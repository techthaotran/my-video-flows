import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendToContent } from '@/providers/TabPool';

const NO_RECEIVER = 'Could not establish connection. Receiving end does not exist.';

interface Stub {
  sendMessage: ReturnType<typeof vi.fn>;
  executeScript: ReturnType<typeof vi.fn>;
  reload: ReturnType<typeof vi.fn>;
}

/** Tab trả lời sau `failures` lần đầu tiên ném lỗi "không có listener". */
function stubChrome(opts: {
  failures: number;
  injectWorks?: boolean;
  reloadFixes?: boolean;
  error?: string;
}): Stub {
  let left = opts.failures;
  const sendMessage = vi.fn(async () => {
    if (left > 0) {
      left--;
      throw new Error(opts.error ?? NO_RECEIVER);
    }
    return { authenticated: true };
  });
  const executeScript = vi.fn(async () => {
    // Inject thành công = tab có lại listener.
    if (opts.injectWorks !== false) left = 0;
    return [];
  });
  // waitTabComplete gắn listener rồi mới gọi reload, nên stub chỉ cần bắn
  // `complete` một cách bất đồng bộ sau khi reload được gọi.
  const listeners = new Set<(id: number, info: { status: string }) => void>();
  const reload = vi.fn(async (tabId: number) => {
    if (opts.reloadFixes !== false) left = 0;
    queueMicrotask(() => {
      for (const fn of listeners) fn(tabId, { status: 'complete' });
    });
  });

  const chrome = globalThis.chrome as unknown as Record<string, Record<string, unknown>>;
  chrome.tabs.sendMessage = sendMessage;
  chrome.tabs.reload = reload;
  chrome.tabs.onUpdated = {
    addListener: (fn: (id: number, info: { status: string }) => void) => listeners.add(fn),
    removeListener: (fn: (id: number, info: { status: string }) => void) => listeners.delete(fn),
  };
  chrome.scripting = { executeScript };
  chrome.runtime.getManifest = () => ({
    version: '0.1.0',
    content_scripts: [
      {
        matches: ['https://flow.google.com/*', 'https://labs.google/fx/*'],
        js: ['src/providers/flow/injected/captcha.ts'],
        world: 'MAIN',
      },
      {
        matches: ['https://flow.google.com/*', 'https://labs.google/fx/*'],
        js: ['src/content/flow/index.ts'],
      },
      { matches: ['https://gemini.google.com/*'], js: ['src/content/gemini/index.ts'] },
    ],
  });
  return { sendMessage, executeScript, reload };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('phục hồi khi tab mất content script', () => {
  it('gửi thẳng khi tab vẫn còn listener — không inject, không reload', async () => {
    const stub = stubChrome({ failures: 0 });
    await expect(sendToContent(1, { type: 'driver.checkAuth' }, 'flow')).resolves.toEqual({
      authenticated: true,
    });
    expect(stub.executeScript).not.toHaveBeenCalled();
    expect(stub.reload).not.toHaveBeenCalled();
  });

  it('inject lại content script rồi thử lại, không đụng tới trang của user', async () => {
    const stub = stubChrome({ failures: 1 });
    await expect(sendToContent(1, { type: 'driver.checkAuth' }, 'flow')).resolves.toEqual({
      authenticated: true,
    });
    expect(stub.reload).not.toHaveBeenCalled();
    // Cả hai entry của Flow: bridge MAIN world + driver ISOLATED world.
    expect(stub.executeScript).toHaveBeenCalledTimes(2);
    expect(stub.executeScript.mock.calls.map((c) => c[0].world)).toEqual(['MAIN', 'ISOLATED']);
    expect(stub.executeScript.mock.calls.map((c) => c[0].files[0])).toEqual([
      'src/providers/flow/injected/captcha.ts',
      'src/content/flow/index.ts',
    ]);
  });

  it('chỉ inject content script của đúng provider', async () => {
    const stub = stubChrome({ failures: 1 });
    await sendToContent(1, { type: 'driver.checkAuth' }, 'gemini');
    expect(stub.executeScript.mock.calls.map((c) => c[0].files[0])).toEqual([
      'src/content/gemini/index.ts',
    ]);
  });

  it('inject không cứu được thì mới reload tab', async () => {
    const stub = stubChrome({ failures: 2, injectWorks: false });
    await expect(sendToContent(1, { type: 'driver.checkAuth' }, 'flow')).resolves.toEqual({
      authenticated: true,
    });
    expect(stub.executeScript).toHaveBeenCalled();
    expect(stub.reload).toHaveBeenCalledWith(1);
  });

  it('hết cách thì báo lỗi tiếng Việt kèm code TAB_LOST, không lộ chuỗi gốc của Chrome', async () => {
    stubChrome({ failures: 99, injectWorks: false, reloadFixes: false });
    const err = (await sendToContent(1, { type: 'driver.checkAuth' }, 'flow').catch(
      (e: unknown) => e,
    )) as Error & { code?: string; cause?: Error };
    expect(err.message).not.toContain('Could not establish connection');
    expect(err.message).toContain('Google Flow');
    expect(err.code).toBe('TAB_LOST');
    expect((err.cause as Error).message).toBe(NO_RECEIVER);
  });

  it('lỗi thật của content script không kích hoạt inject/reload', async () => {
    const stub = stubChrome({ failures: 99, error: 'AUTH_REQUIRED' });
    await expect(sendToContent(1, { type: 'driver.checkAuth' }, 'flow')).rejects.toThrow(
      /Google Flow/,
    );
    expect(stub.sendMessage).toHaveBeenCalledTimes(1);
    expect(stub.executeScript).not.toHaveBeenCalled();
    expect(stub.reload).not.toHaveBeenCalled();
  });
});
