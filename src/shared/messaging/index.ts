import type { NodeRunStatus, RunStatus } from '@/shared/schema';
import type { LogEntry } from '@/shared/log';

/** Typed messages UI ↔ Service Worker ↔ Content scripts */

export type UiToSwMessage =
  | { type: 'workflow.run'; workflowId: string; fromNodeId?: string; mode?: 'full' | 'node' | 'only' | 'from' }
  | { type: 'run.cancel'; runId: string }
  | { type: 'workflow.cancel'; workflowId: string }
  | { type: 'runAll'; workspaceId: string }
  | { type: 'node.runFrom'; workflowId: string; nodeId: string }
  | { type: 'provider.checkAuth'; provider: 'flow' | 'gemini' }
  | { type: 'provider.diagnose'; provider: 'flow' | 'gemini' }
  | { type: 'provider.capabilities'; provider: 'flow' | 'gemini' }
  | { type: 'provider.listFlowMedia'; kind?: 'image' | 'video' | 'any'; pageToken?: string | null }
  | { type: 'provider.fetchFlowMedia'; url: string }
  | { type: 'provider.signFlowMedia'; mediaIds: string[] }
  | { type: 'provider.openLogin'; provider: 'flow' | 'gemini' }
  | { type: 'settings.get' }
  | { type: 'settings.set'; settings: Record<string, unknown> }
  | { type: 'log.clear' }
  | { type: 'ping' };

export type SwToUiEvent =
  | { type: 'node.status'; runId: string; nodeId: string; status: NodeRunStatus; progress?: number; message?: string }
  | { type: 'node.progress'; runId: string; nodeId: string; progress: number; message?: string }
  | { type: 'node.output'; runId: string; nodeId: string; outputId: string; kind: string }
  | { type: 'node.data'; runId: string; nodeId: string; data: Record<string, unknown> }
  | { type: 'run.done'; runId: string; status: RunStatus; error?: string }
  | { type: 'queue.update'; running: number; waiting: number }
  | { type: 'notification'; title: string; body: string; level: 'info' | 'success' | 'error' }
  | { type: 'log'; entry: LogEntry }
  | { type: 'log.snapshot'; entries: LogEntry[] };

export type SwToContentMessage =
  | {
      type: 'driver.execute';
      requestId: string;
      provider: 'flow' | 'gemini';
      action: DriverAction;
    }
  | { type: 'driver.abort'; requestId: string }
  | { type: 'driver.status'; requestId: string }
  | { type: 'driver.checkAuth' }
  | { type: 'driver.capabilities' }
  | { type: 'driver.diagnose' };

export type ContentToSwMessage =
  | { type: 'driver.result'; requestId: string; ok: true; result: DriverResult }
  | { type: 'driver.result'; requestId: string; ok: false; error: DriverError }
  | { type: 'driver.progress'; requestId: string; progress: number; message?: string }
  | { type: 'driver.auth'; authenticated: boolean }
  | { type: 'driver.keepalive' };

export type DriverAction =
  | { name: 'generate'; payload: FlowGeneratePayload | GeminiGeneratePayload }
  | { name: 'prompt'; payload: GeminiPromptPayload }
  | { name: 'listMedia'; payload?: { kind?: 'image' | 'video' | 'any' } }
  | { name: 'fetchMedia'; payload: { url: string } }
  | { name: 'checkAuth' }
  | { name: 'capabilities' }
  | { name: 'diagnose' };

/** Media visible trên gallery / result grid của Google Flow */
export interface FlowMediaItem {
  id: string;
  kind: 'image' | 'video';
  url: string;
  thumbUrl?: string;
  label?: string;
  /** Flow media id read from the CDN url; items without one can't be referenced. */
  mediaId?: string;
  /** Creation time (epoch ms) when the Flow listing reports one. */
  createdAt?: number;
  /** False when the listing had no url to tell image from video — settled on signing. */
  kindKnown?: boolean;
}

export interface FlowGenerateRef {
  kind: 'image' | 'video' | 'audio';
  /** Label asset ([Character]…) — giữ trong prompt; media id đi qua slot RPC. */
  label?: string;
  /** Media đã có trên Flow: dùng thẳng, không upload. */
  mediaId?: string;
  /** File local: upload một lần cho mỗi `cacheKey` (runId + asset id). */
  upload?: { name: string; mime: string; dataBase64: string; cacheKey: string };
}

