/**
 * Flow batchexecute envelope codec — ported from FlowKit flow_batch.py.
 * Builds request envelopes and parses responses; network I/O lives in runner.ts.
 */

export const BATCH_PATH = '/_/AiSandboxAngularFrontend/data/batchexecute';
export const MEDIA_HOST = 'flow-content.google';

export const RPC_GEN_IMAGE = 'ogiZ0b';
export const RPC_GEN_VIDEO = 'eb1hJf';
export const RPC_OPERATION = 'jwpduf';
export const RPC_PROJECT_MEDIA = 'Zzl0ze';
export const RPC_MEDIA = 'as29s';
export const RPC_UPLOAD_IMAGE = 'maseQ';

export const CAPTCHA_IMAGE = 'IMAGE_GENERATION';
export const CAPTCHA_VIDEO = 'VIDEO_GENERATION';

/** Extension substitutes a freshly minted reCAPTCHA token for this marker. */
export const CAPTCHA_SLOT = '__CAPTCHA__';

/**
 * Image wire ids this extension offers in the UI (FlowKit PR #42).
 * Legacy Pro (`GEM_PIX_2`) maps onto Banana 2.
 */
export const IMAGE_MODELS = new Set(['NARWHAL', 'HARBOR_SEAL']);
export const IMAGE_MODEL = 'NARWHAL';
/** Keys are normalized with {@link normalizeModelKey}. */
export const IMAGE_MODEL_BY_NICKNAME: Record<string, string> = {
  'nano banana 2': 'NARWHAL',
  'nano banana 2 lite': 'HARBOR_SEAL',
  'nano banana lite': 'HARBOR_SEAL',
  // Labels saved by earlier builds — Pro retired; land on Banana 2.
  'nano banana pro': 'NARWHAL',
  'google nano banana': 'NARWHAL',
  imagen: 'NARWHAL',
  'gemini image': 'NARWHAL',
};
/** A Flow-style wire id Flow may add before this list learns about it. */
const IMAGE_WIRE_ID_RE = /^[A-Z][A-Z0-9_]{1,95}$/;

export function normalizeModelKey(key: string): string {
  return key.trim().toLowerCase().replace(/[-_\s]+/g, ' ');
}

export const ASPECT_SQUARE = 1;
export const ASPECT_PORTRAIT = 2;
export const ASPECT_LANDSCAPE = 3;
export const ASPECT_PORTRAIT_4_3 = 4;
export const ASPECT_LANDSCAPE_4_3 = 5;

export const ASPECT_BY_NAME: Record<string, number> = {
  IMAGE_ASPECT_RATIO_SQUARE: ASPECT_SQUARE,
  IMAGE_ASPECT_RATIO_PORTRAIT: ASPECT_PORTRAIT,
  IMAGE_ASPECT_RATIO_LANDSCAPE: ASPECT_LANDSCAPE,
  IMAGE_ASPECT_RATIO_PORTRAIT_THREE_FOUR: ASPECT_PORTRAIT_4_3,
  IMAGE_ASPECT_RATIO_PORTRAIT_FOUR_THREE: ASPECT_PORTRAIT_4_3,
  IMAGE_ASPECT_RATIO_LANDSCAPE_FOUR_THREE: ASPECT_LANDSCAPE_4_3,
  '1:1': ASPECT_SQUARE,
  '9:16': ASPECT_PORTRAIT,
  '16:9': ASPECT_LANDSCAPE,
  '3:4': ASPECT_PORTRAIT_4_3,
  '4:3': ASPECT_LANDSCAPE_4_3,
};

/**
 * Veo image-to-video (eb1hJf) wire ids FlowKit's batch port accepts. Access is
 * plan-gated per account — a key Flow refuses answers MODEL_ACCESS_DENIED.
 */
export const VIDEO_MODEL = 'veo_3_1_i2v_lite';
export const VIDEO_MODELS = new Set([
  'veo_3_1_i2v_lite',
  'veo_3_1_i2v_lite_low_priority',
  'veo_3_1_i2v_s_fast_ultra',
]);

