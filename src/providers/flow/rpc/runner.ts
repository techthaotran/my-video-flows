import { CAPTCHA_SLOT } from '@/providers/flow/rpc/batch';
import { ensureFlowMainBridge, solveCaptcha, type CaptchaAction } from '@/providers/flow/rpc/captcha';

const FLOW_URLS = ['https://flow.google.com/*', 'https://labs.google/fx/*'];
const BATCH_RPC_TIMEOUT_MS = 120_000;

export interface BatchRpcCmd {
  id?: string;
  rpcid: string;
  freq: string;
  captchaAction?: CaptchaAction | null;
  /** If set, return only an 800-byte window around this string (project listing). */
  match?: string | null;
}

export interface BatchRpcResult {
  status?: number;
  text?: string;
  matched?: boolean;
  error?: string;
}

/**
 * Mint captcha (if needed) and POST batchexecute from the Flow tab MAIN world.
 * Uses content-script CustomEvent bridge (not executeScript args) so large
 * upload payloads (base64 images) are not truncated by injection limits.
 */
export async function runBatchRpc(
  tabId: number,
  cmd: BatchRpcCmd,
): Promise<BatchRpcResult> {
  let freq = cmd.freq;
  if (cmd.captchaAction) {
    const solved = await solveCaptcha(
      tabId,
      cmd.captchaAction,
      cmd.id ?? crypto.randomUUID(),
    );
    if (!solved?.token) {
      return { error: `CAPTCHA_FAILED: ${solved?.error || 'no token'}` };
    }
    freq = freq.split(CAPTCHA_SLOT).join(solved.token);
  } else {
    await ensureFlowMainBridge(tabId);
  }

  try {
    const result = await Promise.race([
      requestBatchFromTab(tabId, {
        requestId: cmd.id ?? crypto.randomUUID(),
        rpcid: cmd.rpcid,
        freq,
        match: cmd.match ?? null,
      }),
      new Promise<BatchRpcResult>((resolve) =>
        setTimeout(
          () => resolve({ error: 'BATCH_RPC_TIMEOUT' }),
          BATCH_RPC_TIMEOUT_MS,
        ),
      ),
    ]);
    return result;
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

async function requestBatchFromTab(
  tabId: number,
  payload: {
    requestId: string;
    rpcid: string;
    freq: string;
    match: string | null;
  },
): Promise<BatchRpcResult> {
  try {
    const result = (await chrome.tabs.sendMessage(tabId, {
      type: 'BATCH_RPC',
      ...payload,
    })) as BatchRpcResult;
    return result ?? { error: 'NO_BATCH_RPC_RESULT' };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (
      msg.includes('Receiving end does not exist') ||
      msg.includes('Could not establish connection') ||
      msg.includes('message port closed')
    ) {
      return {
        error:
          'NO_CONTENT_SCRIPT — reload tab flow.google.com rồi thử lại (payload upload lớn cần content bridge).',
      };
    }
    // Message too large — hint to compress
    if (/too large|Exceeded|QUOTA|OOM|memory/i.test(msg)) {
      return {
        error: `BATCH_RPC_PAYLOAD_TOO_LARGE: ${msg}. Ảnh quá lớn — hãy dùng ảnh nhỏ hơn.`,
      };
    }
    return { error: msg };
  }
}

/** Ensure tab is awake (Chrome may discard background tabs). */
export async function reviveTabIfNeeded(tabId: number): Promise<number | null> {
  try {
    let tab = await chrome.tabs.get(tabId);
    if (tab.discarded) {
      await chrome.tabs.reload(tabId);
      await sleep(2500);
      tab = await chrome.tabs.get(tabId);
    }
    return tab.id ?? null;
  } catch {
    return null;
  }
}

export async function findFlowTabId(): Promise<number | null> {
  const tabs = await chrome.tabs.query({ url: FLOW_URLS });
  const live = tabs.find((t) => t.id != null && !t.discarded) ?? tabs[0];
  return live?.id ?? null;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
