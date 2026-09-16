import { describe, expect, it } from 'vitest';
import { gatherInputs, previousClipToPassOn } from '@/engine/RunManager';
import { runRepo } from '@/storage/repos/runRepo';
import { executors } from '@/engine/executors';
import type { ExecutorContext, NodeOutputValue } from '@/engine/types';
import { sourceAllowed } from '@/nodes/ports';
import { createEmptyWorkflow } from '@/storage/repos/workflowRepo';
import { migrateWorkflow, type Workflow, type WorkflowNode } from '@/shared/schema';
import type { DriverAction, FlowGeneratePayload } from '@/shared/messaging';
import type { ComposeVideoJob } from '@/media/composeClient';

const CHARACTER = '5ef8278f-a08d-4b30-a45c-bdd946b37427';
const OUTFIT = 'fcf16651-14f3-4335-9557-0a808bd11946';

function node(id: string, type: WorkflowNode['type'], data: Record<string, unknown>): WorkflowNode {
  return { id, type, position: { x: 0, y: 0 }, data };
}

function edge(source: string, sourceHandle: string, target: string, targetHandle: string, type: string) {
  return { id: `${source}-${target}-${targetHandle}`, source, sourceHandle, target, targetHandle, type } as Workflow['edges'][number];
}

/** Run every node in order through the real executors, recording Flow driver calls. */
async function runGraph(
  wf: Workflow,
  order: string[],
  opts: {
    blobs?: Record<string, Blob>;
    driver?: (action: DriverAction) => unknown;
    onCompose?: (job: ComposeVideoJob) => void;
  } = {},
) {
  const blobs: Record<string, Blob> = opts.blobs ?? {};
  const outputs = new Map<string, NodeOutputValue[]>();
  const calls: Extract<DriverAction, { name: 'generate' }>[] = [];
  for (const id of order) {
    const n = wf.nodes.find((x) => x.id === id)!;
    const ctx: ExecutorContext = {
      runId: 'run-1',
      workflow: wf,
      node: n,
      inputs: gatherInputs(wf, id, outputs),
      signal: new AbortController().signal,
      onProgress: () => undefined,
      resolveSlug: () => undefined,
      getAsset: async (assetId) => blobs[assetId],
      saveOutput: async () => 'out',
      putAsset: async (blob) => {
        const id = `asset:${await blob.text()}`;
        blobs[id] = blob;
        return id;
      },
      patchNodeData: async (patch) => {
        Object.assign(n.data, patch);
      },
      extractLastFrame: async (video) => new Blob([`last-of-${await video.text()}`], { type: 'image/jpeg' }),
      composeVideo: async (job) => {
        opts.onCompose?.(job as ComposeVideoJob);
        const names = await Promise.all(job.clips.map((c) => c.text()));
        return new Blob([`merged(${names.join('+')})`], { type: 'video/mp4' });
      },
      callDriver: async (_provider, action) => {
        if (action.name === 'generate') calls.push(action);
        return (opts.driver?.(action) ?? {
          medias: [{ kind: 'video', mime: 'video/mp4', dataBase64: btoa('clip'), mediaId: `media-of-${id}` }],
        }) as never;
      },
    };
    outputs.set(id, await executors[n.type]!(ctx));
  }
  return { outputs, calls };
}

function flowAsset(id: string, label: string, mediaId: string, kind = 'image') {
  return node(id, 'asset', { assetLabel: label, kind, source: 'flow', flowMediaId: mediaId });
}