/** Veo labels → eb1hJf wire ids. Keys are normalized with {@link normalizeModelKey}. */
export const VIDEO_MODEL_BY_NICKNAME: Record<string, string> = {
  'veo 3.1 lite': 'veo_3_1_i2v_lite',
  'veo 3.1 lite low priority': 'veo_3_1_i2v_lite_low_priority',
  'veo 3.1 fast ultra': 'veo_3_1_i2v_s_fast_ultra',
  'veo 3.1 fast (ultra)': 'veo_3_1_i2v_s_fast_ultra',
  // Labels saved by earlier builds of this extension.
  veo: 'veo_3_1_i2v_lite',
  'gemini video': 'veo_3_1_i2v_s_fast_ultra',
};

/**
 * Omni 1.1 Flash text-to-video rides its own RPC with the duration in the key
 * (`abra_t2v_4s` verified live, FlowKit PR #41). Prompt keeps `[Label]` tags;
 * a trailing legend maps each to its CDN url. Video generation never invents a mid-scene still.
 * Omni frame/reference-to-video has no captured batchexecute payload yet.
 */
export const RPC_GEN_VIDEO_TEXT = 'YhhmEf';
export const OMNI_FLASH_DURATIONS = [4, 6, 8, 10] as const;
const OMNI_FLASH_NICKNAMES = new Set(['omni flash', 'google omni flash', 'gemini omni flash']);

export function isOmniFlashModel(key?: string | null): boolean {
  if (typeof key !== 'string' || !key.trim()) return false;
  const n = normalizeModelKey(key);
  if (OMNI_FLASH_NICKNAMES.has(n)) return true;
  // Wire keys (`abra_t2v_4s`) and any label that still says Omni.
  if (/^abra[_-]?/i.test(key.trim())) return true;
  return /\bomni\b/.test(n);
}

/** Snap to the nearest duration Omni offers. */
export function omniTextVideoModel(durationSec?: number | null): string {
  const want = durationSec ?? 8;
  const snapped = OMNI_FLASH_DURATIONS.reduce((best, d) =>
    Math.abs(d - want) < Math.abs(best - want) ? d : best,
  );
  return `abra_t2v_${snapped}s`;
}

export const VIDEO_ASPECT_PORTRAIT = 1;
export const VIDEO_ASPECT_LANDSCAPE = 2;

/** Video only renders 9:16 or 16:9 — other UI ratios snap to the nearest orientation. */
export const VIDEO_ASPECT_BY_NAME: Record<string, number> = {
  VIDEO_ASPECT_RATIO_PORTRAIT: VIDEO_ASPECT_PORTRAIT,
  VIDEO_ASPECT_RATIO_LANDSCAPE: VIDEO_ASPECT_LANDSCAPE,
  '9:16': VIDEO_ASPECT_PORTRAIT,
  '3:4': VIDEO_ASPECT_PORTRAIT,
  '16:9': VIDEO_ASPECT_LANDSCAPE,
  '4:3': VIDEO_ASPECT_LANDSCAPE,
  '1:1': VIDEO_ASPECT_LANDSCAPE,
};

export const STATUS_DONE = 'CAE';
export const OUTCOME_OK = 3;
export const OUTCOME_COMPLAINT = 4;
export const SURFACE_ID = 22;
export const FULL_FRAME_CROP = [null, 0.0038759689922481244, 1, 0.9961240310077519];
export const REF_TYPE_IMAGE = 1;

export class RpcError extends Error {
  constructor(
    public rpcid: string,
    public detail: unknown,
  ) {
    super(`${rpcid} failed: ${JSON.stringify(detail)}`);
    this.name = 'RpcError';
  }
}

export class FlowBatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FlowBatchError';
  }
}

export interface RpcResult {
  rpcid: string;
  data: unknown;
  error: unknown;
  ok: boolean;
}

export interface GeneratedImage {
  mediaId: string;
  url: string;
}

