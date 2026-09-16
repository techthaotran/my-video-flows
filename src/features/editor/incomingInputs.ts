import type { Edge } from '@xyflow/react';
import type { FlowNode } from '@/features/editor/store';
import type { NodeType, PortType } from '@/shared/schema';
import {
  annotateAssetLabels,
  composePrompt,
  extractLabels,
  stripAssetLegend,
  type AssetRef,
} from '@/engine/resolver';
import { strings } from '@/shared/strings';

export type IncomingKind = 'text' | 'image' | 'video' | 'audio' | 'genImage' | 'genVideo' | 'unknown';

export interface IncomingItem {
  id: string;
  sourceNodeId: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  portType: PortType | 'ref';
  kind: IncomingKind;
  title: string;
  subtitle?: string;
  text?: string;
  /** IndexedDB asset id when the asset is a local file */
  assetId?: string;
  /** Media id when the asset already lives on Google Flow */
  flowMediaId?: string;
  /** Signed preview url captured when the Flow asset was picked (may expire) */
  flowPreviewUrl?: string;
  assetKind?: 'image' | 'video' | 'audio';
  /** Asset label used for `[Label]` tags + legend */
  assetLabel?: string;
  /** Mirrors the runtime role: prompt text, a reference, or the previous clip */
  role?: 'prompt' | 'ref' | 'continuation';
  /**
   * edge = wired into this node, prompt = forwarded by a connected Prompt,
   * label = unresolved `[Label]`, cache = last frame a Prompt kept from a removed link
   */
  origin: 'edge' | 'prompt' | 'label' | 'cache';
  missing?: boolean;
}

function kindFromNode(n: FlowNode): IncomingKind {
  switch (n.data.nodeType) {
    case 'text':
    case 'prompt':
      return 'text';
    case 'asset': {
      const k = n.data.data.kind as string | undefined;
      if (k === 'video') return 'video';
      if (k === 'audio') return 'audio';
      return 'image';
    }
    case 'generateImage':
      return 'genImage';
    case 'generateVideo':
    case 'mergeVideo':
      return 'genVideo';
    default:
      return 'unknown';
  }
}

function portTypeFromKind(kind: IncomingKind): PortType | 'ref' {
  if (kind === 'text') return 'text';
  if (kind === 'image' || kind === 'genImage') return 'image';
  if (kind === 'video' || kind === 'genVideo') return 'video';
  if (kind === 'audio') return 'audio';
  return 'any';
}

function titleFor(n: FlowNode): string {
  if (n.data.nodeType === 'asset' && n.data.data.assetLabel) {
    return String(n.data.data.assetLabel);
  }
  return String(n.data.label ?? n.data.slug ?? n.data.nodeType);
}

/** Item describing a node wired straight into another. */
function itemFromSource(src: FlowNode, e: Edge): IncomingItem {
  const kind = kindFromNode(src);
  const d = src.data.data;
  const base: IncomingItem = {
    id: `edge:${e.id}`,
    sourceNodeId: src.id,
    sourceHandle: e.sourceHandle,
    targetHandle: e.targetHandle,
    portType: (e.data as { portType?: PortType } | undefined)?.portType ?? portTypeFromKind(kind),
    kind,
    title: titleFor(src),
    subtitle: src.data.nodeType,
    origin: 'edge',
  };

  if (src.data.nodeType === 'asset') {
    const flowMediaId = d.flowMediaId as string | undefined;
    const assetId = d.assetId as string | undefined;
    const flowWithoutId = !flowMediaId && d.source === 'flow';
    return {
      ...base,
      role: 'ref',
      assetLabel: d.assetLabel as string | undefined,
      assetKind: (d.kind as 'image' | 'video' | 'audio' | undefined) ?? 'image',
      flowMediaId,
      flowPreviewUrl: d.flowPreviewUrl as string | undefined,
      assetId,
      subtitle: flowMediaId
        ? `Google Flow · ${flowMediaId.slice(0, 8)}`
        : flowWithoutId
          ? 'Google Flow - mất media id, chọn lại (không upload)'
          : assetId
            ? 'File local - upload khi chạy'
            : 'Chưa chọn asset',
      missing: flowWithoutId || (!flowMediaId && (!assetId || !!d.missing)),
    };
  }
  if (src.data.nodeType === 'generateVideo') {
    return { ...base, role: 'continuation', subtitle: 'Cảnh trước — I2V từ frame cuối' };
  }
  if (src.data.nodeType === 'mergeVideo') {
    return { ...base, role: 'ref', subtitle: strings.nodeMergeVideo };
  }
  if (src.data.nodeType === 'generateImage') {
    return { ...base, role: 'ref', subtitle: 'Ảnh generate — dùng làm reference' };
  }
  return { ...base, role: 'prompt' };
}

