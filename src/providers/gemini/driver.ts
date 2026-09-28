import {
  click,
  typeInto,
  uploadFiles,
  pasteFiles,
  readAccountEmail,
  sleep,
  humanDelay,
  base64ToBlob,
  query,
  type Locator,
} from '@/providers/dom-kit';
import { geminiSelectors } from '@/providers/gemini/selectors';
import { strings } from '@/shared/strings';
import type {
  DriverAction,
  DriverResult,
  GeminiGeneratePayload,
  GeminiPromptPayload,
  SelectorHealth,
} from '@/shared/messaging';

async function firstMatch(locators: readonly Locator[], timeout = 8000): Promise<Element> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    for (const loc of locators) {
      const el = query(loc as Locator);
      if (el) return el;
    }
    await sleep(120);
  }
  throw Object.assign(
    new Error('SELECTOR_NOT_FOUND — không thấy ô nhập/nút trên Gemini. Kiểm tra tab Gemini đã mở.'),
    { code: 'SELECTOR_NOT_FOUND' },
  );
}

export async function checkAuth(): Promise<boolean> {
  if (query(geminiSelectors.signIn[0] as Locator)) return false;
  for (const loc of geminiSelectors.authAvatar) {
    if (query(loc as Locator)) return true;
  }
  return !!query(geminiSelectors.input[0] as Locator);
}

export async function capabilities() {
  return {
    models: ['Gemini', 'Gemini Flash'],
    kinds: ['image', 'video'],
  };
}

export async function diagnose(): Promise<SelectorHealth[]> {
  const keys = Object.keys(geminiSelectors) as (keyof typeof geminiSelectors)[];
  return keys.map((name) => {
    const locs = geminiSelectors[name] as readonly Locator[];
    const ok = locs.some((l) => !!query(l as Locator));
    return { name, ok, detail: ok ? 'found' : 'missing' };
  });
}

async function ensureNewChat(newChat?: boolean) {
  if (!newChat) return;
  try {
    const btn = await firstMatch(geminiSelectors.newChat as unknown as Locator[], 3000);
    await click(btn);
    await humanDelay(400, 800);
  } catch {
    /* optional */
  }
}

const MODEL_RESPONSE_SELECTOR = geminiSelectors.lastResponse[0].css;

/** The newest model reply on the page (never the whole document). */
export function lastModelResponse(root: ParentNode = document): Element | null {
  const all = root.querySelectorAll(MODEL_RESPONSE_SELECTOR);
  let el: Element | null = all[all.length - 1] ?? null;
  // Climb to the outermost wrapper so nested containers count as one reply.
  let up = el?.parentElement?.closest(MODEL_RESPONSE_SELECTOR) ?? null;
  while (up) {
    el = up;
    up = up.parentElement?.closest(MODEL_RESPONSE_SELECTOR) ?? null;
  }
  return el;
}

function responseText(el: Element | null): string {
  if (!el) return '';
  const body = el.querySelector('message-content') ?? el;
  return (body.textContent ?? '').trim();
}

function responseMediaCount(el: Element | null): number {
  return el ? el.querySelectorAll('img, video').length : 0;
}

function stopVisible(): boolean {
  return !!query(geminiSelectors.stop[0] as Locator);
}

/** Nhãn của phần tử đang khớp selector "stop" - đưa vào lỗi timeout để biết có khớp nhầm không. */
function stopLabel(): string {
  const el = query(geminiSelectors.stop[0] as Locator);
  return (el?.getAttribute('aria-label') ?? el?.textContent ?? '').trim().slice(0, 60);
}

function geminiError(message: string, code: string): Error {
  return Object.assign(new Error(message), { code });
}

export interface WaitResponseOptions {
  timeoutMs: number;
  signal: AbortSignal;
  /** Reply that was already on the page before sending: never counted as the answer. */
  baseline?: Element | null;
  onProgress?: (p: number, m?: string) => void;
  /** Text unchanged this long (no stop button) = done. */
  stableMs?: number;
  /** Stop button gone this long after it was seen = done. */
  stopGraceMs?: number;
  /** Reply has content but stayed unchanged this long while a "stop" match lingers = done. */
  stuckStopMs?: number;
  /** No new reply and no stop button this long after sending = Gemini did not take the prompt. */
  noReplyMs?: number;
}