describe('prompt node', () => {
  it('keeps [Label] tags, appends descriptions without URLs, and concatenates upstream prompts', async () => {
    const wf = createEmptyWorkflow('w');
    wf.nodes = [
      flowAsset('char', 'Character', CHARACTER),
      flowAsset('outfit', 'Outfit', OUTFIT),
      node('p1', 'prompt', {
        preset: 'custom',
        instruction: '[Character]: Cô gái Đông Á.\n\nScene 1: [Character] walks in.',
      }),
      node('p2', 'prompt', {
        preset: 'custom',
        instruction: '[Outfit]: Áo blazer.\n\nScene 2: [Character] wears [Outfit]. [Background] stays.',
      }),
    ];
    wf.edges = [
      edge('char', 'out:image', 'p1', 'in:image', 'image'),
      edge('p1', 'out:text', 'p2', 'in:text', 'text'),
      edge('outfit', 'out:image', 'p2', 'in:image', 'image'),
    ];

    const { outputs } = await runGraph(wf, ['char', 'outfit', 'p1', 'p2']);
    const [text, ...forwarded] = outputs.get('p2')!;
    expect(text!.text).toBe(
      `Scene 2: [Character] wears [Outfit]. [Background] stays.\n\n` +
        `Scene 1: [Character] walks in.\n\n` +
        `Danh sách tham chiếu\n` +
        `[Outfit]: Áo blazer. · mediaId ${OUTFIT}\n\n` +
        `[Character]: Cô gái Đông Á. · mediaId ${CHARACTER}`,
    );
    expect(text!.text).not.toContain('flow-content.google');
    expect(text!.text).not.toContain('Tham khảo');
    // Both assets travel on to the generator, the upstream one via p1.
    expect(forwarded.map((v) => [v.role, v.flowMediaId])).toEqual([
      ['ref', CHARACTER],
      ['ref', OUTFIT],
    ]);
  });
});

