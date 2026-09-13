/**
 * Debug log shared by the service worker and the editor. Every context keeps
 * its own ring buffer; the SW forwards its entries to the editor's console
 * over the run-events port. Pure — no chrome APIs — so tests can import it.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  id: string;
  ts: number;
  level: LogLevel;
  /** Where it came from: `run`, `node`, `rpc`, `driver`, `ui`, `sw`… */
  scope: string;
  message: string;
  runId?: string;
  nodeId?: string;
  /** Extra detail, already made JSON-safe and size-capped. */
  data?: unknown;
  /** Context that produced the entry. */
  origin: 'sw' | 'ui';
}

export interface LogContext {
  runId?: string;
  nodeId?: string;
}

export const LOG_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error'];
const MAX_ENTRIES = 1000;
const MAX_STRING = 4000;
const MAX_DEPTH = 6;
const MAX_ITEMS = 50;

type Listener = (entry: LogEntry) => void;

let origin: LogEntry['origin'] = 'sw';
let seq = 0;
const buffer: LogEntry[] = [];
const listeners = new Set<Listener>();

export function setLogOrigin(next: LogEntry['origin']) {
  origin = next;
}

/** Strings capped, blobs described, cycles/deep trees cut — safe for postMessage. */
export function toLogData(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (value == null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}… (+${value.length - MAX_STRING} ký tự)` : value;
  }
  if (typeof value === 'bigint') return String(value);
  if (typeof value === 'function') return `[function ${value.name || 'anonymous'}]`;
  if (typeof Blob !== 'undefined' && value instanceof Blob) return `[Blob ${value.type || '?'} ${value.size}B]`;
  if (value instanceof Error) {
    const code = (value as { code?: unknown }).code;
    return { name: value.name, message: value.message, ...(code ? { code } : {}), stack: value.stack?.split('\n').slice(0, 6).join('\n') };
  }
  if (typeof value !== 'object') return String(value);
  if (seen.has(value)) return '[circular]';
  if (depth >= MAX_DEPTH) return Array.isArray(value) ? `[Array(${value.length})]` : '[Object]';
  seen.add(value);
  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ITEMS).map((v) => toLogData(v, depth + 1, seen));
    if (value.length > MAX_ITEMS) items.push(`… +${value.length - MAX_ITEMS}`);
    return items;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value).slice(0, MAX_ITEMS)) {
    out[k] = toLogData(v, depth + 1, seen);
  }
  return out;
}

/** Add an entry produced elsewhere (e.g. forwarded from the SW). */
export function ingestLog(entry: LogEntry) {
  buffer.push(entry);
  if (buffer.length > MAX_ENTRIES) buffer.splice(0, buffer.length - MAX_ENTRIES);
  for (const l of listeners) {
    try {
      l(entry);
    } catch {
      /* a broken listener must not break logging */
    }
  }
}

export function writeLog(
  level: LogLevel,
  scope: string,
  message: string,
  data?: unknown,
  ctx?: LogContext,
): LogEntry {
  const entry: LogEntry = {
    id: `${origin}-${Date.now().toString(36)}-${(seq++).toString(36)}`,
    ts: Date.now(),
    level,
    scope,
    message,
    origin,
    ...(ctx?.runId ? { runId: ctx.runId } : {}),
    ...(ctx?.nodeId ? { nodeId: ctx.nodeId } : {}),
    ...(data !== undefined ? { data: toLogData(data) } : {}),
  };
  ingestLog(entry);
  if (level === 'error') console.error(`[${scope}] ${message}`, data ?? '');
  else if (level === 'warn') console.warn(`[${scope}] ${message}`, data ?? '');
  return entry;
}

export interface Logger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
  child(ctx: LogContext): Logger;
}

export function createLogger(scope: string, ctx: LogContext = {}): Logger {
  return {
    debug: (m, d) => void writeLog('debug', scope, m, d, ctx),
    info: (m, d) => void writeLog('info', scope, m, d, ctx),
    warn: (m, d) => void writeLog('warn', scope, m, d, ctx),
    error: (m, d) => void writeLog('error', scope, m, d, ctx),
    child: (more) => createLogger(scope, { ...ctx, ...more }),
  };
}

export function subscribeLogs(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLogs(): LogEntry[] {
  return [...buffer];
}

export function clearLogs() {
  buffer.length = 0;
}
