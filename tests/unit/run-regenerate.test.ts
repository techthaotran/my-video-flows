import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RunManager } from '@/engine/RunManager';
import type { ProviderRouter } from '@/providers/TabPool';
import { db } from '@/storage/db';
import { runRepo } from '@/storage/repos/runRepo';
import { createEmptyWorkflow, workflowRepo } from '@/storage/repos/workflowRepo';
import type { DriverAction, SwToUiEvent } from '@/shared/messaging';
import { strings } from '@/shared/strings';
import type { Workflow, WorkflowNode } from '@/shared/schema';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

function node(id: string, type: WorkflowNode['type'], data: Record<string, unknown>): WorkflowNode {
  return { id, type, position: { x: 0, y: 0 }, data };
}

function edge(
  source: string,
  sourceHandle: string,
  target: string,
  targetHandle: string,
  type: Workflow['edges'][number]['type'],
): Workflow['edges'][number] {
  return { id: `${source}-${target}`, source, sourceHandle, target, targetHandle, type };
}

async function saveClip(name: string) {
  return runRepo.saveOutput({
    nodeRunId: `old-${name}`,
    kind: 'video',
    mime: 'video/mp4',
    blob: new Blob([name], { type: 'video/mp4' }),
  });
}

async function threeClipsMerge(opts: { v1?: string; v2?: string; v3?: string }) {
  const wf = createEmptyWorkflow('ws');
  wf.nodes = [
    node('v1', 'generateVideo', { prompt: '1', ...(opts.v1 ? { previewOutputId: opts.v1 } : {}) }),
    node('v2', 'generateVideo', { prompt: '2', ...(opts.v2 ? { previewOutputId: opts.v2 } : {}) }),
    node('v3', 'generateVideo', { prompt: '3', ...(opts.v3 ? { previewOutputId: opts.v3 } : {}) }),
    node('m', 'mergeVideo', { order: ['v1', 'v2', 'v3'], fps: 24, bitrateMbps: 6 }),
  ];
  wf.edges = [
    edge('v1', 'out:video', 'm', 'in:video', 'video'),
    edge('v2', 'out:video', 'm', 'in:video', 'video'),
    edge('v3', 'out:video', 'm', 'in:video', 'video'),
  ];
  wf.edges[1]!.id = 'v2-m';
  wf.edges[2]!.id = 'v3-m';
  await workflowRepo.save(wf);
  return wf;
}

function waitUntil(predicate: () => boolean, timeoutMs = 8_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (predicate()) {
        resolve();
        return;
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error('timeout waiting for condition'));
        return;
      }
      setTimeout(tick, 10);
    };
    tick();
  });
}

async function waitQueueIdle(manager: RunManager) {
  await waitUntil(() => {
    const q = manager.getQueueCounts();
    return q.running === 0 && q.waiting === 0;
  });
}

function okVideoRouter(onGenerate?: (action: DriverAction) => void): ProviderRouter {
  return {
    execute: async (_p: string, action: DriverAction) => {
      onGenerate?.(action);
      return {
        medias: [{ kind: 'video', mime: 'video/mp4', dataBase64: btoa('new-v2'), mediaId: 'new-v2' }],
      };
    },
  } as unknown as ProviderRouter;
}

