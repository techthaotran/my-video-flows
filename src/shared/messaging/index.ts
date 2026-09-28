import type { NodeRunStatus, RunStatus } from '@/shared/schema';
import type { LogEntry } from '@/shared/log';

/** Typed messages UI ↔ Service Worker ↔ Content scripts */

export interface RunnerOpenPayload {
  workflowId: string;
}

export interface EditorOpenPayload {
  workflowId: string;
}

export interface WorkflowRegeneratePayload {
  workflowId: string;
  /** Node generateImage/generateVideo cần tạo lại. */
  nodeId: string;
}

export interface WorkflowRegenerateResult {
  /** Run tạo lại node; bước ghép (nếu có) dùng run riêng, báo qua run-events. */
  runId: string;
}

/** Upload ảnh local của node Asset lên Flow ngay khi chọn file. */
export interface AssetUploadToFlowPayload {
  workflowId: string;
  nodeId: string;
}

/** Id upload Flow lưu trên node Asset (trả về UI để áp vào node). */
export interface FlowUploadedIds {
  uploadedMediaId: string;
  uploadedProjectId: string;
  uploadedSha256: string;
}

export interface RunDoneEvent {
  runId: string;
  /** Optional để tương thích nơi phát cũ. */
  workflowId?: string;
  status: RunStatus;
  error?: string;
}

export type UiToSwMessage =
  | {
      type: 'workflow.run';
      workflowId: string;
      fromNodeId?: string;
      mode?: 'full' | 'node' | 'only' | 'from';
      /** Chỉ cho mode `node`: node đích bỏ qua dùng lại kết quả (Phân tích lại). */
      force?: boolean;
    }
  | ({ type: 'asset.uploadToFlow' } & AssetUploadToFlowPayload)
  | { type: 'run.cancel'; runId: string }
  | { type: 'workflow.cancel'; workflowId: string }
  | { type: 'runAll'; workspaceId: string }
  | { type: 'node.runFrom'; workflowId: string; nodeId: string }
  | ({ type: 'runner.open' } & RunnerOpenPayload)
  | ({ type: 'editor.open' } & EditorOpenPayload)
  | ({ type: 'workflow.regenerate' } & WorkflowRegeneratePayload)
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
  | ({ type: 'run.done' } & RunDoneEvent)
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
  /**
   * Download a Flow media by id (SW signs the url via `as29s`, the Flow tab
   * fetches it). Download only: never uploads (`maseQ`).
   */
  | { name: 'fetchMediaById'; payload: { mediaId: string } }
  | { name: 'checkAuth' }
  /** Email tài khoản Google của tab (để Gemini dùng đúng tài khoản của Flow). */
  | { name: 'account' }
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
  /** Flow asset-panel favourite (star) from `Zzl0ze` listing. */
  isFavourite?: boolean;
}

export interface FlowGenerateRef {
  kind: 'image' | 'video' | 'audio';
  /** Label asset ([Character]…) — giữ trong prompt; media id đi qua slot RPC. */
  label?: string;
  /** Media đã có trên Flow: dùng thẳng, không upload. */
  mediaId?: string;
  /** File local: dùng lại `uploaded` khi cùng project + sha256, không thì upload (`maseQ`). */
  upload?: FlowUploadRef;
}

export interface FlowUploadedMedia {
  mediaId: string;
  projectId: string;
  sha256: string;
}

export interface FlowUploadRef {
  name: string;
  mime: string;
  dataBase64: string;
  /** SHA-256 nội dung file; thiếu thì không dùng lại / không lưu id. */
  sha256?: string;
  /** Node Asset nguồn: engine lưu id upload mới vào node này. */
  nodeId?: string;
  /** Id đã upload trước đó; driver ghi đè khi upload mới. */
  uploaded?: FlowUploadedMedia;
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
  /** Độ phân giải ảnh Flow: 1K = ogiZ0b CDN; 2K = thêm SPrCad sau gen. */
  resolution?: '1K' | '2K';
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
  /** Ảnh local vừa upload lên Flow trong lần generate này (theo node Asset nguồn). */
  uploads?: ({ nodeId: string } & FlowUploadedMedia)[];
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
    | 'FLOW_MEDIA_FETCH_FAILED'
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
