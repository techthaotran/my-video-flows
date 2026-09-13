import { query, type Locator } from '@/providers/dom-kit';
import { flowSelectors } from '@/providers/flow/selectors';
import { IMAGE_MODELS, VIDEO_MODELS } from '@/shared/schema';
import { parseFlowMediaUrl } from '@/providers/flow/media';
import type {
  DriverAction,
  DriverResult,
  FlowMediaItem,
  SelectorHealth,
} from '@/shared/messaging';

export async function checkAuth(): Promise<boolean> {
  if (/accounts\.google\.com/i.test(location.href)) return false;

  const visibleSignIn = [...document.querySelectorAll('a, button, [role="button"]')].some((el) => {
    const t = (el.textContent ?? '').trim();
    if (!/^(sign in|đăng nhập|log in)$/i.test(t)) return false;
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width * rect.height > 0;
  });
  if (visibleSignIn) return false;

  if (document.querySelector('textarea, [contenteditable="true"]')) return true;
  if (document.querySelector('video[src], video source[src], img[src*="googleusercontent"], img[src*="lh3"]')) {
    return true;
  }
  for (const loc of flowSelectors.authAvatar) {
    if (query(loc as Locator)) return true;
  }
  for (const loc of flowSelectors.newProject) {
    if (query(loc as Locator)) return true;
  }
  for (const loc of flowSelectors.generateButton) {
    if (query(loc as Locator)) return true;
  }

  if (/flow\.google\.com|labs\.google\/fx/i.test(location.href)) return true;
  return false;
}

export async function capabilities() {
  return {
    models: [...IMAGE_MODELS, ...VIDEO_MODELS],
    modes: ['text-to-video', 'frames-to-video', 'text-to-image'],
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4'],
    transport: 'batchexecute',
  };
}

export async function diagnose(): Promise<SelectorHealth[]> {
  const keys = Object.keys(flowSelectors) as (keyof typeof flowSelectors)[];
  const health: SelectorHealth[] = keys.map((name) => {
    const locs = flowSelectors[name] as readonly Locator[];
    const ok = locs.some((l) => !!query(l as Locator));
    return { name, ok, detail: ok ? 'found' : 'missing' };
  });

  health.push({
    name: 'pageUrl',
    ok: /flow\.google\.com|labs\.google\/fx/i.test(location.href),
    detail: location.href,
  });
  health.push({
    name: 'projectInUrl',
    ok: /\/project\/[0-9a-fA-F-]{36}/i.test(location.href),
    detail: /\/project\/([0-9a-fA-F-]{36})/i.exec(location.href)?.[1] ?? 'none',
  });

  return health;
}

async function blobToB64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  let s = '';
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}

function isLikelyUiChrome(el: Element, src: string): boolean {
  const alt = (el.getAttribute('alt') ?? '').toLowerCase();
  const cls = (el.getAttribute('class') ?? '').toLowerCase();
  if (/avatar|account|profile|icon|logo|favicon/.test(alt)) return true;
  if (/avatar|icon|logo|badge/.test(cls)) return true;
  if (/avatar|favicon|logo|icon|_48x48|_32x32/.test(src)) return true;
  if (el instanceof HTMLImageElement) {
    const w = el.naturalWidth || el.width;
    const h = el.naturalHeight || el.height;
    if (w > 0 && h > 0 && w < 64 && h < 64) return true;
  }
  return false;
}

