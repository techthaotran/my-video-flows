import { describe, expect, it, vi } from 'vitest';
import { promptExecutor } from '@/engine/executors';
import type { ExecutorContext, NodeOutputValue } from '@/engine/types';
import type { Workflow, WorkflowNode } from '@/shared/schema';
import type { FlowGeneratePayload } from '@/shared/messaging';
import { strings } from '@/shared/strings';

function pngBlob(bytes: string): Blob {
  return new Blob([bytes], { type: 'image/png' });
}

function ctx(
  data: Record<string, unknown>,
  refs: NodeOutputValue[],
  callDriver: ExecutorContext['callDriver'],
  onProgress: ExecutorContext['onProgress'] = () => undefined,
  extras?: { force?: boolean },
): ExecutorContext {
  const node: WorkflowNode = {
    id: 'p1',
    type: 'prompt',
    position: { x: 0, y: 0 },
    data,
  };
  return {
    runId: 'run-1',
    workflow: { id: 'w', nodes: [node], edges: [] } as unknown as Workflow,
    node,
    inputs: { 'in:image': refs },
    signal: new AbortController().signal,
    force: extras?.force,
    onProgress,
    resolveSlug: () => undefined,
    getAsset: async () => undefined,
    saveOutput: async () => 'out',
    putAsset: async () => 'asset',
    patchNodeData: async () => undefined,
    patchNodeById: async () => undefined,
    extractLastFrame: async () => new Blob(),
    composeVideo: async () => new Blob(),
    flowMediaCache: new Map(),
    callDriver,
  };
}