export interface Operation {
  operationId: string;
  projectId: string | null;
  status: string | null;
  error: string | null;
  done: boolean;
  complained: boolean;
}

export interface MediaUrls {
  mediaId: string;
  video: string | null;
  image: string | null;
}

// ── model / aspect resolvers ─────────────────────────────────────────────────

export function resolveImageModel(key?: string | null): string {
  if (typeof key === 'string' && key.trim()) {
    const nick = IMAGE_MODEL_BY_NICKNAME[normalizeModelKey(key)];
    if (nick) return nick;
    const wire = key.trim();
    // Retired Pro wire id → Banana 2.
    if (wire === 'GEM_PIX_2') return 'NARWHAL';
    if (IMAGE_MODELS.has(wire) || IMAGE_WIRE_ID_RE.test(wire)) return wire;
  }
  return IMAGE_MODEL;
}

/** Veo i2v wire id for a label or wire id; Omni and unknown labels land on the default. */
export function resolveVideoModel(key?: string | null): string {
  if (typeof key === 'string' && key.trim()) {
    const nick = VIDEO_MODEL_BY_NICKNAME[normalizeModelKey(key)];
    if (nick) return nick;
    const wire = key.trim();
    if (VIDEO_MODELS.has(wire) || /^veo_[a-z0-9_]+$/.test(wire)) return wire;
  }
  return VIDEO_MODEL;
}

/** Raw eb1hJf wire model pinned by the user (captured from Flow's own request). */
export const FLOW_VIDEO_WIRE_MODEL_STORAGE_KEY = 'flowVideoWireModel';

/**
 * Veo i2v candidates in try order: pinned wire model, the chosen one, the rest.
 * A refused key costs no credits (MODEL_ACCESS_DENIED), only a captcha.
 */
export function videoModelFallbackChain(key?: string | null, pinned?: string | null): string[] {
  const chain = [pinned?.trim() || null, resolveVideoModel(key), ...VIDEO_MODELS];
  return [...new Set(chain.filter((m): m is string => !!m))];
}

export function resolveAspect(aspect: string | number | undefined | null): number {
  if (typeof aspect === 'number') return aspect;
  if (aspect == null || aspect === '') return ASPECT_SQUARE;
  const mapped = ASPECT_BY_NAME[aspect];
  if (mapped != null) return mapped;
  throw new Error(`unknown aspect ${JSON.stringify(aspect)}`);
}

export function resolveVideoAspect(aspect: string | number | undefined | null): number {
  if (typeof aspect === 'number') {
    if (aspect !== VIDEO_ASPECT_PORTRAIT && aspect !== VIDEO_ASPECT_LANDSCAPE) {
      throw new Error(`video aspect must be 1 or 2, got ${aspect}`);
    }
    return aspect;
  }
  if (aspect == null || aspect === '') return VIDEO_ASPECT_LANDSCAPE;
  const mapped = VIDEO_ASPECT_BY_NAME[aspect];
  if (mapped != null) return mapped;
  throw new Error(`unknown video aspect ${JSON.stringify(aspect)}`);
}

/** Image ratio for the i2v source frame, so the still matches the clip's shape. */
export function videoSourceImageAspect(aspect: string | number | undefined | null): string {
  return resolveVideoAspect(aspect) === VIDEO_ASPECT_PORTRAIT ? '9:16' : '16:9';
}

// ── envelope codec ───────────────────────────────────────────────────────────

export function buildEnvelope(rpcid: string, inner: unknown): string {
  return JSON.stringify([[[rpcid, JSON.stringify(inner), null, 'generic']]]);
}

