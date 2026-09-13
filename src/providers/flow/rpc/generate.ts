/**
 * Orchestrate Flow generate via batchexecute RPC (extension-only).
 * Runs in the service worker — uses chrome.scripting + captcha bridge.
 */

import type { DriverResult, FlowGeneratePayload } from '@/shared/messaging';
import { annotateAssetLabels, type AssetRef } from '@/engine/resolver';
import { extractLastFrame } from '@/providers/flow/rpc/frame';
import {
  CAPTCHA_IMAGE,
  CAPTCHA_VIDEO,
  FLOW_VIDEO_WIRE_MODEL_STORAGE_KEY,
  RPC_GEN_IMAGE,
  RPC_GEN_VIDEO,
  RPC_GEN_VIDEO_TEXT,
  RPC_MEDIA,
  RPC_OPERATION,
  RPC_PROJECT_MEDIA,
  RPC_UPLOAD_IMAGE,
  RpcError,
  extractUuidsFromText,
  extractVideoMediaIdsFromText,
  firstPayload,
  findMediaId,
  findMediaIdInText,
  imageRequest,
  isOmniFlashModel,
  mediaRequest,
  omniTextVideoModel,
  operationRequest,
  projectMediaRequest,
  readImages,
  readMediaUrls,
  readOperation,
  readTextVideoSubmit,
  readUploadedMediaId,
  textVideoRequest,
  uploadRequest,
  videoModelFallbackChain,
  videoRequest,
  type GeneratedImage,
  type Operation,
} from '@/providers/flow/rpc/batch';
import { resolveFlowProjectId } from '@/providers/flow/rpc/project';
import { reviveTabIfNeeded, runBatchRpc } from '@/providers/flow/rpc/runner';
import { createLogger } from '@/shared/log';

const log = createLogger('rpc');

type Progress = (p: number, m?: string) => void;

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

