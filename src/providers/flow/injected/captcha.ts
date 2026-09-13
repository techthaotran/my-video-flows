/**
 * MAIN-world inject on flow.google.com — grecaptcha + batchexecute fetch.
 * Isolated content script bridges CustomEvents ↔ chrome.runtime messages.
 */

const SITE_KEY = '6LdsFiUsAAAAAIjVDZcuLhaHiDn5nnHVXVRQGeMV';
const MAX_RPC_TEXT = 32_000_000;

declare global {
  interface Window {
    grecaptcha?: {
      enterprise?: {
        execute: (siteKey: string, opts: { action: string }) => Promise<string>;
      };
    };
    WIZ_global_data?: Record<string, string>;
  }
}

let captchaMintTail: Promise<unknown> = Promise.resolve();

/** One Enterprise execute at a time — image variants launch staggered but overlap. */
function mintCaptcha(pageAction: string): Promise<string> {
  const run = captchaMintTail.catch(() => undefined).then(async () => {
    await waitForGrecaptcha();
    return window.grecaptcha!.enterprise!.execute(SITE_KEY, { action: pageAction });
  });
  captchaMintTail = run;
  return run;
}

window.addEventListener('GET_CAPTCHA', ((event: CustomEvent) => {
  void (async () => {
    const detail = event.detail as { requestId?: string; pageAction?: string } | undefined;
    const requestId = detail?.requestId;
    const pageAction = detail?.pageAction ?? 'IMAGE_GENERATION';
    try {
      const token = await mintCaptcha(pageAction);
      window.dispatchEvent(
        new CustomEvent('CAPTCHA_RESULT', { detail: { requestId, token } }),
      );
    } catch (e) {
      window.dispatchEvent(
        new CustomEvent('CAPTCHA_RESULT', {
          detail: {
            requestId,
            error: e instanceof Error ? e.message : String(e),
          },
        }),
      );
    }
  })();
}) as EventListener);

window.addEventListener('BATCH_RPC', ((event: CustomEvent) => {
  void (async () => {
    const detail = event.detail as {
      requestId?: string;
      rpcid?: string;
      freq?: string;
      match?: string | null;
    };
    const requestId = detail?.requestId;
    try {
      const result = await runBatchInPage(
        detail?.rpcid ?? '',
        detail?.freq ?? '',
        detail?.match ?? null,
      );
      window.dispatchEvent(
        new CustomEvent('BATCH_RPC_RESULT', { detail: { requestId, ...result } }),
      );
    } catch (e) {
      window.dispatchEvent(
        new CustomEvent('BATCH_RPC_RESULT', {
          detail: {
            requestId,
            error: e instanceof Error ? e.message : String(e),
          },
        }),
      );
    }
  })();
}) as EventListener);

async function runBatchInPage(
  rpcid: string,
  freqStr: string,
  match: string | null,
): Promise<{ status?: number; text?: string; matched?: boolean; error?: string }> {
  const wiz = window.WIZ_global_data || {};
  const at = wiz.SNlM0e;
  const sid = wiz.FdrFJe;
  const bl = wiz.cfb2h;
  if (!at) return { error: 'NO_AT_TOKEN' };
  if (!rpcid || !freqStr) return { error: 'INVALID_BATCH_RPC' };

  const reqid = Math.floor(Math.random() * 900000) + 100000;
  // Mirror Flow's own query: some image models reject generation without
  // source-path; Banana 2 / Lite tolerate it, but keep the param for parity.
  const sourcePath = location.pathname || '/';
  const hl = (document.documentElement.lang || navigator.language || 'en').split('-')[0];
  const url =
    `/_/AiSandboxAngularFrontend/data/batchexecute?rpcids=${encodeURIComponent(rpcid)}` +
    `&source-path=${encodeURIComponent(sourcePath)}` +
    `&bl=${encodeURIComponent(bl || '')}&f.sid=${encodeURIComponent(sid || '')}` +
    `&hl=${encodeURIComponent(hl ?? 'en')}&_reqid=${reqid}&rt=c`;

  const resp = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'x-same-domain': '1',
    },
    body: new URLSearchParams({ 'f.req': freqStr, at }),
  });
  const text = await resp.text();
  if (match) {
    const found = text.indexOf(match);
    return {
      status: resp.status,
      matched: found !== -1,
      text: found === -1 ? '' : text.slice(found, found + 800),
    };
  }
  return { status: resp.status, text: text.slice(0, MAX_RPC_TEXT) };
}

function waitForGrecaptcha(timeout = 22_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (window.grecaptcha?.enterprise?.execute) {
        resolve();
        return;
      }
      if (Date.now() - start > timeout) {
        reject(new Error('grecaptcha not available'));
        return;
      }
      setTimeout(check, 200);
    };
    check();
  });
}