export interface FlowGeneratePayload {
  mode: string;
  model?: string;
  aspectRatio?: string;
  outputsPerPrompt?: number;
  prompt: string;
  /** Asset/ảnh tham chiếu đã nối vào node (qua Prompt hoặc trực tiếp). */
  refs?: FlowGenerateRef[];
  /** Frame cuối (JPEG) của cảnh trước: start frame Veo i2v, ảnh đầu tiên của Omni MZZa6b. */
  continueFrame?: { mime: string; dataBase64: string };
  projectTarget?: string;
  /** Clip length; Omni Flash snaps to 4/6/8/10s. Veo i2v has no duration slot. */
  durationSec?: number;
  timeoutSec?: number;
  /** Chỉ để gắn log — không gửi lên Flow. */
  logCtx?: { runId?: string; nodeId?: string };
}

export interface GeminiGeneratePayload {
  kind: 'image' | 'video';
  model?: string;
  prompt: string;
  images?: { name: string; mime: string; dataBase64: string }[];
  newChat?: boolean;
  timeoutSec?: number;
}

export interface GeminiPromptPayload {
  model?: string;
  instruction: string;
  texts?: string[];
  images?: { name: string; mime: string; dataBase64: string }[];
  newChat?: boolean;
  outputFormat?: 'plain' | 'json';
  timeoutSec?: number;
}

export interface DriverResult {
  texts?: string[];
  medias?: { kind: 'image' | 'video'; mime: string; dataBase64?: string; url?: string; mediaId?: string }[];
  raw?: unknown;
}

export interface DriverError {
  code:
    | 'AUTH_REQUIRED'
    | 'QUOTA_EXCEEDED'
    | 'CONTENT_POLICY'
    | 'TIMEOUT'
    | 'SELECTOR_NOT_FOUND'
    | 'UPLOAD_FAILED'
    | 'TAB_LOST'
    | 'NO_AT_TOKEN'
    | 'NO_FLOW_PROJECT'
    | 'CAPTCHA_FAILED'
    | 'UNSUPPORTED_ON_BATCH_API'
    | 'UNKNOWN';
  message: string;
}

export interface SelectorHealth {
  name: string;
  ok: boolean;
  detail?: string;
}

export type MessageResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function isUiToSwMessage(msg: unknown): msg is UiToSwMessage {
  return typeof msg === 'object' && msg !== null && 'type' in msg;
}

export async function sendToSw<T = unknown>(message: UiToSwMessage): Promise<MessageResponse<T>> {
  return chrome.runtime.sendMessage(message) as Promise<MessageResponse<T>>;
}

export interface RunEventsChannel {
  /** Đóng hẳn kênh — không nối lại nữa. */
  disconnect(): void;
  /** Đang có port sống hay không (dùng cho test/chẩn đoán). */
  readonly connected: boolean;
}

/** Thời gian chờ trước lần nối lại đầu tiên; gấp đôi mỗi lần, tối đa 5s. */
const RECONNECT_BASE_MS = 250;
const RECONNECT_MAX_MS = 5_000;

/**
 * Kênh nhận sự kiện chạy workflow, **tự nối lại**.
 *
 * Service worker MV3 bị Chrome tắt khi rảnh, và port chết theo nó. Port một lần
 * như trước thì mọi thứ vẫn chạy ở service worker nhưng UI câm: bấm chạy lần
 * hai không thấy trạng thái, không thấy progress, preview không đổi — vì không
 * còn `node.status` / `node.progress` / `node.output` nào tới nơi.
 */
export function connectRunEvents(onEvent: (ev: SwToUiEvent) => void): RunEventsChannel {
  let closed = false;
  let port: chrome.runtime.Port | null = null;
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const scheduleReconnect = () => {
    if (closed || timer) return;
    const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** attempt++);
    timer = setTimeout(() => {
      timer = undefined;
      open();
    }, delay);
  };

  const open = () => {
    if (closed) return;
    let next: chrome.runtime.Port;
    try {
      next = chrome.runtime.connect({ name: 'run-events' });
    } catch {
      // Extension vừa reload → context cũ không còn kết nối được nữa.
      scheduleReconnect();
      return;
    }
    port = next;
    next.onMessage.addListener((msg) => {
      // Nhận được tin là kênh chắc chắn thông — cho backoff về mốc đầu.
      attempt = 0;
      onEvent(msg as SwToUiEvent);
    });
    next.onDisconnect.addListener(() => {
      if (port === next) port = null;
      scheduleReconnect();
    });
  };

  open();

  return {
    disconnect() {
      closed = true;
      if (timer) clearTimeout(timer);
      timer = undefined;
      try {
        port?.disconnect();
      } catch {
        /* port đã chết */
      }
      port = null;
    },
    get connected() {
      return port !== null;
    },
  };
}
