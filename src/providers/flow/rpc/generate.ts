/**
 * Orchestrate Flow generate via batchexecute RPC (extension-only).
 * Runs in the service worker — uses chrome.scripting + captcha bridge.
 */

import type {
  DriverResult,
  FlowGeneratePayload,
  FlowGenerateRef,
  FlowUploadRef,
  FlowVideoUploadReply,
} from '@/shared/messaging';
import { readMp4VideoInfo, type Mp4VideoInfo } from '@/media/mp4Info';
import {
  annotateAssetLabels,
  ensureModelAiOriginNote,
  stripFlowMediaUrls,
  type AssetRef,
} from '@/engine/resolver';
import {
  CAPTCHA_IMAGE,
  CAPTCHA_VIDEO,
  FLOW_VIDEO_WIRE_MODEL_STORAGE_KEY,
  OMNI_EDIT_FPS,
  OMNI_EDIT_MAX_REFS,
  OMNI_EDIT_MAX_SEC,
  OMNI_EDIT_MODEL,
  OMNI_MAX_REFS,
  RPC_GEN_IMAGE,
  RPC_GEN_IMAGE_2K,
  RPC_GEN_VIDEO,
  RPC_GEN_VIDEO_EDIT,
  RPC_GEN_VIDEO_REFS,
  RPC_GEN_VIDEO_TEXT,
  RPC_MEDIA,
  RPC_OPERATION,
  RPC_PROJECT_MEDIA,
  RPC_UPLOAD_IMAGE,
  RpcError,
  editVideoRequest,
  editVideoSegment,
  extractUuidsFromText,
  extractVideoMediaIdsFromText,
  firstPayload,
  findMediaId,
  findMediaIdInText,
  image2kRequest,
  imageRequest,
  isOmniFlashModel,
  mediaRequest,
  omniReferenceVideoModel,
  omniTextVideoModel,
  operationRequest,
  projectMediaRequest,
  readImageBase64,
  readImages,
  readMediaUrls,
  readOperation,
  readTextVideoSubmit,
  readUploadedMediaId,
  readWorkflowPoll,
  isMediaNotReadyRpcError,
  referenceVideoRequest,
  resolveImageModel,
  textVideoRequest,
  uploadRequest,
  videoModelFallbackChain,
  videoR2vFallbackChain,
  videoRequest,
  type GeneratedImage,
  type Operation,
} from '@/providers/flow/rpc/batch';
import {
  describeSubmit,
  summarizeSubmit,
  type SubmitRefInfo,
} from '@/providers/flow/rpc/payloadLog';
import {
  buildReferencePromptParts,
  formatPartsForLog,
} from '@/providers/flow/rpc/promptParts';
import { resolveFlowProjectId } from '@/providers/flow/rpc/project';
import { sendToContent } from '@/providers/contentBridge';
import { reviveTabIfNeeded, runBatchRpc } from '@/providers/flow/rpc/runner';
import { createLogger, type Logger } from '@/shared/log';
import { strings } from '@/shared/strings';

const baseLog = createLogger('rpc');
/** Per-generate logger; set in {@link generateViaRpc} so payload logs carry run/node. */
let log: Logger = baseLog;

type Progress = (p: number, m?: string) => void;

export interface OrderedRef {
  label: string;
  mediaId: string;
  kind: 'image';
  source: 'flow' | 'upload';
}

/** FlowKit's VIDEO_POLL_INTERVAL; each round is 1–3 RPCs, every 3rd pulls the listing. */
const VIDEO_POLL_INTERVAL_MS = 10_000;
const MAX_CONSECUTIVE_POLL_FAILURES = 5;
/** Captured Flow UI cadence for x4 image variants (FlowKit PR #42). */
const IMAGE_SUBMIT_OFFSETS_MS = [0, 500, 1500, 2500];
/** A 6s retry of a `[8]` rejection was still refused live; 34s cleared it. */
const IMAGE_TRANSIENT_RETRY_MS = 34_000;

function driverError(code: string, message: string): Error {
  return Object.assign(new Error(message), { code });
}

function logPayload(input: Parameters<typeof describeSubmit>[0]): void {
  const detail = describeSubmit(input);
  const msg = summarizeSubmit(detail);
  if (detail.urlsInPrompt.length || detail.missingRefs.length) log.warn(msg, detail);
  else log.info(msg, detail);
  if (detail.urlsInPrompt.length) {
    throw driverError('UNKNOWN', strings.flowPromptOrphanUrl);
  }
  if (detail.missingRefs.length && input.rpcid !== RPC_UPLOAD_IMAGE) {
    const labels = detail.missingRefs.map((r) => (r.label ? `[${r.label}]` : r.mediaId)).join(', ');
    throw driverError('UNKNOWN', strings.flowMediaIdNotInPayload(labels));
  }
}

function toSubmitRefs(ordered: OrderedRef[], role: SubmitRefInfo['role'] = 'ref'): SubmitRefInfo[] {
  return ordered.map((r) => ({
    label: r.label,
    kind: r.kind,
    source: r.source,
    mediaId: r.mediaId,
    role,
  }));
}

/** Refs logged for Veo i2v: start-frame slot only when continuing; else start + extras (extras → missingRefs). */
function veoSubmitLogRefs(
  sourceMediaId: string,
  orderedRefs: OrderedRef[],
  fromContinuation: boolean,
): SubmitRefInfo[] {
  const start: SubmitRefInfo = fromContinuation
    ? {
        kind: 'image',
        source: 'upload',
        mediaId: sourceMediaId,
        label: strings.continueStartFrameLabel,
        role: 'startFrame',
      }
    : orderedRefs[0] && orderedRefs[0].mediaId === sourceMediaId
      ? { ...toSubmitRefs([orderedRefs[0]], 'startFrame')[0]! }
      : {
          kind: 'image',
          source: 'upload',
          mediaId: sourceMediaId,
          label: strings.continueStartFrameLabel,
          role: 'startFrame',
        };
  // Continue scene: wire has only the last-frame upload; Model/Outfit stay in prompt text.
  if (fromContinuation) return [start];
  const extras = toSubmitRefs(
    orderedRefs.filter((r) => r.mediaId !== sourceMediaId),
    'ref',
  );
  return [start, ...extras];
}

function toAssetRefs(ordered: OrderedRef[]): AssetRef[] {
  return ordered.map((r) => ({ label: r.label, kind: r.kind, flowMediaId: r.mediaId }));
}

/**
 * Final gate: matching Flow URLs → `[Label]`; orphan URLs → error.
 * Re-annotate so legend shows `mediaId {uuid}` for linked Flow assets (no CDN links).
 */
function cleanPromptForSubmit(prompt: string, ordered: OrderedRef[]): string {
  const refs = toAssetRefs(ordered);
  const { text, orphanUrls } = stripFlowMediaUrls(prompt, refs);
  if (orphanUrls.length) throw driverError('UNKNOWN', strings.flowPromptOrphanUrl);
  return ensureModelAiOriginNote(annotateAssetLabels(text, refs), refs);
}

function refLabel(ref: FlowGenerateRef, fallback = 'Asset'): string {
  return ref.label?.trim() || fallback;
}

/**
 * Refs that cannot ride a media-id slot must fail before captcha / upload / submit.
 * Omni and Veo scene-continue go through MZZa6b (capped at {@link OMNI_MAX_REFS}).
 * Omni + one video goes through the video edit RPC (capped at {@link OMNI_EDIT_MAX_REFS}).
 * Plain Veo i2v (`eb1hJf`) accepts exactly one start-frame image.
 */
function assertRefsSupported(payload: FlowGeneratePayload, kind: 'image' | 'video'): void {
  const refs = payload.refs ?? [];
  const omni = isOmniFlashModel(payload.model);
  const continuing = !!payload.continueFrame;

  for (const ref of refs) {
    if (ref.kind === 'image') continue;
    const label = refLabel(ref);
    if (ref.kind === 'video' && kind === 'video') {
      if (!omni) throw driverError('UNKNOWN', strings.videoRefNeedsOmni(label));
      if (continuing) throw driverError('UNKNOWN', strings.videoRefNoContinue(label));
      continue;
    }
    throw driverError('UNKNOWN', strings.refKindUnsupported(label, ref.kind));
  }

  if (kind !== 'video') return;
  const videoRefs = refs.filter((r) => r.kind === 'video');
  if (videoRefs.length > 1) {
    throw driverError('UNKNOWN', strings.videoRefOnlyOne(videoRefs.length));
  }
  const imageRefs = refs.filter((r) => r.kind === 'image' && (r.mediaId || r.upload));
  const uniqueImages = (seed: string[]): Set<string> => {
    const unique = new Set<string>(seed);
    for (const ref of imageRefs) {
      if (ref.mediaId) unique.add(`id:${ref.mediaId}`);
      else if (ref.upload) unique.add(`up:${ref.upload.nodeId ?? ref.upload.sha256 ?? ref.upload.name}`);
    }
    return unique;
  };

  if (videoRefs.length) {
    const total = uniqueImages(['video']).size;
    if (total > OMNI_EDIT_MAX_REFS) {
      throw driverError('OMNI_TOO_MANY_REFS', strings.omniEditTooManyRefs(OMNI_EDIT_MAX_REFS, total));
    }
    return;
  }

  // Omni, or Veo continue (MZZa6b — maseQ frames fail eb1hJf with Media not found).
  if (omni || continuing) {
    const unique = uniqueImages(continuing ? ['continue:last-frame'] : []);
    if (unique.size > OMNI_MAX_REFS) {
      throw driverError('OMNI_TOO_MANY_REFS', strings.omniTooManyRefs(OMNI_MAX_REFS, unique.size));
    }
    return;
  }

  if (imageRefs.length > 1) {
    throw driverError('UNKNOWN', strings.veoTooManyImageRefs);
  }
}

