import type {
  DriverAction,
  DriverResult,
  FlowGeneratePayload,
  SwToUiEvent,
  DriverError,
  FlowMediaItem,
} from '@/shared/messaging';
import { generateViaRpc } from '@/providers/flow/rpc/generate';
import { listProjectMediaPage, signFlowMedia, type SignedFlowMedia } from '@/providers/flow/rpc/listing';
import { createLogger } from '@/shared/log';

const log = createLogger('driver');

const FLOW_URL = 'https://flow.google.com/';
const GEMINI_URL = 'https://gemini.google.com/app';
const FLOW_MATCH = ['https://flow.google.com/*', 'https://labs.google/fx/*'];
const GEMINI_MATCH = ['https://gemini.google.com/*'];

export class TabPool {
  private tabs = new Map<string, number[]>(); // provider -> tabIds
  private maxPerProvider = 2;

  setMax(n: number) {
    this.maxPerProvider = Math.max(1, Math.min(8, n));
  }

  private remember(provider: 'flow' | 'gemini', tabId: number) {
    const list = this.tabs.get(provider) ?? [];
    if (!list.includes(tabId)) list.unshift(tabId);
    this.tabs.set(provider, list.slice(0, this.maxPerProvider));
  }

  /** Tìm tab Flow/Gemini đang mở của user (không chỉ tab do extension tạo) */
  private async findExisting(provider: 'flow' | 'gemini'): Promise<chrome.tabs.Tab[]> {
    const patterns = provider === 'flow' ? FLOW_MATCH : GEMINI_MATCH;
    const found = await chrome.tabs.query({ url: patterns });
    // Ưu tiên tab có URL sâu hơn (đã vào project), rồi tab active
    return found
      .filter((t) => t.id != null)
      .sort((a, b) => {
        const score = (t: chrome.tabs.Tab) => {
          let s = 0;
          if (t.active) s += 10;
          if (t.url && /\/project\//i.test(t.url)) s += 8;
          if (t.url && t.url.length > (provider === 'flow' ? FLOW_URL.length + 5 : GEMINI_URL.length + 5)) s += 5;
          return s;
        };
        return score(b) - score(a);
      });
  }

  async acquire(provider: 'flow' | 'gemini', opts?: { active?: boolean }): Promise<number> {
    const tracked = this.tabs.get(provider) ?? [];

    // 1) Tracked tabs still alive
    for (const id of tracked) {
      try {
        const tab = await chrome.tabs.get(id);
        if (tab?.id != null && isProviderUrl(provider, tab.url)) {
          if (opts?.active) await focusTab(tab);
          return tab.id;
        }
      } catch {
        /* dead */
      }
    }

    // 2) Any existing user tab for this provider
    const existing = await this.findExisting(provider);
    if (existing[0]?.id != null) {
      this.remember(provider, existing[0].id);
      if (opts?.active) await focusTab(existing[0]);
      return existing[0].id;
    }

    // 3) Create new tab
    const url = provider === 'flow' ? FLOW_URL : GEMINI_URL;
    const tab = await chrome.tabs.create({ url, active: opts?.active ?? false });
    if (tab.id == null) throw new Error('Không tạo được tab');
    this.remember(provider, tab.id);
    await waitTabComplete(tab.id);
    // SPA: đợi content script kịp inject
    await sleep(800);
    return tab.id;
  }

  /** Mở / focus tab provider để user đăng nhập */
  async openForLogin(provider: 'flow' | 'gemini'): Promise<number> {
    return this.acquire(provider, { active: true });
  }

  release(_provider: 'flow' | 'gemini', _tabId: number) {
    // keep for reuse
  }

  async onTabRemoved(tabId: number) {
    for (const [provider, list] of this.tabs) {
      this.tabs.set(
        provider,
        list.filter((id) => id !== tabId),
      );
    }
  }
}

function isProviderUrl(provider: 'flow' | 'gemini', url?: string): boolean {
  if (!url) return false;
  return provider === 'flow'
    ? /flow\.google\.com|labs\.google\/fx/i.test(url)
    : url.includes('gemini.google.com');
}

async function focusTab(tab: chrome.tabs.Tab) {
  if (tab.id == null) return;
  await chrome.tabs.update(tab.id, { active: true });
  if (tab.windowId != null) {
    await chrome.windows.update(tab.windowId, { focused: true }).catch(() => undefined);
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function waitTabComplete(tabId: number, timeoutMs = 30000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error('Tab load timeout'));
    }, timeoutMs);
    function listener(id: number, info: chrome.tabs.TabChangeInfo) {
      if (id === tabId && info.status === 'complete') {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.get(tabId).then((t) => {
      if (t.status === 'complete') {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    });
  });
}

/** Gửi message tới content script; nếu chưa inject thì reload tab rồi thử lại */
async function sendToContent<T = unknown>(
  tabId: number,
  message: unknown,
  retries = 2,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      return (await chrome.tabs.sendMessage(tabId, message)) as T;
    } catch (e) {
      lastErr = e;
      if (i === retries) break;
      // Content script chưa sẵn sàng (thường sau reload extension) → reload tab
      await chrome.tabs.reload(tabId);
      await waitTabComplete(tabId);
      await sleep(1200);
    }
  }
  throw Object.assign(
    new Error(
      lastErr instanceof Error
        ? lastErr.message
        : 'Không kết nối được content script trên tab Flow. Hãy reload tab Google Flow.',
    ),
    { code: 'TAB_LOST' },
  );
}

