import { describe, expect, it, vi } from 'vitest';
import { promptExecutor } from '@/engine/executors';
import type { ExecutorContext, NodeOutputValue } from '@/engine/types';
import type { DriverAction, GeminiPromptPayload } from '@/shared/messaging';
import type { Workflow, WorkflowNode } from '@/shared/schema';
import { strings } from '@/shared/strings';

const MEDIA_ID = '11111111-2222-3333-4444-555555555555';
const PNG_B64 = btoa('flow-pixels');

function flowRef(): NodeOutputValue {
  return {
    kind: 'image',
    flowMediaId: MEDIA_ID,
    assetLabel: 'Model',
    name: 'Model',
    fromAsset: true,
    fromFlow: true,
    role: 'ref',
  };
}

function ctx(
  data: Record<string, unknown>,
  refs: NodeOutputValue[],
  callDriver: ExecutorContext['callDriver'],
  flowMediaCache = new Map<string, Promise<Blob>>(),
  onProgress: ExecutorContext['onProgress'] = () => undefined,
): ExecutorContext {
  const node: WorkflowNode = { id: 'p1', type: 'prompt', position: { x: 0, y: 0 }, data };
  return {
    runId: 'run-1',
    workflow: { id: 'w', nodes: [node], edges: [] } as unknown as Workflow,
    node,
    inputs: { 'in:image': refs },
    signal: new AbortController().signal,
    onProgress,
    resolveSlug: () => undefined,
    getAsset: async () => undefined,
    saveOutput: async () => 'out',
    putAsset: async () => 'asset',
    patchNodeData: async () => undefined,
    patchNodeById: async () => undefined,
    extractLastFrame: async () => new Blob(),
    composeVideo: async () => new Blob(),
    flowMediaCache,
    callDriver,
  };
}

const DATA = { preset: 'analyzeImage', instruction: 'mô tả', outputFormat: 'plain', newChat: true };

describe('promptExecutor with Flow-only image refs', () => {
  it('downloads the Flow image and sends it to Gemini', async () => {
    const calls: { provider: string; action: DriverAction }[] = [];
    const callDriver = vi.fn(async (provider: 'flow' | 'gemini', action: DriverAction) => {
      calls.push({ provider, action });
      if (provider === 'flow') return { medias: [{ kind: 'image' as const, mime: 'image/jpeg', dataBase64: PNG_B64 }] };
      return { texts: ['[Model] mô tả ảnh'] };
    });
    const progress: string[] = [];
    const out = await promptExecutor(
      ctx(DATA, [flowRef()], callDriver, new Map(), (_p, m) => m && progress.push(m)),
    );

    expect(calls.map((c) => `${c.provider}.${c.action.name}`)).toEqual(['flow.fetchMediaById', 'gemini.prompt']);
    expect(calls[0]!.action).toEqual({ name: 'fetchMediaById', payload: { mediaId: MEDIA_ID } });
    const payload = (calls[1]!.action as { payload: GeminiPromptPayload }).payload;
    expect(payload.images).toEqual([{ name: 'Model.jpg', mime: 'image/jpeg', dataBase64: PNG_B64 }]);
    expect(progress).toContain(strings.promptFetchFlowImage(1, 1));
    expect(out[0]!.text).toBe('[Model] mô tả ảnh');
    // Reuse is keyed by the immutable media id, so a reused prompt needs no download.
    expect(out[0]!.reuseHash).toBeTruthy();
  });

  it('fetches each Flow media once per run (shared run cache)', async () => {
    const callDriver = vi.fn(async (provider: 'flow' | 'gemini') =>
      provider === 'flow'
        ? { medias: [{ kind: 'image' as const, mime: 'image/png', dataBase64: PNG_B64 }] }
        : { texts: ['[Model] ok'] },
    );
    const cache = new Map<string, Promise<Blob>>();
    await promptExecutor(ctx(DATA, [flowRef()], callDriver, cache));
    await promptExecutor(ctx({ ...DATA, instruction: 'khác' }, [flowRef()], callDriver, cache));
    const flowCalls = callDriver.mock.calls.filter(([p]) => p === 'flow');
    expect(flowCalls).toHaveLength(1);
  });

  it('reused prompt does not download the Flow image', async () => {
    const callDriver = vi.fn(async (provider: 'flow' | 'gemini') =>
      provider === 'flow'
        ? { medias: [{ kind: 'image' as const, mime: 'image/png', dataBase64: PNG_B64 }] }
        : { texts: ['[Model] ok'] },
    );
    const first = await promptExecutor(ctx({ ...DATA, reusePrompt: true }, [flowRef()], callDriver));
    callDriver.mockClear();
    await promptExecutor(
      ctx(
        { ...DATA, reusePrompt: true, formattedOutput: 'ok', reuseHash: first[0]!.reuseHash },
        [flowRef()],
        callDriver,
      ),
    );
    expect(callDriver).not.toHaveBeenCalled();
  });

  it('fails with a clear error when the Flow download fails (no silent skip)', async () => {
    const callDriver = vi.fn(async (provider: 'flow' | 'gemini') => {
      if (provider === 'flow') throw new Error('HTTP 403');
      return { texts: ['should-not-run'] };
    });
    const cache = new Map<string, Promise<Blob>>();
    await expect(promptExecutor(ctx(DATA, [flowRef()], callDriver, cache))).rejects.toMatchObject({
      code: 'FLOW_MEDIA_FETCH_FAILED',
      message: strings.promptFlowImageFetchFailed('[Model]', 'HTTP 403'),
    });
    expect(callDriver.mock.calls.some(([p]) => p === 'gemini')).toBe(false);
    expect(cache.size).toBe(0);
  });
});
