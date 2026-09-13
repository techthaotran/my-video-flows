import {
  handleDriverAction,
  checkAuth,
  diagnose,
  capabilities,
  listMedia,
  fetchMedia,
} from '@/providers/flow/driver';
import type { SwToContentMessage, ContentToSwMessage, DriverAction } from '@/shared/messaging';

const aborts = new Map<string, AbortController>();
let rpcKeepaliveStop: (() => void) | null = null;

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

type CaptchaMsg = {
  type: 'GET_CAPTCHA';
  requestId: string;
  pageAction: string;
};

type RpcKeepaliveMsg = {
  type: 'driver.rpcKeepalive';
  start: boolean;
};

type BatchRpcMsg = {
  type: 'BATCH_RPC';
  requestId: string;
  rpcid: string;
  freq: string;
  match?: string | null;
};

chrome.runtime.onMessage.addListener((message: SwToContentMessage | CaptchaMsg | RpcKeepaliveMsg | BatchRpcMsg, _sender, sendResponse) => {
  void (async () => {
    try {
      if ((message as CaptchaMsg).type === 'GET_CAPTCHA') {
        const { requestId, pageAction } = message as CaptchaMsg;
        const reply = await requestCaptchaFromMain(requestId, pageAction);
        sendResponse(reply);
        return;
      }

      if ((message as BatchRpcMsg).type === 'BATCH_RPC') {
        const { requestId, rpcid, freq, match } = message as BatchRpcMsg;
        const reply = await requestBatchFromMain(requestId, rpcid, freq, match ?? null);
        sendResponse(reply);
        return;
      }

      if ((message as RpcKeepaliveMsg).type === 'driver.rpcKeepalive') {
        const { start } = message as RpcKeepaliveMsg;
        if (start) {
          rpcKeepaliveStop?.();
          rpcKeepaliveStop = startKeepalive();
        } else {
          rpcKeepaliveStop?.();
          rpcKeepaliveStop = null;
        }
        sendResponse({ ok: true });
        return;
      }

      const msg = message as SwToContentMessage;
      if (msg.type === 'driver.checkAuth') {
        sendResponse({ authenticated: await checkAuth() });
        return;
      }
      if (msg.type === 'driver.diagnose') {
        sendResponse({ health: await diagnose() });
        return;
      }
      if (msg.type === 'driver.capabilities') {
        sendResponse(await capabilities());
        return;
      }
      if (msg.type === 'driver.abort') {
        aborts.get(msg.requestId)?.abort();
        sendResponse({ ok: true });
        return;
      }
      if (msg.type === 'driver.status') {
        sendResponse({ running: aborts.has(msg.requestId) });
        return;
      }
      if (msg.type === 'driver.execute') {
        const stopKeep = startKeepalive();
        const ac = new AbortController();
        aborts.set(msg.requestId, ac);
        try {
          const result = await handleDriverAction(
            msg.action as DriverAction,
            (progress, progressMsg) => {
              send({
                type: 'driver.progress',
                requestId: msg.requestId,
                progress,
                message: progressMsg,
              });
            },
            ac.signal,
          );
          send({ type: 'driver.result', requestId: msg.requestId, ok: true, result });
          sendResponse({ ok: true });
        } catch (e) {
          const err = e as { code?: string; message?: string };
          send({
            type: 'driver.result',
            requestId: msg.requestId,
            ok: false,
            error: {
              code: (err.code as never) ?? 'UNKNOWN',
              message: err.message ?? String(e),
            },
          });
          sendResponse({ ok: false });
        } finally {
          aborts.delete(msg.requestId);
          stopKeep();
        }
        return;
      }
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
  })();
  return true;
});

function requestCaptchaFromMain(
  requestId: string,
  pageAction: string,
): Promise<{ token?: string; error?: string }> {
  return new Promise((resolve) => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        requestId?: string;
        token?: string;
        error?: string;
      };
      if (detail?.requestId !== requestId) return;
      window.removeEventListener('CAPTCHA_RESULT', handler);
      clearTimeout(timer);
      resolve({ token: detail.token, error: detail.error });
    };

    const timer = setTimeout(() => {
      window.removeEventListener('CAPTCHA_RESULT', handler);
      resolve({ error: 'CONTENT_TIMEOUT' });
    }, 25_000);

    window.addEventListener('CAPTCHA_RESULT', handler);
    window.dispatchEvent(
      new CustomEvent('GET_CAPTCHA', {
        detail: { requestId, pageAction },
      }),
    );
  });
}

function requestBatchFromMain(
  requestId: string,
  rpcid: string,
  freq: string,
  match: string | null,
): Promise<{ status?: number; text?: string; matched?: boolean; error?: string }> {
  return new Promise((resolve) => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        requestId?: string;
        status?: number;
        text?: string;
        matched?: boolean;
        error?: string;
      };
      if (detail?.requestId !== requestId) return;
      window.removeEventListener('BATCH_RPC_RESULT', handler);
      clearTimeout(timer);
      resolve({
        status: detail.status,
        text: detail.text,
        matched: detail.matched,
        error: detail.error,
      });
    };

    // Uploads can be slow; keep channel open longer than captcha.
    const timer = setTimeout(() => {
      window.removeEventListener('BATCH_RPC_RESULT', handler);
      resolve({ error: 'BATCH_RPC_CONTENT_TIMEOUT' });
    }, 120_000);

    window.addEventListener('BATCH_RPC_RESULT', handler);
    window.dispatchEvent(
      new CustomEvent('BATCH_RPC', {
        detail: { requestId, rpcid, freq, match },
      }),
    );
  });
}

if (import.meta.env.DEV) {
  (window as unknown as { __myXFlowsFlow?: unknown }).__myXFlowsFlow = {
    checkAuth,
    diagnose,
    capabilities,
    listMedia,
    fetchMedia,
  };
}

console.debug('[My X Flows] Flow content script loaded (RPC captcha bridge)');