/**
 * Resolves when Gemini finished answering: the stop button was seen and is gone,
 * or the newest reply has content that stayed unchanged for `stableMs` with no
 * stop button. Driven by a MutationObserver (background-tab intervals are
 * throttled); timers only settle deadlines and the overall timeout.
 */
export function waitResponseDone(opts: WaitResponseOptions): Promise<void> {
  const { timeoutMs, signal, baseline = null, onProgress } = opts;
  const stableMs = opts.stableMs ?? 3000;
  const stopGraceMs = opts.stopGraceMs ?? 500;
  const stuckStopMs = opts.stuckStopMs ?? 20_000;
  const noReplyMs = opts.noReplyMs ?? 60_000;
  const start = Date.now();

  return new Promise<void>((resolve, reject) => {
    let sawStop = false;
    let stopGoneAt: number | null = null;
    let lastSignature = '';
    let lastChangeAt = start;
    let lastReported = '';
    let settle: ReturnType<typeof setTimeout> | undefined;
    let finished = false;
    let lastState = { stopLabel: '', chars: 0, fresh: false };

    const finish = (err?: Error) => {
      if (finished) return;
      finished = true;
      observer.disconnect();
      clearTimeout(settle);
      clearTimeout(overall);
      signal.removeEventListener('abort', onAbort);
      if (err) reject(err);
      else resolve();
    };

    const report = (chars: number, now: number) => {
      if (!onProgress) return;
      const sec = Math.round((now - start) / 1000);
      const message = chars > 0 ? strings.geminiAnswering(chars, sec) : strings.geminiSent;
      if (message === lastReported) return;
      lastReported = message;
      const p = Math.min(95, 40 + Math.round(55 * (1 - Math.exp(-(now - start) / 60_000))));
      onProgress(p, message);
    };

    const evaluate = () => {
      if (finished) return;
      const now = Date.now();
      const stop = stopVisible();
      if (stop) {
        sawStop = true;
        stopGoneAt = null;
      } else if (sawStop && stopGoneAt == null) {
        stopGoneAt = now;
      }

      const current = lastModelResponse();
      const fresh = current && current !== baseline ? current : null;
      const text = responseText(fresh);
      const media = responseMediaCount(fresh);
      const signature = `${text}\u0000${media}`;
      if (signature !== lastSignature) {
        lastSignature = signature;
        lastChangeAt = now;
        report(text.length, now);
      }
      const hasContent = text.length > 0 || media > 0;

      lastState = { stopLabel: stop ? stopLabel() : '', chars: text.length, fresh: !!fresh };

      if (!stop && stopGoneAt != null && now - stopGoneAt >= stopGraceMs) return finish();
      if (!stop && hasContent && now - lastChangeAt >= stableMs) return finish();
      // A "stop" selector match that never goes away (other UI / extension) must not hang the run.
      if (stop && hasContent && now - lastChangeAt >= stuckStopMs) return finish();
      if (!fresh && !sawStop && now - start >= noReplyMs) {
        return finish(geminiError(strings.geminiNoReply(Math.round(noReplyMs / 1000)), 'TIMEOUT'));
      }

      // Re-check at the nearest deadline even if the page goes quiet.
      const waits: number[] = [];
      if (!stop && stopGoneAt != null) waits.push(stopGraceMs - (now - stopGoneAt));
      if (!stop && hasContent) waits.push(stableMs - (now - lastChangeAt));
      if (stop && hasContent) waits.push(stuckStopMs - (now - lastChangeAt));
      if (!fresh && !sawStop) waits.push(noReplyMs - (now - start));
      clearTimeout(settle);
      settle = setTimeout(evaluate, waits.length ? Math.max(50, Math.min(...waits)) : 1000);
    };

    const observer = new MutationObserver(evaluate);
    const onAbort = () => finish(geminiError('Đã huỷ', 'UNKNOWN'));
    const overall = setTimeout(
      () =>
        finish(
          geminiError(
            strings.geminiTimeout(Math.round(timeoutMs / 1000), lastState.stopLabel, lastState.chars),
            'TIMEOUT',
          ),
        ),
      timeoutMs,
    );

    if (signal.aborted) return onAbort();
    signal.addEventListener('abort', onAbort);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['aria-label', 'disabled', 'aria-disabled', 'src'],
    });
    report(0, start);
    evaluate();
  });
}

