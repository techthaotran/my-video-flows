import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BatchRpcCmd, BatchRpcResult } from '@/providers/flow/rpc/runner';
import {
  isOmniFlashModel,
  omniTextVideoModel,
  resolveImageModel,
  resolveVideoAspect,
  resolveVideoModel,
  videoModelFallbackChain,
  videoSourceImageAspect,
  VIDEO_ASPECT_LANDSCAPE,
  VIDEO_ASPECT_PORTRAIT,
} from '@/providers/flow/rpc/batch';

const rpc = vi.fn<(tabId: number, cmd: BatchRpcCmd) => Promise<BatchRpcResult>>();

vi.mock('@/providers/flow/rpc/runner', () => ({
  runBatchRpc: (tabId: number, cmd: BatchRpcCmd) => rpc(tabId, cmd),
  reviveTabIfNeeded: async (tabId: number) => tabId,
}));
vi.mock('@/providers/flow/rpc/frame', () => ({
  extractFirstFrame: async () => 'Zmlyc3QtZnJhbWU=',
  extractLastFrame: async () => 'bGFzdC1mcmFtZQ==',
}));
vi.mock('@/providers/flow/rpc/project', () => ({
  resolveFlowProjectId: async () => 'fcf16651-14f3-4335-9557-0a808bd11946',
}));

const { generateViaRpc } = await import('@/providers/flow/rpc/generate');

const PROJECT = 'fcf16651-14f3-4335-9557-0a808bd11946';
const IMAGE_ID = '11111111-1111-1111-1111-111111111111';

function envelope(rpcid: string, inner: unknown): string {
  const chunk = JSON.stringify([['wrb.fr', rpcid, JSON.stringify(inner), null, null, null, 'generic']]);
  return `)]}'\n${chunk.length}\n${chunk}`;
}

function errorEnvelope(rpcid: string, detail: unknown): string {
  const chunk = JSON.stringify([['wrb.fr', rpcid, null, null, null, detail, 'generic']]);
  return `)]}'\n${chunk.length}\n${chunk}`;
}

const DENIED = [7, null, [['type.googleapis.com/google.rpc.ErrorInfo', ['PUBLIC_ERROR_MODEL_ACCESS_DENIED']]]];

function inner(cmd: BatchRpcCmd): unknown[] {
  const outer = JSON.parse(cmd.freq) as unknown[][][];
  return JSON.parse(outer[0]![0]![1] as string) as unknown[];
}

function videoModelOf(cmd: BatchRpcCmd): string {
  const item = (inner(cmd)[0] as unknown[][])[0]!;
  return item[1] as string;
}

function mediaIdFor(op: string) {
  return `aaaaaaaa-0000-0000-0000-${op.slice(-12).padStart(12, '0')}`;
}

