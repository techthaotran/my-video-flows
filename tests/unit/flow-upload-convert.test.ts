import { describe, expect, it } from 'vitest';
import { gatherInputs } from '@/engine/RunManager';
import { executors } from '@/engine/executors';
import type { ExecutorContext, NodeOutputValue } from '@/engine/types';
import { canUploadOriginal } from '@/providers/flow/rpc/generate';
import { isUploadedLocalAsset, uploadedFlowAssetPatch } from '@/shared/media';
import type { DriverAction, FlowGeneratePayload } from '@/shared/messaging';
import type { Workflow, WorkflowNode } from '@/shared/schema';
import { createEmptyWorkflow } from '@/storage/repos/workflowRepo';

const IDS = { uploadedMediaId: 'up-1', uploadedProjectId: 'proj-1', uploadedSha256: 'sha-1' };

function node(id: string, type: WorkflowNode['type'], data: Record<string, unknown>): WorkflowNode {
  return { id, type, position: { x: 0, y: 0 }, data };
}

function edge(source: string, sourceHandle: string, target: string, targetHandle: string, type: string) {
  return { id: `${source}-${target}`, source, sourceHandle, target, targetHandle, type } as Workflow['edges'][number];
}

/** Model (file local) → Prompt → Generate Video, qua executor thật; ghi lại lệnh generate. */
function modelWorkflow(): Workflow {
  const wf = createEmptyWorkflow('w');
  wf.nodes = [
    node('model', 'asset', { assetLabel: 'Model', kind: 'image', source: 'local', assetId: 'file-1' }),
    node('p', 'prompt', { preset: 'custom', instruction: '[Model] đi bộ.' }),
    node('g', 'generateVideo', { model: 'Omni Flash' }),
  ];
  wf.edges = [
    edge('model', 'out:image', 'p', 'in:image', 'image'),
    edge('p', 'out:text', 'g', 'in:text', 'text'),
  ];
  return wf;
}

async function run(wf: Workflow, uploads: { nodeId: string; mediaId: string; projectId: string; sha256: string }[]) {
  const blobs: Record<string, Blob> = { 'file-1': new Blob(['model-bytes'], { type: 'image/jpeg' }) };
  const outputs = new Map<string, NodeOutputValue[]>();
  const calls: Extract<DriverAction, { name: 'generate' }>[] = [];
  for (const id of ['model', 'p', 'g']) {
    const n = wf.nodes.find((x) => x.id === id)!;
    const ctx: ExecutorContext = {
      runId: 'run',
      workflow: wf,
      node: n,
      inputs: gatherInputs(wf, id, outputs),
      signal: new AbortController().signal,
      onProgress: () => undefined,
      resolveSlug: () => undefined,
      getAsset: async (assetId) => blobs[assetId],
      saveOutput: async () => 'out',
      putAsset: async () => 'asset',
      patchNodeData: async (patch) => {
        Object.assign(n.data, patch);
      },
      patchNodeById: async (otherId, patch) => {
        const target = wf.nodes.find((x) => x.id === otherId);
        if (target) Object.assign(target.data, patch);
      },
      extractLastFrame: async () => new Blob([]),
      composeVideo: async () => new Blob([]),
      flowMediaCache: new Map(),
      callDriver: async (_provider, action) => {
        if (action.name === 'generate') calls.push(action);
        return {
          medias: [{ kind: 'video', mime: 'video/mp4', dataBase64: btoa('clip'), mediaId: 'clip-1' }],
          uploads,
        } as never;
      },
    };
    outputs.set(id, await executors[n.type]!(ctx));
  }
  return { outputs, calls };
}

describe('upload ảnh local: file gốc', () => {
  it('JPEG/PNG đủ nhỏ thì gửi nguyên file', () => {
    expect(canUploadOriginal({ mime: 'image/jpeg', bytes: 500_000, width: 764, height: 1024 })).toBe(true);
    expect(canUploadOriginal({ mime: 'image/png', bytes: 1_200_000, width: 1536, height: 1536 })).toBe(true);
  });

  it('quá nặng, quá lớn hoặc định dạng khác thì nén lại', () => {
    expect(canUploadOriginal({ mime: 'image/jpeg', bytes: 1_200_001, width: 800, height: 800 })).toBe(false);
    expect(canUploadOriginal({ mime: 'image/jpeg', bytes: 400_000, width: 1493, height: 2000 })).toBe(false);
    expect(canUploadOriginal({ mime: 'image/webp', bytes: 100_000, width: 800, height: 800 })).toBe(false);
  });
});

describe('upload ảnh local: node Asset thành asset Flow', () => {
  it('patch giữ id upload và dùng chính id đó làm media id Flow', () => {
    const patch = uploadedFlowAssetPatch(IDS);
    expect(patch).toEqual({ ...IDS, source: 'flow', flowMediaId: 'up-1' });
    expect(isUploadedLocalAsset({ assetId: 'file-1', ...patch })).toBe(true);
    expect(isUploadedLocalAsset({ flowMediaId: 'picked', source: 'flow' })).toBe(false);
    expect(isUploadedLocalAsset({ assetId: 'file-1', ...IDS })).toBe(false);
  });

  it('lần chạy đầu upload rồi chuyển node; lần sau gửi media id, không upload lại', async () => {
    const wf = modelWorkflow();
    const first = await run(wf, [{ nodeId: 'model', mediaId: 'up-1', projectId: 'proj-1', sha256: 'sha-1' }]);
    expect((first.calls[0]!.payload as FlowGeneratePayload).refs?.[0]?.upload).toBeDefined();

    const model = wf.nodes.find((n) => n.id === 'model')!.data;
    expect(model).toMatchObject({ ...IDS, source: 'flow', flowMediaId: 'up-1', assetId: 'file-1' });

    const second = await run(wf, []);
    const ref = (second.calls[0]!.payload as FlowGeneratePayload).refs?.[0];
    expect(ref?.mediaId).toBe('up-1');
    expect(ref?.upload).toBeUndefined();
  });

  it('asset Flow từ file local vẫn đưa file gốc cho node sau (Gemini không phải tải lại)', async () => {
    const wf = modelWorkflow();
    Object.assign(wf.nodes[0]!.data, uploadedFlowAssetPatch(IDS));
    const { outputs } = await run(wf, []);
    const [out] = outputs.get('model')!;
    expect(out!.flowMediaId).toBe('up-1');
    expect(await out!.blob?.text()).toBe('model-bytes');
  });

  it('video local đã upload chỉ nhớ id, không chuyển thành asset Flow', async () => {
    const wf = modelWorkflow();
    Object.assign(wf.nodes[0]!.data, { kind: 'video', assetLabel: 'Video reference' });
    wf.edges = [edge('model', 'out:video', 'g', 'in:video', 'video'), edge('p', 'out:text', 'g', 'in:text', 'text')];
    await run(wf, [{ nodeId: 'model', mediaId: 'vid-1', projectId: 'proj-1', sha256: 'sha-v' }]);
    const data = wf.nodes[0]!.data;
    expect(data.uploadedMediaId).toBe('vid-1');
    expect(data.flowMediaId).toBeUndefined();
    expect(data.source).toBe('local');
  });
});
