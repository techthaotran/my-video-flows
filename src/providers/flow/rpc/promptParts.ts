/**
 * Build MZZa6b structured prompt parts by anchoring image refs at the first
 * `[Label]` occurrence. Pure — no chrome.*.
 *
 * Rules (docs/OMNI_REFS_FIX_PLAN.md §6):
 * - First occurrence of each ordered ref label → image part (prefer narrative
 *   before `Danh sách tham chiếu`; else the definition line).
 * - Later occurrences of the same label stay as literal `[Label]` text.
 * - Ref never mentioned → append `\n[Label]` and anchor there.
 * - Unknown labels in prompt stay as text (caller may warn).
 * - Adjacent text parts are merged; empty text is dropped.
 */

import { normalizeLabel, REFERENCE_LIST_HEADER } from '@/engine/resolver';
import type { PromptPart } from '@/providers/flow/rpc/batch';

export interface OrderedPromptRef {
  label: string;
  mediaId: string;
}

const LABEL_TOKEN_RE = /\[([^\]]+)\]/g;

function findHeaderIndex(prompt: string): number {
  const idx = prompt.indexOf(REFERENCE_LIST_HEADER);
  return idx >= 0 ? idx : prompt.length;
}

/**
 * Index of the first `[Label]` whose normalized text matches `want`,
 * searching only within `[start, end)`.
 */
function findLabelIndex(prompt: string, want: string, start: number, end: number): number {
  LABEL_TOKEN_RE.lastIndex = start;
  for (let m = LABEL_TOKEN_RE.exec(prompt); m; m = LABEL_TOKEN_RE.exec(prompt)) {
    if (m.index >= end) break;
    if (normalizeLabel(m[1]!) === want) return m.index;
  }
  return -1;
}

function pushText(parts: PromptPart[], text: string): void {
  if (!text) return;
  const last = parts[parts.length - 1];
  if (last?.type === 'text') {
    last.text += text;
    return;
  }
  parts.push({ type: 'text', text });
}

function pushImage(parts: PromptPart[], mediaId: string, name: string): void {
  parts.push({ type: 'image', mediaId, name });
}

/**
 * Split `prompt` into alternating text / image parts for {@link referenceVideoRequest}.
 * Returns parts plus the ordered media ids that must appear in `item[1]`.
 */
export function buildReferencePromptParts(
  prompt: string,
  orderedRefs: OrderedPromptRef[],
): { parts: PromptPart[]; mediaIds: string[]; unknownLabels: string[] } {
  if (!orderedRefs.length) {
    const text = prompt;
    return {
      parts: text ? [{ type: 'text', text }] : [],
      mediaIds: [],
      unknownLabels: [],
    };
  }

  const byNorm = new Map<string, OrderedPromptRef>();
  for (const ref of orderedRefs) {
    const key = normalizeLabel(ref.label);
    if (!byNorm.has(key)) byNorm.set(key, ref);
  }

  type Anchor = { index: number; length: number; ref: OrderedPromptRef };
  const anchors: Anchor[] = [];
  const anchored = new Set<string>();
  const headerAt = findHeaderIndex(prompt);

  // Prefer narrative (before reference-list header), then the whole prompt.
  for (const ref of orderedRefs) {
    const key = normalizeLabel(ref.label);
    if (anchored.has(key)) continue;
    let at = findLabelIndex(prompt, key, 0, headerAt);
    if (at < 0) at = findLabelIndex(prompt, key, headerAt, prompt.length);
    if (at < 0) continue;
    const token = prompt.slice(at).match(/^\[([^\]]+)\]/)!;
    anchors.push({ index: at, length: token[0]!.length, ref });
    anchored.add(key);
  }

  // Refs never mentioned: append a line and anchor there.
  let working = prompt;
  for (const ref of orderedRefs) {
    const key = normalizeLabel(ref.label);
    if (anchored.has(key)) continue;
    const insertAt = working.length;
    const addition = `${working.endsWith('\n') || working.length === 0 ? '' : '\n'}[${ref.label}]`;
    working += addition;
    const token = `[${ref.label}]`;
    const at = working.lastIndexOf(token);
    anchors.push({ index: at >= 0 ? at : insertAt + (addition.length - token.length), length: token.length, ref });
    anchored.add(key);
  }

  anchors.sort((a, b) => a.index - b.index);

  const parts: PromptPart[] = [];
  let cursor = 0;
  for (const a of anchors) {
    if (a.index < cursor) continue; // overlapping / already consumed
    pushText(parts, working.slice(cursor, a.index));
    pushImage(parts, a.ref.mediaId, a.ref.label);
    cursor = a.index + a.length;
  }
  pushText(parts, working.slice(cursor));

  const unknownLabels: string[] = [];
  const known = new Set([...byNorm.keys()]);
  LABEL_TOKEN_RE.lastIndex = 0;
  for (let m = LABEL_TOKEN_RE.exec(working); m; m = LABEL_TOKEN_RE.exec(working)) {
    const key = normalizeLabel(m[1]!);
    if (!known.has(key) && !unknownLabels.includes(m[1]!.trim())) {
      unknownLabels.push(m[1]!.trim());
    }
  }

  return {
    parts,
    mediaIds: parts
      .filter((p): p is Extract<PromptPart, { type: 'image' }> => p.type === 'image')
      .map((p) => p.mediaId),
    unknownLabels,
  };
}

/** Human-readable prompt for logs: image parts → `⟦ảnh [Label] mediaId…⟧`. */
export function formatPartsForLog(parts: PromptPart[]): string {
  return parts
    .map((p) => {
      if (p.type === 'text') return p.text;
      const short = p.mediaId.length > 8 ? `${p.mediaId.slice(0, 8)}…` : p.mediaId;
      return `⟦ảnh [${p.name}] ${short}⟧`;
    })
    .join('');
}
