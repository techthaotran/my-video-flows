import { orderedClipIds } from '@/media/layout';
import { topoSort } from '@/engine/scheduler';
import type { Workflow, WorkflowNode } from '@/shared/schema';

const VIDEO_TARGET = 'in:video';

/** Node mergeVideo đầu tiên (không disabled) theo thứ tự chạy; vòng → undefined. */
export function firstMergeNode(wf: Workflow): WorkflowNode | undefined {
  let order: string[];
  try {
    order = topoSort(wf).order;
  } catch {
    return undefined;
  }
  const byId = new Map(wf.nodes.map((n) => [n.id, n]));
  for (const id of order) {
    const n = byId.get(id);
    if (n?.type === 'mergeVideo' && !n.disabled) return n;
  }
  return undefined;
}

/**
 * Id node video nối vào cổng video của Merge (bỏ disabled),
 * sắp theo `order` đã lưu + clip mới xếp cuối.
 */
export function mergeClipNodeIds(wf: Workflow, mergeNodeId: string): string[] {
  const byId = new Map(wf.nodes.map((n) => [n.id, n]));
  const merge = byId.get(mergeNodeId);
  if (!merge || merge.type !== 'mergeVideo' || merge.disabled) return [];

  const connected: string[] = [];
  const seen = new Set<string>();
  for (const e of wf.edges) {
    if (e.target !== mergeNodeId || e.targetHandle !== VIDEO_TARGET) continue;
    if (seen.has(e.source)) continue;
    const src = byId.get(e.source);
    if (!src || src.disabled) continue;
    seen.add(e.source);
    connected.push(e.source);
  }

  const order = (merge.data as { order?: string[] }).order ?? [];
  return orderedClipIds(order, connected);
}

/** Clip có video: generate/merge có previewOutputId; asset có assetId hoặc flowMediaId. */
function clipHasVideo(node: WorkflowNode): boolean {
  const data = node.data as Record<string, unknown>;
  if (node.type === 'generateImage' || node.type === 'generateVideo' || node.type === 'mergeVideo') {
    return typeof data.previewOutputId === 'string' && data.previewOutputId.length > 0;
  }
  if (node.type === 'asset') {
    const hasLocal = typeof data.assetId === 'string' && data.assetId.length > 0;
    const hasFlow = typeof data.flowMediaId === 'string' && data.flowMediaId.length > 0;
    return hasLocal || hasFlow;
  }
  return false;
}

/**
 * Đủ clip để tự ghép: ≥1 clip và mọi clip "có video".
 * Asset Flow (chỉ flowMediaId) vẫn coi là có video để bước ghép báo FLOW_ASSET_NO_UPLOAD.
 */
export function isMergeReady(wf: Workflow, mergeNodeId: string): boolean {
  const clipIds = mergeClipNodeIds(wf, mergeNodeId);
  if (clipIds.length === 0) return false;
  const byId = new Map(wf.nodes.map((n) => [n.id, n]));
  for (const id of clipIds) {
    const node = byId.get(id);
    if (!node || !clipHasVideo(node)) return false;
  }
  return true;
}