/** Fake Flow: denies `deniedModels`, fails `flakyMediaRounds` as29s calls, then serves a video. */
function fakeFlow(opts: {
  deniedModels?: string[];
  flakyMediaRounds?: number;
  /** ogiZ0b calls (1-based) that answer the transient `[8]` rejection. */
  transientImageCalls?: number[];
  /** i2v source media ids eb1hJf answers with `[13]` (INTERNAL). */
  internalSources?: string[];
}) {
  let ops = 0;
  let flaky = opts.flakyMediaRounds ?? 0;
  const submitted: string[] = [];
  const imageItems: unknown[][] = [];
  const calls: string[] = [];
  rpc.mockImplementation(async (_tab, cmd) => {
    calls.push(cmd.rpcid);
    switch (cmd.rpcid) {
      case 'ogiZ0b': {
        const items = inner(cmd)[1] as unknown[][];
        imageItems.push(...items);
        if (opts.transientImageCalls?.includes(calls.filter((c) => c === 'ogiZ0b').length)) {
          return { status: 200, text: errorEnvelope('ogiZ0b', [8]) };
        }
        const id = `22222222-2222-2222-2222-${String(imageItems.length).padStart(12, '0')}`;
        return {
          status: 200,
          text: envelope('ogiZ0b', [[`https://flow-content.google/image/${id}?sig=1`]]),
        };
      }
      case 'maseQ':
        return { status: 200, text: envelope('maseQ', [[IMAGE_ID, PROJECT, 'op', 'CAE']]) };
      case 'YhhmEf': {
        submitted.push(videoModelOf(cmd));
        const mediaId = `bbbbbbbb-0000-0000-0000-${String(submitted.length).padStart(12, '0')}`;
        return { status: 200, text: envelope('YhhmEf', [null, null, null, [[mediaId, PROJECT, 'wf', 'PENDING']]]) };
      }
      case 'eb1hJf': {
        const model = videoModelOf(cmd);
        submitted.push(model);
        if (opts.deniedModels?.includes(model)) {
          return { status: 200, text: errorEnvelope('eb1hJf', DENIED) };
        }
        const item = (inner(cmd)[0] as unknown[][])[0]!;
        if (opts.internalSources?.includes((item[4] as unknown[])[1] as string)) {
          return { status: 200, text: errorEnvelope('eb1hJf', [13]) };
        }
        const op = `op-${String(++ops).padStart(12, '0')}`;
        return { status: 200, text: envelope('eb1hJf', [null, 50, [[op, PROJECT, 'scene', null]]]) };
      }
      case 'jwpduf': {
        const op = ((inner(cmd)[2] as string[][])[0]!)[0]!;
        return { status: 200, text: envelope('jwpduf', [null, 50, [[op, PROJECT, 'scene', 'CAE']]]) };
      }
      case 'Zzl0ze': {
        const op = cmd.match;
        if (!op) return { status: 200, text: `)]}'\n2\n[]` };
        return { status: 200, text: `${op}\\",null,null,[\\"t\\",[1],null,null,\\"${mediaIdFor(op)}\\"]` };
      }
      case 'as29s': {
        if (flaky > 0) {
          flaky--;
          return { error: 'Could not establish connection' };
        }
        const mediaId = inner(cmd)[0] as string;
        return {
          status: 200,
          text: envelope('as29s', [[`https://flow-content.google/video/${mediaId}?sig=1`]]),
        };
      }
      default:
        throw new Error(`unexpected rpc ${cmd.rpcid}`);
    }
  });
  return { submitted, imageItems, calls };
}

async function run(payload: Record<string, unknown>) {
  const promise = generateViaRpc(
    1,
    { mode: 'text-to-video', prompt: 'hello', aspectRatio: '9:16', ...payload },
    () => undefined,
    new AbortController().signal,
  );
  promise.catch(() => undefined);
  await vi.runAllTimersAsync();
  return promise;
}