function mediaSrc(el: Element): string | null {
  if (el instanceof HTMLVideoElement) {
    const s = el.currentSrc || el.src;
    if (s) return s;
    const source = el.querySelector('source[src]');
    return source?.getAttribute('src') ?? null;
  }
  if (el instanceof HTMLImageElement) {
    return el.currentSrc || el.src || null;
  }
  if (el instanceof HTMLSourceElement) {
    return el.src || el.getAttribute('src');
  }
  const bg = getComputedStyle(el).backgroundImage;
  const m = bg && bg !== 'none' ? bg.match(/url\(["']?(.*?)["']?\)/) : null;
  return m?.[1] ?? null;
}

/** Quét gallery / result grid đang mở trên tab Flow */
export async function listMedia(payload?: {
  kind?: 'image' | 'video' | 'any';
}): Promise<DriverResult> {
  if (!(await checkAuth())) {
    throw Object.assign(new Error('Chưa đăng nhập Google Flow'), { code: 'AUTH_REQUIRED' });
  }

  const kindFilter = payload?.kind ?? 'any';
  const roots: Element[] = [document.body];
  for (const loc of flowSelectors.mediaLibrary) {
    const el = query(loc as Locator);
    if (el && !roots.includes(el)) roots.push(el);
  }

  const nodes = new Set<Element>();
  for (const root of roots) {
    for (const el of root.querySelectorAll(
      'video, video source[src], img[src], [style*="background-image"]',
    )) {
      nodes.add(el instanceof HTMLSourceElement ? el.parentElement ?? el : el);
    }
  }

  const items: FlowMediaItem[] = [];
  const seen = new Set<string>();

  for (const el of nodes) {
    const src = mediaSrc(el);
    if (!src || src.startsWith('data:') || seen.has(src)) continue;
    if (isLikelyUiChrome(el, src)) continue;
    if (
      !/blob:|googleusercontent|ggpht|lh3\.google|flow-content\.google|video|image|media|\.mp4|\.webm|\.png|\.jpg|\.jpeg|\.webp/i.test(
        src,
      )
    ) {
      continue;
    }

    const kind: 'image' | 'video' =
      el instanceof HTMLVideoElement || /\.mp4|\.webm|video/i.test(src) ? 'video' : 'image';
    if (kindFilter !== 'any' && kind !== kindFilter) continue;

    seen.add(src);
    const thumbUrl =
      kind === 'video' && el instanceof HTMLVideoElement ? el.poster || src : src;
    // The media id is what generation references; a blob: player src has none,
    // so fall back to the poster (Flow serves it from the same media id).
    const parsed =
      parseFlowMediaUrl(src) ??
      (el instanceof HTMLVideoElement ? parseFlowMediaUrl(el.poster) : null) ??
      parseFlowMediaUrl(el.closest('a[href]')?.getAttribute('href'));
    items.push({
      id: parsed ? `${kind}:${parsed.mediaId}` : `flow-${items.length + 1}`,
      kind,
      url: src,
      thumbUrl,
      label: el.getAttribute('alt') || undefined,
      mediaId: parsed?.mediaId,
    });
  }

  return { raw: { items } };
}

export async function fetchMedia(url: string): Promise<DriverResult> {
  if (!(await checkAuth())) {
    throw Object.assign(new Error('Chưa đăng nhập Google Flow'), { code: 'AUTH_REQUIRED' });
  }
  if (!url) {
    throw Object.assign(new Error('Thiếu URL media'), { code: 'UNKNOWN' });
  }

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const kind: 'image' | 'video' = blob.type.startsWith('video/')
      ? 'video'
      : url.includes('.mp4') || url.includes('video')
        ? 'video'
        : 'image';
    const mime = blob.type || (kind === 'video' ? 'video/mp4' : 'image/png');
    return {
      medias: [{ kind, mime, dataBase64: await blobToB64(blob) }],
    };
  } catch (e) {
    throw Object.assign(
      new Error(e instanceof Error ? e.message : 'Không tải được media từ Flow'),
      { code: 'UPLOAD_FAILED' },
    );
  }
}

/**
 * Content-script driver actions. Generate is RPC-only and runs in the SW
 * (see providers/flow/rpc/generate.ts via ProviderRouter).
 */
export async function handleDriverAction(
  action: DriverAction,
  onProgress: (p: number, m?: string) => void,
  _signal: AbortSignal,
): Promise<DriverResult> {
  switch (action.name) {
    case 'checkAuth':
      return { raw: { authenticated: await checkAuth() } };
    case 'capabilities':
      return { raw: await capabilities() };
    case 'diagnose':
      return { raw: await diagnose() };
    case 'generate':
      throw Object.assign(
        new Error(
          'Generate Flow chạy qua batchexecute RPC ở service worker — không còn DOM executeGenerate.',
        ),
        { code: 'UNKNOWN' },
      );
    case 'listMedia':
      onProgress(20, 'Đang quét media trên Flow…');
      return listMedia(action.payload);
    case 'fetchMedia':
      onProgress(30, 'Đang tải media từ Flow…');
      return fetchMedia(action.payload.url);
    default:
      throw Object.assign(new Error(`Action không hỗ trợ: ${(action as DriverAction).name}`), {
        code: 'UNKNOWN',
      });
  }
}
