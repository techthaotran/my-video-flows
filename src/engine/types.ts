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
  /** Node this value came out of — Merge Video orders its clips by it. */
  sourceNodeId?: string;
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
  /** Store a blob in IndexedDB assets (deduped by hash); returns the asset id. */
  putAsset: (blob: Blob, name: string) => Promise<string>;
  /** Merge into this node's saved data and push the change to the open editor. */
  patchNodeData: (data: Record<string, unknown>) => Promise<void>;
  /** JPEG of a clip's final frame (decoded in the offscreen document). */
  extractLastFrame: (video: Blob) => Promise<Blob>;
  /** Ghép clip + audio + logo thành một mp4 (encode trong offscreen document). */
  composeVideo: (
    job: Omit<import('@/media/composeClient').ComposeVideoJob, 'workflowId'>,
  ) => Promise<Blob>;
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
