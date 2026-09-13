import type { Workflow, WorkflowNode } from '@/shared/schema';
import type { DriverResult } from '@/shared/messaging';

export interface NodeOutputValue {
  kind: 'text' | 'image' | 'video' | 'audio' | 'any';
  text?: string;
  blob?: Blob;
  mime?: string;
  outputId?: string;
  name?: string;
  /** True when media originated from an asset node. */
  fromAsset?: boolean;
  /** Media id on Google Flow — present media is referenced by id, never re-uploaded. */
  flowMediaId?: string;
  /**
   * Media that came from Google Flow (a Flow asset or a Flow generation). It is
   * only ever referenced by `flowMediaId`; without one it is refused, never uploaded.
   */
  fromFlow?: boolean;
  /** Asset label ([Character], [Outfit]…) used for placeholder replacement. */
  assetLabel?: string;
  /** IndexedDB asset id of a local file — uploaded to Flow at most once per run. */
  localAssetId?: string;
  /**
   * How a Prompt forwards what it received: `ref` = asset/image reference for
   * the generator, `continuation` = previous clip the next scene continues from.
   */
  role?: 'prompt' | 'ref' | 'continuation';
}

export interface ExecutorContext {
  runId: string;
  workflow: Workflow;
  node: WorkflowNode;
  inputs: Record<string, NodeOutputValue[]>; // handle -> values
  signal: AbortSignal;
  onProgress: (progress: number, message?: string) => void;
  resolveSlug: (slug: string) => NodeOutputValue | undefined;
  getAsset: (assetId: string) => Promise<Blob | undefined>;
  saveOutput: (value: NodeOutputValue) => Promise<string>;
  callDriver: (
    provider: 'flow' | 'gemini',
    action: import('@/shared/messaging').DriverAction,
  ) => Promise<DriverResult>;
}

export type NodeExecutor = (ctx: ExecutorContext) => Promise<NodeOutputValue[]>;

/** A Google Flow media without its media id: refused instead of re-uploaded. */
export const FLOW_NO_UPLOAD = 'FLOW_ASSET_NO_UPLOAD';

export const NON_RETRYABLE = new Set([
  FLOW_NO_UPLOAD,
  'CONTENT_POLICY',
  'AUTH_REQUIRED',
  'QUOTA_EXCEEDED',
  'SELECTOR_NOT_FOUND',
]);