export function parseEnvelope(text: string): RpcResult[] {
  if (!text) return [];
  // JS String#split(limit) DISCARDS the remainder (unlike Python maxsplit).
  // Strip the )]}' anti-XSSI prefix, then scan length-prefixed chunks.
  let body = text;
  if (body.startsWith(")]}'")) {
    const nl = body.indexOf('\n');
    body = nl === -1 ? body.slice(4) : body.slice(nl + 1);
  }
  const results: RpcResult[] = [];
  let index = 0;
  while (index < body.length) {
    const start = body.indexOf('[', index);
    if (start === -1) break;
    try {
      const { value: chunk, end } = rawDecodeJson(body, start);
      index = end;
      if (!Array.isArray(chunk)) continue;
      for (const entry of chunk) {
        if (!Array.isArray(entry) || entry[0] !== 'wrb.fr') continue;
        const rpcid = typeof entry[1] === 'string' ? entry[1] : '?';
        const payload = entry[2];
        if (payload == null) {
          results.push({
            rpcid,
            data: null,
            error: entry.length > 5 ? entry[5] : true,
            ok: false,
          });
          continue;
        }
        const data =
          typeof payload === 'string' ? (JSON.parse(payload) as unknown) : payload;
        results.push({ rpcid, data, error: null, ok: true });
      }
    } catch {
      index = start + 1;
    }
  }
  return results;
}

/** Minimal JSON raw_decode from an offset (scan past length prefixes). */
function rawDecodeJson(text: string, start: number): { value: unknown; end: number } {
  const slice = text.slice(start);
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = 0; i < slice.length; i++) {
    const ch = slice[i]!;
    if (inString) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '[' || ch === '{') depth++;
    else if (ch === ']' || ch === '}') {
      depth--;
      if (depth === 0) {
        const end = start + i + 1;
        return { value: JSON.parse(text.slice(start, end)), end };
      }
    }
  }
  throw new SyntaxError('unterminated JSON');
}

export function firstPayload(text: string, rpcid: string): unknown {
  const results = parseEnvelope(text);
  for (const result of results) {
    if (result.rpcid !== rpcid) continue;
    if (!result.ok) throw new RpcError(rpcid, result.error);
    return result.data;
  }
  throw new FlowBatchError(`no ${rpcid} envelope in response (${results.length} others)`);
}

// ── request builders ─────────────────────────────────────────────────────────

function clientUuid(): string {
  return crypto.randomUUID().toUpperCase();
}

function context(projectId: string): unknown[] {
  return [null, SURFACE_ID, null, null, null, projectId, null, null, null, null, [CAPTCHA_SLOT, 1]];
}

function reference(mediaId: string): unknown[] {
  return [mediaId, null, null, null, REF_TYPE_IMAGE];
}

export function imageRequest(opts: {
  prompt: string;
  projectId: string;
  count?: number;
  aspect?: string | number;
  seed?: number;
  prompts?: string[];
  model?: string;
  refMediaIds?: string[];
}): string {
  const ratio = resolveAspect(opts.aspect);
  const model = resolveImageModel(opts.model);
  const count = Math.max(1, opts.count ?? 1);
  const base = opts.seed ?? Math.floor(Math.random() * 1e9);
  const items: unknown[] = [];
  for (let index = 0; index < count; index++) {
    const text =
      opts.prompts && index < opts.prompts.length ? opts.prompts[index]! : opts.prompt;
    const refs =
      opts.refMediaIds && opts.refMediaIds.length
        ? opts.refMediaIds.map(reference)
        : null;
    items.push([
      null,
      null,
      refs,
      base + index * 9973,
      ratio,
      model,
      null,
      context(opts.projectId),
      [[[text]]],
      null,
      null,
      null,
      clientUuid(),
      clientUuid(),
    ]);
  }
  return buildEnvelope(RPC_GEN_IMAGE, [
    null,
    items,
    1,
    context(opts.projectId),
    [clientUuid()],
  ]);
}

