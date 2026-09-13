const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PROJECT_PATH_RE = /\/project\/([0-9a-fA-F-]{36})/i;

export const FLOW_PROJECT_STORAGE_KEY = 'flowProjectId';

/**
 * Resolve the Flow project UUID for batchexecute calls.
 * Prefer the open tab URL `/project/{uuid}`, then chrome.storage.local.
 */
export async function resolveFlowProjectId(tabId: number): Promise<string> {
  try {
    const tab = await chrome.tabs.get(tabId);
    const fromUrl = projectIdFromUrl(tab.url);
    if (fromUrl) {
      await chrome.storage.local.set({ [FLOW_PROJECT_STORAGE_KEY]: fromUrl });
      return fromUrl;
    }
  } catch {
    /* tab gone */
  }

  const stored = await chrome.storage.local.get(FLOW_PROJECT_STORAGE_KEY);
  const pinned = stored[FLOW_PROJECT_STORAGE_KEY];
  if (typeof pinned === 'string' && UUID_RE.test(pinned)) return pinned;

  throw Object.assign(
    new Error(
      'NO_FLOW_PROJECT — mở một project trên flow.google.com/project/<uuid> (hoặc ghim flowProjectId vào storage) rồi thử lại.',
    ),
    { code: 'NO_FLOW_PROJECT' as const },
  );
}

export function projectIdFromUrl(url?: string): string | null {
  if (!url) return null;
  const m = url.match(PROJECT_PATH_RE);
  const id = m?.[1];
  return id && UUID_RE.test(id) ? id : null;
}

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
