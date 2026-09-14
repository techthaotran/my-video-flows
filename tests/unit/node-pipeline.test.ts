import { describe, expect, it } from 'vitest';
import { gatherInputs } from '@/engine/RunManager';
import { executors } from '@/engine/executors';
import type { ExecutorContext, NodeOutputValue } from '@/engine/types';
import { sourceAllowed } from '@/nodes/ports';
import { createEmptyWorkflow } from '@/storage/repos/workflowRepo';
import { migrateWorkflow, type Workflow, type WorkflowNode } from '@/shared/schema';
import type { DriverAction, FlowGeneratePayload } from '@/shared/messaging';

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
  opts: { blobs?: Record<string, Blob>; driver?: (action: DriverAction) => unknown } = {},
) {
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
      getAsset: async (assetId) => opts.blobs?.[assetId],
      saveOutput: async () => 'out',
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
  it('keeps [Label] tags, appends a URL legend, and concatenates upstream prompts', async () => {
    const wf = createEmptyWorkflow('w');
    wf.nodes = [
      flowAsset('char', 'Character', CHARACTER),
      flowAsset('outfit', 'Outfit', OUTFIT),
      node('p1', 'prompt', { preset: 'custom', instruction: 'Scene 1: [Character] walks in.' }),
      node('p2', 'prompt', { preset: 'custom', instruction: 'Scene 2: [Character] wears [Outfit]. [Background] stays.' }),
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
        `[Character]: Tham khảo https://flow-content.google/image/${CHARACTER}\n\n` +
        `[Outfit]: Tham khảo https://flow-content.google/image/${OUTFIT}`,
    );
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
      `[Character] dances\n\nDanh sách tham chiếu\n[Character]: Tham khảo https://flow-content.google/image/${CHARACTER}`,
    );
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
    expect(first.continueFrom).toBeUndefined();
    expect(second.prompt).toBe('Scene 2');
    expect(second.mode).toBe('continue-video');
    expect(second.continueFrom).toEqual({ mime: 'video/mp4', dataBase64: btoa('clip') });
  });
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
