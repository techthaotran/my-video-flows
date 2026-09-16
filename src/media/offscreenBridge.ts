/**
 * Đường dây tới offscreen document. Service worker không có DOM, không có
 * <video>, không có WebCodecs và không có AudioContext — mọi việc đụng tới
 * media đều chạy ở đây.
 */

const OFFSCREEN_PATH = 'src/pages/offscreen/index.html';

let creating: Promise<void> | null = null;

export async function ensureOffscreenDocument(): Promise<void> {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
  });
  if (contexts.length) return;
  creating ??= chrome.offscreen
    .createDocument({
      url: OFFSCREEN_PATH,
      reasons: [chrome.offscreen.Reason.BLOBS],
      justification: 'Đọc frame video để nối cảnh và ghép/encode video trong node Ghép video',
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
 * createDocument() resolve trước khi module script của offscreen kịp đăng ký
 * onMessage (rõ nhất ở dev, nơi nó nạp từ Vite server), nên sendMessage ngay
 * sẽ ném "Receiving end does not exist". Retry có backoff; nếu vẫn im thì tạo
 * lại document một lần.
 */
export async function sendToOffscreen(message: unknown): Promise<unknown> {
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