export interface PromptPreview {
  /** Output text exactly as the Prompt executor would build it before running. */
  text: string;
  /** References forwarded to the generator (assets + generated images). */
  refs: IncomingItem[];
  /** Previous clip forwarded for a continuation scene. */
  continuation?: IncomingItem;
  /** `[Label]` without a connected Flow/local asset yet. */
  unresolved: string[];
}

/** Last frame a Prompt kept from the previous scene; the executor forwards it when no clip is linked. */
function cachedFrameItem(node: FlowNode): IncomingItem | undefined {
  const assetId = node.data.nodeType === 'prompt' ? node.data.data.continueFrameAssetId : undefined;
  if (typeof assetId !== 'string' || !assetId) return undefined;
  return {
    id: `cache:${node.id}`,
    sourceNodeId: `cache:${node.id}`,
    portType: 'image',
    kind: 'image',
    assetKind: 'image',
    assetId,
    title: strings.continueFrameCachedTitle,
    subtitle: strings.continueFrameCachedHint,
    role: 'continuation',
    origin: 'cache',
  };
}

/**
 * Mirror of `promptExecutor` for the editor: this node's instruction first,
 * then upstream Prompts; `[Label]` stays in text; Flow media ids travel as refs.
 */
export function computePromptPreview(
  nodeId: string,
  nodes: FlowNode[],
  edges: Edge[],
  visiting: Set<string> = new Set(),
): PromptPreview {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node || visiting.has(nodeId)) return { text: '', refs: [], unresolved: [] };
  visiting.add(nodeId);

  const upstream: string[] = [];
  const refs: IncomingItem[] = [];
  let continuation: IncomingItem | undefined;
  const addRef = (item: IncomingItem) => {
    const key = item.flowMediaId ?? item.assetId ?? item.sourceNodeId;
    if (!refs.some((r) => (r.flowMediaId ?? r.assetId ?? r.sourceNodeId) === key)) refs.push(item);
  };

  for (const e of edges.filter((ed) => ed.target === nodeId)) {
    const src = nodes.find((n) => n.id === e.source);
    if (!src) continue;
    if (src.data.nodeType === 'prompt' || src.data.nodeType === 'text') {
      const up =
        src.data.nodeType === 'text'
          ? { text: String(src.data.data.content ?? ''), refs: [], continuation: undefined }
          : computePromptPreview(src.id, nodes, edges, visiting);
      if (up.text.trim()) upstream.push(up.text);
      up.refs.forEach((r) => addRef({ ...r, origin: 'prompt', id: `via:${src.id}:${r.id}` }));
      if (up.continuation) continuation = { ...up.continuation, origin: 'prompt' };
      continue;
    }
    const item = itemFromSource(src, e);
    if (item.role === 'continuation') continuation = item;
    else addRef(item);
  }
  visiting.delete(nodeId);
  continuation ??= cachedFrameItem(node);

  const assetRefs: AssetRef[] = refs
    .filter((r) => r.assetLabel)
    .map((r) => ({ label: r.assetLabel!, kind: r.assetKind ?? 'image', flowMediaId: r.flowMediaId }));
  const instruction =
    node.data.nodeType === 'text'
      ? String(node.data.data.content ?? '')
      : String(node.data.data.instruction ?? '');
  const text = annotateAssetLabels(composePrompt(upstream, instruction), assetRefs);
  const linked = new Set(
    assetRefs
      .filter((r) => r.flowMediaId)
      .map((r) => r.label.trim().toLowerCase().replace(/\s+/g, ' ')),
  );
  const unresolved = extractLabels(stripAssetLegend(text)).filter(
    (label) => !linked.has(label.trim().toLowerCase().replace(/\s+/g, ' ')),
  );
  return { text, refs, continuation, unresolved };
}