describe('RunManager.regenerate', () => {
  it('tao lai canh 2 thieu video roi tu ghep 3 clip dung thu tu', async () => {
    const c1 = await saveClip('c1');
    const c3 = await saveClip('c3');
    const wf = await threeClipsMerge({ v1: c1.id, v3: c3.id });

    const calls: DriverAction[] = [];
    const compose = await import('@/media/composeClient');
    let composeClipCount = 0;
    const spy = vi.spyOn(compose, 'composeVideoInOffscreen').mockImplementation(async (job) => {
      composeClipCount = job.clips.length;
      return new Blob(['merged'], { type: 'video/mp4' });
    });

    const manager = new RunManager(
      okVideoRouter((a) => calls.push(a)),
      (_ev: SwToUiEvent) => undefined,
    );
    await manager.regenerate(wf.id, 'v2');
    await waitUntil(() => composeClipCount === 3);
    await waitQueueIdle(manager);
    spy.mockRestore();

    expect(calls.filter((c) => c.name === 'generate')).toHaveLength(1);
    expect(composeClipCount).toBe(3);
  });

  it('canh 3 cung thieu video -> khong compose (AC-05.3)', async () => {
    const c1 = await saveClip('c1');
    const wf = await threeClipsMerge({ v1: c1.id });

    let genDone = false;
    const compose = await import('@/media/composeClient');
    const spy = vi.spyOn(compose, 'composeVideoInOffscreen').mockResolvedValue(new Blob(['m']));

    const manager = new RunManager(
      {
        execute: async () => {
          genDone = true;
          return {
            medias: [{ kind: 'video', mime: 'video/mp4', dataBase64: btoa('new-v2'), mediaId: 'new-v2' }],
          };
        },
      } as unknown as ProviderRouter,
      () => undefined,
    );
    await manager.regenerate(wf.id, 'v2');
    await waitUntil(() => genDone);
    await waitQueueIdle(manager);
    const composeCalls = spy.mock.calls.length;
    spy.mockRestore();

    expect(composeCalls).toBe(0);
  });

  it('canh 3 loi gan nhat nhung con previewOutputId -> van compose (AC-05.4)', async () => {
    const c1 = await saveClip('c1');
    const c3 = await saveClip('c3');
    const wf = await threeClipsMerge({ v1: c1.id, v3: c3.id });

    const badRun = await runRepo.create({ workflowId: wf.id, mode: 'only', fromNodeId: 'v3' });
    await runRepo.setNodeStatus(badRun.id, 'v3', 'error', { error: 'policy' });
    await runRepo.update(badRun.id, { status: 'error', finishedAt: Date.now() });

    const compose = await import('@/media/composeClient');
    let composeCalls = 0;
    const spy = vi.spyOn(compose, 'composeVideoInOffscreen').mockImplementation(async () => {
      composeCalls += 1;
      return new Blob(['merged'], { type: 'video/mp4' });
    });

    const manager = new RunManager(okVideoRouter(), () => undefined);
    await manager.regenerate(wf.id, 'v2');
    await waitUntil(() => composeCalls > 0);
    await waitQueueIdle(manager);
    spy.mockRestore();

    expect(composeCalls).toBe(1);
  });

  it('generate loi -> khong compose', async () => {
    const c1 = await saveClip('c1');
    const c3 = await saveClip('c3');
    const wf = await threeClipsMerge({ v1: c1.id, v3: c3.id });

    let done = false;
    const compose = await import('@/media/composeClient');
    const spy = vi.spyOn(compose, 'composeVideoInOffscreen').mockResolvedValue(new Blob(['m']));

    const manager = new RunManager(
      {
        execute: async () => {
          throw Object.assign(new Error('CONTENT_POLICY'), { code: 'CONTENT_POLICY' });
        },
      } as unknown as ProviderRouter,
      (ev) => {
        if (ev.type === 'run.done') done = true;
      },
    );
    await manager.regenerate(wf.id, 'v2');
    await waitUntil(() => done);
    await waitQueueIdle(manager);
    const composeCalls = spy.mock.calls.length;
    spy.mockRestore();

    expect(composeCalls).toBe(0);
  });

  it('canh sau dung canh 2 lam canh truoc khong bi chay lai (AC-05.5)', async () => {
    const c3 = await saveClip('c3');
    const wf = createEmptyWorkflow('ws');
    // Khong noi Merge - chi kiem tra mode only khong tao lai v3.
    wf.nodes = [
      node('v2', 'generateVideo', { prompt: '2' }),
      node('p', 'prompt', { preset: 'custom', instruction: 'tiep' }),
      node('v3', 'generateVideo', { prompt: '3', previewOutputId: c3.id }),
    ];
    wf.edges = [
      edge('v2', 'out:video', 'p', 'in:video', 'video'),
      edge('p', 'out:text', 'v3', 'in:text', 'text'),
    ];
    await workflowRepo.save(wf);

    const generatedNodes: string[] = [];
    let done = false;
    const manager = new RunManager(
      {
        execute: async (_p: string, action: DriverAction) => {
          if (action.name === 'generate') {
            const ctx = (action.payload as { logCtx?: { nodeId?: string } }).logCtx;
            generatedNodes.push(ctx?.nodeId ?? '?');
          }
          return {
            medias: [{ kind: 'video', mime: 'video/mp4', dataBase64: btoa('new-v2'), mediaId: 'new-v2' }],
          };
        },
      } as unknown as ProviderRouter,
      (ev) => {
        if (ev.type === 'run.done') done = true;
      },
    );
    await manager.regenerate(wf.id, 'v2');
    await waitUntil(() => done);
    await waitQueueIdle(manager);

    expect(generatedNodes).toEqual(['v2']);
  });

  it('node khong phai generate / disabled -> loi', async () => {
    const wf = createEmptyWorkflow('ws');
    wf.nodes = [
      node('a', 'asset', { kind: 'image' }),
      node('v', 'generateVideo', { prompt: 'x' }),
      node('off', 'generateVideo', { prompt: 'y' }),
    ];
    wf.nodes[2]!.disabled = true;
    await workflowRepo.save(wf);

    const manager = new RunManager(
      { execute: async () => ({}) } as unknown as ProviderRouter,
      () => undefined,
    );
    await expect(manager.regenerate(wf.id, 'a')).rejects.toThrow(strings.regenerateNotGenerateNode);
    await expect(manager.regenerate(wf.id, 'off')).rejects.toThrow(strings.regenerateNodeDisabled);
    await expect(manager.regenerate(wf.id, 'missing')).rejects.toThrow(strings.nodeNotFound);
  });
});
