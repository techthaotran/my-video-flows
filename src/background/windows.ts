/** Kích thước popup editor / cửa sổ "Chạy". */
export const POPUP_WINDOW_SIZE = { width: 1280, height: 800 } as const;

/**
 * Mở popup theo workflowId, hoặc đưa cửa sổ cũ lên trước.
 * `pagePath` ví dụ: `src/pages/editor/index.html`.
 */
export async function openOrFocusWindow(
  windows: Map<string, number>,
  workflowId: string,
  pagePath: string,
): Promise<void> {
  const existing = windows.get(workflowId);
  if (existing != null) {
    try {
      await chrome.windows.update(existing, { focused: true });
      return;
    } catch {
      windows.delete(workflowId);
    }
  }

  const url = chrome.runtime.getURL(`${pagePath}?id=${encodeURIComponent(workflowId)}`);
  const win = await chrome.windows.create({
    url,
    type: 'popup',
    width: POPUP_WINDOW_SIZE.width,
    height: POPUP_WINDOW_SIZE.height,
  });
  const windowId = win.id;
  if (windowId == null) return;

  windows.set(workflowId, windowId);
  const onRemoved = (id: number) => {
    if (id !== windowId) return;
    windows.delete(workflowId);
    chrome.windows.onRemoved.removeListener(onRemoved);
  };
  chrome.windows.onRemoved.addListener(onRemoved);
}
