/**
 * Start / end frame of a clip, read in the extension's offscreen document — the
 * service worker has no <video>, and decoding inside the Flow tab would be
 * subject to that page's media CSP.
 */

import { sendToOffscreen } from '@/media/offscreenBridge';

const FRAME_TIMEOUT_MS = 60_000;

async function extractFrame(
  video: { mime: string; dataBase64: string },
  which: 'first' | 'last',
): Promise<string> {
  const reply = (await Promise.race([
    sendToOffscreen({ type: 'offscreen.videoFrame', which, ...video }).catch((e) => ({
      error: e instanceof Error ? e.message : String(e),
    })),
    new Promise((resolve) =>
      setTimeout(() => resolve({ error: 'FRAME_TIMEOUT' }), FRAME_TIMEOUT_MS),
    ),
  ])) as { dataBase64?: string; error?: string } | undefined;
  const label = which === 'first' ? 'đầu' : 'cuối';
  if (!reply?.dataBase64) {
    throw Object.assign(
      new Error(`Không đọc được frame ${label} của cảnh trước: ${reply?.error ?? 'không có phản hồi'}`),
      { code: 'UNKNOWN' },
    );
  }
  return reply.dataBase64;
}

/** JPEG base64 (no data: prefix) of the clip's first frame — start image for I2V extend. */
export async function extractFirstFrame(video: { mime: string; dataBase64: string }): Promise<string> {
  return extractFrame(video, 'first');
}

/** JPEG base64 (no data: prefix) of the clip's final frame. */
export async function extractLastFrame(video: { mime: string; dataBase64: string }): Promise<string> {
  return extractFrame(video, 'last');
}