export class ProviderRouter {
  constructor(private pool: TabPool) {}

  async execute(
    provider: 'flow' | 'gemini',
    action: DriverAction,
    signal: AbortSignal,
    onProgress: (p: number, message?: string) => void,
  ): Promise<DriverResult> {
    const started = Date.now();
    const label = `${provider}.${action.name}`;
    try {
      const result = await this.executeInner(provider, action, signal, onProgress);
      log.info(`${label} ok (${Date.now() - started}ms)`, {
        texts: result.texts?.length,
        medias: result.medias?.map((m) => ({ kind: m.kind, mime: m.mime, mediaId: m.mediaId, url: m.url })),
      });
      return result;
    } catch (e) {
      log.error(`${label} lỗi (${Date.now() - started}ms): ${e instanceof Error ? e.message : String(e)}`, e);
      throw e;
    }
  }

  private async executeInner(
    provider: 'flow' | 'gemini',
    action: DriverAction,
    signal: AbortSignal,
    onProgress: (p: number, message?: string) => void,
  ): Promise<DriverResult> {
    const tabId = await this.pool.acquire(provider);
    log.debug(`${provider}.${action.name} → tab ${tabId}`, 'payload' in action ? redactPayload(action.payload) : undefined);

    // Flow generate is batchexecute RPC in the SW (MAIN-world POST + captcha).
    if (provider === 'flow' && action.name === 'generate') {
      return generateViaRpc(
        tabId,
        action.payload as FlowGeneratePayload,
        onProgress,
        signal,
      );
    }

    const requestId = crypto.randomUUID();

    return new Promise((resolve, reject) => {
      const onAbort = () => {
        chrome.tabs.sendMessage(tabId, { type: 'driver.abort', requestId }).catch(() => undefined);
        cleanup();
        reject(Object.assign(new Error('Đã huỷ'), { code: 'UNKNOWN' }));
      };
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener('abort', onAbort);

      const listener = (
        message: {
          type: string;
          requestId?: string;
          ok?: boolean;
          result?: DriverResult;
          error?: DriverError;
          progress?: number;
          message?: string;
        },
        sender: chrome.runtime.MessageSender,
      ) => {
        if (sender.tab?.id !== tabId) return;
        if (message.requestId !== requestId) return;
        if (message.type === 'driver.progress') {
          onProgress(message.progress ?? 0, message.message);
          return;
        }
        if (message.type === 'driver.result') {
          cleanup();
          if (message.ok) resolve(message.result!);
          else {
            const err = Object.assign(new Error(message.error?.message ?? 'Driver error'), {
              code: message.error?.code ?? 'UNKNOWN',
            });
            reject(err);
          }
        }
      };

      function cleanup() {
        signal.removeEventListener('abort', onAbort);
        chrome.runtime.onMessage.removeListener(listener);
      }

      chrome.runtime.onMessage.addListener(listener);
      void sendToContent(tabId, { type: 'driver.execute', requestId, provider, action }).catch((e) => {
        cleanup();
        reject(
          Object.assign(new Error(e instanceof Error ? e.message : String(e)), {
            code: (e as { code?: string })?.code ?? 'TAB_LOST',
          }),
        );
      });
    });
  }

  async openLogin(provider: 'flow' | 'gemini'): Promise<void> {
    await this.pool.openForLogin(provider);
  }

