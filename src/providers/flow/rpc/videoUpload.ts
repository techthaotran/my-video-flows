/**
 * Local video → Flow project media id. Flow takes videos only through a Scotty resumable
 * upload on its own origin (captured from the Flow UI 2026-10-19), never `maseQ`:
 *
 * 1. `POST /upload/v1/flow/upload/video/{projectId}` with `X-Goog-Upload-Command: start`
 *    → `X-Goog-Upload-URL` response header.
 * 2. `POST` that URL with the bytes and `X-Goog-Upload-Command: upload, finalize`
 *    → JSON `{ mediaId, media: { video: { dimensions: { length: "4s" } } }, workflow }`.
 *
 * The media starts as `MEDIA_GENERATION_STATUS_PENDING`; callers wait until `as29s` serves it.
 * Pure apart from the injected `fetch`, so it runs in the content script and in tests.
 */

const UPLOAD_PATH = '/upload/v1/flow/upload/video/';
/** Flow's own uploader sends this type on both steps; mirror it. */
const UPLOAD_CONTENT_TYPE = 'application/x-www-form-urlencoded;charset=utf-8';

export interface FlowVideoUploadInput {
  projectId: string;
  name: string;
  bytes: Uint8Array;
}

export interface FlowVideoUploadResult {
  mediaId: string;
  durationSec: number | null;
}

export class FlowVideoUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FlowVideoUploadError';
  }
}

export function flowVideoUploadPath(projectId: string): string {
  return `${UPLOAD_PATH}${encodeURIComponent(projectId)}`;
}

/** `"4s"` / `"4.04s"` → seconds; anything else → null. */
export function parseDurationSec(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const m = /^(\d+(?:\.\d+)?)s$/.exec(value.trim());
  return m ? Number(m[1]) : null;
}

/** Finalize response → media id (top-level `mediaId`, else `media.name`) and clip length. */
export function readVideoUploadResponse(json: unknown): FlowVideoUploadResult {
  const root = json && typeof json === 'object' ? (json as Record<string, unknown>) : {};
  const media = root.media && typeof root.media === 'object' ? (root.media as Record<string, unknown>) : {};
  const mediaId =
    (typeof root.mediaId === 'string' && root.mediaId) ||
    (typeof media.name === 'string' && media.name) ||
    '';
  if (!mediaId) throw new FlowVideoUploadError('Upload video xong nhưng Flow không trả media id');
  const video = media.video && typeof media.video === 'object' ? (media.video as Record<string, unknown>) : {};
  const dims =
    video.dimensions && typeof video.dimensions === 'object'
      ? (video.dimensions as Record<string, unknown>)
      : {};
  return { mediaId, durationSec: parseDurationSec(dims.length) };
}

/** Header-safe file name (Flow uses it as the asset title, URI-encoded like its own uploader). */
function slug(name: string): string {
  return encodeURIComponent(name || 'video.mp4');
}

export async function uploadVideoToFlow(
  fetchFn: typeof fetch,
  input: FlowVideoUploadInput,
): Promise<FlowVideoUploadResult> {
  const size = input.bytes.byteLength;
  if (!size) throw new FlowVideoUploadError('File video rỗng');

  const start = await fetchFn(flowVideoUploadPath(input.projectId), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': UPLOAD_CONTENT_TYPE,
      Slug: slug(input.name),
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(size),
    },
  });
  const uploadUrl = start.headers.get('x-goog-upload-url');
  if (!start.ok || !uploadUrl) {
    throw new FlowVideoUploadError(`Bắt đầu upload video thất bại (HTTP ${start.status})`);
  }

  const done = await fetchFn(uploadUrl, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': UPLOAD_CONTENT_TYPE,
      Slug: slug(input.name),
      'X-Goog-Upload-Command': 'upload, finalize',
      'X-Goog-Upload-Offset': '0',
    },
    body: new Blob([input.bytes as BlobPart]),
  });
  const text = await done.text();
  const status = done.headers.get('x-goog-upload-status');
  if (!done.ok || (status && status !== 'final')) {
    throw new FlowVideoUploadError(`Upload video thất bại (HTTP ${done.status})`);
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new FlowVideoUploadError(`Upload video: Flow trả về không phải JSON (${text.length} byte)`);
  }
  return readVideoUploadResponse(json);
}
