import { firstMergeNode, isMergeReady, mergeClipNodeIds } from '@/engine/mergeReady';
import { topoSort } from '@/engine/scheduler';
import type {
  AssetLabel,
  Workflow,
  WorkflowNode,
} from '@/shared/schema';
import { defaultKindForLabel } from '@/shared/schema';
import { strings } from '@/shared/strings';
import type { RunnerState } from '@/features/runner/store';

export type PromptPreset =
  | 'enhance'
  | 'analyzeImage'
  | 'script'
  | 'summarize'
  | 'translate'
  | 'brainstorm'
  | 'custom';

interface PromptData {
  preset?: PromptPreset;
  instruction?: string;
  formattedOutput?: string;
}

export interface RunnerAssetSlot {
  nodeId: string;
  slug?: string;
  label: AssetLabel;
  kind: 'image' | 'video' | 'audio';
  source?: 'local' | 'flow';
  assetId?: string;
  flowMediaId?: string;
  flowPreviewUrl?: string;
  originalName?: string;
  missing: boolean;
}

export interface RunnerPromptRef {
  nodeId: string;
  slug?: string;
  preset: PromptPreset;
  instruction: string;
  formattedOutput?: string;
}

export interface RunnerGenerateItem {
  nodeId: string;
  slug?: string;
  type: 'generateImage' | 'generateVideo';
  prompt: string;
  model: string;
  aspectRatio: string;
  durationSec?: number;
  previewOutputId?: string;
  promptNodes: RunnerPromptRef[];
  inMerge: boolean;
}

export interface RunnerMergeInfo {
  nodeId: string;
  slug?: string;
  order: string[];
  previewOutputId?: string;
  clipNodeIds: string[];
  /** Tỉ lệ khung từ clip đầu (để stage preview khớp portrait/landscape). */
  aspectRatio: string;
}

export interface RunnerView {
  assetSlots: RunnerAssetSlot[];
  generateItems: RunnerGenerateItem[];
  merge: RunnerMergeInfo | null;
}

const HIDDEN_TYPES = new Set(['note', 'text', 'unknown']);

function promptRefsForGenerate(wf: Workflow, generateId: string, byId: Map<string, WorkflowNode>): RunnerPromptRef[] {
  const refs: RunnerPromptRef[] = [];
  for (const e of wf.edges) {
    if (e.target !== generateId || e.targetHandle !== 'in:text') continue;
    const src = byId.get(e.source);
    if (!src || src.disabled || src.type !== 'prompt') continue;
    const data = src.data as PromptData;
    refs.push({
      nodeId: src.id,
      slug: src.slug,
      preset: data.preset ?? 'custom',
      instruction: data.instruction ?? '',
      formattedOutput: data.formattedOutput,
    });
  }
  return refs;
}

function toAssetSlot(n: WorkflowNode): RunnerAssetSlot {
  const data = n.data as Record<string, unknown>;
  const label = (data.assetLabel as AssetLabel | undefined) ?? 'Character';
  const kind =
    (data.kind as 'image' | 'video' | 'audio' | undefined) ?? defaultKindForLabel(label);
  return {
    nodeId: n.id,
    slug: n.slug,
    label,
    kind,
    source: data.source as 'local' | 'flow' | undefined,
    assetId: data.assetId as string | undefined,
    flowMediaId: data.flowMediaId as string | undefined,
    flowPreviewUrl: data.flowPreviewUrl as string | undefined,
    originalName: data.originalName as string | undefined,
    missing: data.missing === true,
  };
}

function toGenerateItem(
  n: WorkflowNode,
  wf: Workflow,
  byId: Map<string, WorkflowNode>,
  inMerge: boolean,
): RunnerGenerateItem {
  const data = n.data as Record<string, unknown>;
  return {
    nodeId: n.id,
    slug: n.slug,
    type: n.type as 'generateImage' | 'generateVideo',
    prompt: (data.prompt as string | undefined) ?? '',
    model: (data.model as string | undefined) ?? '',
    aspectRatio: (data.aspectRatio as string | undefined) ?? '9:16',
    durationSec: data.durationSec as number | undefined,
    previewOutputId: data.previewOutputId as string | undefined,
    promptNodes: promptRefsForGenerate(wf, n.id, byId),
    inMerge,
  };
}

/**
 * View model cửa sổ "Chạy": một lần topoSort + một vòng order.
 * Graph có vòng → `{ graphError }` thay vì ném.
 */
export function buildRunnerView(wf: Workflow): RunnerView | { graphError: string } {
  let order: string[];
  try {
    order = topoSort(wf).order;
  } catch (e) {
    return {
      graphError: e instanceof Error ? e.message : strings.runnerGraphError,
    };
  }

  const byId = new Map(wf.nodes.map((n) => [n.id, n]));
  const mergeNode = firstMergeNode(wf);
  const clipNodeIds = mergeNode ? mergeClipNodeIds(wf, mergeNode.id) : [];
  const clipSet = new Set(clipNodeIds);

  const assetSlots: RunnerAssetSlot[] = [];
  const generateById = new Map<string, RunnerGenerateItem>();

  for (const id of order) {
    const n = byId.get(id);
    if (!n || n.disabled || HIDDEN_TYPES.has(n.type)) continue;
    if (n.type === 'asset') {
      assetSlots.push(toAssetSlot(n));
      continue;
    }
    if (n.type === 'generateImage' || n.type === 'generateVideo') {
      generateById.set(id, toGenerateItem(n, wf, byId, clipSet.has(id)));
    }
  }

  const generateItems: RunnerGenerateItem[] = [];
  const seen = new Set<string>();
  for (const id of clipNodeIds) {
    const item = generateById.get(id);
    if (!item) continue;
    generateItems.push(item);
    seen.add(id);
  }
  for (const id of order) {
    if (seen.has(id)) continue;
    const item = generateById.get(id);
    if (!item) continue;
    generateItems.push(item);
  }

  const firstClip = clipNodeIds[0] ? byId.get(clipNodeIds[0]) : undefined;
  const clipAspect =
    firstClip && typeof (firstClip.data as { aspectRatio?: unknown }).aspectRatio === 'string'
      ? (firstClip.data as { aspectRatio: string }).aspectRatio
      : '9:16';

  const merge: RunnerMergeInfo | null = mergeNode
    ? {
        nodeId: mergeNode.id,
        slug: mergeNode.slug,
        order: (mergeNode.data as { order?: string[] }).order ?? [],
        previewOutputId: (mergeNode.data as { previewOutputId?: string }).previewOutputId,
        clipNodeIds,
        aspectRatio: clipAspect,
      }
    : null;

  return { assetSlots, generateItems, merge };
}

export function selectMergeReady(wf: Workflow, merge: RunnerMergeInfo | null): boolean {
  if (!merge) return false;
  return isMergeReady(wf, merge.nodeId);
}

export function selectCanEdit(wf: Workflow): boolean {
  return !wf.locked && !wf.deletedAt;
}

export function selectIsRunning(state: Pick<RunnerState, 'trackedRunIds'>): boolean {
  return state.trackedRunIds.length > 0;
}
