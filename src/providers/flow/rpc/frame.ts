/**
 * Start / end frame of a clip, read in the extension's offscreen document — the
 * service worker has no <video>, and decoding inside the Flow tab would be
 * subject to that page's media CSP.
 */

const OFFSCREEN_PATH = 'src/pages/offscreen/index.html';
const FRAME_TIMEOUT_MS = 60_000;

let creating: Promise<void> | null = null;

async function ensureOffscreenDocument(): Promise<void> {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
  });
  if (contexts.length) return;
  creating ??= chrome.offscreen
    .createDocument({
      url: OFFSCREEN_PATH,
      reasons: [chrome.offscreen.Reason.BLOBS],
      justification: 'Đọc frame cuối của video để nối cảnh tiếp theo bằng I2V',
    })
    .finally(() => {
      creating = null;
    });
  await creating;
}

async function extractFrame(
  video: { mime: string; dataBase64: string },
  which: 'first' | 'last',
): Promise<string> {
  await ensureOffscreenDocument();
  const reply = (await Promise.race([
    chrome.runtime.sendMessage({ type: 'offscreen.videoFrame', which, ...video }),
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