function stripDataUrl(b64: string): string {
  const i = b64.indexOf('base64,');
  return i >= 0 ? b64.slice(i + 7) : b64;
}

function b64ToBytes(b64: string): Uint8Array {
  const raw = atob(stripDataUrl(b64));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function bytesToB64(bytes: Uint8Array): string {
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}

const UPLOAD_MAX_EDGE = 1536;
const UPLOAD_MAX_BYTES = 1_200_000; // ~1.2MB raw → ~1.6MB base64
/** Định dạng Flow nhận nguyên file khi upload ảnh. */
const UPLOAD_ORIGINAL_MIMES = new Set(['image/jpeg', 'image/png']);

/**
 * Ảnh đủ nhỏ thì gửi nguyên file gốc (giữ đúng byte, không vẽ lại qua canvas);
 * chỉ ảnh quá lớn hoặc định dạng lạ mới bị nén lại thành JPEG.
 */
export function canUploadOriginal(img: {
  mime: string;
  bytes: number;
  width: number;
  height: number;
}): boolean {
  return (
    UPLOAD_ORIGINAL_MIMES.has(img.mime.toLowerCase()) &&
    img.bytes <= UPLOAD_MAX_BYTES &&
    Math.max(img.width, img.height) <= UPLOAD_MAX_EDGE
  );
}

/** Ảnh lớn được thu nhỏ trước maseQ — base64 quá lớn làm vỡ messaging / Flow từ chối. */
async function compressForUpload(img: {
  name: string;
  mime: string;
  dataBase64: string;
}): Promise<{ name: string; mime: string; dataBase64: string }> {
  const maxEdge = UPLOAD_MAX_EDGE;
  const maxBytes = UPLOAD_MAX_BYTES;
  try {
    const bytes = b64ToBytes(img.dataBase64);
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const blob = new Blob([copy.buffer], { type: img.mime || 'image/jpeg' });
    const bitmap = await createImageBitmap(blob);
    if (
      canUploadOriginal({
        mime: blob.type,
        bytes: bytes.byteLength,
        width: bitmap.width,
        height: bitmap.height,
      })
    ) {
      bitmap.close();
      return { ...img, mime: blob.type, dataBase64: stripDataUrl(img.dataBase64) };
    }
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return { ...img, dataBase64: stripDataUrl(img.dataBase64) };
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    let quality = 0.88;
    let out = await canvas.convertToBlob({ type: 'image/jpeg', quality });
    while (out.size > maxBytes && quality > 0.5) {
      quality -= 0.1;
      out = await canvas.convertToBlob({ type: 'image/jpeg', quality });
    }
    const buf = new Uint8Array(await out.arrayBuffer());
    const name = img.name.replace(/\.\w+$/, '') + '.jpg';
    return { name, mime: 'image/jpeg', dataBase64: bytesToB64(buf) };
  } catch {
    return { ...img, dataBase64: stripDataUrl(img.dataBase64) };
  }
}

function summarizeRpcFailure(text: string, status?: number): string {
  const preview = (text || '').replace(/\s+/g, ' ').slice(0, 240);
  const http = status != null ? `HTTP ${status}` : 'no status';
  if (!preview) return `${http}, body trống`;
  if (/PUBLIC_ERROR_MODEL_ACCESS_DENIED|MODEL_ACCESS_DENIED/i.test(preview)) {
    return `${http}: MODEL_ACCESS_DENIED — tài khoản không có quyền model này; thử model khác trên Flow`;
  }
  if (/unusual.?activity|recaptcha evaluation failed/i.test(preview)) {
    return `${http}: reCAPTCHA/UNUSUAL_ACTIVITY — chậm lại, reload Flow, thử lại`;
  }
  if (/quota|USER_QUOTA/i.test(preview)) {
    return `${http}: hết quota Flow`;
  }
  return `${http}: ${preview}`;
}

/**
 * Flow chặn vì nghi hoạt động bất thường (reCAPTCHA điểm thấp / gửi dồn dập).
 * Không tự retry, không thử model khác: gửi tiếp chỉ làm tài khoản bị chặn lâu hơn.
 * Bắt chung ở `rpcPayload` nên mọi RPC (ảnh, Veo, Omni, upload) báo cùng một lỗi.
 */
function isUnusualActivity(err: unknown): boolean {
  const detail = err instanceof RpcError ? JSON.stringify(err.detail) : String(err ?? '');
  return /PUBLIC_ERROR_UNUSUAL_ACTIVITY/.test(detail);
}

/** Stop before model fallback or "không trả operation" wrapping. A retry deepens the block. */
function throwIfUnusualActivity(text: string, err?: unknown): void {
  if (isUnusualActivity(err) || /PUBLIC_ERROR_UNUSUAL_ACTIVITY/.test(text)) {
    throw driverError('CAPTCHA_FAILED', strings.flowUnusualActivity);
  }
}

function isModelAccessDenied(err: unknown, text?: string): boolean {
  const blob = `${err instanceof Error ? err.message : String(err ?? '')}\n${text ?? ''}`;
  return /PUBLIC_ERROR_MODEL_ACCESS_DENIED|MODEL_ACCESS_DENIED/i.test(blob);
}

function isImageMode(mode: string): boolean {
  return /image/i.test(mode) && !/video/i.test(mode);
}

async function rpcPayload(
  tabId: number,
  rpcid: string,
  freq: string,
  captchaAction?: string | null,
  match?: string | null,
): Promise<{ text: string; raw: Awaited<ReturnType<typeof runBatchRpc>> }> {
  const started = Date.now();
  const out = await runBatchRpc(tabId, {
    id: crypto.randomUUID(),
    rpcid,
    freq,
    captchaAction,
    match,
  });
  const ms = Date.now() - started;
  const failed = !!out.error || (out.status != null && out.status >= 400) || /\["wrb\.fr","[^"]+",null/.test(out.text ?? '');
  // freq still holds the captcha placeholder, never the minted token.
  const detail = {
    status: out.status,
    bytes: out.text?.length ?? 0,
    error: out.error,
    ...(failed
      ? { freq: freq.length > 6000 ? `${freq.slice(0, 6000)}…` : freq, body: (out.text ?? '').slice(0, 1500) }
      : {}),
  };
  if (failed) log.warn(`${rpcid} ✗ ${out.error ?? `HTTP ${out.status}`} (${ms}ms)`, detail);
  else log.debug(`${rpcid} ✓ HTTP ${out.status} (${ms}ms)`, detail);
  if (out.error) {
    if (out.error.includes('NO_AT_TOKEN')) {
      throw driverError(
        'NO_AT_TOKEN',
        'Không lấy được token at từ trang Flow (WIZ_global_data). Reload tab flow.google.com rồi thử lại.',
      );
    }
    if (out.error.includes('CAPTCHA_FAILED')) {
      throw driverError('CAPTCHA_FAILED', out.error);
    }
    throw driverError('UNKNOWN', out.error);
  }
  if (out.status && out.status >= 400) {
    throw driverError(
      'UNKNOWN',
      `batchexecute ${rpcid} thất bại — ${summarizeRpcFailure(out.text ?? '', out.status)}`,
    );
  }
  const text = out.text ?? '';
  throwIfUnusualActivity(text);
  return { text, raw: out };
}

async function uploadImage(
  tabId: number,
  projectId: string,
  img: { name: string; mime: string; dataBase64: string },
  onProgress: Progress,
): Promise<string> {
  onProgress(18, strings.imageRefUploading(img.name));
  const compressed = await compressForUpload(img);
  const freq = uploadRequest({
    imageB64: compressed.dataBase64,
    projectId,
    mimeType: compressed.mime || 'image/jpeg',
    fileName: compressed.name || 'upload.jpg',
  });
  logPayload({
    rpcid: RPC_UPLOAD_IMAGE,
    freq,
    prompt: '',
    refs: [],
  });
  const { text, raw } = await rpcPayload(tabId, RPC_UPLOAD_IMAGE, freq, CAPTCHA_IMAGE);
  try {
    return readUploadedMediaId(firstPayload(text, RPC_UPLOAD_IMAGE));
  } catch (e) {
    const detail = summarizeRpcFailure(text, raw.status);
    throw driverError(
      'UPLOAD_FAILED',
      `Upload ảnh thất bại (maseQ): ${e instanceof Error ? e.message : String(e)} — ${detail}`,
    );
  }
}

/**
 * After maseQ, Flow may need a beat before i2v can resolve the media id.
 * Poll as29s for an image URL; [5] / Media not found keep waiting until deadline.
 */
const UPLOAD_READY_TIMEOUT_MS = 45_000;
/** Uploaded videos are transcoded (`MEDIA_GENERATION_STATUS_PENDING`) before as29s serves them. */
const VIDEO_UPLOAD_READY_TIMEOUT_MS = 180_000;
const UPLOAD_READY_POLL_MS = 2_000;
/** Upload of a ≤ 30 MB clip; beyond this the Flow tab is not answering. */
const VIDEO_UPLOAD_TIMEOUT_MS = 180_000;

/** Poll as29s until Flow serves the uploaded media; resolves with its signed urls. */
async function waitForUploadedMediaReady(
  tabId: number,
  mediaId: string,
  onProgress: Progress,
  signal: AbortSignal,
  opts: { timeoutMs: number; message: (round: number) => string; timeoutError: string },
): Promise<ReturnType<typeof readMediaUrls>> {
  const deadline = Date.now() + opts.timeoutMs;
  let round = 0;
  while (Date.now() < deadline) {
    if (signal.aborted) throw driverError('UNKNOWN', 'aborted');
    round++;
    onProgress(22, opts.message(round));
    try {
      const { text } = await rpcPayload(tabId, RPC_MEDIA, mediaRequest(mediaId));
      const urls = readMediaUrls(firstPayload(text, RPC_MEDIA), mediaId);
      if (urls.image || urls.video) return urls;
    } catch (e) {
      if (!isMediaNotReadyRpcError(e) && !isMediaNotFoundError(e)) throw e;
    }
    await sleep(UPLOAD_READY_POLL_MS, signal);
  }
  throw driverError('UPLOAD_FAILED', opts.timeoutError);
}

async function waitForUploadedImageReady(
  tabId: number,
  mediaId: string,
  onProgress: Progress,
  signal: AbortSignal,
): Promise<void> {
  await waitForUploadedMediaReady(tabId, mediaId, onProgress, signal, {
    timeoutMs: UPLOAD_READY_TIMEOUT_MS,
    message: (round) => `Chờ Flow nhận frame đã upload (${round})…`,
    timeoutError: strings.flowVideoOpFailed('Media not found. — frame upload chưa sẵn sàng trên Flow'),
  });
}

async function fetchUrlAsMedia(
  url: string,
  kind: 'image' | 'video',
): Promise<{ kind: 'image' | 'video'; mime: string; dataBase64: string; url: string }> {
  const res = await fetch(url);
  if (!res.ok) throw driverError('UPLOAD_FAILED', `Không tải được media (HTTP ${res.status})`);
  const blob = await res.blob();
  const mime =
    blob.type && blob.type !== 'application/octet-stream'
      ? blob.type
      : kind === 'video'
        ? 'video/mp4'
        : 'image/png';
  if (mime.includes('text/html') || blob.size < 512) {
    throw driverError('UNKNOWN', 'Media trả về không hợp lệ');
  }
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return { kind, mime, dataBase64: bytesToB64(bytes), url };
}

/** Id upload đã lưu còn dùng được: cùng project và cùng nội dung file. */
function storedUploadId(upload: FlowUploadRef, projectId: string): string | undefined {
  const saved = upload.uploaded;
  if (!saved || !upload.sha256) return undefined;
  if (saved.projectId !== projectId || saved.sha256 !== upload.sha256) return undefined;
  return saved.mediaId;
}

/** One probe: does Flow currently resolve this media id? Not-found / not-ready count as no. */
async function flowKnowsMedia(tabId: number, mediaId: string): Promise<boolean> {
  try {
    const { text } = await rpcPayload(tabId, RPC_MEDIA, mediaRequest(mediaId));
    const urls = readMediaUrls(firstPayload(text, RPC_MEDIA), mediaId);
    return Boolean(urls.image || urls.video);
  } catch (e) {
    if (isMediaNotReadyRpcError(e) || isMediaNotFoundError(e)) return false;
    throw e;
  }
}

/**
 * Video submit has no stale-upload retry, so a stored upload id Flow no longer knows is
 * dropped up front; resolveRefs then uploads the local file again and the new id replaces it.
 */
async function dropStaleStoredUploads(
  tabId: number,
  projectId: string,
  payload: FlowGeneratePayload,
  signal: AbortSignal,
): Promise<void> {
  for (const ref of payload.refs ?? []) {
    if (signal.aborted) throw driverError('UNKNOWN', 'aborted');
    if (ref.kind !== 'image' || ref.mediaId || !ref.upload) continue;
    const stored = storedUploadId(ref.upload, projectId);
    if (stored && !(await flowKnowsMedia(tabId, stored))) {
      log.warn('Id upload đã lưu không còn trên Flow - upload lại trước khi tạo video');
      ref.upload.uploaded = undefined;
    }
  }
}

/** Local file → Flow media id: the stored upload when still valid, else `maseQ` once and remember it. */
async function localRefMediaId(
  tabId: number,
  projectId: string,
  upload: FlowUploadRef,
  onProgress: Progress,
): Promise<string> {
  const stored = storedUploadId(upload, projectId);
  if (stored) return stored;
  const mediaId = await uploadImage(tabId, projectId, upload, onProgress);
  // Written back on the ref so generateViaRpc can hand the new id to the engine.
  if (upload.sha256) upload.uploaded = { mediaId, projectId, sha256: upload.sha256 };
  return mediaId;
}

/**
 * Turn the node's references into Flow image media ids (ordered, deduped).
 * Assets already on Flow are used by id and never uploaded; local files reuse the id
 * stored on their Asset node (same project + sha256) or upload once.
 * Prompt is cleaned of Flow CDN URLs — media ids go only in RPC slots.
 */
async function resolveRefs(
  tabId: number,
  projectId: string,
  payload: FlowGeneratePayload,
  onProgress: Progress,
  signal: AbortSignal,
): Promise<{ imageIds: string[]; orderedRefs: OrderedRef[]; prompt: string }> {
  const orderedRefs: OrderedRef[] = [];
  const seen = new Set<string>();

  for (const ref of payload.refs ?? []) {
    if (signal.aborted) throw driverError('UNKNOWN', 'aborted');
    if (ref.kind !== 'image') continue;
    let mediaId = ref.mediaId;
    let source: OrderedRef['source'] = 'flow';
    if (!mediaId && ref.upload) {
      source = 'upload';
      mediaId = await localRefMediaId(tabId, projectId, ref.upload, onProgress);
    }
    if (!mediaId) continue;
    if (seen.has(mediaId)) continue;
    seen.add(mediaId);
    orderedRefs.push({
      label: ref.label?.trim() || `${strings.defaultImageRefLabel} ${orderedRefs.length + 1}`,
      mediaId,
      kind: 'image',
      source,
    });
  }

  const prompt = cleanPromptForSubmit(payload.prompt, orderedRefs);
  return {
    imageIds: orderedRefs.map((r) => r.mediaId),
    orderedRefs,
    prompt,
  };
}

async function generateImageRpc(
  tabId: number,
  projectId: string,
  payload: FlowGeneratePayload,
  onProgress: Progress,
  signal: AbortSignal,
): Promise<DriverResult> {
  assertRefsSupported(payload, 'image');
  const { imageIds: refIds, orderedRefs, prompt } = await resolveRefs(
    tabId,
    projectId,
    payload,
    onProgress,
    signal,
  );

  const count = Math.max(1, Math.min(4, payload.outputsPerPrompt ?? 1));
  const seed = Math.floor(Math.random() * 1e9) + 1;
  const model = resolveImageModel(payload.model);
  onProgress(40, count > 1 ? `Tạo ${count} ảnh (RPC)…` : 'Tạo ảnh (RPC)…');

  // Flow's composer launches x4 as four single-image ogiZ0b calls, staggered,
  // each with its own captcha — not one multi-item request (FlowKit PR #42).
  const submitOne = async (index: number): Promise<GeneratedImage> => {
    const freq = imageRequest({
      prompt,
      projectId,
      count: 1,
      seed: seed + index * 9973,
      aspect: payload.aspectRatio,
      model: payload.model,
      refMediaIds: refIds.length ? refIds : undefined,
    });
    logPayload({
      rpcid: RPC_GEN_IMAGE,
      freq,
      model,
      aspect: payload.aspectRatio,
      count: 1,
      resolution: payload.resolution ?? '1K',
      prompt,
      refs: toSubmitRefs(orderedRefs),
    });
    const { text } = await rpcPayload(tabId, RPC_GEN_IMAGE, freq, CAPTCHA_IMAGE);
    const images = readImages(firstPayload(text, RPC_GEN_IMAGE));
    const image = images.find((img) => !refIds.includes(img.mediaId)) ?? images[0];
    if (!image) throw driverError('UNKNOWN', 'Image generation không trả URL');
    return image;
  };
  const runWave = (indices: number[]) =>
    Promise.allSettled(
      indices.map(async (index, position) => {
        await sleep(IMAGE_SUBMIT_OFFSETS_MS[position] ?? 0, signal);
        if (signal.aborted) throw driverError('UNKNOWN', 'aborted');
        return submitOne(index);
      }),
    );

  const results = new Map<number, PromiseSettledResult<GeneratedImage>>();
  const indices = Array.from({ length: count }, (_, i) => i);
  (await runWave(indices)).forEach((r, i) => results.set(indices[i]!, r));

  // [8] is Flow shedding load; one cooldown retry once the whole wave settled.
  const transient = indices.filter((i) => {
    const r = results.get(i)!;
    return r.status === 'rejected' && isTransientImageRejection(r.reason);
  });
  if (transient.length && !signal.aborted) {
    onProgress(60, `Flow đang quá tải — thử lại ${transient.length} ảnh sau ${IMAGE_TRANSIENT_RETRY_MS / 1000}s…`);
    await sleep(IMAGE_TRANSIENT_RETRY_MS, signal);
    if (signal.aborted) throw driverError('UNKNOWN', 'aborted');
    (await runWave(transient)).forEach((r, i) => results.set(transient[i]!, r));
  }

  const images = indices.flatMap((i) => {
    const r = results.get(i)!;
    return r.status === 'fulfilled' ? [r.value] : [];
  });
  if (!images.length) {
    throw (results.get(0) as PromiseRejectedResult).reason;
  }

  onProgress(85, payload.resolution === '2K' ? strings.flowFetchingImage2k : strings.flowFetchingImage);
  const medias: DriverResult['medias'] = [];
  for (const img of images) {
    if (signal.aborted) throw driverError('UNKNOWN', 'aborted');
    if (payload.resolution === '2K') {
      try {
        medias.push({
          kind: 'image',
          mime: 'image/jpeg',
          dataBase64: await fetchImage2k(tabId, projectId, img.mediaId, signal),
          mediaId: img.mediaId,
        });
        continue;
      } catch (err) {
        log.warn('SPrCad 2K thất bại', { mediaId: img.mediaId, err });
        throw err;
      }
    }
    try {
      medias.push({ ...(await fetchUrlAsMedia(img.url, 'image')), mediaId: img.mediaId });
    } catch {
      medias.push({ kind: 'image', mime: 'image/png', url: img.url, mediaId: img.mediaId });
    }
  }
  onProgress(100, 'Xong');
  return { medias };
}

/** After ogiZ0b: SPrCad returns inline JPEG base64 (2K). Captcha action = IMAGE_GENERATION. */
async function fetchImage2k(
  tabId: number,
  projectId: string,
  sourceMediaId: string,
  signal: AbortSignal,
): Promise<string> {
  if (signal.aborted) throw driverError('UNKNOWN', 'aborted');
  const freq = image2kRequest({ sourceMediaId, projectId });
  logPayload({
    rpcid: RPC_GEN_IMAGE_2K,
    freq,
    resolution: '2K',
    prompt: '',
    refs: [{ kind: 'image', source: 'flow', mediaId: sourceMediaId }],
  });
  const { text } = await rpcPayload(tabId, RPC_GEN_IMAGE_2K, freq, CAPTCHA_IMAGE);
  const b64 = readImageBase64(firstPayload(text, RPC_GEN_IMAGE_2K));
  if (!b64) throw driverError('UNKNOWN', strings.flowImage2kEmpty);
  return b64;
}

async function resolveMediaIdForOperation(
  tabId: number,
  projectId: string,
  operationId: string,
  round: number,
): Promise<{ mediaId: string | null; complaint: string | null }> {
  let complaint: string | null = null;
  let worthLooking = round % 3 === 0;

  try {
    const { text } = await rpcPayload(
      tabId,
      RPC_OPERATION,
      operationRequest(operationId),
    );
    const op = readOperation(firstPayload(text, RPC_OPERATION));
    complaint = op.error;
    if (op.projectId) projectId = op.projectId;
    worthLooking = worthLooking || op.done || op.complained;
  } catch {
    worthLooking = true;
  }

  if (!worthLooking) return { mediaId: null, complaint };

  const matched = await runBatchRpc(tabId, {
    rpcid: RPC_PROJECT_MEDIA,
    freq: projectMediaRequest(projectId),
    match: operationId,
  });
  if (matched.error) {
    throw driverError(matched.error.includes('NO_AT_TOKEN') ? 'NO_AT_TOKEN' : 'UNKNOWN', matched.error);
  }
  if (matched.status && matched.status >= 400) {
    throw driverError(
      matched.status === 401 || matched.status === 403 ? 'AUTH_REQUIRED' : 'UNKNOWN',
      `batchexecute ${RPC_PROJECT_MEDIA} thất bại — HTTP ${matched.status}`,
    );
  }
  let mediaId = findMediaIdInText(matched.text ?? '', operationId);
  if (!mediaId && (matched.text ?? '').includes(")]}'")) {
    try {
      mediaId = findMediaId(firstPayload(matched.text!, RPC_PROJECT_MEDIA), operationId);
    } catch {
      mediaId = null;
    }
  }
  return { mediaId, complaint };
}

function isTransientImageRejection(reason: unknown): boolean {
  return reason instanceof RpcError && JSON.stringify(reason.detail) === '[8]';
}

/** `[13]` (INTERNAL) with no detail — Flow's answer to an i2v source frame it can't use. */
function isInternalRejection(reason: unknown): boolean {
  return reason instanceof RpcError && Array.isArray(reason.detail) && reason.detail[0] === 13;
}

/**
 * `[5]` (NOT_FOUND) on a MZZa6b submit: Flow does not serve that reference-video
 * wire key for this account at all. Unlike MODEL_ACCESS_DENIED (a per-key plan
 * gate) it rules out the whole Veo r2v branch, so the fallback jumps to Omni.
 */
function isModelNotServed(reason: unknown): boolean {
  if ((reason as { modelNotServed?: boolean }).modelNotServed) return true;
  return (
    reason instanceof RpcError &&
    Array.isArray(reason.detail) &&
    reason.detail.length === 1 &&
    reason.detail[0] === 5
  );
}

/** Terminal poll errors — fail on first hit, do not retry or wrap as "5 lần liên tiếp". */
function isTerminalPollError(e: unknown): boolean {
  const code = (e as { code?: string }).code;
  return (
    code === 'FLOW_RENDER_FAILED' ||
    code === 'AUTH_REQUIRED' ||
    code === 'NO_AT_TOKEN' ||
    (e instanceof Error && e.message === 'aborted')
  );
}

/**
 * Wait for a clip's `/video/` url.
 * - Veo: operation id → media id → url
 * - Omni: jwpduf until workflow DONE → as29s (as29s [5] = not ready, keep polling)
 * - Orphan (submit accepted, parse failed): discover new `/video/` ids on the
 *   project listing that were not present before submit, then resolve urls.
 *   Flow still renders the clip even when our response shape drifts.
 */
type VideoJob =
  | { operationId: string; mediaId?: undefined; excludeMediaIds?: undefined }
  | { mediaId: string; operationId?: undefined; excludeMediaIds?: undefined }
  | { excludeMediaIds: Set<string>; mediaId?: undefined; operationId?: undefined };

async function pollVideoUntilReady(
  tabId: number,
  projectId: string,
  job: VideoJob,
  timeoutSec: number,
  onProgress: Progress,
  signal: AbortSignal,
): Promise<{ mediaId: string; videoUrl: string }> {
  const deadline = Date.now() + timeoutSec * 1000;
  let round = 0;
  let mediaId: string | null = job.mediaId ?? null;
  const operationId = job.operationId ?? '';
  const excludeMediaIds = job.excludeMediaIds;
  let lastError: string | null = null;
  let consecutiveFailures = 0;

  while (Date.now() < deadline) {
    await sleep(VIDEO_POLL_INTERVAL_MS, signal);
    if (signal.aborted) throw driverError('UNKNOWN', 'aborted');
    round++;
    const pct = Math.min(88, 50 + round * 2);
    onProgress(
      pct,
      excludeMediaIds && !mediaId
        ? 'Submit đã lên Flow — đang tìm video mới trên project…'
        : 'Đang tạo video…',
    );

    try {
      if (!mediaId && operationId) {
        const found = await resolveMediaIdForOperation(tabId, projectId, operationId, round);
        // Veo complained (e.g. "Media not found.") — fail now, do not burn the full timeout.
        if (found.complaint) {
          throw driverError('FLOW_RENDER_FAILED', strings.flowVideoOpFailed(found.complaint));
        }
        mediaId = found.mediaId;
      }

      if (!mediaId && excludeMediaIds) {
        mediaId = await findNewProjectVideoId(tabId, projectId, excludeMediaIds);
        if (mediaId) excludeMediaIds.add(mediaId); // claim so parallel orphan jobs skip it
      }

      if (mediaId) {
        // Omni / MZZa6b / YhhmEf: UI polls jwpduf with mediaId until workflow settles.
        if (!operationId) {
          const { text: pollText } = await rpcPayload(
            tabId,
            RPC_OPERATION,
            operationRequest(mediaId),
          );
          const wf = readWorkflowPoll(firstPayload(pollText, RPC_OPERATION));
          if (wf?.failed) {
            throw driverError(
              'FLOW_RENDER_FAILED',
              strings.flowRenderFailureMessage(wf.error, wf.reasons),
            );
          }
          if (wf && !wf.done) {
            consecutiveFailures = 0;
            continue;
          }
        }

        try {
          const { text } = await rpcPayload(tabId, RPC_MEDIA, mediaRequest(mediaId));
          const urls = readMediaUrls(firstPayload(text, RPC_MEDIA), mediaId);
          if (urls.video) {
            return { mediaId, videoUrl: urls.video };
          }
        } catch (e) {
          if (isMediaNotReadyRpcError(e)) {
            consecutiveFailures = 0;
            continue;
          }
          if (isMediaNotFoundError(e)) {
            throw driverError(
              'FLOW_RENDER_FAILED',
              strings.flowVideoOpFailed(mediaNotFoundDetail(e)),
            );
          }
          throw e;
        }
      }
      consecutiveFailures = 0;
    } catch (e) {
      if (isTerminalPollError(e)) throw e;
      if (isMediaNotReadyRpcError(e)) {
        consecutiveFailures = 0;
        continue;
      }
      lastError = e instanceof Error ? e.message : String(e);
      consecutiveFailures++;
      if (consecutiveFailures >= MAX_CONSECUTIVE_POLL_FAILURES) {
        throw driverError(
          'UNKNOWN',
          `Poll video lỗi ${consecutiveFailures} lần liên tiếp: ${lastError}`,
        );
      }
    }
  }

  const hint = lastError;
  throw driverError(
    'TIMEOUT',
    `Hết thời gian chờ video${hint ? ` (${hint})` : ''}` +
      (excludeMediaIds
        ? ' — nếu clip đã hiện trên flow.google.com thì parse response đã lệch; lấy từ gallery Flow'
        : ''),
  );
}

/** Flow returned a permanent missing-media signal (not as29s [5] still-encoding). */
function isMediaNotFoundError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e ?? '');
  return /media not found/i.test(msg);
}

