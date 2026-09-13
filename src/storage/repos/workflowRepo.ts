import { db } from '@/storage/db';
import {
  type Workflow,
  type WorkflowNode,
  type WorkflowEdge,
  WorkflowSchema,
  SCHEMA_VERSION,
  validateNodeData,
  upgradeStoredWorkflow,
  type NodeType,
} from '@/shared/schema';
import { nanoid } from '@/shared/utils';
import { strings } from '@/shared/strings';

const MAX_REVISIONS = 20;

function defaultNodeData(type: NodeType) {
  return validateNodeData(type, {});
}

export function createEmptyWorkflow(workspaceId: string, name = 'Workflow mới'): Workflow {
  const now = Date.now();
  return {
    id: nanoid(),
    schemaVersion: SCHEMA_VERSION,
    workspaceId,
    name,
    enabled: false,
    locked: false,
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 0.8 },
    settings: { concurrency: 1, retry: 2, stopOnError: true },
    createdAt: now,
    updatedAt: now,
  };
}

export const workflowRepo = {
  async list(workspaceId?: string): Promise<Workflow[]> {
    let rows: Workflow[];
    if (workspaceId) {
      rows = await db.workflows.where('workspaceId').equals(workspaceId).toArray();
    } else {
      rows = await db.workflows.toArray();
    }
    return rows
      .filter((w) => !w.deletedAt)
      .map(upgradeStoredWorkflow)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },

  async listAllIncludingDeleted(): Promise<Workflow[]> {
    return db.workflows.toArray();
  },

  async get(id: string): Promise<Workflow | undefined> {
    const wf = await db.workflows.get(id);
    return wf && upgradeStoredWorkflow(wf);
  },

  async create(partial: Partial<Workflow> & { workspaceId: string; name: string }): Promise<Workflow> {
    const wf = WorkflowSchema.parse({
      ...createEmptyWorkflow(partial.workspaceId, partial.name),
      ...partial,
      schemaVersion: SCHEMA_VERSION,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await db.workflows.add(wf);
    return wf;
  },

  async save(workflow: Workflow, opts?: { revision?: boolean }): Promise<Workflow> {
    const cleaned: Workflow = {
      ...workflow,
      schemaVersion: SCHEMA_VERSION,
      updatedAt: Date.now(),
      nodes: workflow.nodes.map((n) => ({
        ...n,
        data: validateNodeData(n.type as NodeType, n.data) as Record<string, unknown>,
      })),
    };
    const parsed = WorkflowSchema.parse(cleaned);

    await db.transaction('rw', db.workflows, db.workflowRevisions, db.drafts, async () => {
      await db.workflows.put(parsed);
      if (opts?.revision !== false) {
        await db.workflowRevisions.add({
          id: nanoid(),
          workflowId: parsed.id,
          workflow: parsed,
          createdAt: Date.now(),
        });
        const revs = await db.workflowRevisions
          .where('workflowId')
          .equals(parsed.id)
          .sortBy('createdAt');
        if (revs.length > MAX_REVISIONS) {
          const drop = revs.slice(0, revs.length - MAX_REVISIONS);
          await db.workflowRevisions.bulkDelete(drop.map((r) => r.id));
        }
      }
      await db.drafts.delete(parsed.id);
    });

    return parsed;
  },

  async saveDraft(workflow: Workflow): Promise<void> {
    await db.drafts.put({
      workflowId: workflow.id,
      workflow: { ...workflow, updatedAt: Date.now() },
      updatedAt: Date.now(),
    });
  },

  async getDraft(workflowId: string) {
    return db.drafts.get(workflowId);
  },

  async clearDraft(workflowId: string) {
    await db.drafts.delete(workflowId);
  },

  async setEnabled(id: string, enabled: boolean): Promise<void> {
    await db.workflows.update(id, { enabled, updatedAt: Date.now() });
  },

  async rename(id: string, name: string): Promise<void> {
    await db.workflows.update(id, { name, updatedAt: Date.now() });
  },

  async softDelete(id: string): Promise<void> {
    await db.workflows.update(id, { deletedAt: Date.now(), enabled: false, updatedAt: Date.now() });
  },

  async restore(id: string): Promise<void> {
    await db.workflows.update(id, { deletedAt: undefined, updatedAt: Date.now() });
  },

  async hardDelete(id: string): Promise<void> {
    await db.transaction('rw', [db.workflows, db.workflowRevisions, db.drafts], async () => {
      await db.workflows.delete(id);
      await db.drafts.delete(id);
      const revs = await db.workflowRevisions.where('workflowId').equals(id).primaryKeys();
      await db.workflowRevisions.bulkDelete(revs);
    });
  },

  async duplicate(id: string): Promise<Workflow> {
    const src = await this.get(id);
    if (!src) throw new Error('Workflow không tồn tại');
    const now = Date.now();
    const copy: Workflow = {
      ...structuredClone(src),
      id: nanoid(),
      name: `${src.name} ${strings.copySuffix}`,
      enabled: false,
      createdAt: now,
      updatedAt: now,
      deletedAt: undefined,
    };
    await db.workflows.add(copy);
    return copy;
  },

  async moveToWorkspace(id: string, workspaceId: string): Promise<void> {
    await db.workflows.update(id, { workspaceId, updatedAt: Date.now() });
  },

  async cloneFromTemplate(
    templateWorkflow: Omit<Workflow, 'workspaceId' | 'enabled'> & { workspaceId?: string },
    workspaceId: string,
  ): Promise<Workflow> {
    const now = Date.now();
    const idMap = new Map<string, string>();
    const nodes: WorkflowNode[] = templateWorkflow.nodes.map((n) => {
      const newId = nanoid();
      idMap.set(n.id, newId);
      return { ...structuredClone(n), id: newId };
    });
    const edges: WorkflowEdge[] = templateWorkflow.edges.map((e) => ({
      ...e,
      id: nanoid(),
      source: idMap.get(e.source) ?? e.source,
      target: idMap.get(e.target) ?? e.target,
    }));

    const wf: Workflow = {
      ...structuredClone(templateWorkflow),
      id: nanoid(),
      workspaceId,
      name: `${templateWorkflow.name} ${strings.copySuffix}`,
      enabled: false,
      locked: false,
      nodes,
      edges,
      createdAt: now,
      updatedAt: now,
      sourceTemplateId: templateWorkflow.id,
      deletedAt: undefined,
    };
    await db.workflows.add(wf);
    return wf;
  },
};

export { defaultNodeData };
