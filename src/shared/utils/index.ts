import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function nanoid(size = 12): string {
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  let id = '';
  for (let i = 0; i < size; i++) id += alphabet[bytes[i]! % alphabet.length];
  return id;
}

export function slugifyFilename(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 80) || 'workflow';
}

export function formatRelativeTime(ts: number, now = Date.now()): string {
  const rtf = new Intl.RelativeTimeFormat('vi', { numeric: 'auto' });
  const diffSec = Math.round((ts - now) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(diffSec, 'second');
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, 'minute');
  const diffHour = Math.round(diffMin / 60);
  if (Math.abs(diffHour) < 24) return rtf.format(diffHour, 'hour');
  const diffDay = Math.round(diffHour / 24);
  if (Math.abs(diffDay) < 30) return rtf.format(diffDay, 'day');
  const diffMonth = Math.round(diffDay / 30);
  if (Math.abs(diffMonth) < 12) return rtf.format(diffMonth, 'month');
  return rtf.format(Math.round(diffMonth / 12), 'year');
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export async function sha256(data: ArrayBuffer | Uint8Array | Blob): Promise<string> {
  const view =
    data instanceof Blob
      ? new Uint8Array(await data.arrayBuffer())
      : data instanceof Uint8Array
        ? data
        : new Uint8Array(data);
  // Copy into a fresh Uint8Array - Node Buffer pool / SharedArrayBuffer views
  // are rejected by SubtleCrypto.digest in jsdom + fake-indexeddb.
  const bytes = new Uint8Array(view.byteLength);
  bytes.set(view);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Base64 (không prefix data:) của nội dung blob; chia khối để không tràn stack. */
export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/** SHA-256 hex của nội dung blob (không phụ thuộc name/metadata). */
export async function hashBlobContent(blob: Blob): Promise<string> {
  return sha256(blob);
}

/**
 * Peel markdown fences / surrounding prose so Gemini JSON can be JSON.parse'd.
 * Prefers a fenced ```json block, else the outermost `{…}` span, else trimmed text.
 */
export function extractJsonPayload(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  const wholeFence = /^```(?:json)?\s*\r?\n?([\s\S]*?)\r?\n?```$/i.exec(trimmed);
  if (wholeFence) return wholeFence[1]!.trim();

  const embeddedFence = /```(?:json)?\s*\r?\n?([\s\S]*?)\r?\n?```/i.exec(trimmed);
  if (embeddedFence) return embeddedFence[1]!.trim();

  const best = largestJsonObject(trimmed);
  if (best) return best;

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start !== -1 && end > start) return trimmed.slice(start, end + 1);

  return trimmed;
}

/** Vị trí `}` đóng object mở tại `start` (bỏ qua ngoặc nằm trong chuỗi), -1 nếu không đóng. */
function matchingBrace(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === '\\') i++;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return i;
  }
  return -1;
}

/**
 * Object JSON hợp lệ dài nhất trong văn bản. Gemini đôi khi bỏ dở một object rồi
 * viết lại từ đầu, nên cắt từ `{` đầu tới `}` cuối sẽ gộp cả bản hỏng.
 */
function largestJsonObject(text: string): string | undefined {
  let best: string | undefined;
  for (let start = text.indexOf('{'); start !== -1; start = text.indexOf('{', start + 1)) {
    const end = matchingBrace(text, start);
    if (end === -1 || (best && end - start + 1 <= best.length)) continue;
    const candidate = text.slice(start, end + 1);
    try {
      JSON.parse(candidate);
      best = candidate;
    } catch {
      /* không phải object hợp lệ - thử vị trí `{` kế tiếp */
    }
  }
  return best;
}

export function debounce<T extends (...args: never[]) => void>(fn: T, ms: number): T & { cancel: () => void } {
  let t: ReturnType<typeof setTimeout> | undefined;
  const wrapped = ((...args: Parameters<T>) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  }) as T & { cancel: () => void };
  wrapped.cancel = () => {
    if (t) clearTimeout(t);
  };
  return wrapped;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function chromeDownload(blob: Blob, filename: string, saveAs = true): Promise<number> {
  const url = URL.createObjectURL(blob);
  try {
    return await chrome.downloads.download({ url, filename, saveAs });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
