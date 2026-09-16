import { describe, expect, it, vi } from 'vitest';
import { RunManager } from '@/engine/RunManager';
import type { ProviderRouter } from '@/providers/TabPool';
import { runRepo } from '@/storage/repos/runRepo';
import { createEmptyWorkflow, workflowRepo } from '@/storage/repos/workflowRepo';
import type { DriverAction, FlowGeneratePayload, SwToUiEvent } from '@/shared/messaging';
import type { Workflow, WorkflowNode } from '@/shared/schema';

const IMAGE_MEDIA = '5ef8278f-a08d-4b30-a45c-bdd946b37427';

function node(id: string, type: WorkflowNode['type'], data: Record<string, unknown>): WorkflowNode {
  return { id, type, position: { x: 0, y: 0 }, data };
}

function edge(source: string, sourceHandle: string, target: string, targetHandle: string, type: string) {
  return { id: `${source}-${target}`, source, sourceHandle, target, targetHandle, type } as Workflow['edges'][number];
}

/** Run a workflow to completion; returns driver calls and the final run event. */
async function runToEnd(wf: Workflow, opts: Parameters<RunManager['runWorkflow']>[1]) {
  const calls: DriverAction[] = [];
  const router = {
    execute: async (_provider: string, action: DriverAction) => {
      calls.push(action);
      return { medias: [{ kind: 'video', mime: 'video/mp4', dataBase64: btoa('new-clip'), mediaId: 'new-video' }] };
    },
  } as unknown as ProviderRouter;
  let finish!: (ev: Extract<SwToUiEvent, { type: 'run.done' }>) => void;
  const done = new Promise<Extract<SwToUiEvent, { type: 'run.done' }>>((r) => (finish = r));
  const manager = new RunManager(router, (ev) => {
    if (ev.type === 'run.done') finish(ev);
  });
  await manager.runWorkflow(wf.id, opts);
  return { calls, done: await done };
}

describe('generate only this node', () => {
  async function imageThenVideo(previewOutputId: string) {
    const wf = createEmptyWorkflow('ws');
    wf.nodes = [
      node('img', 'generateImage', { prompt: 'a girl', previewOutputId }),
      node('p', 'prompt', { preset: 'custom', instruction: '[Ảnh] walks' }),
      node('vid', 'generateVideo', { model: 'Veo 3.1 Lite' }),
    ];
    wf.edges = [
      edge('img', 'out:image', 'p', 'in:image', 'image'),
      edge('p', 'out:text', 'vid', 'in:text', 'text'),
    ];
    await workflowRepo.save(wf);
    return wf;
  }

  it('reuses the upstream generator result and generates only the chosen node', async () => {
    const stored = await runRepo.saveOutput({
      nodeRunId: 'old',
      kind: 'image',
      mime: 'image/png',
      blob: new Blob(['png'], { type: 'image/png' }),
      flowMediaId: IMAGE_MEDIA,
    });
    const wf = await imageThenVideo(stored.id);

    const { calls, done } = await runToEnd(wf, { mode: 'only', nodeId: 'vid' });

    expect(done.status).toBe('success');
    expect(calls).toHaveLength(1);
    const payload = (calls[0] as Extract<DriverAction, { name: 'generate' }>).payload as FlowGeneratePayload;
    expect(payload.mode).not.toBe('text-to-image');
    expect(payload.refs?.[0]).toMatchObject({ kind: 'image', mediaId: IMAGE_MEDIA });
  });

  it('stops with a clear error when an upstream generator has no result to reuse', async () => {
    const wf = await imageThenVideo('missing-output');

    const { calls, done } = await runToEnd(wf, { mode: 'only', nodeId: 'vid' });

    expect(done.status).toBe('error');
    expect(done.error).toMatch(/chưa có kết quả để dùng lại/);
    expect(calls).toHaveLength(0);
  });
});