function mediaNotFoundDetail(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e ?? '');
  const m = /media not found\.?/i.exec(msg);
  return m?.[0] ?? 'Media not found.';
}

/** Snapshot `/video/<id>` ids currently visible in the project listing. */
async function listProjectVideoIds(tabId: number, projectId: string): Promise<Set<string>> {
  const matched = await runBatchRpc(tabId, {
    rpcid: RPC_PROJECT_MEDIA,
    freq: projectMediaRequest(projectId),
  });
  if (matched.error || (matched.status != null && matched.status >= 400)) {
    return new Set();
  }
  return new Set(extractVideoMediaIdsFromText(matched.text ?? ''));
}

/** First video media id on the project that was not in the pre-submit snapshot. */
async function findNewProjectVideoId(
  tabId: number,
  projectId: string,
  exclude: Set<string>,
): Promise<string | null> {
  const now = await listProjectVideoIds(tabId, projectId);
  for (const id of now) {
    if (!exclude.has(id)) return id;
  }
  return null;
}

/**
 * Video-only: never call ogiZ0b / invent a mid-scene still.
 *
 * - Previous scene (`continueFrame`) → last-frame upload + `MZZa6b`
 *   (Omni `abra_r2v_*` or Veo `veo_3_1_r2v_*`; maseQ frames fail `eb1hJf`).
 * - Omni Flash text-only → `YhhmEf` / `abra_t2v_*`.
 * - Omni Flash + images → `MZZa6b` / `abra_r2v_*`.
 * - Omni Flash + one video (± images) → video edit (`jIps6` / `abra_edit`).
 * - Veo → image-to-video (`eb1hJf`) with exactly one start frame.
 */