describe('generate node', () => {
  it('references Flow assets by media id and never uploads them', async () => {
    const wf = createEmptyWorkflow('w');
    wf.nodes = [
      flowAsset('char', 'Character', CHARACTER),
      node('p', 'prompt', { preset: 'custom', instruction: '[Character] dances' }),
      node('g', 'generateImage', { model: 'Nano Banana 2', aspectRatio: '9:16', count: 1 }),
    ];
    wf.edges = [edge('char', 'out:image', 'p', 'in:image', 'image'), edge('p', 'out:text', 'g', 'in:text', 'text')];

    const { calls, outputs } = await runGraph(wf, ['char', 'p', 'g'], {
      driver: () => ({ medias: [{ kind: 'image', mime: 'image/png', dataBase64: btoa('png'), mediaId: 'new-image' }] }),
    });
    const payload = calls[0]!.payload as FlowGeneratePayload;
    expect(payload?.prompt).toBe(
      '[Character] dances\n\n' +
        'Danh sách tham chiếu\n' +
        `[Character]: mediaId ${CHARACTER}`,
    );
    expect(payload?.prompt).not.toContain('flow-content.google');
    expect(payload?.refs).toEqual([{ kind: 'image', label: 'Character', mediaId: CHARACTER }]);
    expect(outputs.get('g')![0]!.flowMediaId).toBe('new-image');
  });

  it('refuses a Google Flow asset that lost its media id instead of uploading it', async () => {
    const wf = createEmptyWorkflow('w');
    wf.nodes = [
      node('char', 'asset', { assetLabel: 'Character', kind: 'image', source: 'flow', assetId: 'local-1' }),
    ];
    await expect(
      runGraph(wf, ['char'], { blobs: { 'local-1': new Blob(['png'], { type: 'image/png' }) } }),
    ).rejects.toMatchObject({ code: 'FLOW_ASSET_NO_UPLOAD' });
  });

  it('references a Flow generation by the id in its CDN url, and never uploads one without an id', async () => {
    const wf = createEmptyWorkflow('w');
    wf.nodes = [
      node('p1', 'prompt', { preset: 'custom', instruction: 'still' }),
      node('g1', 'generateImage', { model: 'Nano Banana 2', aspectRatio: '9:16', count: 1 }),
      node('g2', 'generateVideo', { model: 'Veo 3.1 Lite', aspectRatio: '9:16', count: 1, prompt: 'move' }),
    ];
    wf.edges = [edge('p1', 'out:text', 'g1', 'in:text', 'text'), edge('g1', 'out:image', 'g2', 'in:image', 'image')];

    const image = (url?: string) => () => ({
      medias: [{ kind: 'image', mime: 'image/png', dataBase64: btoa('png'), url }],
    });
    const withUrl = await runGraph(wf, ['p1', 'g1'], {
      driver: image(`https://flow-content.google/image/${CHARACTER}?sig=1`),
    });
    expect(withUrl.outputs.get('g1')![0]).toMatchObject({ flowMediaId: CHARACTER, fromFlow: true });

    await expect(runGraph(wf, ['p1', 'g1', 'g2'], { driver: image(undefined) })).rejects.toMatchObject({
      code: 'FLOW_ASSET_NO_UPLOAD',
    });
  });

  it('uploads a local asset with a per-run cache key and leaves its [Label] for the driver', async () => {
    const wf = createEmptyWorkflow('w');
    wf.nodes = [
      node('char', 'asset', { assetLabel: 'Character', kind: 'image', source: 'local', assetId: 'local-1' }),
      node('p', 'prompt', { preset: 'custom', instruction: '[Character] dances' }),
      node('g', 'generateVideo', { model: 'Veo 3.1 Lite', aspectRatio: '9:16', count: 1 }),
    ];
    wf.edges = [edge('char', 'out:image', 'p', 'in:image', 'image'), edge('p', 'out:text', 'g', 'in:text', 'text')];

    const { calls } = await runGraph(wf, ['char', 'p', 'g'], {
      blobs: { 'local-1': new Blob(['png'], { type: 'image/png' }) },
    });
    const payload = calls[0]!.payload as FlowGeneratePayload;
    expect(payload.prompt).toBe('[Character] dances');
    expect(payload.refs?.[0]).toMatchObject({
      kind: 'image',
      label: 'Character',
      upload: { cacheKey: 'run-1:local-1', mime: 'image/png' },
    });
  });

  it('continues from the previous clip when Generate Video feeds the next scene prompt', async () => {
    const wf = createEmptyWorkflow('w');
    wf.nodes = [
      node('p1', 'prompt', { preset: 'custom', instruction: 'Scene 1' }),
      node('v1', 'generateVideo', { model: 'Omni Flash', aspectRatio: '9:16', count: 1 }),
      node('p2', 'prompt', { preset: 'custom', instruction: 'Scene 2' }),
      node('v2', 'generateVideo', { model: 'Omni Flash', aspectRatio: '9:16', count: 1 }),
    ];
    wf.edges = [
      edge('p1', 'out:text', 'v1', 'in:text', 'text'),
      edge('v1', 'out:video', 'p2', 'in:video', 'video'),
      edge('p2', 'out:text', 'v2', 'in:text', 'text'),
    ];

    const { calls } = await runGraph(wf, ['p1', 'v1', 'p2', 'v2']);
    const first = calls[0]!.payload as FlowGeneratePayload;
    const second = calls[1]!.payload as FlowGeneratePayload;
    expect(first.continueFrame).toBeUndefined();
    expect(second.prompt).toBe('Scene 2');
    expect(second.mode).toBe('continue-video');
    expect(second.continueFrame).toEqual({ mime: 'image/jpeg', dataBase64: btoa('last-of-clip') });
    // The Prompt that received the clip keeps its last frame.
    expect(wf.nodes.find((x) => x.id === 'p2')!.data.continueFrameAssetId).toBe('asset:last-of-clip');
  });

  it('regenerates the next scene from the cached last frame after the link is removed', async () => {
    const wf = createEmptyWorkflow('w');
    wf.nodes = [
      node('p2', 'prompt', { preset: 'custom', instruction: 'Scene 2', continueFrameAssetId: 'frame-1' }),
      node('v2', 'generateVideo', { model: 'Omni Flash', aspectRatio: '9:16', count: 1 }),
    ];
    wf.edges = [edge('p2', 'out:text', 'v2', 'in:text', 'text')];

    const { calls } = await runGraph(wf, ['p2', 'v2'], {
      blobs: { 'frame-1': new Blob(['cached-frame'], { type: 'image/jpeg' }) },
    });
    const payload = calls[0]!.payload as FlowGeneratePayload;
    expect(payload.mode).toBe('continue-video');
    expect(payload.continueFrame).toEqual({ mime: 'image/jpeg', dataBase64: btoa('cached-frame') });
  });

  it('refuses a cached last frame whose asset is gone instead of silently starting a new scene', async () => {
    const wf = createEmptyWorkflow('w');
    wf.nodes = [
      node('p2', 'prompt', { preset: 'custom', instruction: 'Scene 2', continueFrameAssetId: 'gone' }),
      node('v2', 'generateVideo', { model: 'Omni Flash', count: 1 }),
    ];
    wf.edges = [edge('p2', 'out:text', 'v2', 'in:text', 'text')];

    await expect(runGraph(wf, ['p2', 'v2'])).rejects.toThrow(/frame cuối đã lưu/);
  });
});

