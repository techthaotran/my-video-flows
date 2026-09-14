/**
 * Describe Flow batchexecute payloads before submit.
 * Pure — no chrome.* — so unit tests can import it.
 */

import {
  CAPTCHA_SLOT,
  MEDIA_HOST,
  RPC_GEN_IMAGE,
  RPC_GEN_VIDEO,
  RPC_GEN_VIDEO_REFS,
  RPC_GEN_VIDEO_TEXT,
  RPC_UPLOAD_IMAGE,
} from '@/providers/flow/rpc/batch';

const FLOW_URL_RE = new RegExp(
  `https://${MEDIA_HOST.replace(/\./g, '\\.')}/(?:image|video)/[0-9a-fA-F-]+`,
  'gi',
);
const LABEL_RE = /\[([^\]]+)\]/g;
const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
/** Base64-looking strings long enough to be an upload body. */
const BASE64_RE = /(?:data:[^;]+;base64,)?[A-Za-z0-9+/]{200,}={0,2}/g;
const LOG_CHUNK = 4000;

export interface SubmitRefInfo {
  label?: string;
  kind: string;
  source: 'flow' | 'upload';
  mediaId: string;
  /** startFrame = id in the Veo i2v slot; ref = expected but may be missing from wire. */
  role?: 'startFrame' | 'ref';
}

export interface DescribeSubmitInput {
  rpcid: string;
  freq: string;
  model?: string;
  aspect?: string | number;
  durationSec?: number;
  count?: number;
  prompt: string;
  refs?: SubmitRefInfo[];
  /** When set (MZZa6b), urls are scanned from text parts only via this string. */
  promptForUrlScan?: string;
}

export interface DescribeSubmitResult {
  rpcid: string;
  model?: string;
  aspect?: string | number;
  durationSec?: number;
  count?: number;
  prompt: string | string[];
  promptLength: number;
  labelsInPrompt: string[];
  urlsInPrompt: string[];
  refs: SubmitRefInfo[];
  wireMediaIds: string[];
  /** Media ids anchored as image parts inside MZZa6b structured prompt. */
  anchoredMediaIds?: string[];
  missingRefs: SubmitRefInfo[];
  freq: unknown;
}

/** Split long strings so {@link toLogData} does not truncate mid-prompt. */
export function chunkForLog(text: string, size = LOG_CHUNK): string | string[] {
  if (text.length <= size) return text;
  const parts: string[] = [];
  for (let i = 0; i < text.length; i += size) parts.push(text.slice(i, i + size));
  return parts;
}

/** Unwrap `[[[rpcid, JSON.stringify(inner), null, "generic"]]]` → inner. */
export function decodeFreqInner(freq: string): unknown {
  const outer = JSON.parse(freq) as unknown;
  if (!Array.isArray(outer) || !Array.isArray(outer[0]) || !Array.isArray(outer[0][0])) {
    return outer;
  }
  const cell = outer[0][0] as unknown[];
  const inner = cell[1];
  if (typeof inner === 'string') {
    try {
      return JSON.parse(inner);
    } catch {
      return inner;
    }
  }
  return inner;
}