describe('promptExecutor reusePrompt', () => {
  it('same inputs → returns formattedOutput and does not call driver', async () => {
    const blob = pngBlob('same-pixels');
    const callDriver = vi.fn(async () => ({ texts: ['should-not-run'] }));
    const progress: string[] = [];

    // First run to learn the hash shape via a real call.
    const first = await promptExecutor(
      ctx(
        {
          preset: 'analyzeImage',
          instruction: 'mô tả',
          model: '',
          outputFormat: 'plain',
          reusePrompt: true,
          newChat: true,
        },
        [{ kind: 'image', blob, mime: 'image/png', role: 'ref', name: 'a.png' }],
        callDriver,
      ),
    );
    expect(callDriver).toHaveBeenCalledTimes(1);
    const reuseHash = first[0]!.reuseHash!;
    expect(reuseHash).toBeTruthy();

    callDriver.mockClear();
    const second = await promptExecutor(
      ctx(
        {
          preset: 'analyzeImage',
          instruction: 'mô tả',
          model: '',
          outputFormat: 'plain',
          reusePrompt: true,
          newChat: true,
          formattedOutput: 'KẾT QUẢ CŨ',
          reuseHash,
        },
        [{ kind: 'image', blob, mime: 'image/png', role: 'ref', name: 'a.png' }],
        callDriver,
        (_p, msg) => {
          if (msg) progress.push(msg);
        },
      ),
    );

    expect(callDriver).not.toHaveBeenCalled();
    expect(second[0]!.text).toBe('KẾT QUẢ CŨ');
    expect(progress).toContain(strings.promptReused);
  });

  it('fresh Gemini call → onProgress promptFresh', async () => {
    const progress: string[] = [];
    const callDriver = vi.fn(async () => ({ texts: ['new-analysis'] }));
    await promptExecutor(
      ctx(
        {
          preset: 'analyzeImage',
          instruction: 'mô tả',
          reusePrompt: true,
          outputFormat: 'plain',
          newChat: true,
        },
        [{ kind: 'image', blob: pngBlob('pix'), mime: 'image/png', role: 'ref' }],
        callDriver,
        (_p, msg) => {
          if (msg) progress.push(msg);
        },
      ),
    );
    expect(callDriver).toHaveBeenCalledTimes(1);
    expect(progress).toContain(strings.promptFresh);
  });

  it('same size different content → calls driver again', async () => {
    const a = pngBlob('AAAA');
    const b = pngBlob('BBBB');
    expect(a.size).toBe(b.size);

    const callDriver = vi.fn(async () => ({ texts: ['fresh'] }));
    const first = await promptExecutor(
      ctx(
        {
          preset: 'analyzeImage',
          instruction: 'mô tả',
          reusePrompt: true,
          outputFormat: 'plain',
          newChat: true,
        },
        [{ kind: 'image', blob: a, mime: 'image/png', role: 'ref' }],
        callDriver,
      ),
    );
    const reuseHash = first[0]!.reuseHash!;

    callDriver.mockClear();
    callDriver.mockResolvedValueOnce({ texts: ['changed'] });
    const second = await promptExecutor(
      ctx(
        {
          preset: 'analyzeImage',
          instruction: 'mô tả',
          reusePrompt: true,
          outputFormat: 'plain',
          newChat: true,
          formattedOutput: 'CŨ',
          reuseHash,
        },
        [{ kind: 'image', blob: b, mime: 'image/png', role: 'ref' }],
        callDriver,
      ),
    );

    expect(callDriver).toHaveBeenCalledTimes(1);
    expect(second[0]!.text).toBe('changed');
    expect(second[0]!.reuseHash).not.toBe(reuseHash);
  });

  it('reusePrompt: false → always calls driver', async () => {
    const blob = pngBlob('pixels');
    const callDriver = vi.fn(async () => ({ texts: ['always'] }));
    const first = await promptExecutor(
      ctx(
        {
          preset: 'analyzeImage',
          instruction: 'x',
          reusePrompt: false,
          outputFormat: 'plain',
          newChat: true,
        },
        [{ kind: 'image', blob, mime: 'image/png', role: 'ref' }],
        callDriver,
      ),
    );
    const reuseHash = first[0]!.reuseHash!;

    callDriver.mockClear();
    await promptExecutor(
      ctx(
        {
          preset: 'analyzeImage',
          instruction: 'x',
          reusePrompt: false,
          outputFormat: 'plain',
          newChat: true,
          formattedOutput: 'CŨ',
          reuseHash,
        },
        [{ kind: 'image', blob, mime: 'image/png', role: 'ref' }],
        callDriver,
      ),
    );
    expect(callDriver).toHaveBeenCalledTimes(1);
  });

  it('forwardRefs: false → text only (continuation still kept)', async () => {
    const callDriver = vi.fn(async () => ({
      texts: [JSON.stringify({ type: 'scene', summary: 'street', pose: 'stand', camera: 'wide', lighting: 'soft', background: 'city', mood: 'calm', color_grading: 'warm' })],
    }));
    const out = await promptExecutor(
      ctx(
        {
          preset: 'fashionScene',
          instruction: '',
          outputFormat: 'json',
          reusePrompt: false,
          forwardRefs: false,
          newChat: true,
        },
        [
          {
            kind: 'image',
            blob: pngBlob('scene'),
            mime: 'image/png',
            role: 'ref',
            assetLabel: 'Background',
          },
          {
            kind: 'image',
            blob: pngBlob('frame'),
            mime: 'image/jpeg',
            role: 'continuation',
            name: 'prev',
          },
        ],
        callDriver,
      ),
    );
    expect(out.map((v) => v.role)).toEqual(['prompt', 'continuation']);
    expect(out.some((v) => v.role === 'ref')).toBe(false);
  });

  it('fashionScene forwardRefs:false keeps scene media out of generateImage refs', async () => {
    const { gatherInputs } = await import('@/engine/RunManager');
    const { executors } = await import('@/engine/executors');
    const SCENE = 'aaaaaaaa-1111-4111-8111-111111111111';
    const MODEL = 'bbbbbbbb-2222-4222-8222-222222222222';

    const wf = {
      id: 'w',
      nodes: [
        {
          id: 'asset-scene',
          type: 'asset' as const,
          position: { x: 0, y: 0 },
          data: { kind: 'image', assetLabel: 'Background', source: 'flow', flowMediaId: SCENE },
        },
        {
          id: 'asset-model',
          type: 'asset' as const,
          position: { x: 0, y: 0 },
          data: { kind: 'image', assetLabel: 'Character', source: 'flow', flowMediaId: MODEL },
        },
        {
          id: 'prompt-scene',
          type: 'prompt' as const,
          position: { x: 0, y: 0 },
          data: {
            preset: 'fashionScene',
            outputFormat: 'json',
            reusePrompt: false,
            forwardRefs: false,
            newChat: true,
          },
        },
        {
          id: 'prompt-model',
          type: 'prompt' as const,
          position: { x: 0, y: 0 },
          data: {
            preset: 'fashionModel',
            outputFormat: 'json',
            reusePrompt: false,
            forwardRefs: true,
            newChat: true,
          },
        },
        {
          id: 'prompt-compose',
          type: 'prompt' as const,
          position: { x: 0, y: 0 },
          data: { preset: 'fashionCompose', outputFormat: 'plain', reusePrompt: false, forwardRefs: true },
        },
        {
          id: 'gen',
          type: 'generateImage' as const,
          position: { x: 0, y: 0 },
          data: { model: 'Nano Banana 2', aspectRatio: '9:16', count: 1, resolution: '1K' },
        },
      ],
      edges: [
        {
          id: 'e1',
          source: 'asset-scene',
          sourceHandle: 'out:image',
          target: 'prompt-scene',
          targetHandle: 'in:image',
          type: 'image',
        },
        {
          id: 'e2',
          source: 'asset-model',
          sourceHandle: 'out:image',
          target: 'prompt-model',
          targetHandle: 'in:image',
          type: 'image',
        },
        {
          id: 'e3',
          source: 'prompt-scene',
          sourceHandle: 'out:text',
          target: 'prompt-compose',
          targetHandle: 'in:text',
          type: 'text',
        },
        {
          id: 'e4',
          source: 'prompt-model',
          sourceHandle: 'out:text',
          target: 'prompt-compose',
          targetHandle: 'in:text',
          type: 'text',
        },
        {
          id: 'e5',
          source: 'prompt-compose',
          sourceHandle: 'out:text',
          target: 'gen',
          targetHandle: 'in:text',
          type: 'text',
        },
      ],
    } as unknown as Workflow;

    const outputs = new Map<string, NodeOutputValue[]>();
    let genPayload: FlowGeneratePayload | undefined;
    const order = [
      'asset-scene',
      'asset-model',
      'prompt-scene',
      'prompt-model',
      'prompt-compose',
      'gen',
    ];

    for (const id of order) {
      const n = wf.nodes.find((x) => x.id === id)!;
      const c: ExecutorContext = {
        runId: 'run-1',
        workflow: wf,
        node: n,
        inputs: gatherInputs(wf, id, outputs),
        signal: new AbortController().signal,
        onProgress: () => undefined,
        resolveSlug: () => undefined,
        getAsset: async () => undefined,
        saveOutput: async () => 'out',
        putAsset: async () => 'asset',
        patchNodeData: async () => undefined,
        patchNodeById: async () => undefined,
        extractLastFrame: async () => new Blob(),
        composeVideo: async () => new Blob(),
        flowMediaCache: new Map(),
        callDriver: async (_provider, action) => {
          if (action.name === 'prompt') {
            const preset = (n.data as { preset?: string }).preset;
            if (preset === 'fashionScene') {
              return {
                texts: [
                  JSON.stringify({
                    type: 'scene',
                    summary: 'street',
                    pose: 'stand',
                    camera: 'wide',
                    lighting: 'soft',
                    background: 'city',
                    mood: 'calm',
                    color_grading: 'warm',
                  }),
                ],
              };
            }
            if (preset === 'fashionModel') {
              return {
                texts: [
                  JSON.stringify({
                    type: 'model',
                    summary: 'model',
                    identity: { face: 'oval' },
                    must_keep: [],
                    never_change: [],
                  }),
                ],
              };
            }
            return { texts: [''] };
          }
          if (action.name === 'fetchMediaById') {
            // Flow-only asset refs are downloaded for Gemini (never uploaded).
            return { medias: [{ kind: 'image', mime: 'image/png', dataBase64: btoa('flow') }] };
          }
          if (action.name === 'generate') {
            genPayload = action.payload as FlowGeneratePayload;
            return {
              medias: [{ kind: 'image', mime: 'image/png', dataBase64: btoa('png'), mediaId: 'out-img' }],
            };
          }
          return {};
        },
      };
      outputs.set(id, await executors[n.type]!(c));
    }

    expect(genPayload).toBeTruthy();
    const mediaIds = (genPayload!.refs ?? []).map((r) => r.mediaId);
    expect(mediaIds).toContain(MODEL);
    expect(mediaIds).not.toContain(SCENE);
  });

  it('systemPrompt override changes reuseHash and is sent to Gemini', async () => {
    const blob = pngBlob('sys');
    const callDriver = vi.fn(async () => ({ texts: ['with-skill'] }));
    const first = await promptExecutor(
      ctx(
        {
          preset: 'analyzeImage',
          instruction: 'mô tả',
          reusePrompt: true,
          outputFormat: 'plain',
          newChat: true,
          systemPrompt: 'Skill A',
        },
        [{ kind: 'image', blob, mime: 'image/png', role: 'ref' }],
        callDriver,
      ),
    );
    expect(callDriver).toHaveBeenCalledWith(
      'gemini',
      expect.objectContaining({
        name: 'prompt',
        payload: expect.objectContaining({ instruction: 'Skill A' }),
      }),
    );
    const hashA = first[0]!.reuseHash!;

    callDriver.mockClear();
    callDriver.mockResolvedValueOnce({ texts: ['with-skill-b'] });
    await promptExecutor(
      ctx(
        {
          preset: 'analyzeImage',
          instruction: 'mô tả',
          reusePrompt: true,
          outputFormat: 'plain',
          newChat: true,
          systemPrompt: 'Skill B',
          formattedOutput: 'CŨ',
          reuseHash: hashA,
        },
        [{ kind: 'image', blob, mime: 'image/png', role: 'ref' }],
        callDriver,
      ),
    );
    expect(callDriver).toHaveBeenCalledTimes(1);
  });

  it('outputEdited keeps formattedOutput even when image changes', async () => {
    const callDriver = vi.fn(async () => ({ texts: ['should-not-run'] }));
    const progress: string[] = [];
    const out = await promptExecutor(
      ctx(
        {
          preset: 'analyzeImage',
          instruction: 'mô tả',
          reusePrompt: true,
          outputFormat: 'plain',
          newChat: true,
          formattedOutput: 'SỬA TAY',
          outputEdited: true,
          reuseHash: 'stale',
        },
        [{ kind: 'image', blob: pngBlob('changed'), mime: 'image/png', role: 'ref' }],
        callDriver,
        (_p, msg) => {
          if (msg) progress.push(msg);
        },
      ),
    );
    expect(callDriver).not.toHaveBeenCalled();
    expect(out[0]!.text).toBe('SỬA TAY');
    expect(out[0]!.outputEdited).toBe(true);
    expect(progress).toContain(strings.promptEdited);
  });

  it('force skips reuse and outputEdited, calls Gemini', async () => {
    const blob = pngBlob('force');
    const callDriver = vi.fn(async () => ({ texts: ['forced-fresh'] }));
    const out = await promptExecutor(
      ctx(
        {
          preset: 'analyzeImage',
          instruction: 'mô tả',
          reusePrompt: true,
          outputFormat: 'plain',
          newChat: true,
          formattedOutput: 'SỬA TAY',
          outputEdited: true,
          reuseHash: 'any',
        },
        [{ kind: 'image', blob, mime: 'image/png', role: 'ref' }],
        callDriver,
        () => undefined,
        { force: true },
      ),
    );
    expect(callDriver).toHaveBeenCalledTimes(1);
    expect(out[0]!.text).toBe('forced-fresh');
    expect(out[0]!.outputEdited).toBe(false);
  });
});