describe('chạy node Ghép video', () => {
  /** Hai Generate Video đã có kết quả cũ, cùng nối vào một node Ghép video. */
  async function twoClipsIntoMerge() {
    const a = await runRepo.saveOutput({
      nodeRunId: 'old-a',
      kind: 'video',
      mime: 'video/mp4',
      blob: new Blob(['clip-a'], { type: 'video/mp4' }),
    });
    const b = await runRepo.saveOutput({
      nodeRunId: 'old-b',
      kind: 'video',
      mime: 'video/mp4',
      blob: new Blob(['clip-b'], { type: 'video/mp4' }),
    });
    const wf = createEmptyWorkflow('ws');
    wf.nodes = [
      node('v1', 'generateVideo', { prompt: 'cảnh 1', previewOutputId: a.id }),
      node('v2', 'generateVideo', { prompt: 'cảnh 2', previewOutputId: b.id }),
      node('m', 'mergeVideo', { order: ['v2', 'v1'], fps: 24, bitrateMbps: 6 }),
    ];
    wf.edges = [
      edge('v1', 'out:video', 'm', 'in:video', 'video'),
      edge('v2', 'out:video', 'm', 'in:video', 'video'),
    ];
    wf.edges[1]!.id = 'v2-m';
    await workflowRepo.save(wf);
    return wf;
  }

  it('dùng lại clip cũ của node phía trước, không gọi Flow generate lần nào', async () => {
    const wf = await twoClipsIntoMerge();
    const { calls, done } = await runToEnd(wf, { mode: 'only', nodeId: 'm' });

    // Ghép video chạy hoàn toàn cục bộ — không một lượt generate nào bị đốt.
    expect(calls.filter((c) => c.name === 'generate')).toHaveLength(0);
    expect(done.status).toBe('error');
    // Không có offscreen document trong jsdom: dừng ở bước ghép, không phải ở
    // bước generate — đủ để chứng minh upstream đã dùng lại kết quả cũ.
    expect(done.error).not.toMatch(/chưa có kết quả để dùng lại/);
  });

  it('phát node.output với outputId mới, trước khi node rời trạng thái running', async () => {
    const clip = await runRepo.saveOutput({
      nodeRunId: 'old-solo',
      kind: 'video',
      mime: 'video/mp4',
      blob: new Blob(['clip'], { type: 'video/mp4' }),
    });
    const wf = createEmptyWorkflow('ws');
    wf.nodes = [
      node('v1', 'generateVideo', { prompt: 'cảnh 1', previewOutputId: clip.id }),
      node('m', 'mergeVideo', { order: ['v1'] }),
    ];
    wf.edges = [edge('v1', 'out:video', 'm', 'in:video', 'video')];
    await workflowRepo.save(wf);

    const compose = await import('@/media/composeClient');
    const spy = vi
      .spyOn(compose, 'composeVideoInOffscreen')
      .mockResolvedValue(new Blob(['merged'], { type: 'video/mp4' }));

    const events: string[] = [];
    let outputId: string | undefined;
    let finish!: () => void;
    const done = new Promise<void>((r) => (finish = r));
    const manager = new RunManager({ execute: async () => ({}) } as unknown as ProviderRouter, (ev) => {
      if (ev.type === 'node.output' && ev.nodeId === 'm') {
        events.push('output');
        outputId = ev.outputId;
      }
      if (ev.type === 'node.status' && ev.nodeId === 'm' && ev.status === 'success') {
        events.push('success');
      }
      if (ev.type === 'run.done') finish();
    });
    await manager.runWorkflow(wf.id, { mode: 'only', nodeId: 'm' });
    await done;
    spy.mockRestore();

    // UI đặt preview khi nhận node.output; nếu success tới trước, node hết
    // running trong lúc preview vẫn còn trỏ vào kết quả cũ.
    expect(events).toEqual(['output', 'success']);
    expect(outputId).toBeTruthy();
    expect(outputId).not.toBe(clip.id);

    // previewOutputId phải được ghi xuống IndexedDB để mở lại editor vẫn thấy.
    const saved = await workflowRepo.get(wf.id);
    const mergeNode = saved!.nodes.find((n) => n.id === 'm')!;
    expect((mergeNode.data as { previewOutputId?: string }).previewOutputId).toBe(outputId);

    const out = await runRepo.getOutput(outputId!);
    expect(out?.kind).toBe('video');
    expect(out?.size).toBe(new Blob(['merged']).size);
  });

  it('node Ghép video hiện trạng thái chạy trên canvas', async () => {
    const wf = await twoClipsIntoMerge();
    const statuses: string[] = [];
    const router = {
      execute: async () => ({ medias: [] }),
    } as unknown as import('@/providers/TabPool').ProviderRouter;
    let finish!: () => void;
    const done = new Promise<void>((r) => (finish = r));
    const manager = new RunManager(router, (ev) => {
      if (ev.type === 'node.status' && ev.nodeId === 'm') statuses.push(ev.status);
      if (ev.type === 'run.done') finish();
    });
    await manager.runWorkflow(wf.id, { mode: 'only', nodeId: 'm' });
    await done;
    expect(statuses[0]).toBe('running');
  });
});