function approxB64Bytes(s: string): number {
  const raw = s.includes('base64,') ? s.slice(s.indexOf('base64,') + 7) : s;
  return Math.max(0, Math.floor((raw.length * 3) / 4));
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)}KB`;
  return `${(n / (1024 * 1024)).toFixed(1)}MB`;
}

/** Replace upload base64 with a size tag; keep captcha placeholder; drop secrets. */
export function sanitizeFreq(freq: string | unknown): unknown {
  const decoded = typeof freq === 'string' ? decodeFreqInner(freq) : freq;
  return scrubValue(decoded);
}

function scrubValue(value: unknown): unknown {
  if (typeof value === 'string') {
    if (value === CAPTCHA_SLOT) return CAPTCHA_SLOT;
    if (/cookie|authorization|sapisid|__Secure/i.test(value) && value.length > 40) {
      return '[redacted]';
    }
    if (BASE64_RE.test(value)) {
      BASE64_RE.lastIndex = 0;
      return value.replace(BASE64_RE, (m) => `[base64 image/jpeg ${formatBytes(approxB64Bytes(m))}]`);
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(scrubValue);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (/^(at|cookie|authorization|token)$/i.test(k)) {
        out[k] = '[redacted]';
        continue;
      }
      out[k] = scrubValue(v);
    }
    return out;
  }
  return value;
}

function collectUuids(node: unknown, out: string[]): void {
  if (typeof node === 'string') {
    if (UUID_RE.test(node) && !out.includes(node)) out.push(node);
    return;
  }
  if (Array.isArray(node)) {
    for (const child of node) collectUuids(child, out);
    return;
  }
  if (node && typeof node === 'object') {
    for (const v of Object.values(node)) collectUuids(v, out);
  }
}

/**
 * Media ids that actually sit in the wire payload for known RPCs.
 * Walks the decoded inner envelope; ignores project / captcha / client UUIDs
 * that are not in a media-id slot when the structure is known.
 */
export function extractWireMediaIds(rpcid: string, freqOrInner: string | unknown): string[] {
  const inner = typeof freqOrInner === 'string' ? decodeFreqInner(freqOrInner) : freqOrInner;
  if (rpcid === RPC_GEN_IMAGE) return wireIdsFromImageRequest(inner);
  if (rpcid === RPC_GEN_VIDEO) return wireIdsFromVideoRequest(inner);
  if (rpcid === RPC_GEN_VIDEO_TEXT) return [];
  if (rpcid === RPC_GEN_VIDEO_REFS) return wireIdsFromReferenceVideoRequest(inner);
  if (rpcid === RPC_UPLOAD_IMAGE) return [];
  return wireIdsGeneric(inner);
}

/** Image-part media ids inside MZZa6b structured prompt (item[0]). */
export function extractAnchoredMediaIds(freqOrInner: string | unknown): string[] {
  const inner = typeof freqOrInner === 'string' ? decodeFreqInner(freqOrInner) : freqOrInner;
  const item = referenceVideoItem(inner);
  if (!item) return [];
  const block = item[0];
  if (!Array.isArray(block) || !Array.isArray(block[2]) || !Array.isArray(block[2][0])) return [];
  const parts = block[2][0] as unknown[];
  const ids: string[] = [];
  for (const part of parts) {
    if (!Array.isArray(part) || part[0] !== null) continue;
    const nest = part[1];
    if (!Array.isArray(nest) || !Array.isArray(nest[0])) continue;
    const pair = nest[0];
    if (Array.isArray(pair) && typeof pair[0] === 'string' && UUID_RE.test(pair[0])) {
      if (!ids.includes(pair[0])) ids.push(pair[0]);
    }
  }
  return ids;
}

function referenceVideoItem(inner: unknown): unknown[] | null {
  if (!Array.isArray(inner) || !Array.isArray(inner[0])) return null;
  const batch = inner[0];
  if (!Array.isArray(batch) || !Array.isArray(batch[0])) return null;
  return batch[0] as unknown[];
}

function wireIdsFromImageRequest(inner: unknown): string[] {
  // [[null, items, 1, context, [uuid]]] — each item[2] is refs: [[mediaId,…],…] | null
  if (!Array.isArray(inner)) return [];
  const items = inner[1];
  if (!Array.isArray(items)) return [];
  const ids: string[] = [];
  for (const item of items) {
    if (!Array.isArray(item)) continue;
    const refs = item[2];
    if (!Array.isArray(refs)) continue;
    for (const ref of refs) {
      if (Array.isArray(ref) && typeof ref[0] === 'string' && UUID_RE.test(ref[0])) {
        if (!ids.includes(ref[0])) ids.push(ref[0]);
      }
    }
  }
  return ids;
}

function wireIdsFromVideoRequest(inner: unknown): string[] {
  // [[ [item], context, [uuid, 2] ]] — item[4] = [null, sourceMediaId, …]
  if (!Array.isArray(inner) || !Array.isArray(inner[0])) return [];
  const batch = inner[0];
  if (!Array.isArray(batch) || !Array.isArray(batch[0])) return [];
  const item = batch[0];
  if (!Array.isArray(item)) return [];
  const frame = item[4];
  if (Array.isArray(frame) && typeof frame[1] === 'string' && UUID_RE.test(frame[1])) {
    return [frame[1]];
  }
  return [];
}

function wireIdsFromReferenceVideoRequest(inner: unknown): string[] {
  // item[1] = [[null, mediaId], …]
  const item = referenceVideoItem(inner);
  if (!item) return [];
  const refs = item[1];
  if (!Array.isArray(refs)) return [];
  const ids: string[] = [];
  for (const ref of refs) {
    if (Array.isArray(ref) && typeof ref[1] === 'string' && UUID_RE.test(ref[1])) {
      if (!ids.includes(ref[1])) ids.push(ref[1]);
    }
  }
  return ids;
}

function wireIdsGeneric(inner: unknown): string[] {
  const ids: string[] = [];
  collectUuids(inner, ids);
  return ids;
}

function labelsInPrompt(prompt: string): string[] {
  const out: string[] = [];
  LABEL_RE.lastIndex = 0;
  for (let m = LABEL_RE.exec(prompt); m; m = LABEL_RE.exec(prompt)) {
    const label = m[1]!.trim();
    if (label && !out.includes(label)) out.push(label);
  }
  return out;
}

function urlsInPrompt(prompt: string): string[] {
  const out: string[] = [];
  FLOW_URL_RE.lastIndex = 0;
  for (let m = FLOW_URL_RE.exec(prompt); m; m = FLOW_URL_RE.exec(prompt)) {
    if (!out.includes(m[0]!)) out.push(m[0]!);
  }
  return out;
}

function sameIdList(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((id, i) => id === b[i]);
}

export function describeSubmit(input: DescribeSubmitInput): DescribeSubmitResult {
  const refs = input.refs ?? [];
  const wireMediaIds = extractWireMediaIds(input.rpcid, input.freq);
  const wireSet = new Set(wireMediaIds);
  const missingRefs = refs.filter((r) => r.mediaId && !wireSet.has(r.mediaId));
  const scanText = input.promptForUrlScan ?? input.prompt;
  const urls = urlsInPrompt(scanText);

  const result: DescribeSubmitResult = {
    rpcid: input.rpcid,
    model: input.model,
    aspect: input.aspect,
    durationSec: input.durationSec,
    count: input.count,
    prompt: chunkForLog(input.prompt),
    promptLength: input.prompt.length,
    labelsInPrompt: labelsInPrompt(input.prompt),
    urlsInPrompt: urls,
    refs,
    wireMediaIds,
    missingRefs,
    freq: sanitizeFreq(input.freq),
  };

  if (input.rpcid === RPC_GEN_VIDEO_REFS) {
    result.anchoredMediaIds = extractAnchoredMediaIds(input.freq);
    if (!sameIdList(result.anchoredMediaIds, wireMediaIds)) {
      // Surface as missing so logPayload refuses submit.
      for (const id of result.anchoredMediaIds) {
        if (!wireSet.has(id) && !missingRefs.some((r) => r.mediaId === id)) {
          missingRefs.push({ kind: 'image', source: 'flow', mediaId: id, label: 'anchored≠item[1]' });
        }
      }
      for (const id of wireMediaIds) {
        if (!result.anchoredMediaIds.includes(id) && !missingRefs.some((r) => r.mediaId === id)) {
          missingRefs.push({ kind: 'image', source: 'flow', mediaId: id, label: 'item[1]≠anchored' });
        }
      }
      result.missingRefs = missingRefs;
    }
  }

  return result;
}

/** One-line summary for the log message. */
export function summarizeSubmit(d: DescribeSubmitResult): string {
  const wired = d.refs.length ? `${d.refs.length - d.missingRefs.length}/${d.refs.length}` : '0/0';
  const model = d.model ? ` (${d.model})` : '';
  return `payload → ${d.rpcid}${model} ref ${wired} vào wire, ${d.urlsInPrompt.length} link`;
}