async function generateVideoRpc(
  tabId: number,
  projectId: string,
  payload: FlowGeneratePayload,
  onProgress: Progress,
  signal: AbortSignal,
): Promise<DriverResult> {
  assertRefsSupported(payload, 'video');
  if (payload.continueFrame) {
    return generateContinuedSceneVideo(tabId, projectId, payload, onProgress, signal);
  }
  if (payload.refs?.some((r) => r.kind === 'video')) {
    return generateOmniEditVideo(tabId, projectId, payload, onProgress, signal);
  }
  if (isOmniFlashModel(payload.model)) {
    return generateOmniFlashVideo(tabId, projectId, payload, onProgress, signal);
  }
  return generateVeoI2vVideo(tabId, projectId, payload, onProgress, signal);
}

/** Upload the previous scene's last frame; resolves once Flow serves it (as29s). */
async function uploadLastFrame(
  tabId: number,
  projectId: string,
  frame: { mime: string; dataBase64: string },
  onProgress: Progress,
  signal: AbortSignal,
): Promise<string> {
  const frameId = await uploadImage(
    tabId,
    projectId,
    { name: 'previous-scene-last-frame.jpg', mime: frame.mime, dataBase64: frame.dataBase64 },
    onProgress,
  );
  await waitForUploadedImageReady(tabId, frameId, onProgress, signal);
  return frameId;
}

