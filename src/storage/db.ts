import Dexie, { type EntityTable } from 'dexie';
import type {
  AssetMeta,
  NodeRun,
  OutputMeta,
  Run,
  Template,
  Workflow,
  Workspace,
} from '@/shared/schema';
import { SCHEMA_VERSION } from '@/shared/schema';

export interface AssetRecord extends AssetMeta {
  blob: Blob;
}

export interface OutputRecord extends OutputMeta {
  blob?: Blob;
}

export interface DraftRecord {
  workflowId: string;
  workflow: Workflow;
  updatedAt: number;
}

export interface RevisionRecord {
  id: string;
  workflowId: string;
  workflow: Workflow;
  createdAt: number;
}

export interface NotificationRecord {
  id: string;
  title: string;
  body: string;
  level: 'info' | 'success' | 'error';
  read: boolean;
  createdAt: number;
}

export class MyXFlowsDB extends Dexie {
  workspaces!: EntityTable<Workspace, 'id'>;
  workflows!: EntityTable<Workflow, 'id'>;
  workflowRevisions!: EntityTable<RevisionRecord, 'id'>;
  drafts!: EntityTable<DraftRecord, 'workflowId'>;
  assets!: EntityTable<AssetRecord, 'id'>;
  templates!: EntityTable<Template, 'id'>;
  runs!: EntityTable<Run, 'id'>;
  nodeRuns!: EntityTable<NodeRun, 'id'>;
  outputs!: EntityTable<OutputRecord, 'id'>;
  notifications!: EntityTable<NotificationRecord, 'id'>;

  constructor() {
    super('my-x-flows');

    this.version(1).stores({
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
  }
}

export const db = new MyXFlowsDB();

export async function ensurePersist(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) {
      return await navigator.storage.persist();
    }
  } catch {
    /* ignore */
  }
  return false;
}

export async function estimateStorage() {
  try {
    if (navigator.storage?.estimate) {
      return await navigator.storage.estimate();
    }
  } catch {
    /* ignore */
  }
  return { usage: 0, quota: 0 };
}

export { SCHEMA_VERSION };