  async checkAuth(provider: 'flow' | 'gemini'): Promise<{ authenticated: boolean; error?: string }> {
    try {
      const tabId = await this.pool.acquire(provider);
      const res = await sendToContent<{ authenticated?: boolean }>(tabId, {
        type: 'driver.checkAuth',
      });
      return { authenticated: !!res?.authenticated };
    } catch (e) {
      return {
        authenticated: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  /**
   * One page of Flow media for the asset picker (newest first within the page).
   * First page (`pageToken` null) merges DOM gallery items that aren't on the
   * listing yet and reuses any signed urls the tab already shows. Later pages
   * are RPC-only. Urls for unsigned ids are filled per page via `signFlowMedia`.
   */
  async listFlowMedia(
    kind: 'image' | 'video' | 'any',
    opts?: { pageToken?: string | null },
  ): Promise<{ items: FlowMediaItem[]; nextPageToken: string | null }> {
    const tabId = await this.pool.acquire('flow');
    const pageToken = opts?.pageToken ?? null;

    if (pageToken) {
      const page = await listProjectMediaPage(tabId, pageToken);
      const items = filterFlowMediaKind(page.items, kind);
      log.info(`listFlowMedia trang tiếp: ${items.length} asset (listing ${page.items.length})`);
      return { items, nextPageToken: page.nextPageToken };
    }

    const [rpc, dom] = await Promise.allSettled([
      listProjectMediaPage(tabId, null),
      this.execute('flow', { name: 'listMedia', payload: { kind: 'any' } }, new AbortController().signal, () => undefined),
    ]);
    if (rpc.status === 'rejected') log.warn(`listFlowMedia RPC lỗi: ${errMessage(rpc.reason)}`);
    if (rpc.status === 'rejected' && dom.status === 'rejected') throw dom.reason;

    const rpcPage = rpc.status === 'fulfilled' ? rpc.value : { items: [] as FlowMediaItem[], nextPageToken: null };
    const rpcItems = rpcPage.items;
    const domItems =
      dom.status === 'fulfilled' ? ((dom.value.raw as { items?: FlowMediaItem[] })?.items ?? []) : [];
    const domById = new Map(domItems.filter((i) => i.mediaId).map((i) => [i.mediaId!, i]));
    const listed = new Set(rpcItems.map((i) => i.mediaId));

    const items: FlowMediaItem[] = [];
    const seen = new Set<string>();
    const merged = [
      ...domItems.filter((i) => !listed.has(i.mediaId)),
      ...rpcItems.map((i) => {
        const shown = domById.get(i.mediaId!);
        return shown ? { ...i, kind: shown.kind, kindKnown: true, url: shown.url, thumbUrl: shown.thumbUrl } : i;
      }),
    ];
    for (const item of merged) {
      if (!item.mediaId || seen.has(item.mediaId)) continue;
      if (kind !== 'any' && item.kindKnown !== false && item.kind !== kind) continue;
      seen.add(item.mediaId);
      items.push(item);
    }
    log.info(`listFlowMedia trang đầu: ${items.length} asset (listing ${rpcItems.length}, tab ${domItems.length})`);
    return { items, nextPageToken: rpcPage.nextPageToken };
  }

  /** Signed urls (and settled kind) for one picker page of media ids. */
  async signFlowMedia(mediaIds: string[]): Promise<{ items: SignedFlowMedia[] }> {
    const tabId = await this.pool.acquire('flow');
    return { items: await signFlowMedia(tabId, mediaIds) };
  }

  async diagnose(provider: 'flow' | 'gemini') {
    const tabId = await this.pool.acquire(provider);
    return sendToContent(tabId, { type: 'driver.diagnose' });
  }

  async capabilities(provider: 'flow' | 'gemini') {
    const tabId = await this.pool.acquire(provider);
    return sendToContent(tabId, { type: 'driver.capabilities' });
  }
}

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function filterFlowMediaKind(items: FlowMediaItem[], kind: 'image' | 'video' | 'any'): FlowMediaItem[] {
  if (kind === 'any') return items.filter((i) => !!i.mediaId);
  return items.filter((i) => {
    if (!i.mediaId) return false;
    if (i.kindKnown === false) return true;
    return i.kind === kind;
  });
}

export type EventBroadcaster = (ev: SwToUiEvent) => void;

/** Payload for the log without base64 bodies. */
function redactPayload(payload: unknown): unknown {
  return JSON.parse(
    JSON.stringify(payload ?? null, (key, value) =>
      key === 'dataBase64' && typeof value === 'string' ? `[base64 ${Math.round(value.length * 0.75)}B]` : value,
    ),
  );
}
