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

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isNoReceiver(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.includes('Receiving end does not exist') || msg.includes('Could not establish connection');
}

/**
 * createDocument() resolves before the offscreen module script has registered its
 * onMessage listener (notably in dev, where it loads from the Vite server), so an
 * immediate sendMessage throws "Receiving end does not exist". Retry with backoff;
 * if the document still never answers, recreate it once.
 */
async function sendToOffscreen(message: unknown): Promise<unknown> {
  for (let recreated = false; ; recreated = true) {
    await ensureOffscreenDocument();
    for (let i = 0; i < 10; i++) {
      try {
        return await chrome.runtime.sendMessage(message);
      } catch (e) {
        if (!isNoReceiver(e)) throw e;
        await sleep(150 * (i + 1));
      }
    }
    if (recreated) throw new Error('OFFSCREEN_NOT_READY');
    await chrome.offscreen.closeDocument().catch(() => undefined);
  }
}

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
