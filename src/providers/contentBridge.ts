/**
 * SW → content script messaging with self-recovery (re-inject, then reload the tab).
 * Separate from TabPool so the Flow RPC layer can use it without an import cycle.
 */

import { createLogger } from '@/shared/log';

const log = createLogger('driver');

const FLOW_MATCH = ['https://flow.google.com/*', 'https://labs.google/fx/*'];
const GEMINI_MATCH = ['https://gemini.google.com/*'];

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Đợi tab load xong.
 *
 * `navigate` dùng khi ta chủ động reload / đổi URL: hàm gắn listener **trước**
 * rồi mới gọi, và chỉ chấp nhận sự kiện `complete` mới. Gọi reload trước rồi
 * mới chờ là sai hai đường — tab còn giữ status `complete` của trang cũ (chờ
 * xong ngay lập tức, gửi message vào trang đang điều hướng dở), hoặc sự kiện đã
 * bắn xong trước khi listener kịp gắn (chờ tới hết timeout).
 */
export function waitTabComplete(
  tabId: number,
  opts: { timeoutMs?: number; navigate?: () => Promise<unknown> } = {},
): Promise<void> {
  const timeoutMs = opts.timeoutMs ?? 30000;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error('Tab load timeout'));
    }, timeoutMs);
    const done = () => {
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    };
    function listener(id: number, info: chrome.tabs.TabChangeInfo) {
      if (id === tabId && info.status === 'complete') done();
    }
    chrome.tabs.onUpdated.addListener(listener);

    if (opts.navigate) {
      opts.navigate().catch((e) => {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        reject(e);
      });
      return;
    }
    chrome.tabs.get(tabId).then(
      (t) => {
        if (t.status === 'complete') done();
      },
      () => undefined,
    );
  });
}

/**
 * Content script khai báo trong manifest cho các trang của provider này, kèm
 * world của từng entry.
 */
function manifestContentScripts(
  provider: 'flow' | 'gemini',
): { files: string[]; world: chrome.scripting.ExecutionWorld }[] {
  const patterns = provider === 'flow' ? FLOW_MATCH : GEMINI_MATCH;
  const entries = chrome.runtime.getManifest().content_scripts ?? [];
  return entries
    .filter((cs) => (cs.matches ?? []).some((m) => patterns.includes(m)))
    .map((cs) => ({
      files: cs.js ?? [],
      world: ((cs as { world?: chrome.scripting.ExecutionWorld }).world ??
        'ISOLATED') as chrome.scripting.ExecutionWorld,
    }))
    .filter((cs) => cs.files.length > 0);
}

/**
 * Nạp lại content script vào tab đang mở. Đây là cách phục hồi khi tab không có
 * listener nữa — thường do extension vừa reload (script cũ mất context), hoặc
 * loader dạng `import()` của bản dev không chạy được. Nạp lại rẻ hơn và không
 * phá trạng thái trang như reload tab; cả hai entry point đều idempotent nên
 * gọi lặp là an toàn.
 */
async function reinjectContentScripts(
  tabId: number,
  provider: 'flow' | 'gemini',
): Promise<boolean> {
  let injected = false;
  for (const cs of manifestContentScripts(provider)) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId, allFrames: false },
        files: cs.files,
        world: cs.world,
        injectImmediately: true,
      });
      injected = true;
    } catch (e) {
      log.warn(`Không inject lại được content script (${cs.files.join(', ')}): ${errMessage(e)}`);
    }
  }
  return injected;
}

function isNoReceiver(e: unknown): boolean {
  const msg = errMessage(e);
  return (
    msg.includes('Receiving end does not exist') ||
    msg.includes('Could not establish connection')
  );
}

/**
 * Gửi message tới content script, tự phục hồi khi tab không có listener:
 * inject lại script trước (giữ nguyên trang), chỉ reload tab khi cách đó không
 * ăn thua. Lỗi cuối cùng luôn là câu tiếng Việt chỉ rõ phải làm gì — chuỗi gốc
 * "Could not establish connection" của Chrome chỉ giữ lại để debug trong log.
 */
export async function sendToContent<T = unknown>(
  tabId: number,
  message: unknown,
  provider: 'flow' | 'gemini' = 'flow',
): Promise<T> {
  const recover: ('inject' | 'reload')[] = ['inject', 'reload'];
  let lastErr: unknown;

  for (let attempt = 0; ; attempt++) {
    try {
      return (await chrome.tabs.sendMessage(tabId, message)) as T;
    } catch (e) {
      lastErr = e;
      const step = recover[attempt];
      // Lỗi khác "không có listener" (tab đóng, content script ném lỗi thật)
      // thì inject lại cũng vô ích.
      if (!step || !isNoReceiver(e)) break;

      if (step === 'inject') {
        log.warn(`Tab ${provider} không có content script — inject lại`);
        if (!(await reinjectContentScripts(tabId, provider))) continue;
        await sleep(300);
      } else {
        log.warn(`Inject lại không ăn thua — reload tab ${provider}`);
        await waitTabComplete(tabId, {
          navigate: () => chrome.tabs.reload(tabId),
        }).catch(() => undefined);
        await sleep(1200);
      }
    }
  }

  const label = provider === 'flow' ? 'Google Flow' : 'Gemini';
  throw Object.assign(
    new Error(
      `Không kết nối được với tab ${label}. Mở tab ${label}, đăng nhập rồi thử lại; ` +
        'nếu vừa cập nhật extension thì reload extension và reload tab.',
    ),
    { code: 'TAB_LOST', cause: lastErr },
  );
}
