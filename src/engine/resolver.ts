import type { Workflow } from '@/shared/schema';
import { flowMediaUrl } from '@/providers/flow/media';
import type { NodeOutputValue } from '@/engine/types';

const SLUG_RE = /@([a-zA-Z0-9_]+)/g;
/** [Character], [Outfit], [Video reference], ... */
const LABEL_RE = /\[([^\]]+)\]/g;

export function extractSlugs(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(SLUG_RE)) {
    if (m[1]) out.push(m[1]);
  }
  return [...new Set(out)];
}

export function extractLabels(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(LABEL_RE)) {
    if (m[1]) out.push(m[1].trim());
  }
  return [...new Set(out)];
}

export function buildSlugIndex(workflow: Workflow): Map<string, string> {
  const map = new Map<string, string>();
  for (const n of workflow.nodes) {
    const slug = n.slug ?? (n.data as { slug?: string }).slug;
    if (slug) map.set(slug.replace(/^@/, ''), n.id);
  }
  return map;
}

export function resolveTextContent(
  content: string,
  getText: (slug: string) => string | undefined,
  depth = 0,
): string {
  if (depth > 10) return content;
  return content.replace(SLUG_RE, (_, slug: string) => {
    const v = getText(slug);
    if (v == null) return `@${slug}`;
    return resolveTextContent(v, getText, depth + 1);
  });
}

export function resolveTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '');
}

export interface AssetRef {
  label: string;
  kind: 'image' | 'video' | 'audio' | 'text' | 'any';
  flowMediaId?: string;
}

/** Địa chỉ của asset trên Flow, hoặc undefined khi asset chưa có media id (file local chưa upload). */
export function assetAddress(ref: AssetRef): string | undefined {
  if (!ref.flowMediaId || (ref.kind !== 'image' && ref.kind !== 'video')) return undefined;
  return flowMediaUrl(ref.kind, ref.flowMediaId);
}

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Header for the unified reference block appended by {@link annotateAssetLabels}. */
export const REFERENCE_LIST_HEADER = 'Danh sách tham chiếu';

const FLOW_MEDIA_URL_RE =
  /https:\/\/flow-content\.google\/(?:image|video)\/[0-9a-fA-F-]+/gi;

const LEGEND_URL_SUFFIX_RE =
  /\s*(?:Tham khảo\s+)?https:\/\/flow-content\.google\/(?:image|video)\/[0-9a-fA-F-]+\s*$/i;

function isDefBlock(block: string): boolean {
  const t = block.trim();
  return /^\[[^\]]+\]:/.test(t) || t === REFERENCE_LIST_HEADER || t.startsWith(`${REFERENCE_LIST_HEADER}\n`);
}

/**
 * Bỏ khối chú thích tham khảo ở cuối (để annotate lại không bị trùng khi forward
 * qua Prompt khác): giữ lại `[Label]: mô tả`, chỉ bỏ phần URL — mô tả cần sống sót
 * để node cha re-annotate vẫn còn nội dung, không chỉ còn "Tham khảo <url>" trơ trọi.
 * Không đụng `[Background]: mô tả…` thuần text (không có URL Flow).
 */
export function stripAssetLegend(content: string): string {
  const trimmed = content.replace(/\s+$/, '');
  if (!trimmed) return content;
  const blocks = trimmed.split(/\n{2,}/);
  let end = blocks.length;
  while (end > 0 && isDefBlock(blocks[end - 1]!)) end--;
  if (end === blocks.length) return content;

  let head = blocks.slice(0, end);
  const refBlocks = blocks.slice(end);
  if (head.length && head[head.length - 1]!.trim() === REFERENCE_LIST_HEADER) {
    head = head.slice(0, -1);
  } else if (refBlocks[0] && refBlocks[0]!.trim().startsWith(`${REFERENCE_LIST_HEADER}\n`)) {
    refBlocks[0] = refBlocks[0]!.trim().slice(REFERENCE_LIST_HEADER.length + 1);
  }

  const converted = refBlocks
    .map((b) => b.trim().replace(LEGEND_URL_SUFFIX_RE, '').trim())
    // A bare `[Label]:` with the URL stripped and no description left carries no info.
    .filter((b) => b && !/^\[[^\]]+\]:$/.test(b));
  return [...head, ...converted].join('\n\n');
}

/**
 * Đưa URL Flow (do bản cũ replace `[Label]` → URL) về lại `[Label]`.
 * Cả dạng `https://…: mô tả` (từ `[Label]: mô tả`) lẫn URL đứng riêng.
 */
export function restoreAssetLabels(content: string, refs: AssetRef[]): string {
  let out = content;
  for (const ref of refs) {
    const address = assetAddress(ref);
    if (!address || !out.includes(address)) continue;
    out = out.split(address).join(`[${ref.label}]`);
  }
  return out;
}

