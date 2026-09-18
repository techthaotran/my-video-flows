import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openOrFocusWindow, POPUP_WINDOW_SIZE } from '@/background/windows';

type RemovedListener = (windowId: number) => void;

describe('openOrFocusWindow', () => {
  const removedListeners: RemovedListener[] = [];
  let nextWindowId = 10;
  let createMock: ReturnType<typeof vi.fn>;
  let updateMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    removedListeners.length = 0;
    nextWindowId = 10;
    createMock = vi.fn(async () => ({ id: nextWindowId++ }));
    updateMock = vi.fn(async () => ({}));

    const chrome = globalThis.chrome as unknown as {
      windows: {
        create: typeof createMock;
        update: typeof updateMock;
        onRemoved: {
          addListener: (fn: RemovedListener) => void;
          removeListener: (fn: RemovedListener) => void;
        };
      };
      runtime: { getURL: (p: string) => string };
    };
    chrome.windows.create = createMock;
    chrome.windows.update = updateMock;
    chrome.windows.onRemoved = {
      addListener: (fn) => {
        removedListeners.push(fn);
      },
      removeListener: (fn) => {
        const i = removedListeners.indexOf(fn);
        if (i >= 0) removedListeners.splice(i, 1);
      },
    };
    chrome.runtime.getURL = (p) => `chrome-extension://test/${p}`;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mở lần đầu gọi windows.create đúng kích thước', async () => {
    const map = new Map<string, number>();
    await openOrFocusWindow(map, 'wf-1', 'src/pages/runner/index.html');

    expect(createMock).toHaveBeenCalledWith({
      url: 'chrome-extension://test/src/pages/runner/index.html?id=wf-1',
      type: 'popup',
      width: POPUP_WINDOW_SIZE.width,
      height: POPUP_WINDOW_SIZE.height,
    });
    expect(map.get('wf-1')).toBe(10);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('lần hai gọi windows.update', async () => {
    const map = new Map<string, number>([['wf-1', 42]]);
    await openOrFocusWindow(map, 'wf-1', 'src/pages/editor/index.html');

    expect(updateMock).toHaveBeenCalledWith(42, { focused: true });
    expect(createMock).not.toHaveBeenCalled();
    expect(map.get('wf-1')).toBe(42);
  });

  it('update lỗi → mở mới', async () => {
    updateMock.mockRejectedValueOnce(new Error('no such window'));
    const map = new Map<string, number>([['wf-1', 42]]);
    await openOrFocusWindow(map, 'wf-1', 'src/pages/editor/index.html');

    expect(updateMock).toHaveBeenCalled();
    expect(createMock).toHaveBeenCalled();
    expect(map.get('wf-1')).toBe(10);
  });

  it('onRemoved gỡ khỏi map', async () => {
    const map = new Map<string, number>();
    await openOrFocusWindow(map, 'wf-1', 'src/pages/runner/index.html');
    expect(map.has('wf-1')).toBe(true);
    expect(removedListeners).toHaveLength(1);

    removedListeners[0]!(10);
    expect(map.has('wf-1')).toBe(false);
  });
});