/** Shrink images before maseQ — large base64 breaks messaging / Flow rejects huge bodies. */
async function compressForUpload(img: {
  name: string;
  mime: string;
  dataBase64: string;
}): Promise<{ name: string; mime: string; dataBase64: string }> {
  const maxEdge = 1536;
  const maxBytes = 1_200_000; // ~1.2MB raw → ~1.6MB base64
  try {
    const bytes = b64ToBytes(img.dataBase64);
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const blob = new Blob([copy.buffer], { type: img.mime || 'image/jpeg' });
    const bitmap = await createImageBitmap(blob);
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
  return { text: out.text ?? '', raw: out };
}

async function uploadImage(
  tabId: number,
  projectId: string,
  img: { name: string; mime: string; dataBase64: string },
  onProgress: Progress,
): Promise<string> {
  onProgress(18, `Nén & upload ${img.name}…`);
  const compressed = await compressForUpload(img);
  const freq = uploadRequest({
    imageB64: compressed.dataBase64,
    projectId,
    mimeType: compressed.mime || 'image/jpeg',
    fileName: compressed.name || 'upload.jpg',
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

/** Local uploads already on Flow, keyed by `${projectId}:${cacheKey}` (cacheKey carries the run id). */
const uploadedMediaIds = new Map<string, string>();
const MAX_UPLOAD_CACHE = 200;

/**
 * Turn the node's references into Flow image media ids. Assets that already
 * live on Flow are used by id and never uploaded; local files are uploaded once
 * per run. After upload, the prompt legend is refreshed so `[Label]` maps to
 * the new Flow URL (labels in the body stay as tags).
 */
async function resolveRefs(
  tabId: number,
  projectId: string,
  payload: FlowGeneratePayload,
  onProgress: Progress,
  signal: AbortSignal,
): Promise<{ imageIds: string[]; prompt: string }> {
  const imageIds: string[] = [];
  const addressed: AssetRef[] = [];
  let unusable = 0;

  for (const ref of payload.refs ?? []) {
    if (signal.aborted) throw driverError('UNKNOWN', 'aborted');
    if (ref.kind !== 'image') {
      // Video/audio can't be a generation input on the batch API; a Flow video
      // still reaches the model as its address in the prompt.
      unusable++;
      continue;
    }
    let mediaId = ref.mediaId;
    if (!mediaId && ref.upload) {
      const key = `${projectId}:${ref.upload.cacheKey}`;
      mediaId = uploadedMediaIds.get(key);
      if (!mediaId) {
        mediaId = await uploadImage(tabId, projectId, ref.upload, onProgress);
        uploadedMediaIds.set(key, mediaId);
        if (uploadedMediaIds.size > MAX_UPLOAD_CACHE) {
          uploadedMediaIds.delete(uploadedMediaIds.keys().next().value!);
        }
      }
    }
    if (!mediaId) continue;
    if (!imageIds.includes(mediaId)) imageIds.push(mediaId);
    if (ref.label) addressed.push({ label: ref.label, kind: 'image', flowMediaId: mediaId });
  }

  if (unusable) {
    onProgress(20, `${unusable} video/audio tham chiếu chỉ được đưa địa chỉ vào prompt (API Flow chưa nhận làm input)`);
  }
  return { imageIds, prompt: annotateAssetLabels(payload.prompt, addressed) };
}

async function generateImageRpc(
  tabId: number,
  projectId: string,
  payload: FlowGeneratePayload,
  onProgress: Progress,
  signal: AbortSignal,
): Promise<DriverResult> {
  const { imageIds: refIds, prompt } = await resolveRefs(tabId, projectId, payload, onProgress, signal);

  const count = Math.max(1, Math.min(4, payload.outputsPerPrompt ?? 1));
  const seed = Math.floor(Math.random() * 1e9) + 1;
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

  onProgress(85, 'Tải ảnh…');
  const medias: DriverResult['medias'] = [];
  for (const img of images) {
    if (signal.aborted) throw driverError('UNKNOWN', 'aborted');
    try {
      medias.push({ ...(await fetchUrlAsMedia(img.url, 'image')), mediaId: img.mediaId });
    } catch {
      medias.push({ kind: 'image', mime: 'image/png', url: img.url, mediaId: img.mediaId });
    }
  }
  onProgress(100, 'Xong');
  return { medias };
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
 * Wait for a clip's `/video/` url.
 * - Veo: operation id → media id → url
 * - Omni: media id → url
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
  let lastComplaint: string | null = null;
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
        lastComplaint = found.complaint ?? lastComplaint;
        mediaId = found.mediaId;
      }

      if (!mediaId && excludeMediaIds) {
        mediaId = await findNewProjectVideoId(tabId, projectId, excludeMediaIds);
        if (mediaId) excludeMediaIds.add(mediaId); // claim so parallel orphan jobs skip it
      }

      if (mediaId) {
        const { text } = await rpcPayload(tabId, RPC_MEDIA, mediaRequest(mediaId));
        const urls = readMediaUrls(firstPayload(text, RPC_MEDIA), mediaId);
        if (urls.video) {
          return { mediaId, videoUrl: urls.video };
        }
      }
      consecutiveFailures = 0;
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === 'AUTH_REQUIRED' || code === 'NO_AT_TOKEN') throw e;
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

  const hint = lastComplaint ?? lastError;
  throw driverError(
    'TIMEOUT',
    `Hết thời gian chờ video${hint ? ` (${hint})` : ''}` +
      (excludeMediaIds
        ? ' — nếu clip đã hiện trên flow.google.com thì parse response đã lệch; lấy từ gallery Flow'
        : ''),
  );
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
 * - Omni Flash → ALWAYS text-to-video (`YhhmEf` / `abra_t2v_*`). Prompt keeps
 *   `[Label]` tags; a legend maps each to its CDN url. Never falls back to Veo.
 * - Veo → image-to-video (`eb1hJf`) with exactly one start frame.
 * - continue-from (any model) → last-frame upload + Veo i2v (Omni has no
 *   captured frame-to-video batchexecute payload yet).
 */
async function generateVideoRpc(
  tabId: number,
  projectId: string,
  payload: FlowGeneratePayload,
  onProgress: Progress,
  signal: AbortSignal,
): Promise<DriverResult> {
  const count = Math.max(1, Math.min(4, payload.outputsPerPrompt ?? 1));
  const resolved = await resolveRefs(tabId, projectId, payload, onProgress, signal);
  const scene: FlowGeneratePayload = { ...payload, prompt: resolved.prompt };
  const omni = isOmniFlashModel(payload.model);
  let startFrameId: string | undefined;

  // Next scene: last frame → Veo i2v (Omni batch has no frame/r2v capture yet).
  if (payload.continueFrom) {
    if (omni) {
      onProgress(8, 'Omni Flash chưa nối cảnh trên API batch — dùng Veo i2v từ frame cuối…');
    }
    onProgress(10, 'Lấy frame cuối của cảnh trước để I2V…');
    const frame = await extractLastFrame(payload.continueFrom);
    startFrameId = await uploadImage(
      tabId,
      projectId,
      { name: 'previous-scene-last-frame.jpg', mime: 'image/jpeg', dataBase64: frame },
      onProgress,
    );
  } else if (!omni && resolved.imageIds.length) {
    startFrameId = resolved.imageIds[0];
    if (resolved.imageIds.length > 1) {
      onProgress(
        20,
        `Veo i2v dùng 1 ảnh start frame; ${resolved.imageIds.length - 1} asset còn lại chỉ qua link trong prompt`,
      );
    }
  }

  const jobs: { projectId: string; job: VideoJob }[] = [];

  // Omni Flash (not a continued scene): prompt + asset links only — never eb1hJf.
  if (omni && !payload.continueFrom) {
    const model = omniTextVideoModel(payload.durationSec);
    log.info(`Omni Flash → ${RPC_GEN_VIDEO_TEXT} (${model}), bỏ qua Veo/eb1hJf`, {
      refs: resolved.imageIds.length,
      durationSec: payload.durationSec,
    });
    // Snapshot so a parse-failed submit can still be recovered from Flow's gallery.
    const knownVideos = await listProjectVideoIds(tabId, projectId);
    const sharedExclude = new Set(knownVideos);
    for (let n = 0; n < count; n++) {
      if (signal.aborted) throw driverError('UNKNOWN', 'aborted');
      onProgress(
        45,
        count > 1 ? `Submit Omni Flash ${n + 1}/${count} (${model})…` : `Submit Omni Flash (${model})…`,
      );
      const submitted = await submitOmniTextVideo(tabId, projectId, scene, model);
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
  } else {
    if (!startFrameId) {
      throw driverError(
        'UNKNOWN',
        'Tạo video không tạo ảnh trung gian. Dùng Omni Flash (prompt + link asset), hoặc nối đúng 1 ảnh start frame / cảnh trước cho Veo i2v.',
      );
    }
    if (signal.aborted) throw driverError('UNKNOWN', 'aborted');

    const knownVideos = await listProjectVideoIds(tabId, projectId);
    const sharedExclude = new Set(knownVideos);
    const first = await submitVideoWithFallback(tabId, projectId, startFrameId, scene, onProgress, signal);
    const operations: (Operation | { orphan: true })[] = [first.operation];
    for (let n = 1; n < count; n++) {
      if (signal.aborted) throw driverError('UNKNOWN', 'aborted');
      onProgress(46, `Submit video ${n + 1}/${count} (${first.model})…`);
      operations.push(await submitVideo(tabId, projectId, startFrameId, scene, first.model));
    }
    for (const op of operations) {
      if ('orphan' in op) {
        jobs.push({ projectId, job: { excludeMediaIds: sharedExclude } });
      } else {
        jobs.push({ projectId: op.projectId ?? projectId, job: { operationId: op.operationId } });
      }
    }
  }

  const settled = await Promise.allSettled(
    jobs.map(({ projectId: pid, job }) =>
      pollVideoUntilReady(tabId, pid, job, payload.timeoutSec ?? 600, onProgress, signal),
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

async function submitOmniTextVideo(
  tabId: number,
  projectId: string,
  payload: FlowGeneratePayload,
  model: string,
): Promise<{ mediaId: string | null; projectId: string | null }> {
  const freq = textVideoRequest({ prompt: payload.prompt, projectId, aspect: payload.aspectRatio, model });
  const { text, raw } = await rpcPayload(tabId, RPC_GEN_VIDEO_TEXT, freq, CAPTCHA_VIDEO);

  const failHard = (e: unknown): never => {
    const denied = isModelAccessDenied(e, text);
    throw driverError(
      'UNKNOWN',
      denied
        ? `MODEL_ACCESS_DENIED: tài khoản Flow này không dùng được Omni Flash (${model}). Thử chọn model Veo.`
        : `Omni Flash bị từ chối (${model}): ${e instanceof Error ? e.message : String(e)} — ${summarizeRpcFailure(text, raw.status)}`,
    );
  };

  try {
    return readTextVideoSubmit(firstPayload(text, RPC_GEN_VIDEO_TEXT));
  } catch (e) {
    if (e instanceof RpcError || isModelAccessDenied(e, text)) return failHard(e);

    // HTTP accepted but envelope shape drifted — try UUID salvage, else orphan-poll.
    const fromText = extractVideoMediaIdsFromText(text)[0] ?? null;
    if (fromText) {
      log.warn('Omni submit: salvaged media id from raw body', { mediaId: fromText });
      return { mediaId: fromText, projectId };
    }
    const uuids = extractUuidsFromText(text).filter((id) => id !== projectId);
    if (uuids[0] && (raw.status == null || raw.status < 400)) {
      log.warn('Omni submit: using first non-project UUID as media id candidate', { mediaId: uuids[0] });
      return { mediaId: uuids[0]!, projectId };
    }
    if (raw.status == null || raw.status < 400) {
      log.warn('Omni submit accepted but unparsed — will recover from project listing', {
        status: raw.status,
        preview: text.slice(0, 240),
      });
      return { mediaId: null, projectId };
    }
    return failHard(e);
  }
}

async function submitVideo(
  tabId: number,
  projectId: string,
  sourceMediaId: string,
  payload: FlowGeneratePayload,
  model: string,
): Promise<Operation | { orphan: true }> {
  const freq = videoRequest({
    prompt: payload.prompt,
    projectId,
    sourceMediaId,
    aspect: payload.aspectRatio,
    model,
  });
  const { text, raw } = await rpcPayload(tabId, RPC_GEN_VIDEO, freq, CAPTCHA_VIDEO);
  try {
    return readOperation(firstPayload(text, RPC_GEN_VIDEO));
  } catch (e) {
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
      return { operation: await submitVideo(tabId, projectId, sourceMediaId, payload, model), model };
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
      `Nếu tài khoản có Omni Flash: chọn "Omni Flash" (prompt + link asset). ` +
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
  const alive = await reviveTabIfNeeded(tabId);
  if (alive == null) {
    throw driverError('TAB_LOST', 'Tab Flow đã bị đóng hoặc discard');
  }

  onProgress(5, 'Lấy Flow project…');
  const projectId = await resolveFlowProjectId(alive);

  // Keep SW alive during long polls via content-script port
  chrome.tabs.sendMessage(alive, { type: 'driver.rpcKeepalive', start: true }).catch(() => undefined);

  try {
    if (isImageMode(payload.mode)) {
      return await generateImageRpc(alive, projectId, payload, onProgress, signal);
    }
    return await generateVideoRpc(alive, projectId, payload, onProgress, signal);
  } finally {
    chrome.tabs
      .sendMessage(alive, { type: 'driver.rpcKeepalive', start: false })
      .catch(() => undefined);
  }
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