/** What a node receives: its own edges, plus what a connected Prompt forwards to a generator. */
export function resolveIncomingItems(nodeId: string, nodes: FlowNode[], edges: Edge[]): IncomingItem[] {
  const target = nodes.find((n) => n.id === nodeId);
  if (!target) return [];

  if (target.data.nodeType === 'prompt') {
    const preview = computePromptPreview(nodeId, nodes, edges);
    const direct = edges
      .filter((e) => e.target === nodeId)
      .flatMap((e) => {
        const src = nodes.find((n) => n.id === e.source);
        if (!src) return [];
        const item = itemFromSource(src, e);
        if (item.role === 'prompt') {
          return [{ ...item, text: computePromptPreview(src.id, nodes, edges).text || undefined }];
        }
        return [item];
      });
    const forwarded = [
      ...preview.refs.filter((r) => r.origin === 'prompt'),
      ...(preview.continuation && preview.continuation.origin !== 'edge' ? [preview.continuation] : []),
    ];
    return [...direct, ...forwarded, ...unresolvedItems(preview, direct)];
  }

  const items: IncomingItem[] = [];
  for (const e of edges.filter((ed) => ed.target === nodeId)) {
    const src = nodes.find((n) => n.id === e.source);
    if (!src) continue;
    const item = itemFromSource(src, e);
    if (src.data.nodeType !== 'prompt') {
      items.push(item);
      continue;
    }
    const preview = computePromptPreview(src.id, nodes, edges);
    items.push({ ...item, text: preview.text || undefined });
    for (const r of [...preview.refs, ...(preview.continuation ? [preview.continuation] : [])]) {
      if (items.some((i) => i.sourceNodeId === r.sourceNodeId)) continue;
      items.push({ ...r, origin: 'prompt', id: `via:${src.id}:${r.id}`, targetHandle: e.targetHandle });
    }
  }
  return items;
}

function unresolvedItems(preview: PromptPreview, direct: IncomingItem[]): IncomingItem[] {
  return preview.unresolved.map((label) => {
    const local = [...direct, ...preview.refs].find(
      (r) => r.assetLabel?.toLowerCase() === label.toLowerCase() && r.assetId,
    );
    return {
      id: `label:${label}`,
      sourceNodeId: local?.sourceNodeId ?? '',
      portType: 'ref' as const,
      kind: 'unknown' as const,
      title: `[${label}]`,
        subtitle: local ? 'File local — gắn URL vào chú thích sau khi upload lúc chạy' : 'Chưa nối asset có label này',
      origin: 'label' as const,
      missing: !local,
    };
  });
}

export function summarizeIncoming(items: IncomingItem[] | null | undefined) {
  const list = items ?? [];
  const texts = list.filter((i) => i.kind === 'text' && i.text).map((i) => i.text!);
  const assets = list.filter(
    (i) =>
      i.kind === 'image' ||
      i.kind === 'video' ||
      i.kind === 'audio' ||
      i.kind === 'genImage' ||
      i.kind === 'genVideo',
  );
  return {
    texts,
    assets,
    imageCount: list.filter((i) => i.kind === 'image' || i.kind === 'genImage').length,
    videoCount: list.filter((i) => i.kind === 'video' || i.kind === 'genVideo').length,
    audioCount: list.filter((i) => i.kind === 'audio').length,
    hasAny: list.length > 0,
  };
}

export function isMediaCapableNode(type: NodeType): boolean {
  return type === 'prompt' || type === 'generateImage' || type === 'generateVideo';
}