describe('prompt-less Generate Video upstream', () => {
  async function setup(opts: { prompt?: string; downstream?: boolean; stored?: boolean }) {
    const out = opts.stored
      ? await runRepo.saveOutput({ nodeRunId: 'nr', kind: 'video', mime: 'video/mp4', blob: new Blob(['old-clip'], { type: 'video/mp4' }) })
      : undefined;
    const wf = createEmptyWorkflow('w');
    wf.nodes = [
      node('v1', 'generateVideo', { model: 'Omni Flash', prompt: opts.prompt ?? '', previewOutputId: out?.id ?? 'none' }),
      node('p2', 'prompt', { preset: 'custom', instruction: 'Scene 2' }),
    ];
    wf.edges = opts.downstream === false ? [] : [edge('v1', 'out:video', 'p2', 'in:video', 'video')];
    return { wf, v1: wf.nodes[0]!, out };
  }

  it('passes on the clip it made last time when it still feeds another node', async () => {
    const { wf, v1, out } = await setup({ stored: true });
    const clip = await previousClipToPassOn(wf, v1, {});
    expect(clip).toMatchObject({ kind: 'video', outputId: out!.id });
    // fake-indexeddb clones Blobs as plain objects under jsdom; presence is what matters here.
    expect(clip!.blob).toBeTruthy();
    expect(clip!.mime).toBe('video/mp4');
  });

  it('still generates when the node has a prompt, and fails as before without downstream or stored clip', async () => {
    expect(await previousClipToPassOn(...(await args({ stored: true, prompt: 'Scene 1' })))).toBeUndefined();
    expect(await previousClipToPassOn(...(await args({ stored: true, downstream: false })))).toBeUndefined();
    expect(await previousClipToPassOn(...(await args({ stored: false })))).toBeUndefined();
  });

  async function args(opts: Parameters<typeof setup>[0]) {
    const { wf, v1 } = await setup(opts);
    return [wf, v1, {}] as const;
  }
});

describe('connection rules', () => {
  it('matches the node roles', () => {
    expect(sourceAllowed('asset', 'prompt')).toBe(true);
    expect(sourceAllowed('prompt', 'prompt')).toBe(true);
    expect(sourceAllowed('generateVideo', 'prompt')).toBe(true);
    expect(sourceAllowed('prompt', 'generateVideo')).toBe(true);
    expect(sourceAllowed('asset', 'generateImage')).toBe(true);
    expect(sourceAllowed('generateImage', 'generateVideo')).toBe(false);
    expect(sourceAllowed('generateVideo', 'generateVideo')).toBe(false);
    expect(sourceAllowed('generateVideo', 'autoDownload')).toBe(true);
    expect(sourceAllowed('prompt', 'autoDownload')).toBe(false);
  });
});

describe('schema v3', () => {
  it('turns legacy Text nodes into Prompt nodes, keeping their edges', () => {
    const wf = migrateWorkflow({
      id: 'a',
      workspaceId: 'w',
      name: 't',
      schemaVersion: 2,
      nodes: [{ id: 't', type: 'text', position: { x: 0, y: 0 }, data: { content: 'hello [Character]' } }],
      edges: [],
      createdAt: 1,
      updatedAt: 1,
    });
    expect(wf.nodes[0]).toMatchObject({ type: 'prompt', data: { preset: 'custom', instruction: 'hello [Character]' } });
  });
});