/**
 * Scene continue for Omni and Veo: last frame rides `MZZa6b` as the first image,
 * followed by Model/Outfit/Background media ids.
 * Veo i2v (`eb1hJf`) answers "Media not found." for maseQ uploads, so continue
 * never goes through it. Veo r2v keys are plan-gated — try a fallback chain, then
 * Omni `abra_r2v_*` when the account has no Veo reference access.
 */
async function generateContinuedSceneVideo(
  tabId: number,
  projectId: string,
  payload: FlowGeneratePayload,
  onProgress: Progress,
  signal: AbortSignal,
): Promise<DriverResult> {
  const continueFrame = payload.continueFrame;
  if (!continueFrame) throw driverError('UNKNOWN', strings.videoNeedsStartFrame);

  const frameId = await uploadLastFrame(tabId, projectId, continueFrame, onProgress, signal);
  const resolved = await resolveRefs(tabId, projectId, payload, onProgress, signal);
  const frameRef: OrderedRef = {
    label: strings.continueFrameRefLabel,
    mediaId: frameId,
    kind: 'image',
    source: 'upload',
  };
  const orderedRefs = [frameRef, ...resolved.orderedRefs.filter((r) => r.mediaId !== frameId)];
  const scene: FlowGeneratePayload = {
    ...payload,
    prompt: strings.omniContinuePromptLead(strings.continueFrameRefLabel) + resolved.prompt,
  };
  return submitReferenceScene(tabId, projectId, payload, scene, orderedRefs, onProgress, signal);
}

/**
 * Submit `scene` through reference-to-video (`MZZa6b`) with `orderedRefs` as the image slots and
 * poll the result. Shared by scene continue and by Veo with a local start image.
 */
async function submitReferenceScene(
  tabId: number,
  projectId: string,
  payload: FlowGeneratePayload,
  scene: FlowGeneratePayload,
  orderedRefs: OrderedRef[],
  onProgress: Progress,
  signal: AbortSignal,
): Promise<DriverResult> {
  const omni = isOmniFlashModel(payload.model);
  const count = Math.max(1, Math.min(4, payload.outputsPerPrompt ?? 1));
  const knownVideos = await listProjectVideoIds(tabId, projectId);
  const sharedExclude = new Set(knownVideos);
  const label = omni ? 'Omni Flash' : 'Veo';

  const first = await submitContinueReferenceWithFallback(
    tabId,
    projectId,
    scene,
    orderedRefs,
    payload,
    omni,
    onProgress,
    signal,
    new Set([...knownVideos, ...orderedRefs.map((r) => r.mediaId)]),
  );
  log.info(`${label} nối cảnh → ${RPC_GEN_VIDEO_REFS} (${first.model})`, {
    refs: orderedRefs.length,
    durationSec: payload.durationSec,
  });

  const jobs: { projectId: string; job: VideoJob }[] = [];
  if (first.submitted.mediaId) {
    sharedExclude.add(first.submitted.mediaId);
    jobs.push({
      projectId: first.submitted.projectId ?? projectId,
      job: { mediaId: first.submitted.mediaId },
    });
  } else {
    onProgress(48, 'Parse response lệch - giữ job trên Flow, sẽ lấy video từ project…');
    jobs.push({ projectId, job: { excludeMediaIds: sharedExclude } });
  }

  for (let n = 1; n < count; n++) {
    if (signal.aborted) throw driverError('UNKNOWN', 'aborted');
    onProgress(45, `Submit ${label} ${n + 1}/${count} (${first.model})…`);
    const submitted = await submitReferenceVideo(
      tabId,
      projectId,
      scene,
      first.model,
      orderedRefs,
      new Set([...knownVideos, ...orderedRefs.map((r) => r.mediaId)]),
      referenceDeniedMessages(first.model),
    );
    if (submitted.mediaId) {
      sharedExclude.add(submitted.mediaId);
      jobs.push({ projectId: submitted.projectId ?? projectId, job: { mediaId: submitted.mediaId } });
    } else {
      onProgress(48, 'Parse response lệch - giữ job trên Flow, sẽ lấy video từ project…');
      jobs.push({ projectId, job: { excludeMediaIds: sharedExclude } });
    }
  }
  return settleAndFetchVideos(tabId, jobs, payload.timeoutSec ?? 600, onProgress, signal);
}

function referenceDeniedMessages(model: string): {
  denied: string;
  failed: (detail: string) => string;
} {
  if (model.startsWith('abra_')) {
    return {
      denied: strings.omniReferenceDenied(model),
      failed: (detail) => strings.omniReferenceSubmitFailed(model, detail),
    };
  }
  return {
    denied: strings.veoReferenceDenied(model),
    failed: (detail) => strings.veoReferenceSubmitFailed(model, detail),
  };
}

/**
 * Omni continue: one `abra_r2v_*` key.
 * Veo continue: try Veo r2v keys, then Omni `abra_r2v_*` when the account has no Veo r2v.
 */
async function submitContinueReferenceWithFallback(
  tabId: number,
  projectId: string,
  scene: FlowGeneratePayload,
  orderedRefs: OrderedRef[],
  payload: FlowGeneratePayload,
  omni: boolean,
  onProgress: Progress,
  signal: AbortSignal,
  excludeMediaIds: Set<string>,
): Promise<{
  submitted: { mediaId: string | null; projectId: string | null };
  model: string;
}> {
  const omniModel = omniReferenceVideoModel(payload.durationSec);
  const models = omni
    ? [omniModel]
    : [...videoR2vFallbackChain(payload.model), omniModel];
  const rejected: string[] = [];
  // NOT_FOUND on one Veo r2v key means Flow serves none of them for this account.
  let veoR2vUnavailable = false;

  for (const model of models) {
    if (signal.aborted) throw driverError('UNKNOWN', 'aborted');
    if (veoR2vUnavailable && model !== omniModel) continue;
    const fallingToOmni = !omni && model === omniModel && rejected.length > 0;
    if (fallingToOmni) {
      onProgress(44, strings.veoContinueFallbackOmni);
      log.info(strings.veoContinueFallbackOmni, { rejected });
    } else {
      onProgress(
        45,
        rejected.length
          ? `Model bị từ chối — thử ${model}…`
          : `Submit ${omni ? 'Omni Flash' : 'Veo'} (${model})…`,
      );
    }
    try {
      const submitted = await submitReferenceVideo(
        tabId,
        projectId,
        scene,
        model,
        orderedRefs,
        excludeMediaIds,
        referenceDeniedMessages(model),
      );
      return { submitted, model };
    } catch (e) {
      const notServed = isModelNotServed(e);
      if (!isModelAccessDenied(e) && !notServed) throw e;
      // Omni is the last candidate — a rejection there has no fallback left.
      if (notServed && model === omniModel) throw e;
      if (notServed) {
        log.warn(strings.veoReferenceNotServed(model));
        veoR2vUnavailable = true;
      }
      rejected.push(model);
    }
  }

  throw driverError('UNKNOWN', strings.veoContinueNoModel(rejected.join(', ')));
}

