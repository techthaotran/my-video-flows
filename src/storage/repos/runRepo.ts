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
    return db.runs.where('workflowId').equals(workflowId).reverse().limit(limit).sortBy('startedAt');
  },

  async latest(workflowId: string): Promise<Run | undefined> {
    const rows = await db.runs.where('workflowId').equals(workflowId).reverse().sortBy('startedAt');
    return rows.at(-1) ?? rows[0];
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
