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

/**
 * Trailing legend we append / rewrite:
 * `[Character]: … Tham khảo https://flow-content.google/image/…`
 * also matches legacy `[Outfit]: https://…`
 */
const LEGEND_LINE_RE =
  /^\[[^\]]+\]:\s*(?:.*\s+)?(?:Tham khảo\s+)?https:\/\/flow-content\.google\/(?:image|video)\/[0-9a-fA-F-]+\s*$/i;

const FLOW_MEDIA_URL_RE =
  /https:\/\/flow-content\.google\/(?:image|video)\/[0-9a-fA-F-]+/gi;

/**
 * Bỏ khối chú thích tham khảo ở cuối (để annotate lại không bị trùng).
 * Không đụng `[Background]: mô tả…` thuần text (không có URL Flow).
 */
export function stripAssetLegend(content: string): string {
  const lines = content.split('\n');
  let end = lines.length;
  while (end > 0 && lines[end - 1]!.trim() === '') end--;
  let cut = end;
  while (cut > 0 && LEGEND_LINE_RE.test(lines[cut - 1]!.trim())) cut--;
  if (cut === end) return content;
  while (cut > 0 && lines[cut - 1]!.trim() === '') cut--;
  return lines.slice(0, cut).join('\n');
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
 * Giữ `[Label]` trần trong narrative. Khối `[Label]: mô tả` chuyển thành dòng
 * chú thích: `[Label]: {mô tả}. Tham khảo {url}` (không nhân đôi, không thay
 * label bằng URL). Label chưa có Flow id giữ nguyên định nghĩa trong thân.
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

  if (!linked.size) return cleaned;

  const { narrative, descriptions } = splitLabelDefinitions(cleaned);

  const unlinkedDefs: string[] = [];
  for (const [key, { label, description }] of descriptions) {
    if (!linked.has(key)) unlinkedDefs.push(`[${label}]: ${description}`);
  }

  const legend: string[] = [];
  for (const [key, { label, address }] of linked) {
    legend.push(legendLine(label, address, descriptions.get(key)?.description));
  }

  const bodyParts = [...(narrative ? [narrative] : []), ...unlinkedDefs];
  const body = bodyParts.join('\n\n').trim();
  return body ? `${body}\n\n${legend.join('\n')}` : legend.join('\n');
}

/** @deprecated Dùng `annotateAssetLabels`. */
export function replaceAssetLabels(content: string, refs: AssetRef[]): string {
  return annotateAssetLabels(content, refs);
}

/** Prompt output: prompt upstream nối trước (đã bỏ legend cũ), instruction sau cùng. */
export function composePrompt(upstream: string[], instruction: string): string {
  return [...upstream.map(stripAssetLegend), instruction]
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