beforeEach(() => {
  vi.useFakeTimers();
  rpc.mockReset();
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('video aspect', () => {
  it('snaps every UI ratio to a video orientation', () => {
    expect(resolveVideoAspect('4:3')).toBe(VIDEO_ASPECT_LANDSCAPE);
    expect(resolveVideoAspect('3:4')).toBe(VIDEO_ASPECT_PORTRAIT);
    expect(resolveVideoAspect('1:1')).toBe(VIDEO_ASPECT_LANDSCAPE);
    expect(videoSourceImageAspect('3:4')).toBe('9:16');
    expect(videoSourceImageAspect('1:1')).toBe('16:9');
  });
});

describe('video model fallback chain', () => {
  it('puts the pinned wire model first, then only Veo keys, without duplicates', () => {
    const chain = videoModelFallbackChain('Veo 3.1 Lite Low Priority', 'captured_model');
    expect(chain[0]).toBe('captured_model');
    expect(chain[1]).toBe('veo_3_1_i2v_lite_low_priority');
    expect(chain.slice(1).every((m) => m.startsWith('veo_'))).toBe(true);
    expect(new Set(chain).size).toBe(chain.length);
  });
});

describe('model mapping', () => {
  it('maps image labels (current and legacy) to Flow wire ids', () => {
    expect(resolveImageModel('Nano Banana 2')).toBe('NARWHAL');
    expect(resolveImageModel('Nano Banana 2 Lite')).toBe('HARBOR_SEAL');
    expect(resolveImageModel('NANO_BANANA_2_LITE')).toBe('HARBOR_SEAL');
    expect(resolveImageModel('Nano Banana Pro')).toBe('NARWHAL');
    expect(resolveImageModel('google nano banana')).toBe('NARWHAL');
    expect(resolveImageModel('SOME_FUTURE_MODEL')).toBe('SOME_FUTURE_MODEL');
    expect(resolveImageModel('Omni Flash')).toBe('NARWHAL');
  });

  it('never maps Omni Flash onto a Veo key', () => {
    expect(isOmniFlashModel('Omni Flash')).toBe(true);
    expect(isOmniFlashModel('google omni flash')).toBe(true);
    expect(isOmniFlashModel('omni-flash')).toBe(true);
    expect(isOmniFlashModel('abra_t2v_4s')).toBe(true);
    expect(isOmniFlashModel('Veo 3.1 Lite')).toBe(false);
    expect(resolveVideoModel('Veo 3.1 Fast (Ultra)')).toBe('veo_3_1_i2v_s_fast_ultra');
    expect(resolveVideoModel('veo')).toBe('veo_3_1_i2v_lite');
  });

  it('snaps Omni duration to 4/6/8/10', () => {
    expect(omniTextVideoModel(4)).toBe('abra_t2v_4s');
    expect(omniTextVideoModel(5)).toBe('abra_t2v_4s');
    expect(omniTextVideoModel(7)).toBe('abra_t2v_6s');
    expect(omniTextVideoModel(undefined)).toBe('abra_t2v_8s');
    expect(omniTextVideoModel(30)).toBe('abra_t2v_10s');
  });
});

describe('generateViaRpc video', () => {
  const veoStart = { refs: [{ kind: 'image' as const, mediaId: IMAGE_ID }] };

  it('walks past denied models and reports every one when all are denied', async () => {
    const all = videoModelFallbackChain('Veo 3.1 Lite');
    const { submitted } = fakeFlow({ deniedModels: all });
    await expect(run({ model: 'Veo 3.1 Lite', ...veoStart })).rejects.toThrow(/MODEL_ACCESS_DENIED với mọi model Veo đã thử/);
    expect(submitted).toEqual(all);
  });

  it('survives transient poll failures instead of failing the job', async () => {
    fakeFlow({ flakyMediaRounds: 2 });
    const result = await run({ model: 'Veo 3.1 Lite', ...veoStart });
    expect(result.medias).toHaveLength(1);
    expect(result.medias![0]!.url).toContain('/video/');
  });

  it('submits one generation per requested output, reusing the accepted model', async () => {
    const denied = videoModelFallbackChain('Veo 3.1 Lite')[0]!;
    const { submitted } = fakeFlow({ deniedModels: [denied] });
    const result = await run({ model: 'Veo 3.1 Lite', outputsPerPrompt: 2, ...veoStart });
    expect(result.medias).toHaveLength(2);
    expect(submitted).toHaveLength(3);
    expect(submitted[1]).toBe(submitted[2]);
  });

  it('fails fast when the listing call is unauthorized', async () => {
    fakeFlow({});
    const base = rpc.getMockImplementation()!;
    rpc.mockImplementation(async (tab, cmd) =>
      cmd.rpcid === 'Zzl0ze' ? { status: 401, text: '' } : base(tab, cmd),
    );
    await expect(run({ model: 'Veo 3.1 Lite', ...veoStart })).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
  });

  it('refuses Veo without a start frame instead of inventing a mid-scene image', async () => {
    const { calls } = fakeFlow({});
    await expect(run({ model: 'Veo 3.1 Lite' })).rejects.toThrow(/không tạo ảnh trung gian/i);
    expect(calls).not.toContain('ogiZ0b');
    expect(calls).not.toContain('eb1hJf');
  });
});

describe('generateViaRpc Omni Flash', () => {
  it('text-only Omni Flash goes through YhhmEf with the duration key, never eb1hJf', async () => {
    const { submitted, calls } = fakeFlow({});
    const result = await run({ model: 'Omni Flash', durationSec: 6 });
    expect(submitted).toEqual(['abra_t2v_6s']);
    expect(calls).not.toContain('eb1hJf');
    expect(calls).not.toContain('jwpduf');
    expect(calls).not.toContain('ogiZ0b');
    expect(result.medias![0]!.url).toContain('/video/bbbbbbbb-');
  });

  it('Omni Flash with asset links stays on YhhmEf — no mid-scene image, no Veo fallback', async () => {
    const { submitted, calls } = fakeFlow({});
    await run({
      model: 'google omni flash',
      mode: 'ingredients-to-video',
      prompt: `https://flow-content.google/image/${IMAGE_ID} character with outfit`,
      refs: [
        { kind: 'image', label: 'Character', mediaId: IMAGE_ID },
        { kind: 'image', label: 'Outfit', mediaId: '33333333-3333-3333-3333-333333333333' },
      ],
    });
    expect(submitted).toEqual(['abra_t2v_8s']);
    expect(calls).toContain('YhhmEf');
    expect(calls).not.toContain('ogiZ0b');
    expect(calls).not.toContain('eb1hJf');
  });

  it('recovers an Omni clip from the project listing when submit parse fails', async () => {
    const newVideo = 'cccccccc-0000-0000-0000-000000000099';
    fakeFlow({});
    const base = rpc.getMockImplementation()!;
    let zzl = 0;
    rpc.mockImplementation(async (tab, cmd) => {
      if (cmd.rpcid === 'YhhmEf') {
        // HTTP 200 success prefix but unreadable payload shape.
        return { status: 200, text: `)]}'\n12\n[["wrb.fr","YhhmEf","{}",null,null,null,"generic"]]` };
      }
      if (cmd.rpcid === 'Zzl0ze') {
        zzl++;
        // First call = pre-submit snapshot (empty). Later = new clip on Flow.
        if (zzl === 1) return { status: 200, text: `)]}'\n2\n[]` };
        return {
          status: 200,
          text: `https://flow-content.google/video/${newVideo}?sig=1`,
        };
      }
      if (cmd.rpcid === 'as29s') {
        const mediaId = inner(cmd)[0] as string;
        return {
          status: 200,
          text: envelope('as29s', [[`https://flow-content.google/video/${mediaId}?sig=1`]]),
        };
      }
      return base(tab, cmd);
    });
    const result = await run({ model: 'Omni Flash', durationSec: 4 });
    expect(zzl).toBeGreaterThan(1);
    expect(result.medias![0]!.url).toContain(newVideo);
  });
});

describe('generateViaRpc references', () => {
  function sourceOf(cmd: BatchRpcCmd): string {
    const item = (inner(cmd)[0] as unknown[][])[0]!;
    return (item[4] as unknown[])[1] as string;
  }

  it('uses a Flow asset as the i2v source by media id — no upload, no scene composition', async () => {
    const { calls } = fakeFlow({});
    const sources: string[] = [];
    const base = rpc.getMockImplementation()!;
    rpc.mockImplementation(async (tab, cmd) => {
      if (cmd.rpcid === 'eb1hJf') sources.push(sourceOf(cmd));
      return base(tab, cmd);
    });
    await run({ model: 'Veo 3.1 Lite', refs: [{ kind: 'image', label: 'Character', mediaId: IMAGE_ID }] });
    expect(calls).not.toContain('maseQ');
    expect(calls).not.toContain('ogiZ0b');
    expect(sources).toEqual([IMAGE_ID]);
  });

  it('surfaces a Flow-internal [13] submit failure immediately — no auto-retry', async () => {
    const { calls } = fakeFlow({ internalSources: [IMAGE_ID] });
    await expect(
      run({ model: 'Veo 3.1 Lite', refs: [{ kind: 'image', mediaId: IMAGE_ID }] }),
    ).rejects.toThrow(/lỗi nội bộ phía Google Flow/);
    // One submit attempt only — no recompose, no cooldown-and-resubmit.
    expect(calls.filter((c) => c === 'eb1hJf')).toHaveLength(1);
    expect(calls).not.toContain('ogiZ0b');
  });

  it('passes Flow asset ids as image references and annotates labels after upload', async () => {
    const { calls, imageItems } = fakeFlow({});
    const payload = {
      mode: 'text-to-image',
      model: 'Nano Banana 2',
      prompt: '[Outfit] on [Character]',
      refs: [
        { kind: 'image', label: 'Character', mediaId: '33333333-3333-3333-3333-333333333333' },
        { kind: 'image', label: 'Outfit', upload: { name: 'o.png', mime: 'image/png', dataBase64: 'aGVsbG8=', cacheKey: 'run-9:o' } },
      ],
    };
    await run(payload);
    await run(payload);
    // The local file is uploaded once for the run, the Flow asset never.
    expect(calls.filter((c) => c === 'maseQ')).toHaveLength(1);
    const item = imageItems[0]!;
    expect((item[2] as unknown[][]).map((r) => r[0])).toEqual(['33333333-3333-3333-3333-333333333333', IMAGE_ID]);
    const prompt = (item[8] as string[][][])[0]![0]![0]!;
    expect(prompt).toBe(
      `[Outfit] on [Character]\n\n` +
        `Danh sách tham chiếu\n` +
        `[Character]: Tham khảo https://flow-content.google/image/33333333-3333-3333-3333-333333333333\n\n` +
        `[Outfit]: Tham khảo https://flow-content.google/image/${IMAGE_ID}`,
    );
  });

  it('Veo with several assets uses the first as start frame only — never ogiZ0b', async () => {
    const second = '33333333-3333-3333-3333-333333333333';
    const { calls } = fakeFlow({});
    const sources: string[] = [];
    const base = rpc.getMockImplementation()!;
    rpc.mockImplementation(async (tab, cmd) => {
      if (cmd.rpcid === 'eb1hJf') sources.push(sourceOf(cmd));
      return base(tab, cmd);
    });
    await run({
      model: 'Veo 3.1 Lite',
      refs: [
        { kind: 'image', label: 'Character', mediaId: IMAGE_ID },
        { kind: 'image', label: 'Outfit', mediaId: second },
      ],
    });
    expect(calls).not.toContain('ogiZ0b');
    expect(sources).toEqual([IMAGE_ID]);
  });

  it('starts the next scene from the last frame of the previous clip', async () => {
    const { calls } = fakeFlow({});
    const sources: string[] = [];
    const base = rpc.getMockImplementation()!;
    rpc.mockImplementation(async (tab, cmd) => {
      if (cmd.rpcid === 'eb1hJf') sources.push(sourceOf(cmd));
      return base(tab, cmd);
    });
    await run({
      model: 'Omni Flash',
      mode: 'continue-video',
      continueFrom: { mime: 'video/mp4', dataBase64: 'Y2xpcA==' },
    });
    expect(calls[0]).toBe('maseQ');
    expect(calls).toContain('eb1hJf');
    expect(calls).not.toContain('YhhmEf');
    expect(calls).not.toContain('ogiZ0b');
    expect(sources).toEqual([IMAGE_ID]);
  });
});

describe('generateViaRpc image', () => {
  it('sends one single-item ogiZ0b per variant with the mapped model', async () => {
    const { imageItems, calls } = fakeFlow({});
    const result = await run({ mode: 'text-to-image', model: 'Nano Banana 2 Lite', outputsPerPrompt: 3 });
    expect(calls.filter((c) => c === 'ogiZ0b')).toHaveLength(3);
    expect(imageItems.map((item) => item[5])).toEqual(['HARBOR_SEAL', 'HARBOR_SEAL', 'HARBOR_SEAL']);
    expect(new Set(imageItems.map((item) => item[3])).size).toBe(3);
    expect(result.medias).toHaveLength(3);
  });

  it('retries a transient [8] variant once and keeps the others', async () => {
    const { calls } = fakeFlow({ transientImageCalls: [2] });
    const result = await run({ mode: 'text-to-image', model: 'Nano Banana 2', outputsPerPrompt: 2 });
    expect(calls.filter((c) => c === 'ogiZ0b')).toHaveLength(3);
    expect(result.medias).toHaveLength(2);
  });
});

describe('readProjectMediaPage', () => {
  const wrap = (payload: unknown) =>
    `)]}'\n\n123\n${JSON.stringify([['wrb.fr', 'Zzl0ze', JSON.stringify(payload), null, null, null, 'generic']])}`;
  const project = 'fcf16651-14f3-4335-9557-0a808bd11946';
  const id = (n: number) => `0000000${n}-1111-4222-8333-444455556666`;
  const wf = (n: number) => `ffffff0${n}-1111-4222-8333-444455556666`;

  it('reads media records ([mediaId, projectId, …]) even without urls, newest first', async () => {
    const { readProjectMediaPage } = await import('@/providers/flow/rpc/batch');
    const page = readProjectMediaPage(
      wrap([
        null,
        // workflows: [id, null, null, …] — not media
        [[wf(1), null, null, 1], [wf(2), null, null, 2]],
        [
          [id(1), project, wf(1), [1757000000, 0]],
          [id(2), project, wf(2), [1757900000, 0], [`https://flow-content.google/video/${id(2)}?sig=b`]],
          [id(3), project, wf(1), [1757500000, 0]],
        ],
      ]),
    );
    expect(page.items.map((i) => i.mediaId)).toEqual([id(2), id(3), id(1)]);
    expect(page.items[0]).toMatchObject({ kind: 'video', url: `https://flow-content.google/video/${id(2)}?sig=b`, createdAt: 1757900000_000 });
    expect(page.items[1]!.kind).toBeUndefined();
    expect(page.nextPageToken).toBeNull();
  });

  it('keeps listing order and picks up a trailing page token', async () => {
    const { readProjectMediaPage } = await import('@/providers/flow/rpc/batch');
    const page = readProjectMediaPage(
      wrap([null, [[id(1), project, wf(1)], [id(2), project, wf(2)]], 'CgwI6f7zxQYQgPSm3AMSJGFiY2Q']),
    );
    expect(page.items.map((i) => i.mediaId)).toEqual([id(1), id(2)]);
    expect(page.nextPageToken).toBe('CgwI6f7zxQYQgPSm3AMSJGFiY2Q');
  });
});