/** Send stays disabled while attachments upload; wait until it is clickable. */
async function waitEnabled(el: Element, timeoutMs: number, signal: AbortSignal): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (signal.aborted) throw geminiError('Đã huỷ', 'UNKNOWN');
    const disabled =
      (el as HTMLButtonElement).disabled === true || el.getAttribute('aria-disabled') === 'true';
    if (!disabled) return;
    await sleep(250);
  }
}

const ATTACH_TIMEOUT_MS = 10_000;
const ATTACH_POLL_MS = 250;

/** Số file đính kèm Gemini đang hiển thị (thẻ `uploader-file-preview`), dự phòng đếm ảnh trong khung chat. */
function attachmentCount(input: Element): number {
  const previews = document.querySelectorAll(geminiSelectors.attachmentPreview[0].css).length;
  if (previews) return previews;
  const area = input.closest('rich-textarea')?.parentElement?.parentElement ?? input.parentElement;
  return area?.querySelectorAll('img').length ?? 0;
}

async function waitAttachment(input: Element, before: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < ATTACH_TIMEOUT_MS) {
    if (attachmentCount(input) > before) return true;
    await sleep(ATTACH_POLL_MS);
  }
  return false;
}

/**
 * Đính kèm ảnh bằng paste (như Cmd+V), dự phòng bằng drop. Không bấm nút upload:
 * nút đó mở hộp thoại chọn file của hệ điều hành, content script không điều khiển được.
 */
async function attachImages(
  images: NonNullable<GeminiPromptPayload['images']>,
  onProgress: (p: number, m?: string) => void,
): Promise<void> {
  const input = await firstMatch(geminiSelectors.input as unknown as Locator[], 10000);
  for (let i = 0; i < images.length; i++) {
    const img = images[i]!;
    onProgress(15 + Math.round((20 * i) / images.length), strings.geminiUploadingImages(i + 1, images.length));
    const data = base64ToBlob(img.dataBase64, img.mime);
    const before = attachmentCount(input);
    pasteFiles(input, [new File([data], img.name, { type: img.mime })]);
    if (await waitAttachment(input, before)) continue;
    await uploadFiles(input, [{ name: img.name, mime: img.mime, data }]);
    if (await waitAttachment(input, before)) continue;
    throw geminiError(strings.geminiAttachFailed, 'UPLOAD_FAILED');
  }
}

export async function executePrompt(
  payload: GeminiPromptPayload,
  onProgress: (p: number, m?: string) => void,
  signal: AbortSignal,
): Promise<DriverResult> {
  if (!(await checkAuth())) {
    throw Object.assign(new Error('Chưa đăng nhập Gemini'), { code: 'AUTH_REQUIRED' });
  }
  await ensureNewChat(payload.newChat);
  onProgress(10, strings.geminiTypingPrompt);

  if (payload.images?.length) await attachImages(payload.images, onProgress);

  const input = await firstMatch(geminiSelectors.input as unknown as Locator[], 10000);
  const full = [payload.instruction, ...(payload.texts ?? [])].filter(Boolean).join('\n\n');
  await typeInto(input, full);
  await humanDelay();

  const send = await firstMatch(geminiSelectors.send as unknown as Locator[], 5000);
  await waitEnabled(send, 60_000, signal);
  const baseline = lastModelResponse();
  await click(send);
  onProgress(40, strings.geminiSent);
  await waitResponseDone({ timeoutMs: (payload.timeoutSec ?? 180) * 1000, signal, baseline, onProgress });

  const last = lastModelResponse();
  const text = last && last !== baseline ? responseText(last) : '';

  const err = query(geminiSelectors.errorToast[0] as Locator);
  if (err && /can't|unable|policy/i.test(err.textContent ?? '')) {
    throw Object.assign(new Error(err.textContent ?? 'Policy'), { code: 'CONTENT_POLICY' });
  }
  if (!text) throw geminiError(strings.geminiNoResponse, 'UNKNOWN');

  onProgress(100, strings.geminiDone);
  return { texts: [text] };
}

