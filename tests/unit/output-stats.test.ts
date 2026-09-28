import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/storage/db';
import { runRepo } from '@/storage/repos/runRepo';
import { hashBlobContent, nanoid } from '@/shared/utils';
import type { NodeRun, Run } from '@/shared/schema';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

async function addRun(partial: Partial<Run> & { workflowId: string; startedAt: number }): Promise<Run> {
  const run: Run = {
    id: partial.id ?? nanoid(),
    workflowId: partial.workflowId,
    status: partial.status ?? 'success',
    startedAt: partial.startedAt,
    mode: partial.mode ?? 'full',
    finishedAt: partial.finishedAt,
  };
  await db.runs.add(run);
  return run;
}

async function addNodeRun(
  partial: Partial<NodeRun> & { runId: string; nodeId: string },
): Promise<NodeRun> {
  const nr: NodeRun = {
    id: partial.id ?? nanoid(),
    runId: partial.runId,
    nodeId: partial.nodeId,
    status: partial.status ?? 'success',
    outputIds: partial.outputIds ?? [],
    logs: [],
    startedAt: partial.startedAt,
    finishedAt: partial.finishedAt,
  };
  await db.nodeRuns.put(nr);
  return nr;
}

describe('hashBlobContent', () => {
  it('hai blob cùng size khác nội dung → hash khác nhau', async () => {
    const a = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'application/octet-stream' });
    const b = new Blob([new Uint8Array([1, 2, 3, 5])], { type: 'application/octet-stream' });
    expect(a.size).toBe(b.size);
    const ha = await hashBlobContent(a);
    const hb = await hashBlobContent(b);
    expect(ha).not.toBe(hb);
    expect(ha).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('Dexie v2 outputs.workflowId backfill', () => {
  it('upgrade gắn workflowId từ nodeRuns + runs', async () => {
    await db.close();
    await db.delete();

    const Dexie = (await import('dexie')).default;
    const legacy = new Dexie('my-x-flows');
    legacy.version(1).stores({
      workspaces: 'id, updatedAt, isCurrent',
      workflows: 'id, workspaceId, updatedAt, enabled, name, deletedAt',
      workflowRevisions: 'id, workflowId, createdAt',
      drafts: 'workflowId, updatedAt',
      assets: 'id, sha256, workflowId, createdAt',
      templates: 'id, category, updatedAt',
      runs: 'id, workflowId, status, startedAt',
      nodeRuns: 'id, [runId+nodeId], runId, nodeId, status',
      outputs: 'id, nodeRunId, createdAt',
      notifications: 'id, createdAt, read',
    });
    await legacy.open();
    await legacy.table('runs').add({
      id: 'run-1',
      workflowId: 'wf-backfill',
      status: 'success',
      startedAt: 1,
      mode: 'full',
    });
    await legacy.table('nodeRuns').add({
      id: 'nr-1',
      runId: 'run-1',
      nodeId: 'n1',
      status: 'success',
      outputIds: [],
      logs: [],
    });
    await legacy.table('outputs').add({
      id: 'out-1',
      nodeRunId: 'nr-1',
      kind: 'image',
      createdAt: 10,
    });
    legacy.close();

    await db.open();
    const row = await db.outputs.get('out-1');
    expect(row?.workflowId).toBe('wf-backfill');
  });
});

describe('runRepo.getOutputStats', () => {
  it('đếm ảnh/video và trả thumbs mới nhất', async () => {
    const wf = 'wf-stats';
    const run = await addRun({ workflowId: wf, startedAt: 100 });
    const nr = await addNodeRun({ runId: run.id, nodeId: 'gen' });

    await db.outputs.bulkPut([
      {
        id: 'img-old',
        nodeRunId: nr.id,
        workflowId: wf,
        kind: 'image',
        mime: 'image/png',
        createdAt: 100,
        blob: new Blob([new Uint8Array([1])], { type: 'image/png' }),
      },
      {
        id: 'img-mid',
        nodeRunId: nr.id,
        workflowId: wf,
        kind: 'image',
        mime: 'image/png',
        createdAt: 200,
        blob: new Blob([new Uint8Array([2])], { type: 'image/png' }),
      },
      {
        id: 'vid-new',
        nodeRunId: nr.id,
        workflowId: wf,
        kind: 'video',
        mime: 'video/mp4',
        createdAt: 300,
        blob: new Blob([new Uint8Array([3])], { type: 'video/mp4' }),
      },
      {
        id: 'txt',
        nodeRunId: nr.id,
        workflowId: wf,
        kind: 'text',
        text: 'ignore',
        createdAt: 400,
      },
    ]);

    const stats = await runRepo.getOutputStats([wf, 'empty'], 2);
    expect(stats[wf]!.images).toBe(2);
    expect(stats[wf]!.videos).toBe(1);
    expect(stats[wf]!.thumbs.map((t) => t.id)).toEqual(['vid-new', 'img-mid']);
    expect(stats[wf]!.thumbs).toHaveLength(2);
    expect(stats.empty).toEqual({ images: 0, videos: 0, thumbs: [] });
  });

  it('chỉ hydrate ≤ thumbLimit bản ghi; vẫn đếm đủ nhiều output', async () => {
    const wf = 'wf-many';
    const run = await addRun({ workflowId: wf, startedAt: 1 });
    const nr = await addNodeRun({ runId: run.id, nodeId: 'gen' });

    const rows = Array.from({ length: 12 }, (_, i) => ({
      id: `out-${i}`,
      nodeRunId: nr.id,
      workflowId: wf,
      kind: (i % 3 === 0 ? 'video' : 'image') as 'image' | 'video',
      mime: i % 3 === 0 ? 'video/mp4' : 'image/png',
      createdAt: i + 1,
      blob: new Blob([new Uint8Array([i])], {
        type: i % 3 === 0 ? 'video/mp4' : 'image/png',
      }),
    }));
    await db.outputs.bulkPut(rows);

    const stats = await runRepo.getOutputStats([wf], 4);
    expect(stats[wf]!.images).toBe(8);
    expect(stats[wf]!.videos).toBe(4);
    expect(stats[wf]!.thumbs).toHaveLength(4);
    expect(stats[wf]!.thumbs.map((t) => t.id)).toEqual([
      'out-11',
      'out-10',
      'out-9',
      'out-8',
    ]);
    // Thumbs are full OutputRecords (blob round-trip depends on IDB; fake-indexeddb may strip Blob).
    expect(stats[wf]!.thumbs.every((t) => t.kind === 'image' || t.kind === 'video')).toBe(true);
  });

  it('saveOutput ghi workflowId', async () => {
    const run = await addRun({ workflowId: 'wf-save', startedAt: 1 });
    const nr = await addNodeRun({ runId: run.id, nodeId: 'n' });
    const out = await runRepo.saveOutput({
      nodeRunId: nr.id,
      workflowId: 'wf-save',
      kind: 'image',
      mime: 'image/png',
      blob: new Blob([new Uint8Array([9])], { type: 'image/png' }),
    });
    expect(out.workflowId).toBe('wf-save');
    expect((await db.outputs.get(out.id))?.workflowId).toBe('wf-save');
  });
});
