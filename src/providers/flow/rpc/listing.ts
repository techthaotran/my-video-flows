import type { FlowMediaItem } from '@/shared/messaging';
import {
  RPC_MEDIA,
  RPC_PROJECT_MEDIA,
  firstPayload,
  mediaRequest,
  projectMediaPageRequest,
  readMediaUrls,
  readProjectMediaPage,
  type ProjectMediaEntry,
} from '@/providers/flow/rpc/batch';
import { resolveFlowProjectId } from '@/providers/flow/rpc/project';
import { runBatchRpc } from '@/providers/flow/rpc/runner';
import { createLogger } from '@/shared/log';

const log = createLogger('rpc');

const MAX_PAGES = 20;
const MAX_ITEMS = 2000;

/**
 * Every media id of the open Flow project via the `Zzl0ze` listing RPC — unlike
 * the DOM scan this is not limited to the thumbnails Flow currently renders.
 * Records mostly carry only the id; urls are signed per picker page
 * (`signFlowMedia`) so a large project doesn't cost one RPC per item up front.
 */
export async function listProjectMediaViaRpc(tabId: number): Promise<FlowMediaItem[]> {
  const projectId = await resolveFlowProjectId(tabId);
  const byId = new Map<string, ProjectMediaEntry>();
  let token: string | null = null;
  const seenTokens = new Set<string>();

  for (let page = 0; page < MAX_PAGES && byId.size < MAX_ITEMS; page++) {
    const res = await runBatchRpc(tabId, {
      rpcid: RPC_PROJECT_MEDIA,
      freq: projectMediaPageRequest(projectId, token),
    });
    const httpFailed = res.status != null && res.status >= 400;
    if (res.error || httpFailed) {
      const msg = res.error ?? `batchexecute ${RPC_PROJECT_MEDIA} thất bại — HTTP ${res.status}`;
      // A follow-up page failing just ends pagination; the first page failing is an error.
      if (page === 0) throw new Error(msg);
      log.warn(`${RPC_PROJECT_MEDIA} trang ${page + 1} lỗi — dừng`, { error: msg });
      break;
    }

    const { items, nextPageToken } = readProjectMediaPage(res.text ?? '');
    let added = 0;
    for (const item of items) {
      if (byId.has(item.mediaId)) continue;
      byId.set(item.mediaId, item);
      added++;
    }
    log.debug(`${RPC_PROJECT_MEDIA} trang ${page + 1}: ${items.length} media, token=${nextPageToken ? 'có' : 'không'}`);

    if (!nextPageToken || seenTokens.has(nextPageToken) || added === 0) break;
    seenTokens.add(nextPageToken);
    token = nextPageToken;
  }

  const entries = [...byId.values()];
  if (entries.some((e) => e.createdAt != null)) {
    entries.sort((a, b) => (b.createdAt ?? -Infinity) - (a.createdAt ?? -Infinity));
  }
  return entries.map((m) => ({
    id: m.mediaId,
    kind: m.kind ?? 'image',
    kindKnown: !!m.kind,
    url: m.url?.includes('?') ? m.url : '',
    thumbUrl: m.url?.includes('?') ? m.url : undefined,
    mediaId: m.mediaId,
    createdAt: m.createdAt,
  }));
}

const SIGN_CONCURRENCY = 4;

export interface SignedFlowMedia {
  mediaId: string;
  kind: 'image' | 'video' | null;
  url: string | null;
}

/**
 * Signed CDN urls for a page of media ids via `as29s` (same call generate uses) —
 * the CDN refuses bare `/image/<id>` paths. Also settles the kind the listing
 * record didn't carry. Best effort: an id that fails comes back with url null.
 */
export async function signFlowMedia(tabId: number, mediaIds: string[]): Promise<SignedFlowMedia[]> {
  const out: SignedFlowMedia[] = mediaIds.map((mediaId) => ({ mediaId, kind: null, url: null }));
  let next = 0;
  const worker = async () => {
    while (next < out.length) {
      const entry = out[next++]!;
      try {
        const res = await runBatchRpc(tabId, { rpcid: RPC_MEDIA, freq: mediaRequest(entry.mediaId) });
        if (res.error || !res.text) continue;
        const urls = readMediaUrls(firstPayload(res.text, RPC_MEDIA), entry.mediaId);
        if (urls.video) {
          entry.kind = 'video';
          entry.url = urls.video;
        } else if (urls.image) {
          entry.kind = 'image';
          entry.url = urls.image;
        }
      } catch {
        /* url stays null */
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(SIGN_CONCURRENCY, out.length) }, worker));
  return out;
}