export function videoRequest(opts: {
  prompt: string;
  projectId: string;
  sourceMediaId: string;
  crop?: unknown[];
  aspect?: string | number;
  model?: string;
}): string {
  // FlowKit wire: [[[ [null,null,[[[prompt]]]], model, aspect, null, crop, uuids ]], context, [uuid, 2]]
  // Prompt group MUST be one slot — flattening null/null/prompt breaks eb1hJf.
  const item = [
    [null, null, [[[opts.prompt]]]],
    resolveVideoModel(opts.model),
    resolveVideoAspect(opts.aspect),
    null,
    [null, opts.sourceMediaId, null, null, null, opts.crop ?? FULL_FRAME_CROP],
    [null, null, null, null, clientUuid(), clientUuid()],
  ];
  const inner = [[item], context(opts.projectId), [clientUuid(), 2]];
  return buildEnvelope(RPC_GEN_VIDEO, inner);
}

/** Omni Flash text-to-video submit (YhhmEf) — FlowKit PR #41 capture. */
export function textVideoRequest(opts: {
  prompt: string;
  projectId: string;
  aspect?: string | number;
  model: string;
}): string {
  const item = [
    [null, null, [[[opts.prompt]]]],
    opts.model,
    resolveVideoAspect(opts.aspect),
    null,
    [null, null, null, null, clientUuid(), clientUuid()],
  ];
  return buildEnvelope(RPC_GEN_VIDEO_TEXT, [[item], context(opts.projectId), [clientUuid(), 1]]);
}

/** `[?, ?, ?, [[mediaId, projectId, workflowId, status, …]]]` — the media id is known at submit. */
export function readTextVideoSubmit(payload: unknown): { mediaId: string; projectId: string | null } {
  const records = Array.isArray(payload) && payload.length > 3 ? payload[3] : null;
  const record = Array.isArray(records) && records.length ? records[0] : null;
  const mediaId = Array.isArray(record) ? record[0] : null;
  if (typeof mediaId === 'string' && UUID_RE_STRICT.test(mediaId)) {
    const projectId = Array.isArray(record) && typeof record[1] === 'string' ? record[1] : null;
    return { mediaId, projectId };
  }
  const salvaged = salvageWorkflowMediaId(payload);
  if (salvaged) return salvaged;
  throw new FlowBatchError('text-video submit carried no media id');
}

const UUID_RE_STRICT = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const UUID_RE_GLOBAL =
  /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g;
const VIDEO_CDN_ID_RE = new RegExp(
  `${MEDIA_HOST.replace(/\./g, '\\.')}/video/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})`,
  'gi',
);

/** Walk Omni/Veo submit rows for `[mediaId, projectId, …]` when the documented slot moved. */
function salvageWorkflowMediaId(payload: unknown): { mediaId: string; projectId: string | null } | null {
  for (const node of walkLists(payload)) {
    if (typeof node[0] !== 'string' || !UUID_RE_STRICT.test(node[0])) continue;
    // Workflow rows usually carry a project id next; skip bare uuid noise.
    if (typeof node[1] === 'string' && UUID_RE_STRICT.test(node[1])) {
      return { mediaId: node[0], projectId: node[1] };
    }
  }
  return null;
}