describe('merge video node', () => {
  /** Ba clip nối vào node ghép, kèm audio và logo là asset file cục bộ. */
  function mergeGraph(order: string[]) {
    const wf = createEmptyWorkflow('w');
    wf.nodes = [
      node('a', 'asset', { assetLabel: 'Video reference', kind: 'video', assetId: 'blob:a' }),
      node('b', 'asset', { assetLabel: 'Video reference', kind: 'video', assetId: 'blob:b' }),
      node('nhac', 'asset', { assetLabel: 'Audio voice', kind: 'audio', assetId: 'blob:nhac' }),
      node('logo', 'asset', { assetLabel: 'Background', kind: 'image', assetId: 'blob:logo' }),
      node('m', 'mergeVideo', {
        order,
        fps: 24,
        bitrateMbps: 6,
        audioStartSec: 12.5,
        logoXPercent: 70,
        logoYPercent: 5,
        logoWidthPercent: 22,
        logoOpacity: 80,
      }),
    ];
    wf.edges = [
      edge('a', 'out:video', 'm', 'in:video', 'video'),
      edge('b', 'out:video', 'm', 'in:video', 'video'),
      edge('nhac', 'out:audio', 'm', 'in:audio', 'audio'),
      edge('logo', 'out:image', 'm', 'in:image', 'image'),
    ];
    return wf;
  }

  const blobs = {
    'blob:a': new Blob(['a'], { type: 'video/mp4' }),
    'blob:b': new Blob(['b'], { type: 'video/mp4' }),
    'blob:nhac': new Blob(['nhac'], { type: 'audio/mpeg' }),
    'blob:logo': new Blob(['logo'], { type: 'image/png' }),
  };

  it('ghép clip theo thứ tự trên node, kèm audio đã chọn mốc và logo', async () => {
    let job: ComposeVideoJob | undefined;
    const { outputs } = await runGraph(mergeGraph(['b', 'a']), ['a', 'b', 'nhac', 'logo', 'm'], {
      blobs: { ...blobs },
      onCompose: (j) => {
        job = j;
      },
    });

    expect(await Promise.all(job!.clips.map((c) => c.text()))).toEqual(['b', 'a']);
    expect(job!.audio?.startSec).toBe(12.5);
    expect(await job!.audio!.blob.text()).toBe('nhac');
    expect(job!.logo).toMatchObject({ xPercent: 70, widthPercent: 22, opacity: 80 });
    expect(job!.fps).toBe(24);
    expect(job!.bitrateMbps).toBe(6);

    const out = outputs.get('m')!;
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: 'video', mime: 'video/mp4' });
    expect(await out[0]!.blob!.text()).toBe('merged(b+a)');
  });

  it('không có audio/logo thì vẫn ghép, chỉ bỏ hai phần đó', async () => {
    const wf = mergeGraph([]);
    wf.edges = wf.edges.filter((e) => e.source === 'a' || e.source === 'b');
    let job: ComposeVideoJob | undefined;
    await runGraph(wf, ['a', 'b', 'm'], { blobs: { ...blobs }, onCompose: (j) => (job = j) });
    expect(job!.clips).toHaveLength(2);
    expect(job!.audio).toBeUndefined();
    expect(job!.logo).toBeUndefined();
  });

  it('báo lỗi rõ ràng khi chưa nối clip nào', async () => {
    const wf = mergeGraph([]);
    wf.edges = [];
    await expect(runGraph(wf, ['m'], { blobs: { ...blobs } })).rejects.toThrow(/Chưa nối video nào/);
  });

  it('từ chối clip Flow chỉ có media id — không có file để ghép cục bộ', async () => {
    const wf = mergeGraph([]);
    wf.nodes = wf.nodes.map((n) =>
      n.id === 'a'
        ? node('a', 'asset', {
            assetLabel: 'Video reference',
            kind: 'video',
            source: 'flow',
            flowMediaId: 'media-1',
          })
        : n,
    );
    await expect(
      runGraph(wf, ['a', 'b', 'nhac', 'logo', 'm'], { blobs: { ...blobs } }),
    ).rejects.toThrow(/chưa có file để ghép/);
  });
});
