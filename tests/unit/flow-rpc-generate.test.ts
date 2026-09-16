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
import { clearLogs, getLogs } from '@/shared/log';
import { strings } from '@/shared/strings';

const rpc = vi.fn<(tabId: number, cmd: BatchRpcCmd) => Promise<BatchRpcResult>>();

vi.mock('@/providers/flow/rpc/runner', () => ({
  runBatchRpc: (tabId: number, cmd: BatchRpcCmd) => rpc(tabId, cmd),
  reviveTabIfNeeded: async (tabId: number) => tabId,
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
  // YhhmEf / eb1hJf: model at [1]; MZZa6b: model at [2] (item[1] is refs list).
  if (cmd.rpcid === 'MZZa6b') return item[2] as string;
  return item[1] as string;
}

function refMediaIdsOf(cmd: BatchRpcCmd): string[] {
  const item = (inner(cmd)[0] as unknown[][])[0]!;
  const refs = item[1] as unknown[];
  return refs.map((r) => (r as unknown[])[1] as string);
}

function mediaIdFor(op: string) {
  return `aaaaaaaa-0000-0000-0000-${op.slice(-12).padStart(12, '0')}`;
}

/** Fake Flow: denies `deniedModels`, fails `flakyMediaRounds` as29s calls, then serves a video. */
function fakeFlow(opts: {
  deniedModels?: string[];
  flakyMediaRounds?: number;
  /** as29s calls that answer `[5]` (media not ready) before returning a url. */
  as29sNotReadyRounds?: number;
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
      case 'MZZa6b': {
        submitted.push(videoModelOf(cmd));
        const mediaId = `dddddddd-0000-0000-0000-${String(submitted.length).padStart(12, '0')}`;
        return { status: 200, text: envelope('MZZa6b', [null, null, null, [[mediaId, PROJECT, 'wf', 'PENDING']]]) };
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
        const target = ((inner(cmd)[2] as string[][])[0]!)[0]!;
        if (target.startsWith('op-')) {
          return { status: 200, text: envelope('jwpduf', [null, 50, [[target, PROJECT, 'scene', 'CAE']]]) };
        }
        const genParams = new Array(9).fill(null);
        genParams[8] = [3];
        const wf = [target, PROJECT, null, null, null, genParams, null, null];
        return { status: 200, text: envelope('jwpduf', [null, 50, [wf]]) };
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
        if (opts.as29sNotReadyRounds && opts.as29sNotReadyRounds > 0) {
          opts.as29sNotReadyRounds--;
          return { status: 200, text: errorEnvelope('as29s', [5]) };
        }
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

function payloadLogRefs(rpcid?: string): Array<{ label?: string; mediaId: string; role?: string; source?: string }> {
  const entry = getLogs().find(
    (e) =>
      e.message.startsWith('payload →') &&
      e.scope === 'rpc' &&
      (rpcid == null || e.message.includes(rpcid) || (e.data as { rpcid?: string } | undefined)?.rpcid === rpcid),
  );
  const data = entry?.data as
    | { refs?: Array<{ label?: string; mediaId: string; role?: string; source?: string }>; rpcid?: string }
    | undefined;
  return data?.refs ?? [];
}

beforeEach(() => {
  vi.useFakeTimers();
  rpc.mockReset();
  clearLogs();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.mocked(console.warn).mockRestore();
  vi.mocked(console.error).mockRestore();
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
    expect(calls).not.toContain('ogiZ0b');
    expect(calls).not.toContain('MZZa6b');
    expect(calls.filter((c) => c === 'jwpduf').length).toBeGreaterThan(0);
    expect(result.medias![0]!.url).toContain('/video/bbbbbbbb-');
  });

  it('keeps polling when as29s returns [5] before the clip is ready', async () => {
    fakeFlow({ as29sNotReadyRounds: 3 });
    const result = await run({ model: 'Omni Flash', durationSec: 4 });
    expect(result.medias![0]!.url).toContain('/video/bbbbbbbb-');
    expect(rpc.mock.calls.filter((c) => c[1].rpcid === 'as29s').length).toBeGreaterThan(3);
  });

  it('fails immediately when jwpduf reports workflow render failure', async () => {
    fakeFlow({});
    const base = rpc.getMockImplementation()!;
    rpc.mockImplementation(async (tab, cmd) => {
      if (cmd.rpcid === 'jwpduf') {
        const target = ((inner(cmd)[2] as string[][])[0]!)[0]!;
        const genParams = new Array(9).fill(null);
        genParams[8] = [4, ['PUBLIC_ERROR_PROMINENT_PEOPLE_FILTER_FAILED'], ['PROMINENT_PERSON']];
        const wf = [target, PROJECT, null, null, null, genParams, null, null];
        return { status: 200, text: envelope('jwpduf', [null, 50, [wf]]) };
      }
      return base(tab, cmd);
    });
    const promise = run({ model: 'Omni Flash', durationSec: 4 });
    promise.catch(() => undefined);
    await vi.runAllTimersAsync();
    await expect(promise).rejects.toMatchObject({ code: 'FLOW_RENDER_FAILED' });
    await expect(promise).rejects.toThrow(/người nổi tiếng/i);
    expect(rpc.mock.calls.filter((c) => c[1].rpcid === 'jwpduf').length).toBe(1);
  });

  it('Omni Flash with 2 Flow image refs goes through MZZa6b once per count', async () => {
    const outfit = '33333333-3333-3333-3333-333333333333';
    const { submitted, calls } = fakeFlow({});
    const result = await run({
      model: 'google omni flash',
      mode: 'ingredients-to-video',
      durationSec: 4,
      outputsPerPrompt: 2,
      prompt: `[Character] with [Outfit]`,
      refs: [
        { kind: 'image', label: 'Character', mediaId: IMAGE_ID },
        { kind: 'image', label: 'Outfit', mediaId: outfit },
      ],
    });
    expect(submitted).toEqual(['abra_r2v_4s', 'abra_r2v_4s']);
    expect(calls.filter((c) => c === 'MZZa6b')).toHaveLength(2);
    expect(calls).not.toContain('YhhmEf');
    expect(calls).not.toContain('ogiZ0b');
    expect(calls).not.toContain('eb1hJf');
    expect(calls).not.toContain('maseQ');
    expect(result.medias).toHaveLength(2);

    const mz = rpc.mock.calls.map((c) => c[1]).filter((c) => c.rpcid === 'MZZa6b');
    expect(refMediaIdsOf(mz[0]!)).toEqual([IMAGE_ID, outfit]);
    const item = (inner(mz[0]!)[0] as unknown[][])[0]!;
    const parts = ((item[0] as unknown[])[2] as unknown[])[0] as unknown[];
    const imageIds = parts
      .filter((p) => Array.isArray(p) && p[0] === null)
      .map((p) => ((p as unknown[])[1] as unknown[][])[0]![0]);
    expect(imageIds).toEqual([IMAGE_ID, outfit]);
  });

  it('Omni Flash with one local image uploads once then MZZa6b', async () => {
    const { calls } = fakeFlow({});
    await run({
      model: 'Omni Flash',
      durationSec: 8,
      prompt: '[Character] walks',
      refs: [
        {
          kind: 'image',
          label: 'Character',
          upload: {
            name: 'face.jpg',
            mime: 'image/jpeg',
            dataBase64: 'ZmFrZQ==',
            cacheKey: 'run1:local-char',
          },
        },
      ],
    });
    expect(calls.filter((c) => c === 'maseQ')).toHaveLength(1);
    expect(calls).toContain('MZZa6b');
    expect(calls).not.toContain('YhhmEf');
    const mz = rpc.mock.calls.map((c) => c[1]).find((c) => c.rpcid === 'MZZa6b')!;
    expect(videoModelOf(mz)).toBe('abra_r2v_8s');
    expect(refMediaIdsOf(mz)).toEqual([IMAGE_ID]);
  });

  it('Omni Flash with too many image refs fails before upload / captcha', async () => {
    const { calls } = fakeFlow({});
    const refs = Array.from({ length: 8 }, (_, i) => ({
      kind: 'image' as const,
      label: `R${i}`,
      mediaId: `aaaaaaaa-bbbb-cccc-dddd-${String(i).padStart(12, '0')}`,
    }));
    await expect(run({ model: 'Omni Flash', refs })).rejects.toMatchObject({
      code: 'OMNI_TOO_MANY_REFS',
    });
    expect(calls).not.toContain('maseQ');
    expect(calls).not.toContain('MZZa6b');
    expect(calls).not.toContain('YhhmEf');
  });

  it('rejects video refs for Omni before submit', async () => {
    const { calls } = fakeFlow({});
    await expect(
      run({
        model: 'Omni Flash',
        refs: [{ kind: 'video', label: 'Video reference', mediaId: IMAGE_ID }],
      }),
    ).rejects.toThrow(/video/);
    expect(calls).not.toContain('YhhmEf');
    expect(calls).not.toContain('MZZa6b');
  });

  it('rejects audio refs for Omni before submit', async () => {
    const { calls } = fakeFlow({});
    await expect(
      run({
        model: 'Omni Flash',
        refs: [{ kind: 'audio', label: 'Audio voice', mediaId: IMAGE_ID }],
      }),
    ).rejects.toThrow(/audio/);
    expect(calls).not.toContain('YhhmEf');
    expect(calls).not.toContain('MZZa6b');
  });

  it('Omni Flash with Character + Background Flow images goes through MZZa6b', async () => {
    const background = '33333333-3333-3333-3333-333333333333';
    const { calls } = fakeFlow({});
    await run({
      model: 'Omni Flash',
      durationSec: 4,
      prompt: '[Character] walks in [Background]',
      refs: [
        { kind: 'image', label: 'Character', mediaId: IMAGE_ID },
        { kind: 'image', label: 'Background', mediaId: background },
      ],
    });
    expect(calls.filter((c) => c === 'MZZa6b')).toHaveLength(1);
    expect(calls).not.toContain('YhhmEf');
    expect(calls).not.toContain('maseQ');
    const mz = rpc.mock.calls.map((c) => c[1]).find((c) => c.rpcid === 'MZZa6b')!;
    expect(refMediaIdsOf(mz)).toEqual([IMAGE_ID, background]);
    const item = (inner(mz)[0] as unknown[][])[0]!;
    const parts = ((item[0] as unknown[])[2] as unknown[])[0] as unknown[];
    const imageIds = parts
      .filter((p) => Array.isArray(p) && p[0] === null)
      .map((p) => ((p as unknown[])[1] as unknown[][])[0]![0]);
    expect(imageIds).toEqual([IMAGE_ID, background]);
  });

  it('recovers an Omni clip from the project listing when submit parse fails', async () => {
    const newVideo = 'cccccccc-0000-0000-0000-000000000099';
    fakeFlow({});
    const base = rpc.getMockImplementation()!;
    let zzl = 0;
    rpc.mockImplementation(async (tab, cmd) => {
      if (cmd.rpcid === 'YhhmEf') {
        return { status: 200, text: `)]}'\n12\n[["wrb.fr","YhhmEf","{}",null,null,null,"generic"]]` };
      }
      if (cmd.rpcid === 'Zzl0ze') {
        zzl++;
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

  it('recovers Omni reference clip via orphan-poll when MZZa6b parse fails', async () => {
    const newVideo = 'eeeeeeee-0000-0000-0000-000000000088';
    fakeFlow({});
    const base = rpc.getMockImplementation()!;
    let zzl = 0;
    rpc.mockImplementation(async (tab, cmd) => {
      if (cmd.rpcid === 'MZZa6b') {
        return { status: 200, text: `)]}'\n12\n[["wrb.fr","MZZa6b","{}",null,null,null,"generic"]]` };
      }
      if (cmd.rpcid === 'Zzl0ze') {
        zzl++;
        if (zzl === 1) return { status: 200, text: `)]}'\n2\n[]` };
        return { status: 200, text: `https://flow-content.google/video/${newVideo}?sig=1` };
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
    const result = await run({
      model: 'Omni Flash',
      durationSec: 4,
      prompt: '[Character] walks',
      refs: [{ kind: 'image', label: 'Character', mediaId: IMAGE_ID }],
    });
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
    const refs = payloadLogRefs('eb1hJf');
    expect(refs[0]).toMatchObject({
      label: 'Character',
      mediaId: IMAGE_ID,
      role: 'startFrame',
      source: 'flow',
    });
    expect(refs).toHaveLength(1);
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

  it('passes Flow asset ids as image references and keeps [Label] without URLs', async () => {
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
      '[Outfit] on [Character]\n\n' +
        'Danh sách tham chiếu\n' +
        '[Character]: mediaId 33333333-3333-3333-3333-333333333333\n\n' +
        `[Outfit]: mediaId ${IMAGE_ID}`,
    );
    expect(prompt).not.toContain('flow-content.google');
  });

  it('Veo with several assets fails before submit', async () => {
    const second = '33333333-3333-3333-3333-333333333333';
    const { calls } = fakeFlow({});
    await expect(
      run({
        model: 'Veo 3.1 Lite',
        refs: [
          { kind: 'image', label: 'Character', mediaId: IMAGE_ID },
          { kind: 'image', label: 'Outfit', mediaId: second },
        ],
      }),
    ).rejects.toThrow(/Veo chỉ nhận 1 ảnh/);
    expect(calls).not.toContain('eb1hJf');
    expect(calls).not.toContain('ogiZ0b');
  });

  it('rejects orphan Flow URLs in the prompt', async () => {
    await expect(
      run({
        model: 'Veo 3.1 Lite',
        prompt: 'https://flow-content.google/image/99999999-9999-9999-9999-999999999999 alone',
        refs: [{ kind: 'image', label: 'Character', mediaId: IMAGE_ID }],
      }),
    ).rejects.toThrow(/link Flow không gắn asset/);
  });

  it('restores a matching Flow URL in an old prompt to [Label]', async () => {
    const { calls } = fakeFlow({});
    const prompts: string[] = [];
    const base = rpc.getMockImplementation()!;
    rpc.mockImplementation(async (tab, cmd) => {
      if (cmd.rpcid === 'eb1hJf') {
        const item = (inner(cmd)[0] as unknown[][])[0]!;
        prompts.push((((item[0] as unknown[])[2] as string[][][])[0]![0]![0] as string));
      }
      return base(tab, cmd);
    });
    await run({
      model: 'Veo 3.1 Lite',
      prompt: `https://flow-content.google/image/${IMAGE_ID} walks`,
      refs: [{ kind: 'image', label: 'Character', mediaId: IMAGE_ID }],
    });
    expect(prompts[0]).toBe(
      '[Character] walks\n\n' +
        'Danh sách tham chiếu\n' +
        `[Character]: mediaId ${IMAGE_ID}`,
    );
    expect(calls).toContain('eb1hJf');
  });
  it('continues an Omni scene through MZZa6b with the last frame as the first image', async () => {
    const { calls, submitted } = fakeFlow({});
    const freqs: BatchRpcCmd[] = [];
    const base = rpc.getMockImplementation()!;
    rpc.mockImplementation(async (tab, cmd) => {
      if (cmd.rpcid === 'MZZa6b') freqs.push(cmd);
      return base(tab, cmd);
    });
    const BG = '33333333-3333-3333-3333-333333333333';
    const result = await run({
      model: 'Omni Flash',
      mode: 'continue-video',
      durationSec: 4,
      continueFrame: { mime: 'image/jpeg', dataBase64: 'bGFzdC1mcmFtZQ==' },
      prompt: '[Character] mặc [Outfit] trong [Background]',
      refs: [
        { kind: 'image', label: 'Character', mediaId: '44444444-4444-4444-4444-444444444444' },
        { kind: 'image', label: 'Outfit', mediaId: '55555555-5555-5555-5555-555555555555' },
        { kind: 'image', label: 'Background', mediaId: BG },
      ],
    });
    expect(calls[0]).toBe('maseQ');
    expect(calls.filter((c) => c === 'maseQ')).toHaveLength(1);
    expect(calls).toContain('MZZa6b');
    expect(calls).not.toContain('eb1hJf');
    expect(calls).not.toContain('YhhmEf');
    expect(calls).not.toContain('ogiZ0b');
    expect(submitted).toEqual(['abra_r2v_4s']);
    expect(refMediaIdsOf(freqs[0]!)).toEqual([
      IMAGE_ID,
      '44444444-4444-4444-4444-444444444444',
      '55555555-5555-5555-5555-555555555555',
      BG,
    ]);
    const refs = payloadLogRefs('MZZa6b');
    expect(refs[0]).toMatchObject({
      label: strings.continueFrameRefLabel,
      mediaId: IMAGE_ID,
      source: 'upload',
    });
    expect(result.medias).toHaveLength(1);
  });

  it('counts the last frame against the Omni reference cap', async () => {
    const { calls } = fakeFlow({});
    const refs = Array.from({ length: 7 }, (_, i) => ({
      kind: 'image' as const,
      label: `Ref${i}`,
      mediaId: `6666666${i}-6666-6666-6666-666666666666`,
    }));
    await expect(
      run({
        model: 'Omni Flash',
        mode: 'continue-video',
        continueFrame: { mime: 'image/jpeg', dataBase64: 'bGFzdC1mcmFtZQ==' },
        refs,
      }),
    ).rejects.toMatchObject({ code: 'OMNI_TOO_MANY_REFS' });
    expect(calls).not.toContain('maseQ');
  });

  it('fails immediately when Veo operation complains Media not found', async () => {
    fakeFlow({});
    const base = rpc.getMockImplementation()!;
    rpc.mockImplementation(async (tab, cmd) => {
      if (cmd.rpcid === 'jwpduf') {
        const target = ((inner(cmd)[2] as string[][])[0]!)[0]!;
        if (typeof target === 'string' && target.startsWith('op-')) {
          const detail = new Array(9).fill(null);
          detail[8] = [4, 'Media not found.'];
          return {
            status: 200,
            text: envelope('jwpduf', [null, 50, [[target, PROJECT, 'scene', 'FAILED', null, detail]]]),
          };
        }
      }
      return base(tab, cmd);
    });
    const promise = run({
      model: 'Veo 3.1 Lite',
      mode: 'continue-video',
      continueFrame: { mime: 'image/jpeg', dataBase64: 'bGFzdC1mcmFtZQ==' },
      prompt: '[Character] walks in [Background]',
      refs: [
        { kind: 'image', label: 'Character', mediaId: IMAGE_ID },
        { kind: 'image', label: 'Background', mediaId: '33333333-3333-3333-3333-333333333333' },
      ],
      timeoutSec: 600,
    });
    promise.catch(() => undefined);
    await vi.runAllTimersAsync();
    await expect(promise).rejects.toMatchObject({ code: 'FLOW_RENDER_FAILED' });
    await expect(promise).rejects.toThrow(/Media not found/i);
    await expect(promise).rejects.toThrow(/chọn Omni Flash/i);
    // Must not sit on the full timeout — one complaint poll is enough after submit.
    const jwp = rpc.mock.calls.filter((c) => c[1].rpcid === 'jwpduf');
    expect(jwp.length).toBeLessThan(5);
  });

  it('continues from last frame and keeps Character/Outfit in prompt only (no media-id slots)', async () => {
    const { calls } = fakeFlow({});
    const sources: string[] = [];
    const prompts: string[] = [];
    const base = rpc.getMockImplementation()!;
    rpc.mockImplementation(async (tab, cmd) => {
      if (cmd.rpcid === 'eb1hJf') {
        sources.push(sourceOf(cmd));
        const item = (inner(cmd)[0] as unknown[][])[0]!;
        prompts.push((((item[0] as unknown[])[2] as string[][][])[0]![0]![0] as string));
      }
      return base(tab, cmd);
    });
    await run({
      model: 'Veo 3.1 Lite',
      mode: 'continue-video',
      continueFrame: { mime: 'image/jpeg', dataBase64: 'bGFzdC1mcmFtZQ==' },
      prompt: '[Character] mặc [Outfit] bước tiếp.\n\nDanh sách tham chiếu\n[Character]: cô gái\n\n[Outfit]: áo nâu',
      refs: [
        { kind: 'image', label: 'Character', mediaId: IMAGE_ID },
        { kind: 'image', label: 'Outfit', mediaId: '33333333-3333-3333-3333-333333333333' },
      ],
    });
    expect(calls.filter((c) => c === 'maseQ')).toHaveLength(1);
    expect(calls).toContain('eb1hJf');
    expect(calls).not.toContain('YhhmEf');
    expect(calls).not.toContain('MZZa6b');
    expect(calls).not.toContain('ogiZ0b');
    expect(sources).toEqual([IMAGE_ID]);
    expect(prompts[0]).toContain('[Character]');
    expect(prompts[0]).toContain('[Outfit]');
    const refs = payloadLogRefs('eb1hJf');
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({
      label: strings.continueStartFrameLabel,
      mediaId: IMAGE_ID,
      role: 'startFrame',
      source: 'upload',
    });
  });

  it('continues without uploading local Character when last frame owns the start slot', async () => {
    const { calls } = fakeFlow({});
    await run({
      model: 'Veo 3.1 Lite',
      mode: 'continue-video',
      continueFrame: { mime: 'image/jpeg', dataBase64: 'bGFzdC1mcmFtZQ==' },
      prompt: '[Character] bước tiếp',
      refs: [
        {
          kind: 'image',
          label: 'Character',
          upload: { name: 'c.png', mime: 'image/png', dataBase64: 'aGVsbG8=', cacheKey: 'run:c' },
        },
      ],
    });
    // Only previous-scene last frame is uploaded — not Character.
    expect(calls.filter((c) => c === 'maseQ')).toHaveLength(1);
    expect(calls).toContain('eb1hJf');
    expect(calls).not.toContain('ogiZ0b');
    expect(payloadLogRefs('eb1hJf')).toHaveLength(1);
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

  it('projectMediaPageRequest puts token in the list envelope', async () => {
    const { projectMediaPageRequest } = await import('@/providers/flow/rpc/batch');
    const freq = projectMediaPageRequest(project, 'CgwI6f7zxQYQgPSm3AMSJGFiY2Q');
    const outer = JSON.parse(freq) as unknown[][][];
    const inner = JSON.parse(outer[0]![0]![1] as string) as unknown[];
    expect(inner).toEqual([`projects/${project}`, null, 'CgwI6f7zxQYQgPSm3AMSJGFiY2Q', null, [1]]);
  });
});