/** Omni Flash without scene continue: text `YhhmEf` or reference `MZZa6b`. */
async function generateOmniFlashVideo(
  tabId: number,
  projectId: string,
  payload: FlowGeneratePayload,
  onProgress: Progress,
  signal: AbortSignal,
): Promise<DriverResult> {
  const count = Math.max(1, Math.min(4, payload.outputsPerPrompt ?? 1));
  const resolved = await resolveRefs(tabId, projectId, payload, onProgress, signal);
  const scene: FlowGeneratePayload = { ...payload, prompt: resolved.prompt };
  const knownVideos = await listProjectVideoIds(tabId, projectId);
  const sharedExclude = new Set(knownVideos);
  const withRefs = resolved.orderedRefs.length > 0;
  const model = withRefs
    ? omniReferenceVideoModel(payload.durationSec)
    : omniTextVideoModel(payload.durationSec);
  const rpcLabel = withRefs ? RPC_GEN_VIDEO_REFS : RPC_GEN_VIDEO_TEXT;
  log.info(`Omni Flash → ${rpcLabel} (${model})`, {
    refs: resolved.orderedRefs.length,
    durationSec: payload.durationSec,
  });

  const jobs: { projectId: string; job: VideoJob }[] = [];
  for (let n = 0; n < count; n++) {
    if (signal.aborted) throw driverError('UNKNOWN', 'aborted');
    onProgress(
      45,
      count > 1
        ? `Submit Omni Flash ${n + 1}/${count} (${model})…`
        : `Submit Omni Flash (${model})…`,
    );
    const excludeForSalvage = new Set([
      ...knownVideos,
      ...resolved.orderedRefs.map((r) => r.mediaId),
    ]);
    const submitted = withRefs
      ? await submitReferenceVideo(
          tabId,
          projectId,
          scene,
          model,
          resolved.orderedRefs,
          excludeForSalvage,
          referenceDeniedMessages(model),
        )
      : await submitOmniTextVideo(
          tabId,
          projectId,
          scene,
          model,
          resolved.orderedRefs,
          excludeForSalvage,
        );
    if (submitted.mediaId) {
      sharedExclude.add(submitted.mediaId);
      jobs.push({
        projectId: submitted.projectId ?? projectId,
        job: { mediaId: submitted.mediaId },
      });
    } else {
      onProgress(48, 'Parse response lệch — giữ job trên Flow, sẽ lấy video từ project…');
      jobs.push({ projectId, job: { excludeMediaIds: sharedExclude } });
    }
  }
  return settleAndFetchVideos(tabId, jobs, payload.timeoutSec ?? 600, onProgress, signal);
}

/** The single video ref of an Omni edit, resolved to a Flow media id and its length. */
interface VideoSource {
  label: string;
  mediaId: string;
  source: 'flow' | 'upload';
  durationSec: number;
  /** Frame rate of the clip; the edit segment is counted in its frames. */
  fps: number;
}

function assertVideoLength(label: string, durationSec: number | null): number {
  if (durationSec == null || !(durationSec > 0)) {
    throw driverError('UNKNOWN', strings.videoRefUnknownLength(label));
  }
  // Container rounding (e.g. 10.02s for a 10s render) is not a reason to refuse the clip.
  if (durationSec > OMNI_EDIT_MAX_SEC + 0.1) {
    throw driverError('UNKNOWN', strings.videoRefTooLong(label, durationSec, OMNI_EDIT_MAX_SEC));
  }
  return durationSec;
}

/** Clip fps for the edit segment; Flow's own fallback (24) when the file does not say. */
function fpsOf(info: Mp4VideoInfo | null): number {
  return info && info.fps > 0 && Number.isFinite(info.fps) ? info.fps : OMNI_EDIT_FPS;
}

/** Local video → Flow via the content script (Scotty upload, never `maseQ`). */
async function uploadVideo(
  tabId: number,
  projectId: string,
  upload: FlowUploadRef,
  onProgress: Progress,
): Promise<{ mediaId: string; durationSec?: number }> {
  onProgress(18, strings.videoRefUploading(upload.name));
  let reply: FlowVideoUploadReply | undefined;
  try {
    // A Flow tab opened before the extension update keeps an old content script that never
    // answers this message: time out instead of hanging the run.
    reply = await Promise.race([
      // Re-injects the content script when the tab lost it (extension reloaded).
      sendToContent<FlowVideoUploadReply | undefined>(tabId, {
        type: 'flow.uploadVideo',
        projectId,
        name: upload.name || 'video.mp4',
        mime: upload.mime || 'video/mp4',
        dataBase64: stripDataUrl(upload.dataBase64),
      }),
      new Promise<FlowVideoUploadReply>((resolve) =>
        setTimeout(() => resolve({ error: strings.videoRefUploadTimeout }), VIDEO_UPLOAD_TIMEOUT_MS),
      ),
    ]);
  } catch (e) {
    throw driverError('UPLOAD_FAILED', strings.videoRefUploadFailed(e instanceof Error ? e.message : String(e)));
  }
  if (!reply?.mediaId) {
    throw driverError('UPLOAD_FAILED', strings.videoRefUploadFailed(reply?.error ?? 'không có phản hồi'));
  }
  log.info('Upload video → Flow', { mediaId: reply.mediaId, durationSec: reply.durationSec });
  return { mediaId: reply.mediaId, durationSec: reply.durationSec };
}

/**
 * Flow asset: id as is (never uploaded back), length read from the signed mp4.
 * Local file: length checked before upload, stored id reused when Flow still knows it,
 * else uploaded once and remembered on the Asset node. Resolves once Flow serves the video.
 */
async function resolveVideoSource(
  tabId: number,
  projectId: string,
  ref: FlowGenerateRef,
  onProgress: Progress,
  signal: AbortSignal,
): Promise<VideoSource> {
  const label = refLabel(ref, strings.videoRefPromptName);
  const waitReady = (mediaId: string) =>
    waitForUploadedMediaReady(tabId, mediaId, onProgress, signal, {
      timeoutMs: VIDEO_UPLOAD_READY_TIMEOUT_MS,
      message: strings.videoRefWaitReady,
      timeoutError: strings.videoRefNotReady,
    });

  if (ref.mediaId) {
    const urls = await waitReady(ref.mediaId);
    if (!urls.video) throw driverError('UNKNOWN', strings.videoRefUnknownLength(label));
    const clip = await fetchUrlAsMedia(urls.video, 'video');
    const info = readMp4VideoInfo(b64ToBytes(clip.dataBase64));
    const durationSec = assertVideoLength(label, info?.durationSec ?? null);
    return { label, mediaId: ref.mediaId, source: 'flow', durationSec, fps: fpsOf(info) };
  }

  const upload = ref.upload;
  if (!upload) throw driverError('UNKNOWN', strings.videoRefMissing(label));
  const info = readMp4VideoInfo(b64ToBytes(upload.dataBase64));
  const localSec = info?.durationSec ?? null;
  if (localSec != null) assertVideoLength(label, localSec);
  const fps = fpsOf(info);

  const stored = storedUploadId(upload, projectId);
  if (stored && (await flowKnowsMedia(tabId, stored))) {
    return { label, mediaId: stored, source: 'upload', durationSec: assertVideoLength(label, localSec), fps };
  }
  if (stored) log.warn('Id upload video đã lưu không còn trên Flow - upload lại');
  const uploaded = await uploadVideo(tabId, projectId, upload, onProgress);
  if (upload.sha256) upload.uploaded = { mediaId: uploaded.mediaId, projectId, sha256: upload.sha256 };
  const durationSec = assertVideoLength(label, uploaded.durationSec ?? localSec);
  await waitReady(uploaded.mediaId);
  return { label, mediaId: uploaded.mediaId, source: 'upload', durationSec, fps };
}

/** `[Video reference]` → plain words: the video rides the RPC input slot, not an image part. */
function replaceVideoLabel(prompt: string, label: string): string {
  return prompt.split(`[${label}]`).join(strings.videoRefPromptName);
}

/**
 * Omni with a video ref: video edit (`jIps6` / `abra_edit`), the Flow UI path for any
 * ingredient set containing a video. Output length follows the input segment (≤ 10s),
 * images ride the edit's image-ref slot anchored at their `[Label]`.
 */
async function generateOmniEditVideo(
  tabId: number,
  projectId: string,
  payload: FlowGeneratePayload,
  onProgress: Progress,
  signal: AbortSignal,
): Promise<DriverResult> {
  const videoRef = payload.refs?.find((r) => r.kind === 'video');
  if (!videoRef) throw driverError('UNKNOWN', strings.videoNeedsStartFrame);
  const count = Math.max(1, Math.min(4, payload.outputsPerPrompt ?? 1));
  await dropStaleStoredUploads(tabId, projectId, payload, signal);
  const video = await resolveVideoSource(tabId, projectId, videoRef, onProgress, signal);
  const resolved = await resolveRefs(tabId, projectId, payload, onProgress, signal);
  const prompt = replaceVideoLabel(resolved.prompt, video.label);
  const { parts, unknownLabels } = buildReferencePromptParts(
    prompt,
    resolved.orderedRefs.map((r) => ({ label: r.label, mediaId: r.mediaId })),
  );
  if (unknownLabels.length) {
    log.warn(strings.omniUnknownLabelWarn(unknownLabels.map((l) => `[${l}]`).join(', ')), {
      unknownLabels,
    });
  }
  const segment = editVideoSegment(video.mediaId, video.durationSec, video.fps);
  const knownVideos = await listProjectVideoIds(tabId, projectId);
  const sharedExclude = new Set([...knownVideos, video.mediaId]);
  const excludeForSalvage = new Set([
    ...knownVideos,
    video.mediaId,
    ...resolved.orderedRefs.map((r) => r.mediaId),
  ]);
  const textOnly = parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('');
  const submitRefs: SubmitRefInfo[] = [
    { label: video.label, kind: 'video', source: video.source, mediaId: video.mediaId, role: 'ref' },
    ...toSubmitRefs(resolved.orderedRefs),
  ];
  log.info(`Omni + video → ${RPC_GEN_VIDEO_EDIT} (${OMNI_EDIT_MODEL})`, {
    video: video.mediaId,
    durationSec: video.durationSec,
    fps: video.fps,
    frames: [segment.startFrame, segment.endFrame],
    images: resolved.orderedRefs.length,
  });

  const jobs: { projectId: string; job: VideoJob }[] = [];
  for (let n = 0; n < count; n++) {
    if (signal.aborted) throw driverError('UNKNOWN', 'aborted');
    onProgress(
      45,
      count > 1
        ? `Submit Omni chỉnh sửa video ${n + 1}/${count} (${OMNI_EDIT_MODEL})…`
        : `Submit Omni chỉnh sửa video (${OMNI_EDIT_MODEL})…`,
    );
    const freq = editVideoRequest({
      video: segment,
      parts,
      projectId,
      aspect: payload.aspectRatio,
    });
    logPayload({
      rpcid: RPC_GEN_VIDEO_EDIT,
      freq,
      model: OMNI_EDIT_MODEL,
      aspect: payload.aspectRatio,
      durationSec: video.durationSec,
      prompt: formatPartsForLog(parts),
      promptForUrlScan: textOnly,
      refs: submitRefs,
    });
    const submitted = await parseOmniSubmitResponse(
      tabId,
      projectId,
      RPC_GEN_VIDEO_EDIT,
      freq,
      strings.omniEditDenied,
      strings.omniEditSubmitFailed,
      excludeForSalvage,
    );
    if (submitted.mediaId) {
      sharedExclude.add(submitted.mediaId);
      excludeForSalvage.add(submitted.mediaId);
      jobs.push({ projectId: submitted.projectId ?? projectId, job: { mediaId: submitted.mediaId } });
    } else {
      onProgress(48, 'Parse response lệch - giữ job trên Flow, sẽ lấy video từ project…');
      jobs.push({ projectId, job: { excludeMediaIds: sharedExclude } });
    }
  }
  return settleAndFetchVideos(tabId, jobs, payload.timeoutSec ?? 600, onProgress, signal);
}

