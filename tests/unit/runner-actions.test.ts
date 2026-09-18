import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  moveClip,
  pickLocalAsset,
  setRunnerErrorHandler,
  updateNodeField,
} from '@/features/runner/actions';
import type { RunnerAssetSlot, RunnerMergeInfo } from '@/features/runner/selectors';
import { db } from '@/storage/db';
import { createEmptyWorkflow, workflowRepo } from '@/storage/repos/workflowRepo';
import type { WorkflowNode } from '@/shared/schema';

beforeEach(async () => {
  await db.delete();
  await db.open();
  setRunnerErrorHandler(() => undefined);
});

function node(id: string, type: WorkflowNode['type'], data: Record<string, unknown>): WorkflowNode {
  return { id, type, position: { x: 0, y: 0 }, data };
}

describe('runner actions', () => {
  it('chon file sai loai bi tu choi, node khong doi', async () => {
    const wf = createEmptyWorkflow('ws');
    wf.nodes = [node('a', 'asset', { assetLabel: 'Character', kind: 'image', assetId: 'old' })];
    await workflowRepo.save(wf);

    const errors: string[] = [];
    setRunnerErrorHandler((m) => errors.push(m));

    const slot: RunnerAssetSlot = {
      nodeId: 'a',
      label: 'Character',
      kind: 'image',
      assetId: 'old',
      missing: false,
    };
    const video = new File(['x'], 'clip.mp4', { type: 'video/mp4' });
    await pickLocalAsset(wf.id, slot, video, wf);

    const saved = await workflowRepo.get(wf.id);
    expect((saved!.nodes[0]!.data as { assetId?: string }).assetId).toBe('old');
    expect(errors.length).toBeGreaterThan(0);
  });

  it('chon dung loai ghi patch', async () => {
    const wf = createEmptyWorkflow('ws');
    wf.nodes = [node('a', 'asset', { assetLabel: 'Character', kind: 'image' })];
    await workflowRepo.save(wf);

    const slot: RunnerAssetSlot = {
      nodeId: 'a',
      label: 'Character',
      kind: 'image',
      missing: false,
    };
    const image = new File(['png'], 'face.png', { type: 'image/png' });
    await pickLocalAsset(wf.id, slot, image, (await workflowRepo.get(wf.id))!);

    const saved = await workflowRepo.get(wf.id);
    const data = saved!.nodes[0]!.data as { assetId?: string; source?: string; missing?: boolean };
    expect(data.assetId).toBeTruthy();
    expect(data.source).toBe('local');
    expect(data.missing).toBe(false);
  });

  it('moveClip ghi order moi', async () => {
    const wf = createEmptyWorkflow('ws');
    wf.nodes = [
      node('v1', 'generateVideo', { prompt: '1' }),
      node('v2', 'generateVideo', { prompt: '2' }),
      node('m', 'mergeVideo', { order: ['v1', 'v2'] }),
    ];
    await workflowRepo.save(wf);
    const merge: RunnerMergeInfo = {
      nodeId: 'm',
      order: ['v1', 'v2'],
      clipNodeIds: ['v1', 'v2'],
      aspectRatio: '9:16',
    };
    await moveClip(wf.id, merge, 'v1', 1, wf);
    const saved = await workflowRepo.get(wf.id);
    expect((saved!.nodes.find((n) => n.id === 'm')!.data as { order: string[] }).order).toEqual([
      'v2',
      'v1',
    ]);
  });

  it('workflow bi khoa thi action ghi khong chay', async () => {
    const wf = createEmptyWorkflow('ws');
    wf.locked = true;
    wf.nodes = [node('v1', 'generateVideo', { prompt: 'cu' })];
    await workflowRepo.save(wf);

    const spy = vi.spyOn(workflowRepo, 'patchNodeData');
    await updateNodeField(wf.id, 'v1', { prompt: 'moi' }, wf);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();

    const saved = await workflowRepo.get(wf.id);
    expect((saved!.nodes[0]!.data as { prompt: string }).prompt).toBe('cu');
  });
});
