import { beforeEach, describe, expect, it } from 'vitest';
import { RunManager } from '@/engine/RunManager';
import type { ProviderRouter } from '@/providers/TabPool';
import { db } from '@/storage/db';
import { createEmptyWorkflow, workflowRepo } from '@/storage/repos/workflowRepo';
import type { DriverAction, SwToUiEvent } from '@/shared/messaging';
import type { WorkflowNode } from '@/shared/schema';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

function node(id: string, type: WorkflowNode['type'], data: Record<string, unknown>): WorkflowNode {
  return { id, type, position: { x: 0, y: 0 }, data };
}

describe('RunManager - patchNodeData không ghi đè field khác', () => {
  it('sửa field node khác trong lúc run → previewOutputId và field đó đều còn', async () => {
    const wf = createEmptyWorkflow('ws');
    wf.nodes = [node('v1', 'generateVideo', { prompt: 'ban đầu', model: 'Veo 3.1 Lite' })];
    await workflowRepo.save(wf);

    const router = {
      execute: async (_provider: string, _action: DriverAction) => {
        // Trong lúc generate, cửa sổ "Chạy" (hoặc editor) patch prompt.
        await workflowRepo.patchNodeData(wf.id, 'v1', { prompt: 'sửa giữa chừng' });
        return {
          medias: [{ kind: 'video', mime: 'video/mp4', dataBase64: btoa('clip'), mediaId: 'mid' }],
        };
      },
    } as unknown as ProviderRouter;

    let finish!: () => void;
    const done = new Promise<void>((r) => (finish = r));
    const manager = new RunManager(router, (ev: SwToUiEvent) => {
      if (ev.type === 'run.done') finish();
    });
    await manager.runWorkflow(wf.id, { mode: 'only', nodeId: 'v1' });
    await done;

    const saved = await workflowRepo.get(wf.id);
    const data = saved!.nodes.find((n) => n.id === 'v1')!.data as {
      prompt: string;
      previewOutputId?: string;
    };
    expect(data.prompt).toBe('sửa giữa chừng');
    expect(data.previewOutputId).toBeTruthy();
  });
});