function cleanDescription(raw: string): string {
  return raw
    .replace(/\s*Tham khảo\s+https:\/\/flow-content\.google\/(?:image|video)\/[0-9a-fA-F-]+\s*$/i, '')
    .replace(FLOW_MEDIA_URL_RE, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[:\s]+|[:\s]+$/g, '')
    .trim();
}

/**
 * Tách các khối `[Label]: mô tả` ra khỏi thân prompt.
 * Phần còn lại (narrative có `[Label]` trần) giữ nguyên.
 */
export function splitLabelDefinitions(content: string): {
  narrative: string;
  descriptions: Map<string, { label: string; description: string }>;
} {
  const descriptions = new Map<string, { label: string; description: string }>();
  const narrativeLines: string[] = [];
  const lines = content.split('\n');
  let i = 0;
  while (i < lines.length) {
    const m = /^\[([^\]]+)\]:\s*(.*)$/.exec(lines[i]!);
    if (!m) {
      narrativeLines.push(lines[i]!);
      i++;
      continue;
    }
    const label = m[1]!.trim();
    const parts: string[] = [];
    if (m[2]!.trim()) parts.push(m[2]!.trim());
    i++;
    while (i < lines.length) {
      const line = lines[i]!;
      if (line.trim() === '') break;
      if (/^\[[^\]]+\]/.test(line.trim())) break;
      parts.push(line.trim());
      i++;
    }
    if (i < lines.length && lines[i]!.trim() === '') i++;
    const description = cleanDescription(parts.join(' '));
    if (description) descriptions.set(normalizeLabel(label), { label, description });
  }
  const narrative = narrativeLines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { narrative, descriptions };
}

/** @deprecated dùng splitLabelDefinitions */
export function extractLabelDescriptions(content: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const [key, v] of splitLabelDefinitions(content).descriptions) {
    map.set(key, v.description);
  }
  return map;
}

function legendLine(label: string, address: string, description?: string): string {
  if (description) {
    const desc = description.replace(/\.\s*$/, '');
    return `[${label}]: ${desc}. Tham khảo ${address}`;
  }
  return `[${label}]: Tham khảo ${address}`;
}

/**
 * Giữ `[Label]` trần trong narrative. Mọi khối `[Label]: mô tả` (dù có ảnh gắn
 * kèm hay không) được gom vào một danh sách tham chiếu duy nhất phía dưới narrative,
 * theo đúng thứ tự xuất hiện; label có Flow id thêm `Tham khảo {url}` vào cuối.
 */
export function annotateAssetLabels(content: string, refs: AssetRef[]): string {
  const cleaned = restoreAssetLabels(stripAssetLegend(content), refs).trimEnd();
  const linked = new Map<string, { label: string; address: string }>();
  for (const ref of refs) {
    const address = assetAddress(ref);
    const key = normalizeLabel(ref.label);
    if (!address || linked.has(key)) continue;
    linked.set(key, { label: ref.label, address });
  }

  const { narrative, descriptions } = splitLabelDefinitions(cleaned);
  if (!descriptions.size && !linked.size) return cleaned;

  const entries: string[] = [];
  const seen = new Set<string>();
  for (const [key, { label, description }] of descriptions) {
    seen.add(key);
    const linkedInfo = linked.get(key);
    entries.push(linkedInfo ? legendLine(label, linkedInfo.address, description) : `[${label}]: ${description}`);
  }
  for (const [key, { label, address }] of linked) {
    if (seen.has(key)) continue;
    entries.push(legendLine(label, address));
  }
  if (!entries.length) return cleaned;

  const parts = narrative ? [narrative] : [];
  parts.push(`${REFERENCE_LIST_HEADER}\n${entries.join('\n\n')}`);
  return parts.join('\n\n').trim();
}

/** @deprecated Dùng `annotateAssetLabels`. */
export function replaceAssetLabels(content: string, refs: AssetRef[]): string {
  return annotateAssetLabels(content, refs);
}

/** Prompt output: prompt upstream nối trước (đã bỏ legend cũ), instruction sau cùng. */
export function composePrompt(upstream: string[], instruction: string): string {
  return [instruction, ...upstream.map(stripAssetLegend)]
    .map((part) => part.trim())
    .filter(Boolean)
    .join('\n\n');
}

export function makeSlug(
  kind: 'image' | 'video' | 'audio' | 'text' | 'asset',
  existing: Set<string>,
): string {
  const prefix = kind === 'asset' ? 'asset' : kind;
  let i = 1;
  let candidate = `${prefix}_${Math.random().toString(36).slice(2, 6)}_${i}`;
  while (existing.has(candidate)) {
    i++;
    candidate = `${prefix}_${Math.random().toString(36).slice(2, 6)}_${i}`;
  }
  return candidate;
}

export type { NodeOutputValue };
