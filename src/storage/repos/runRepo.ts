import { db, type OutputRecord } from '@/storage/db';
import type { NodeRun, NodeRunStatus, Run, RunStatus } from '@/shared/schema';
import { nanoid } from '@/shared/utils';

export const runRepo = {
  async create(partial: Omit<Run, 'id' | 'startedAt' | 'status'> & { status?: RunStatus }): Promise<Run> {
    const run: Run = {
      id: nanoid(),
      status: partial.status ?? 'queued',
      startedAt: Date.now(),
      workflowId: partial.workflowId,
      fromNodeId: partial.fromNodeId,
      mode: partial.mode ?? 'full',
    };
    await db.runs.add(run);
    return run;
  },

  async update(id: string, patch: Partial<Run>): Promise<void> {
    await db.runs.update(id, patch);
  },

  async get(id: string): Promise<Run | undefined> {
    return db.runs.get(id);
  },

  async listByWorkflow(workflowId: string, limit = 20): Promise<Run[]> {
    const rows = await db.runs.where('workflowId').equals(workflowId).sortBy('startedAt');
    return rows.reverse().slice(0, limit);
  },

  async latest(workflowId: string): Promise<Run | undefined> {
    const rows = await this.listByWorkflow(workflowId, 1);
    return rows[0];
  },

  /**
   * Bản NodeRun mới nhất cho mỗi node trong `limit` run gần nhất.
   * So theo run.startedAt, cùng run thì so finishedAt ?? startedAt.
   */
  async latestNodeRuns(workflowId: string, limit = 20): Promise<Map<string, NodeRun>> {
    const runs = await this.listByWorkflow(workflowId, limit);
    const result = new Map<string, NodeRun>();
    if (runs.length === 0) return result;

    const runById = new Map(runs.map((r) => [r.id, r]));
    const runIds = runs.map((r) => r.id);
    const nodeRuns = await db.nodeRuns.where('runId').anyOf(runIds).toArray();

    for (const nr of nodeRuns) {
      const run = runById.get(nr.runId);
      if (!run) continue;
      const prev = result.get(nr.nodeId);
      if (!prev) {
        result.set(nr.nodeId, nr);
        continue;
      }
      const prevRun = runById.get(prev.runId)!;
      if (run.startedAt > prevRun.startedAt) {
        result.set(nr.nodeId, nr);
        continue;
      }
      if (run.startedAt < prevRun.startedAt) continue;
      const nrAt = nr.finishedAt ?? nr.startedAt ?? 0;
      const prevAt = prev.finishedAt ?? prev.startedAt ?? 0;
      if (nrAt >= prevAt) result.set(nr.nodeId, nr);
    }
    return result;
  },

  async listRunning(): Promise<Run[]> {
    return db.runs.where('status').anyOf('queued', 'running').toArray();
  },

  async upsertNodeRun(nodeRun: NodeRun): Promise<void> {
    await db.nodeRuns.put(nodeRun);
  },

  async getNodeRun(runId: string, nodeId: string): Promise<NodeRun | undefined> {
    return db.nodeRuns.where('[runId+nodeId]').equals([runId, nodeId]).first();
  },

  async listNodeRuns(runId: string): Promise<NodeRun[]> {
    return db.nodeRuns.where('runId').equals(runId).toArray();
  },

  async setNodeStatus(
    runId: string,
    nodeId: string,
    status: NodeRunStatus,
    patch?: Partial<NodeRun>,
  ): Promise<NodeRun> {
    const existing = await this.getNodeRun(runId, nodeId);
    const next: NodeRun = {
      id: existing?.id ?? nanoid(),
      runId,
      nodeId,
      status,
      progress: patch?.progress ?? existing?.progress,
      message: patch?.message ?? existing?.message,
      error: patch?.error,
      errorCode: patch?.errorCode,
      outputIds: patch?.outputIds ?? existing?.outputIds ?? [],
      startedAt: existing?.startedAt ?? (status === 'running' ? Date.now() : undefined),
      finishedAt:
        status === 'success' || status === 'error' || status === 'cancelled' || status === 'skipped'
          ? Date.now()
          : existing?.finishedAt,
      inputHash: patch?.inputHash ?? existing?.inputHash,
      logs: [...(existing?.logs ?? []), ...(patch?.logs ?? [])],
    };
    await db.nodeRuns.put(next);
    return next;
  },

  async saveOutput(partial: Omit<OutputRecord, 'id' | 'createdAt'> & { id?: string }): Promise<OutputRecord> {
    const rec: OutputRecord = {
      id: partial.id ?? nanoid(),
      nodeRunId: partial.nodeRunId,
      kind: partial.kind,
      mime: partial.mime,
      text: partial.text,
      size: partial.size ?? partial.blob?.size,
      flowMediaId: partial.flowMediaId,
      createdAt: Date.now(),
      blob: partial.blob,
    };
    await db.outputs.put(rec);
    return rec;
  },

  async getOutput(id: string): Promise<OutputRecord | undefined> {
    return db.outputs.get(id);
  },

  async clearWorkflowOutputs(workflowId: string): Promise<void> {
    const runs = await db.runs.where('workflowId').equals(workflowId).toArray();
    for (const run of runs) {
      const nodeRuns = await this.listNodeRuns(run.id);
      for (const nr of nodeRuns) {
        const outs = await db.outputs.where('nodeRunId').equals(nr.id).primaryKeys();
        await db.outputs.bulkDelete(outs);
      }
    }
  },
};