describe('fashion roles through Prompt nodes', () => {
  const sceneJson = JSON.stringify({ type: 'scene', summary: 'Phòng khách' });
  const modelJson = JSON.stringify({ type: 'model', summary: 'Nữ 25 tuổi' });
  const outfitJson = JSON.stringify({ type: 'outfit', summary: 'Áo thun tím' });
  const flowRef = (id: string, label: string, extra: Partial<NodeOutputValue> = {}): NodeOutputValue => ({
    kind: 'image',
    role: 'ref',
    flowMediaId: id,
    assetLabel: label,
    ...extra,
  });

  it('node phân tích gắn vai trò cho ảnh nó chuyển tiếp', async () => {
    const out = await promptExecutor(
      ctx(
        { preset: 'fashionScene', outputEdited: true, formattedOutput: sceneJson, forwardRefs: true },
        [flowRef('m-scene', 'Background')],
        vi.fn(),
      ),
    );
    expect(out.find((v) => v.flowMediaId === 'm-scene')?.fashionRole).toBe('scene');
  });

  it('Ghép prompt: ảnh bối cảnh đứng đầu, lệnh sửa ảnh dùng đúng nhãn', async () => {
    const c = ctx({ preset: 'fashionCompose' }, [], vi.fn());
    c.inputs = {
      'in:text': [
        { kind: 'text', role: 'prompt', text: modelJson },
        flowRef('m-model', 'Character', { fashionRole: 'model' }),
        { kind: 'text', role: 'prompt', text: outfitJson },
        flowRef('m-outfit', 'Outfit', { fashionRole: 'outfit' }),
        { kind: 'text', role: 'prompt', text: sceneJson },
        flowRef('m-scene', 'Background', { fashionRole: 'scene' }),
      ],
    };
    const out = await promptExecutor(c);
    expect(out.filter((v) => v.role === 'ref').map((v) => v.flowMediaId)).toEqual([
      'm-scene',
      'm-model',
      'm-outfit',
    ]);
    const text = out.find((v) => v.kind === 'text')!.text!;
    expect(text).toContain('Chỉnh sửa ảnh [Background]');
    expect(text).toContain('khuôn mặt trong [Character]');
    expect(text).toContain('trang phục trong [Outfit]');
  });
});

describe('Chỉ node này (reuseSavedPrompt)', () => {
  it('node Prompt phía trước trả prompt đã lưu, không gọi Gemini dù đầu vào đã đổi', async () => {
    const callDriver = vi.fn(async () => ({ texts: ['không được gọi'] }));
    const c = ctx(
      { preset: 'fashionModel', formattedOutput: '{"type":"model"}', reuseHash: 'hash-cũ', reusePrompt: true },
      [{ kind: 'image', role: 'ref', flowMediaId: 'ảnh-mới', assetLabel: 'Character' }],
      callDriver,
    );
    c.reuseSavedPrompt = true;
    const out = await promptExecutor(c);
    expect(callDriver).not.toHaveBeenCalled();
    expect(out.find((v) => v.kind === 'text')?.text).toBe('{"type":"model"}');
  });

  it('chưa có prompt đã lưu thì vẫn gọi Gemini', async () => {
    const callDriver = vi.fn(async () => ({ texts: ['{"type":"model"}'] }));
    const c = ctx({ preset: 'fashionModel', reusePrompt: true, outputFormat: 'json' }, [], callDriver);
    c.reuseSavedPrompt = true;
    await promptExecutor(c);
    expect(callDriver).toHaveBeenCalledTimes(1);
  });
});