/** Veo without scene continue: exactly one image start frame → `eb1hJf`. */
async function generateVeoI2vVideo(
  tabId: number,
  projectId: string,
  payload: FlowGeneratePayload,
  onProgress: Progress,
  signal: AbortSignal,
): Promise<DriverResult> {
  const count = Math.max(1, Math.min(4, payload.outputsPerPrompt ?? 1));
  await dropStaleStoredUploads(tabId, projectId, payload, signal);
  const resolved = await resolveRefs(tabId, projectId, payload, onProgress, signal);
  // Local image: upload first (done in resolveRefs), then wait until Flow resolves the id, only then submit.
  for (const ref of resolved.orderedRefs) {
    if (ref.source === 'upload') await waitForUploadedImageReady(tabId, ref.mediaId, onProgress, signal);
  }
  const startFrameId = resolved.imageIds[0];
  if (!startFrameId) {
    throw driverError('UNKNOWN', strings.videoNeedsStartFrame);
  }
  const scene: FlowGeneratePayload = { ...payload, prompt: resolved.prompt };
  // `eb1hJf` only knows ids Flow generated: a maseQ upload ends in "Media not found." after submit.
  // A local start image therefore rides the reference path (`MZZa6b`), which accepts uploads.
  if (resolved.orderedRefs[0]?.source === 'upload') {
    log.info('Ảnh start frame là file local → Veo qua ảnh tham chiếu (MZZa6b), không dùng eb1hJf');
    return submitReferenceScene(tabId, projectId, payload, scene, resolved.orderedRefs, onProgress, signal);
  }
  const jobs = await submitVeoI2vJobs(
    tabId,
    projectId,
    startFrameId,
    scene,
    resolved.orderedRefs,
    count,
    onProgress,
    signal,
  );
  return settleAndFetchVideos(tabId, jobs, payload.timeoutSec ?? 600, onProgress, signal);
}

async function submitVeoI2vJobs(
  tabId: number,
  projectId: string,
  startFrameId: string,
  scene: FlowGeneratePayload,
  orderedRefs: OrderedRef[],
  count: number,
  onProgress: Progress,
  signal: AbortSignal,
): Promise<{ projectId: string; job: VideoJob }[]> {
  if (signal.aborted) throw driverError('UNKNOWN', 'aborted');
  const knownVideos = await listProjectVideoIds(tabId, projectId);
  const sharedExclude = new Set(knownVideos);
  const first = await submitVideoWithFallback(
    tabId,
    projectId,
    startFrameId,
    scene,
    orderedRefs,
    onProgress,
    signal,
  );
  const operations: (Operation | { orphan: true })[] = [first.operation];
  for (let n = 1; n < count; n++) {
    if (signal.aborted) throw driverError('UNKNOWN', 'aborted');
    onProgress(46, `Submit video ${n + 1}/${count} (${first.model})…`);
    operations.push(
      await submitVideo(tabId, projectId, startFrameId, scene, first.model, orderedRefs),
    );
  }
  return operations.map((op) =>
    'orphan' in op
      ? { projectId, job: { excludeMediaIds: sharedExclude } }
      : { projectId: op.projectId ?? projectId, job: { operationId: op.operationId } },
  );
}

async function settleAndFetchVideos(
  tabId: number,
  jobs: { projectId: string; job: VideoJob }[],
  timeoutSec: number,
  onProgress: Progress,
  signal: AbortSignal,
): Promise<DriverResult> {
  const settled = await Promise.allSettled(
    jobs.map(({ projectId: pid, job }) =>
      pollVideoUntilReady(tabId, pid, job, timeoutSec, onProgress, signal),
    ),
  );
  const clips = settled.flatMap((s) => (s.status === 'fulfilled' ? [s.value] : []));
  if (!clips.length) {
    throw (settled[0] as PromiseRejectedResult).reason;
  }

  onProgress(92, 'Tải video…');
  const medias: DriverResult['medias'] = [];
  for (const { videoUrl, mediaId } of clips) {
    try {
      medias.push({ ...(await fetchUrlAsMedia(videoUrl, 'video')), mediaId });
    } catch {
      medias.push({ kind: 'video', mime: 'video/mp4', url: videoUrl, mediaId });
    }
  }
  onProgress(100, 'Xong');
  return { medias };
}

/** Shared Omni submit parse / salvage / orphan path for YhhmEf and MZZa6b. */
async function parseOmniSubmitResponse(
  tabId: number,
  projectId: string,
  rpcid: string,
  freq: string,
  deniedMessage: string,
  rejectedMessage: (detail: string) => string,
  /** Ids already known (refs / project videos) — never treat as the new clip. */
  excludeMediaIds?: Set<string>,
): Promise<{ mediaId: string | null; projectId: string | null }> {
  const { text, raw } = await rpcPayload(tabId, rpcid, freq, CAPTCHA_VIDEO);
  const excluded = excludeMediaIds ?? new Set<string>();

  const failHard = (e: unknown): never => {
    throwIfUnusualActivity(text, e);
    const denied = isModelAccessDenied(e, text);
    throw Object.assign(
      driverError(
        'UNKNOWN',
        denied
          ? deniedMessage
          : rejectedMessage(
              `${e instanceof Error ? e.message : String(e)} — ${summarizeRpcFailure(text, raw.status)}`,
            ),
      ),
      { modelDenied: denied, modelNotServed: isModelNotServed(e) },
    );
  };

  try {
    return readTextVideoSubmit(firstPayload(text, rpcid));
  } catch (e) {
    throwIfUnusualActivity(text, e);
    if (e instanceof RpcError || isModelAccessDenied(e, text)) return failHard(e);

    const fromText =
      extractVideoMediaIdsFromText(text).find((id) => !excluded.has(id)) ?? null;
    if (fromText) {
      log.warn('Omni submit: salvaged media id from raw body', { mediaId: fromText, rpcid });
      return { mediaId: fromText, projectId };
    }
    const uuids = extractUuidsFromText(text).filter(
      (id) => id !== projectId && !excluded.has(id),
    );
    if (uuids[0] && (raw.status == null || raw.status < 400)) {
      log.warn('Omni submit: using first non-project UUID as media id candidate', {
        mediaId: uuids[0],
        rpcid,
      });
      return { mediaId: uuids[0]!, projectId };
    }
    if (raw.status == null || raw.status < 400) {
      log.warn('Omni submit accepted but unparsed — will recover from project listing', {
        status: raw.status,
        rpcid,
        preview: text.slice(0, 240),
      });
      return { mediaId: null, projectId };
    }
    return failHard(e);
  }
}

async function submitOmniTextVideo(
  tabId: number,
  projectId: string,
  payload: FlowGeneratePayload,
  model: string,
  orderedRefs: OrderedRef[],
  excludeMediaIds?: Set<string>,
): Promise<{ mediaId: string | null; projectId: string | null }> {
  const freq = textVideoRequest({
    prompt: payload.prompt,
    projectId,
    aspect: payload.aspectRatio,
    model,
  });
  logPayload({
    rpcid: RPC_GEN_VIDEO_TEXT,
    freq,
    model,
    aspect: payload.aspectRatio,
    durationSec: payload.durationSec,
    prompt: payload.prompt,
    refs: toSubmitRefs(orderedRefs),
  });
  return parseOmniSubmitResponse(
    tabId,
    projectId,
    RPC_GEN_VIDEO_TEXT,
    freq,
    strings.omniTextDenied(model),
    (detail) => strings.omniTextSubmitFailed(model, detail),
    excludeMediaIds ?? new Set(orderedRefs.map((r) => r.mediaId)),
  );
}