export async function executeGenerate(
  payload: GeminiGeneratePayload,
  onProgress: (p: number, m?: string) => void,
  signal: AbortSignal,
): Promise<DriverResult> {
  if (!(await checkAuth())) {
    throw Object.assign(new Error('Chưa đăng nhập Gemini'), { code: 'AUTH_REQUIRED' });
  }
  await ensureNewChat(payload.newChat);
  onProgress(10, 'Chọn tool…');

  try {
    const toolLocs =
      payload.kind === 'video'
        ? geminiSelectors.createVideoTool
        : geminiSelectors.createImageTool;
    const tool = await firstMatch(toolLocs as unknown as Locator[], 4000);
    await click(tool);
  } catch {
    /* tool may already be active or embedded in prompt */
  }

  if (payload.images?.length) await attachImages(payload.images, onProgress);

  const input = await firstMatch(geminiSelectors.input as unknown as Locator[], 10000);
  await typeInto(input, payload.prompt);
  const send = await firstMatch(geminiSelectors.send as unknown as Locator[], 5000);
  await waitEnabled(send, 60_000, signal);
  const baseline = lastModelResponse();
  await click(send);
  onProgress(40, 'Đang tạo…');
  await waitResponseDone({ timeoutMs: (payload.timeoutSec ?? 300) * 1000, signal, baseline, onProgress });

  // Only the new reply: the account avatar is also a googleusercontent image.
  const last = lastModelResponse();
  const reply = last && last !== baseline ? last : null;
  const media = reply?.querySelector('video, img[src*="googleusercontent"], img[src*="ggpht"], img[src*="lh3"]') as
    | HTMLImageElement
    | HTMLVideoElement
    | null
    | undefined;
  if (!media?.src) {
    if (reply && responseText(reply)) {
      throw Object.assign(new Error('Gemini từ chối tạo media'), { code: 'CONTENT_POLICY' });
    }
    throw Object.assign(new Error('Không tìm thấy media'), { code: 'UNKNOWN' });
  }

  const kind = media instanceof HTMLVideoElement ? 'video' : 'image';
  try {
    const res = await fetch(media.src);
    const blob = await res.blob();
    const buf = await blob.arrayBuffer();
    let s = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
    return { medias: [{ kind, mime: blob.type, dataBase64: btoa(s) }] };
  } catch {
    return { medias: [{ kind, mime: kind === 'video' ? 'video/mp4' : 'image/png', url: media.src }] };
  }
}

export async function handleDriverAction(
  action: DriverAction,
  onProgress: (p: number, m?: string) => void,
  signal: AbortSignal,
): Promise<DriverResult> {
  switch (action.name) {
    case 'checkAuth':
      return { raw: { authenticated: await checkAuth() } };
    case 'account':
      return { raw: { email: readAccountEmail() } };
    case 'capabilities':
      return { raw: await capabilities() };
    case 'diagnose':
      return { raw: await diagnose() };
    case 'prompt':
      return executePrompt(action.payload as GeminiPromptPayload, onProgress, signal);
    case 'generate':
      return executeGenerate(action.payload as GeminiGeneratePayload, onProgress, signal);
    default:
      throw Object.assign(new Error(`Action không hỗ trợ`), { code: 'UNKNOWN' });
  }
}
