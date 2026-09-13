import {
  waitFor,
  click,
  typeInto,
  uploadFiles,
  sleep,
  humanDelay,
  base64ToBlob,
  query,
  type Locator,
} from '@/providers/dom-kit';
import { geminiSelectors } from '@/providers/gemini/selectors';
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

async function waitResponseDone(timeoutMs: number, signal: AbortSignal) {
  const start = Date.now();
  let sawStop = false;
  while (Date.now() - start < timeoutMs) {
    if (signal.aborted) throw new Error('aborted');
    const stop = query(geminiSelectors.stop[0] as Locator);
    if (stop) sawStop = true;
    if (sawStop && !stop) {
      await sleep(500);
      if (!query(geminiSelectors.stop[0] as Locator)) return;
    }
    // Also accept: send button visible again after some content
    if (sawStop === false && Date.now() - start > 3000) {
      const media = document.querySelector('img[src*="google"], video');
      if (media) return;
    }
    await sleep(400);
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
  onProgress(10, 'Nhập prompt…');

  if (payload.images?.length) {
    const fileInput =
      (query(geminiSelectors.fileInput[0] as Locator) as HTMLInputElement | null) ??
      ((await firstMatch(geminiSelectors.attach as unknown as Locator[], 5000).then(async (btn) => {
        await click(btn);
        return waitFor(geminiSelectors.fileInput[0] as Locator);
      })) as HTMLInputElement);
    await uploadFiles(
      fileInput,
      payload.images.map((i) => ({
        name: i.name,
        mime: i.mime,
        data: base64ToBlob(i.dataBase64, i.mime),
      })),
    );
  }

  const input = await firstMatch(geminiSelectors.input as unknown as Locator[], 10000);
  const full = [payload.instruction, ...(payload.texts ?? [])].filter(Boolean).join('\n\n');
  await typeInto(input, full);
  await humanDelay();

  const send = await firstMatch(geminiSelectors.send as unknown as Locator[], 5000);
  await click(send);
  onProgress(40, 'Đang chờ phản hồi…');
  await waitResponseDone((payload.timeoutSec ?? 180) * 1000, signal);

  // Grab last text response
  const candidates = [
    ...document.querySelectorAll('[data-message-author-role="model"], message-content, .model-response, .response-container'),
  ];
  const last = candidates.at(-1) ?? document.body;
  const text = (last.textContent ?? '').trim();
  if (!text) throw Object.assign(new Error('Không lấy được phản hồi'), { code: 'UNKNOWN' });

  const err = query(geminiSelectors.errorToast[0] as Locator);
  if (err && /can't|unable|policy/i.test(err.textContent ?? '')) {
    throw Object.assign(new Error(err.textContent ?? 'Policy'), { code: 'CONTENT_POLICY' });
  }

  onProgress(100, 'Xong');
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

  if (payload.images?.length) {
    try {
      const attach = await firstMatch(geminiSelectors.attach as unknown as Locator[], 4000);
      await click(attach);
      const fileInput = (await waitFor(geminiSelectors.fileInput[0] as Locator)) as HTMLInputElement;
      await uploadFiles(
        fileInput,
        payload.images.map((i) => ({
          name: i.name,
          mime: i.mime,
          data: base64ToBlob(i.dataBase64, i.mime),
        })),
      );
    } catch {
      throw Object.assign(new Error('Upload ảnh thất bại'), { code: 'UPLOAD_FAILED' });
    }
  }

  const input = await firstMatch(geminiSelectors.input as unknown as Locator[], 10000);
  await typeInto(input, payload.prompt);
  const send = await firstMatch(geminiSelectors.send as unknown as Locator[], 5000);
  await click(send);
  onProgress(40, 'Đang tạo…');
  await waitResponseDone((payload.timeoutSec ?? 300) * 1000, signal);

  const media = document.querySelector('video, img[src*="googleusercontent"], img[src*="ggpht"], img[src*="lh3"]') as
    | HTMLImageElement
    | HTMLVideoElement
    | null;
  if (!media?.src) {
    const textOnly = document.querySelector('[data-message-author-role="model"]');
    if (textOnly) {
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
