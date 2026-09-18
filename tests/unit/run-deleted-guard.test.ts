import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RunManager } from '@/engine/RunManager';
import type { ProviderRouter } from '@/providers/TabPool';
import { db } from '@/storage/db';
import { runRepo } from '@/storage/repos/runRepo';
import { createEmptyWorkflow, workflowRepo } from '@/storage/repos/workflowRepo';
import type { DriverAction, SwToUiEvent } from '@/shared/messaging';
import { strings } from '@/shared/strings';
import type { WorkflowNode } from '@/shared/schema';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

function node(id: string, type: WorkflowNode['type'], data: Record<string, unknown>): WorkflowNode {
  return { id, type, position: { x: 0, y: 0 }, data };
}

describe('RunManager - workflow đã xoá', () => {
  it('runWorkflow trên workflow đã xoá ném lỗi', async () => {
    const wf = createEmptyWorkflow('ws');
    wf.nodes = [node('v1', 'generateVideo', { prompt: 'x' })];
    await workflowRepo.save(wf);
    await workflowRepo.softDelete(wf.id);

    const manager = new RunManager(
      { execute: async () => ({}) } as unknown as ProviderRouter,
      () => undefined,
    );
    await expect(manager.runWorkflow(wf.id)).rejects.toThrow(strings.workflowDeleted);
  });

  it('xoá mềm sau khi xếp hàng → run cancelled, driver không bị gọi', async () => {
    const wf = createEmptyWorkflow('ws');
    wf.nodes = [node('v1', 'generateVideo', { prompt: 'cảnh' })];
    await workflowRepo.save(wf);

    const calls: DriverAction[] = [];
    const router = {
      execute: async (_provider: string, action: DriverAction) => {
        calls.push(action);
        return { medias: [{ kind: 'video', mime: 'video/mp4', dataBase64: btoa('x'), mediaId: 'm' }] };
      },
    } as unknown as ProviderRouter;

    let finish!: (ev: Extract<SwToUiEvent, { type: 'run.done' }>) => void;
    const done = new Promise<Extract<SwToUiEvent, { type: 'run.done' }>>((r) => (finish = r));

    // Soft-delete ngay sau khi tạo run (sau guard deletedAt của runWorkflow),
    // trước khi executeRun đọc lại workflow.
    const realCreate = runRepo.create.bind(runRepo);
    vi.spyOn(runRepo, 'create').mockImplementation(async (partial) => {
      const run = await realCreate(partial);
      await workflowRepo.softDelete(partial.workflowId);
      return run;
    });

    const manager = new RunManager(router, (ev) => {
      if (ev.type === 'run.done') finish(ev);
    });
    const runId = await manager.runWorkflow(wf.id);
    const ev = await done;

    expect(ev.runId).toBe(runId);
    expect(ev.workflowId).toBe(wf.id);
    expect(ev.status).toBe('cancelled');
    expect(calls).toHaveLength(0);

    const stored = await runRepo.get(runId);
    expect(stored?.status).toBe('cancelled');
  });
});
