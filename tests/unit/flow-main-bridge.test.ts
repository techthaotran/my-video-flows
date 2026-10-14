import { describe, expect, it } from 'vitest';
import { installFlowMainBridge } from '@/providers/flow/injected/mainBridge';

/**
 * Same shape as Flow's Y4a wrapper: Object.assign overwrites the caller's action.
 * The literal must stay in the function source; the bridge detects the hijack that way.
 */
function hijackedExecute(siteKey: string, opts: { action: string }): Promise<string> {
  const forced = Object.assign({}, opts, { action: 'extension_hijack_detected' });
  return Promise.resolve(`${siteKey}:${forced.action}`);
}

function plainExecute(siteKey: string, opts: { action: string }): Promise<string> {
  return Promise.resolve(`${siteKey}:${opts.action}`);
}

function requestCaptcha(pageAction: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const onResult = (event: Event) => {
      const detail = (event as CustomEvent<{ token?: string; error?: string }>).detail;
      window.removeEventListener('CAPTCHA_RESULT', onResult);
      if (detail?.error) reject(new Error(detail.error));
      else resolve(detail?.token ?? '');
    };
    window.addEventListener('CAPTCHA_RESULT', onResult);
    window.dispatchEvent(
      new CustomEvent('GET_CAPTCHA', { detail: { requestId: pageAction, pageAction } }),
    );
  });
}

describe('Flow MAIN bridge captcha', () => {
  it('keeps the real action when Flow rewrites execute to extension_hijack_detected', async () => {
    const assign = Object.assign;
    window.grecaptcha = {
      enterprise: {
        ready: (cb) => cb(),
        execute: hijackedExecute,
      },
    };
    expect(installFlowMainBridge()).toBe(true);

    const video = await requestCaptcha('VIDEO_GENERATION');
    expect(video.endsWith(':VIDEO_GENERATION')).toBe(true);
    expect(video.includes('extension_hijack_detected')).toBe(false);
    expect(Object.assign).toBe(assign);

    window.grecaptcha = {
      enterprise: {
        ready: (cb) => cb(),
        execute: plainExecute,
      },
    };
    const image = await requestCaptcha('IMAGE_GENERATION');
    expect(image.endsWith(':IMAGE_GENERATION')).toBe(true);
    expect(Object.assign).toBe(assign);
  });
});
