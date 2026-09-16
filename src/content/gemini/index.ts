import { handleDriverAction, checkAuth, diagnose, capabilities } from '@/providers/gemini/driver';
import type { SwToContentMessage, ContentToSwMessage, DriverAction } from '@/shared/messaging';

/**
 * Service worker inject lại file này khi tab mất listener (extension vừa
 * reload, hoặc loader dev không chạy). Inject lặp không được đăng ký listener
 * hai lần — nếu không, mỗi message sẽ có hai handler cùng chạy.
 */
declare global {
  interface Window {
    __myXFlowsGeminiContent?: boolean;
  }
}

const alreadyInstalled = window.__myXFlowsGeminiContent === true;
window.__myXFlowsGeminiContent = true;

const aborts = new Map<string, AbortController>();

function send(msg: ContentToSwMessage) {
  chrome.runtime.sendMessage(msg).catch(() => undefined);
}

function startKeepalive() {
  const port = chrome.runtime.connect({ name: 'driver-keepalive' });
  const iv = setInterval(() => {
    try {
      port.postMessage({ type: 'driver.keepalive' });
    } catch {
      clearInterval(iv);
    }
  }, 20_000);
  return () => {
    clearInterval(iv);
    try {
      port.disconnect();
    } catch {
      /* */
    }
  };
}

if (!alreadyInstalled) {
  chrome.runtime.onMessage.addListener(onSwMessage);
  console.debug('[My X Flows] Gemini content script loaded');
}

function onSwMessage(
  message: SwToContentMessage,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (r?: unknown) => void,
) {
  void (async () => {
    try {
      if (message.type === 'driver.checkAuth') {
        sendResponse({ authenticated: await checkAuth() });
        return;
      }
      if (message.type === 'driver.diagnose') {
        sendResponse({ health: await diagnose() });
        return;
      }
      if (message.type === 'driver.capabilities') {
        sendResponse(await capabilities());
        return;
      }
      if (message.type === 'driver.abort') {
        aborts.get(message.requestId)?.abort();
        sendResponse({ ok: true });
        return;
      }
      if (message.type === 'driver.status') {
        sendResponse({ running: aborts.has(message.requestId) });
        return;
      }
      if (message.type === 'driver.execute') {
        const stopKeep = startKeepalive();
        const ac = new AbortController();
        aborts.set(message.requestId, ac);
        try {
          const result = await handleDriverAction(
            message.action as DriverAction,
            (progress, msg) => {
              send({ type: 'driver.progress', requestId: message.requestId, progress, message: msg });
            },
            ac.signal,
          );
          send({ type: 'driver.result', requestId: message.requestId, ok: true, result });
          sendResponse({ ok: true });
        } catch (e) {
          const err = e as { code?: string; message?: string };
          send({
            type: 'driver.result',
            requestId: message.requestId,
            ok: false,
            error: {
              code: (err.code as never) ?? 'UNKNOWN',
              message: err.message ?? String(e),
            },
          });
          sendResponse({ ok: false });
        } finally {
          aborts.delete(message.requestId);
          stopKeep();
        }
        return;
      }
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
  })();
  return true;
}

if (import.meta.env.DEV) {
  (window as unknown as { __myXFlowsGemini?: unknown }).__myXFlowsGemini = {
    checkAuth,
    diagnose,
    capabilities,
  };
}
