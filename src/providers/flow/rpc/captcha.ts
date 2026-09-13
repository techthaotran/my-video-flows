/** reCAPTCHA site key for Flow (unchanged after Sept 2026 migration). */
export const FLOW_CAPTCHA_SITE_KEY = '6LdsFiUsAAAAAIjVDZcuLhaHiDn5nnHVXVRQGeMV';

const CAPTCHA_TIMEOUT_MS = 30_000;

export type CaptchaAction = 'IMAGE_GENERATION' | 'VIDEO_GENERATION' | string;

/**
 * Ask the Flow tab's content script to mint a reCAPTCHA token via MAIN-world grecaptcha.
 * Runs in the service worker.
 */
export async function solveCaptcha(
  tabId: number,
  pageAction: CaptchaAction,
  requestId: string = crypto.randomUUID(),
): Promise<{ token?: string; error?: string }> {
  try {
    const result = await Promise.race([
      requestCaptchaFromTab(tabId, requestId, pageAction),
      new Promise<{ error: string }>((resolve) =>
        setTimeout(() => resolve({ error: 'CAPTCHA_TIMEOUT' }), CAPTCHA_TIMEOUT_MS),
      ),
    ]);
    return result;
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

async function requestCaptchaFromTab(
  tabId: number,
  requestId: string,
  pageAction: string,
): Promise<{ token?: string; error?: string }> {
  try {
    return (await chrome.tabs.sendMessage(tabId, {
      type: 'GET_CAPTCHA',
      requestId,
      pageAction,
    })) as { token?: string; error?: string };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      error:
        msg.includes('Receiving end does not exist') ||
        msg.includes('Could not establish connection')
          ? 'NO_CONTENT_SCRIPT — reload tab flow.google.com'
          : msg,
    };
  }
}