async function submitReferenceVideo(
  tabId: number,
  projectId: string,
  payload: FlowGeneratePayload,
  model: string,
  orderedRefs: OrderedRef[],
  excludeMediaIds: Set<string> | undefined,
  messages: { denied: string; failed: (detail: string) => string },
): Promise<{ mediaId: string | null; projectId: string | null }> {
  const { parts, unknownLabels } = buildReferencePromptParts(
    payload.prompt,
    orderedRefs.map((r) => ({ label: r.label, mediaId: r.mediaId })),
  );
  if (unknownLabels.length) {
    log.warn(strings.omniUnknownLabelWarn(unknownLabels.map((l) => `[${l}]`).join(', ')), {
      unknownLabels,
    });
  }
  const freq = referenceVideoRequest({
    parts,
    projectId,
    aspect: payload.aspectRatio,
    model,
  });
  const promptLog = formatPartsForLog(parts);
  const textOnly = parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('');
  logPayload({
    rpcid: RPC_GEN_VIDEO_REFS,
    freq,
    model,
    aspect: payload.aspectRatio,
    durationSec: payload.durationSec,
    prompt: promptLog,
    promptForUrlScan: textOnly,
    refs: toSubmitRefs(orderedRefs),
  });
  return parseOmniSubmitResponse(
    tabId,
    projectId,
    RPC_GEN_VIDEO_REFS,
    freq,
    messages.denied,
    messages.failed,
    excludeMediaIds ?? new Set(orderedRefs.map((r) => r.mediaId)),
  );
}

async function submitVideo(
  tabId: number,
  projectId: string,
  sourceMediaId: string,
  payload: FlowGeneratePayload,
  model: string,
  orderedRefs: OrderedRef[],
): Promise<Operation | { orphan: true }> {
  const freq = videoRequest({
    prompt: payload.prompt,
    projectId,
    sourceMediaId,
    aspect: payload.aspectRatio,
    model,
  });
  logPayload({
    rpcid: RPC_GEN_VIDEO,
    freq,
    model,
    aspect: payload.aspectRatio,
    prompt: payload.prompt,
    refs: veoSubmitLogRefs(sourceMediaId, orderedRefs, !!payload.continueFrame),
  });
  const { text, raw } = await rpcPayload(tabId, RPC_GEN_VIDEO, freq, CAPTCHA_VIDEO);
  try {
    return readOperation(firstPayload(text, RPC_GEN_VIDEO));
  } catch (e) {
    throwIfUnusualActivity(text, e);
    const detail = summarizeRpcFailure(text, raw.status);
    const internal = isInternalRejection(e);
    if (e instanceof RpcError || internal || isModelAccessDenied(e, text)) {
      const hint = internal
        ? ' — lỗi nội bộ phía Google Flow / ảnh start frame i2v không dùng được; thử lại thủ công sau vài phút'
        : '';
      throw Object.assign(
        driverError(
          'UNKNOWN',
          `Video generate không trả operation (${model}): ${e instanceof Error ? e.message : String(e)} — ${detail}${hint}`,
        ),
        { modelDenied: isModelAccessDenied(e, text), internal },
      );
    }
    // Accepted (non-error HTTP) but unparsed — keep the Flow job; recover via listing.
    if (raw.status == null || raw.status < 400) {
      const uuids = extractUuidsFromText(text).filter((id) => id !== projectId && id !== sourceMediaId);
      if (uuids[0]) {
        log.warn('Veo submit: salvaged operation id from raw body', { operationId: uuids[0] });
        return {
          operationId: uuids[0]!,
          projectId,
          status: null,
          error: null,
          done: false,
          complained: false,
        };
      }
      log.warn('Veo submit accepted but unparsed — will recover from project listing', {
        status: raw.status,
        preview: text.slice(0, 240),
      });
      return { orphan: true };
    }
    throw Object.assign(
      driverError(
        'UNKNOWN',
        `Video generate không trả operation (${model}): ${e instanceof Error ? e.message : String(e)} — ${detail}`,
      ),
      { modelDenied: isModelAccessDenied(e, text), internal },
    );
  }
}

async function submitVideoWithFallback(
  tabId: number,
  projectId: string,
  sourceMediaId: string,
  payload: FlowGeneratePayload,
  orderedRefs: OrderedRef[],
  onProgress: Progress,
  signal: AbortSignal,
): Promise<{ operation: Operation | { orphan: true }; model: string }> {
  const stored = await chrome.storage.local.get(FLOW_VIDEO_WIRE_MODEL_STORAGE_KEY);
  const pinned = stored[FLOW_VIDEO_WIRE_MODEL_STORAGE_KEY];
  const models = videoModelFallbackChain(payload.model, typeof pinned === 'string' ? pinned : null);
  const denied: string[] = [];

  for (const model of models) {
    if (signal.aborted) throw driverError('UNKNOWN', 'aborted');
    onProgress(
      45,
      denied.length ? `Model bị từ chối — thử ${model}…` : `Submit video (${model})…`,
    );
    try {
      return {
        operation: await submitVideo(tabId, projectId, sourceMediaId, payload, model, orderedRefs),
        model,
      };
    } catch (e) {
      const modelDenied =
        (e as { modelDenied?: boolean }).modelDenied || isModelAccessDenied(e);
      if (!modelDenied) throw e;
      denied.push(model);
    }
  }

  throw driverError(
    'UNKNOWN',
    `MODEL_ACCESS_DENIED với mọi model Veo đã thử (${denied.join(', ')}). ` +
      `Nếu tài khoản có Omni Flash: chọn "Omni Flash" (prompt thuần hoặc ảnh tham chiếu qua media id). ` +
      `Hoặc lấy wire model của Veo: tạo 1 video tay trên flow.google.com, ` +
      `mở DevTools → Network → request batchexecute?rpcids=eb1hJf, lấy tên model trong f.req ` +
      `rồi ghim vào chrome.storage.local["${FLOW_VIDEO_WIRE_MODEL_STORAGE_KEY}"].`,
  );
}

/**
 * Entry: acquire-ready tabId → project → image or video RPC pipeline.
 */
export async function generateViaRpc(
  tabId: number,
  payload: FlowGeneratePayload,
  onProgress: Progress,
  signal: AbortSignal,
): Promise<DriverResult> {
  log = payload.logCtx ? baseLog.child(payload.logCtx) : baseLog;
  const alive = await reviveTabIfNeeded(tabId);
  if (alive == null) {
    throw driverError('TAB_LOST', 'Tab Flow đã bị đóng hoặc discard');
  }

  onProgress(5, 'Lấy Flow project…');
  const projectId = await resolveFlowProjectId(alive);

  // Keep SW alive during long polls via content-script port
  chrome.tabs.sendMessage(alive, { type: 'driver.rpcKeepalive', start: true }).catch(() => undefined);

  const uploadRefs = (payload.refs ?? []).flatMap((r) => (r.upload ? [r.upload] : []));
  const storedBefore = uploadRefs.map((u) => u.uploaded?.mediaId);
  const imageMode = isImageMode(payload.mode);
  const generate = () =>
    imageMode
      ? generateImageRpc(alive, projectId, payload, onProgress, signal)
      : generateVideoRpc(alive, projectId, payload, onProgress, signal);

  try {
    // Chỉ ảnh: "Media not found" trên id upload đã lưu → upload lại 1 lần.
    // Video (poll / frame / render) cũng có thể báo Media not found - không gói thành flowUploadedMediaGone.
    const result = imageMode
      ? await generateWithStaleUploadRetry(generate, uploadRefs, projectId)
      : await generate();
    const uploads = freshUploads(uploadRefs, storedBefore);
    return uploads.length ? { ...result, uploads } : result;
  } finally {
    log = baseLog;
    chrome.tabs
      .sendMessage(alive, { type: 'driver.rpcKeepalive', start: false })
      .catch(() => undefined);
  }
}

/**
 * A stored upload id Flow no longer knows ("Media not found"): upload again once from
 * the local file and generate again. A second miss is reported, never retried.
 */
async function generateWithStaleUploadRetry(
  generate: () => Promise<DriverResult>,
  uploadRefs: FlowUploadRef[],
  projectId: string,
): Promise<DriverResult> {
  const stale = uploadRefs.filter((u) => storedUploadId(u, projectId));
  try {
    return await generate();
  } catch (e) {
    if (!stale.length || !isMediaNotFoundError(e)) throw e;
    log.warn('Id upload đã lưu không còn trên Flow - upload lại từ file gốc', {
      count: stale.length,
    });
    for (const u of stale) u.uploaded = undefined;
    try {
      return await generate();
    } catch (again) {
      if (!isMediaNotFoundError(again)) throw again;
      throw driverError('UPLOAD_FAILED', strings.flowUploadedMediaGone(mediaNotFoundDetail(again)));
    }
  }
}

/** Uploads made during this generate that belong to an Asset node (engine persists them). */
function freshUploads(
  uploadRefs: FlowUploadRef[],
  storedBefore: (string | undefined)[],
): NonNullable<DriverResult['uploads']> {
  return uploadRefs.flatMap((u, i) =>
    u.nodeId && u.uploaded && u.uploaded.mediaId !== storedBefore[i]
      ? [{ nodeId: u.nodeId, ...u.uploaded }]
      : [],
  );
}

/**
 * Upload one local image to the open Flow project (`maseQ`) - used when the user picks
 * a file, so runs reuse the id instead of uploading again.
 */
export async function uploadImageViaRpc(
  tabId: number,
  img: { name: string; mime: string; dataBase64: string },
): Promise<{ mediaId: string; projectId: string }> {
  const alive = await reviveTabIfNeeded(tabId);
  if (alive == null) throw driverError('TAB_LOST', strings.flowUploadNoTab);
  const projectId = await resolveFlowProjectId(alive);
  const mediaId = await uploadImage(alive, projectId, img, () => undefined);
  return { mediaId, projectId };
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(done, ms);
    signal?.addEventListener('abort', done, { once: true });
    function done() {
      clearTimeout(timer);
      signal?.removeEventListener('abort', done);
      resolve();
    }
  });
}
