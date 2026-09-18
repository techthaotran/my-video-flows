import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/storage/db';
import { runRepo } from '@/storage/repos/runRepo';
import type { NodeRun, Run } from '@/shared/schema';
import { nanoid } from '@/shared/utils';

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

async function addNodeRun(partial: Partial<NodeRun> & { runId: string; nodeId: string }): Promise<NodeRun> {
  const nr: NodeRun = {
    id: partial.id ?? nanoid(),
    runId: partial.runId,
    nodeId: partial.nodeId,
    status: partial.status ?? 'success',
    outputIds: partial.outputIds ?? [],
    logs: [],
    startedAt: partial.startedAt,
    finishedAt: partial.finishedAt,
    error: partial.error,
    progress: partial.progress,
  };
  await db.nodeRuns.put(nr);
  return nr;
}

describe('runRepo.listByWorkflow', () => {
  it('trả đúng thứ tự mới → cũ và tôn trọng limit', async () => {
    const wf = 'wf-1';
    await addRun({ workflowId: wf, startedAt: 100, id: 'r1' });
    await addRun({ workflowId: wf, startedAt: 300, id: 'r3' });
    await addRun({ workflowId: wf, startedAt: 200, id: 'r2' });
    await addRun({ workflowId: 'other', startedAt: 400, id: 'rx' });

    const rows = await runRepo.listByWorkflow(wf, 2);
    expect(rows.map((r) => r.id)).toEqual(['r3', 'r2']);
  });
});

describe('runRepo.latestNodeRuns', () => {
  it('chọn đúng bản mới nhất qua nhiều run', async () => {
    const wf = 'wf-1';
    const old = await addRun({ workflowId: wf, startedAt: 100, id: 'old' });
    const mid = await addRun({ workflowId: wf, startedAt: 200, id: 'mid' });
    const neu = await addRun({ workflowId: wf, startedAt: 300, id: 'new' });

    await addNodeRun({ runId: old.id, nodeId: 'a', status: 'error', finishedAt: 110 });
    await addNodeRun({ runId: mid.id, nodeId: 'a', status: 'success', finishedAt: 210 });
    await addNodeRun({ runId: neu.id, nodeId: 'b', status: 'running', startedAt: 310 });
    // Cùng run: bản finishedAt lớn hơn thắng.
    await addNodeRun({
      runId: neu.id,
      nodeId: 'c',
      status: 'queued',
      startedAt: 305,
      finishedAt: undefined,
      id: 'c-old',
    });
    await addNodeRun({
      runId: neu.id,
      nodeId: 'c',
      status: 'success',
      startedAt: 305,
      finishedAt: 320,
      id: 'c-new',
    });

    const map = await runRepo.latestNodeRuns(wf, 20);
    expect(map.get('a')?.status).toBe('success');
    expect(map.get('a')?.runId).toBe(mid.id);
    expect(map.get('b')?.status).toBe('running');
    expect(map.get('c')?.id).toBe('c-new');
  });

  it('node không có trong 20 run thì không có key', async () => {
    const wf = 'wf-1';
    // 21 run: node chỉ xuất hiện ở run cũ nhất sẽ bị đẩy ra ngoài limit 20.
    for (let i = 0; i < 21; i++) {
      const run = await addRun({ workflowId: wf, startedAt: i + 1, id: `r${i}` });
      if (i === 0) {
        await addNodeRun({ runId: run.id, nodeId: 'ancient', status: 'success', finishedAt: 1 });
      }
      if (i === 20) {
        await addNodeRun({ runId: run.id, nodeId: 'fresh', status: 'success', finishedAt: 21 });
      }
    }

    const map = await runRepo.latestNodeRuns(wf, 20);
    expect(map.has('ancient')).toBe(false);
    expect(map.has('fresh')).toBe(true);
  });
});