/** Every `/video/<uuid>` id embedded in a raw batchexecute body or listing. */
export function extractVideoMediaIdsFromText(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  VIDEO_CDN_ID_RE.lastIndex = 0;
  for (let m = VIDEO_CDN_ID_RE.exec(text); m; m = VIDEO_CDN_ID_RE.exec(text)) {
    const id = m[1]!;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** UUIDs in a response body (submit salvage when structure drifts). */
export function extractUuidsFromText(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  UUID_RE_GLOBAL.lastIndex = 0;
  for (let m = UUID_RE_GLOBAL.exec(text); m; m = UUID_RE_GLOBAL.exec(text)) {
    const id = m[0]!;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function readOperation(payload: unknown): Operation {
  const records =
    Array.isArray(payload) && payload.length > 2 ? payload[2] : null;
  let record = Array.isArray(records) && records.length ? records[0] : null;
  if (!Array.isArray(record) || !record.length) {
    // Structure drift: first nested list whose [0] looks like an operation id.
    for (const node of walkLists(payload)) {
      if (typeof node[0] === 'string' && node[0].length >= 8) {
        record = node;
        break;
      }
    }
  }
  if (!Array.isArray(record) || !record.length) {
    throw new FlowBatchError('operation payload carried no record');
  }
  const status = typeof record[3] === 'string' ? record[3] : null;
  const error = readOperationError(record);
  return {
    operationId: String(record[0]),
    projectId: typeof record[1] === 'string' ? record[1] : null,
    status,
    error,
    done: status === STATUS_DONE,
    complained: error != null,
  };
}

export function uploadRequest(opts: {
  imageB64: string;
  projectId: string;
  mimeType?: string;
  fileName?: string;
}): string {
  return buildEnvelope(RPC_UPLOAD_IMAGE, [
    context(opts.projectId),
    opts.imageB64,
    opts.mimeType ?? 'image/jpeg',
    1,
    null,
    null,
    null,
    null,
    opts.fileName ?? 'upload.jpg',
    null,
    clientUuid(),
    clientUuid(),
  ]);
}

export function operationRequest(operationId: string): string {
  return buildEnvelope(RPC_OPERATION, [null, null, [[operationId]]]);
}

export function projectMediaRequest(projectId: string): string {
  return buildEnvelope(RPC_PROJECT_MEDIA, [`projects/${projectId}`, null, null, null, [1]]);
}

export function mediaRequest(mediaId: string): string {
  return buildEnvelope(RPC_MEDIA, [mediaId]);
}

// ── response readers ─────────────────────────────────────────────────────────

function* walkStrings(node: unknown): Generator<string> {
  if (typeof node === 'string') {
    yield node;
  } else if (Array.isArray(node)) {
    for (const item of node) yield* walkStrings(item);
  }
}

function* walkLists(node: unknown): Generator<unknown[]> {
  if (Array.isArray(node)) {
    yield node;
    for (const item of node) yield* walkLists(item);
  } else if (node && typeof node === 'object') {
    for (const item of Object.values(node as Record<string, unknown>)) yield* walkLists(item);
  }
}

/** CDN image urls only — UUID-bounded so prompt prose after a bare address is not part of the id. */
const IMAGE_CDN_RE = new RegExp(
  `https://${MEDIA_HOST.replace(/\./g, '\\.')}/image/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})(\\?[^\\s"\\\\]*)?`,
  'gi',
);

export function readImages(payload: unknown): GeneratedImage[] {
  const images: GeneratedImage[] = [];
  const seen = new Set<string>();
  for (const text of walkStrings(payload)) {
    IMAGE_CDN_RE.lastIndex = 0;
    for (let m = IMAGE_CDN_RE.exec(text); m; m = IMAGE_CDN_RE.exec(text)) {
      const mediaId = m[1]!;
      if (seen.has(mediaId)) continue;
      seen.add(mediaId);
      images.push({ mediaId, url: m[0]! });
    }
  }
  // Signed result urls (`?sig=…`) before bare addresses echoed from the prompt.
  images.sort((a, b) => Number(b.url.includes('?')) - Number(a.url.includes('?')));
  return images;
}

export interface ProjectMediaEntry {
  /** Unknown until signed when the listing record carries no url. */
  kind?: 'image' | 'video';
  mediaId: string;
  /** Signed CDN url when the listing carries one (bare path otherwise, or none). */
  url?: string;
  /** Creation time (epoch ms) when the listing record carries one. */
  createdAt?: number;
}

export interface ProjectMediaPage {
  items: ProjectMediaEntry[];
  /** Opaque continuation token, if the listing has more pages. */
  nextPageToken: string | null;
}

const PROJECT_MEDIA_URL_RE = new RegExp(
  `https://${MEDIA_HOST.replace(/\./g, '\\.')}/(image|video)/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})(?:\\?[^\\s"\\\\]*)?`,
  'gi',
);

const PAGE_TOKEN_RE = /^[A-Za-z0-9_\-+/=.]{12,}$/;
const EPOCH_S_MIN = 1.4e9;
const EPOCH_S_MAX = 2.2e9;

function mediaUrlsIn(str: string): { kind: 'image' | 'video'; mediaId: string; url: string }[] {
  const out: { kind: 'image' | 'video'; mediaId: string; url: string }[] = [];
  PROJECT_MEDIA_URL_RE.lastIndex = 0;
  for (let m = PROJECT_MEDIA_URL_RE.exec(str); m; m = PROJECT_MEDIA_URL_RE.exec(str)) {
    out.push({ kind: m[1]!.toLowerCase() as 'image' | 'video', mediaId: m[2]!, url: m[0] });
  }
  return out;
}

/** Epoch ms from a listing value: seconds / ms numbers or digit strings, or ISO dates. */
function asEpochMs(value: unknown): number | null {
  let n: number | null = null;
  if (typeof value === 'number') n = value;
  else if (typeof value === 'string') {
    if (/^\d{10,13}$/.test(value)) n = Number(value);
    else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
      const t = Date.parse(value);
      return Number.isNaN(t) ? null : t;
    }
  }
  if (n == null) return null;
  if (n >= EPOCH_S_MIN && n <= EPOCH_S_MAX) return Math.round(n * 1000);
  if (n >= EPOCH_S_MIN * 1000 && n <= EPOCH_S_MAX * 1000) return Math.round(n);
  return null;
}

function* walkScalars(node: unknown): Generator<unknown> {
  if (Array.isArray(node)) {
    for (const item of node) yield* walkScalars(item);
  } else {
    yield node;
  }
}

/** `[mediaId, projectId, …]` — the media record shape (as in the text-video submit). */
function isMediaRecord(node: unknown): node is unknown[] {
  return (
    Array.isArray(node) &&
    typeof node[0] === 'string' &&
    UUID_RE_STRICT.test(node[0]) &&
    typeof node[1] === 'string' &&
    UUID_RE_STRICT.test(node[1])
  );
}

/** The list holding the most media records (the listing also carries workflows). */
function findMediaRecordList(payload: unknown): unknown[][] {
  let best: unknown[][] = [];
  for (const list of walkLists(payload)) {
    const records = list.filter(isMediaRecord);
    if (records.length > best.length) best = records;
  }
  return best;
}

function mergeEntry(byId: Map<string, ProjectMediaEntry>, found: ProjectMediaEntry) {
  const prev = byId.get(found.mediaId);
  if (!prev) {
    byId.set(found.mediaId, { ...found });
    return;
  }
  // The video kind wins over a poster /image/; a signed url (has a query) over a bare path.
  if (found.kind === 'video' && prev.kind !== 'video') {
    prev.kind = 'video';
    if (found.url) prev.url = found.url;
  } else if (!prev.kind && found.kind) {
    prev.kind = found.kind;
  }
  if (found.url && found.kind === prev.kind && (!prev.url || (!prev.url.includes('?') && found.url.includes('?')))) {
    prev.url = found.url;
  }
  prev.createdAt ??= found.createdAt;
}

/**
 * One project listing (`Zzl0ze`) response: every media record once, newest first
 * when records carry a creation time (listing order otherwise), plus the
 * continuation token. Most records carry no url — only the id — so kind/url are
 * filled in later by signing (`as29s`). Falls back to a raw-body url scan when
 * the envelope drifts.
 */
export function readProjectMediaPage(text: string): ProjectMediaPage {
  const byId = new Map<string, ProjectMediaEntry>();
  let payload: unknown;
  try {
    payload = firstPayload(text, RPC_PROJECT_MEDIA);
  } catch {
    const raw = text.replace(/\\u003d/gi, '=').replace(/\\u0026/gi, '&').replace(/\\\//g, '/');
    for (const found of mediaUrlsIn(raw)) mergeEntry(byId, found);
    return { items: [...byId.values()], nextPageToken: null };
  }

  const records = findMediaRecordList(payload);
  for (const record of records) {
    let createdAt: number | undefined;
    for (const scalar of walkScalars(record)) {
      const t = asEpochMs(scalar);
      if (t != null && (createdAt == null || t > createdAt)) createdAt = t;
    }
    const mediaId = record[0] as string;
    let kind: 'image' | 'video' | undefined;
    let url: string | undefined;
    for (const str of walkStrings(record)) {
      for (const found of mediaUrlsIn(str)) {
        if (found.mediaId !== mediaId) continue;
        if (!kind || found.kind === 'video') kind = found.kind;
        if (found.kind === kind && (!url || (!url.includes('?') && found.url.includes('?')))) url = found.url;
      }
    }
    mergeEntry(byId, { mediaId, kind, url, createdAt });
  }
  // Media referenced only by url elsewhere in the payload (older shapes).
  for (const str of walkStrings(payload)) {
    for (const found of mediaUrlsIn(str)) mergeEntry(byId, found);
  }

  let nextPageToken: string | null = null;
  if (Array.isArray(payload)) {
    for (const node of payload) {
      if (typeof node === 'string' && PAGE_TOKEN_RE.test(node) && !node.startsWith('projects/') && !/^\d+$/.test(node) && !UUID_RE_STRICT.test(node)) {
        nextPageToken = node;
      }
    }
  }

  const items = [...byId.values()];
  if (items.some((i) => i.createdAt != null)) {
    items.sort((a, b) => (b.createdAt ?? -Infinity) - (a.createdAt ?? -Infinity));
  }
  return { items, nextPageToken };
}

/** Listing request for a follow-up page (Google List convention: parent, pageSize, pageToken). */
export function projectMediaPageRequest(projectId: string, pageToken: string | null): string {
  return buildEnvelope(RPC_PROJECT_MEDIA, [`projects/${projectId}`, null, pageToken, null, [1]]);
}

export function readUploadedMediaId(payload: unknown): string {
  const record = Array.isArray(payload) && payload.length ? payload[0] : null;
  const mediaId = Array.isArray(record) && record.length ? record[0] : null;
  if (typeof mediaId !== 'string' || !mediaId) {
    throw new FlowBatchError('upload response carried no media id');
  }
  return mediaId;
}

export function readOperationError(record: unknown[]): string | null {
  const detail = record.length > 5 ? record[5] : null;
  if (!Array.isArray(detail) || detail.length <= 8) return null;
  const block = detail[8];
  if (!Array.isArray(block) || !block.length || block[0] !== OUTCOME_COMPLAINT) return null;
  for (const text of walkStrings(block)) return text;
  return 'operation failed without a message';
}

export function findMediaId(payload: unknown, operationId: string): string | null {
  for (const node of walkLists(payload)) {
    if (node.length < 4 || node[0] !== operationId) continue;
    const detail = node[3];
    if (Array.isArray(detail) && detail.length > 4 && typeof detail[4] === 'string') {
      return detail[4];
    }
  }
  return null;
}

const MEDIA_SLOT = /null,null,\\?"([0-9a-fA-F-]{36})\\?"/;

export function findMediaIdInText(text: string, operationId: string): string | null {
  const start = text.indexOf(operationId);
  if (start === -1) return null;
  const match = MEDIA_SLOT.exec(text.slice(start, start + 800));
  return match?.[1] ?? null;
}

export function readMediaUrls(payload: unknown, mediaId: string): MediaUrls {
  let video: string | null = null;
  let image: string | null = null;
  const videoRe = new RegExp(
    `https://${MEDIA_HOST.replace(/\./g, '\\.')}/video/${mediaId}(?:\\?[^\\s"\\\\]*)?`,
    'i',
  );
  const imageRe = new RegExp(
    `https://${MEDIA_HOST.replace(/\./g, '\\.')}/image/${mediaId}(?:\\?[^\\s"\\\\]*)?`,
    'i',
  );
  for (const text of walkStrings(payload)) {
    if (!video) {
      const m = videoRe.exec(text);
      if (m) video = m[0];
    }
    if (!image) {
      const m = imageRe.exec(text);
      if (m) image = m[0];
    }
  }
  return { mediaId, video, image };
}
