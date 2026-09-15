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

export interface ProjectMediaPageResult {
  items: FlowMediaItem[];
  nextPageToken: string | null;
}

function toFlowMediaItem(m: ProjectMediaEntry): FlowMediaItem {
  const signed = m.url?.includes('?') ? m.url : '';
  return {
    id: m.mediaId,
    kind: m.kind ?? 'image',
    kindKnown: !!m.kind,
    url: signed,
    thumbUrl: signed || undefined,
    mediaId: m.mediaId,
    createdAt: m.createdAt,
  };
}

/**
 * One page of project media via `Zzl0ze`. Records mostly carry only the id;
 * urls are signed per picker page (`signFlowMedia`).
 */
export async function listProjectMediaPage(
  tabId: number,
  pageToken: string | null = null,
): Promise<ProjectMediaPageResult> {
  const projectId = await resolveFlowProjectId(tabId);
  const res = await runBatchRpc(tabId, {
    rpcid: RPC_PROJECT_MEDIA,
    freq: projectMediaPageRequest(projectId, pageToken),
  });
  const httpFailed = res.status != null && res.status >= 400;
  if (res.error || httpFailed) {
    const msg = res.error ?? `batchexecute ${RPC_PROJECT_MEDIA} thất bại — HTTP ${res.status}`;
    throw new Error(msg);
  }

  const { items, nextPageToken } = readProjectMediaPage(res.text ?? '');
  log.debug(
    `${RPC_PROJECT_MEDIA}: ${items.length} media, token=${pageToken ? 'tiếp' : 'đầu'} → next=${nextPageToken ? 'có' : 'không'}`,
  );
  return {
    items: items.map(toFlowMediaItem),
    nextPageToken,
  };
}

const SIGN_CONCURRENCY = 8;

export interface SignedFlowMedia {
  mediaId: string;
  kind: 'image' | 'video' | null;
  url: string | null;
  /** Prefer image/poster for grid tiles when the media is video. */
  thumbUrl?: string | null;
}

/**
 * Signed CDN urls for a page of media ids via `as29s` (same call generate uses) —
 * the CDN refuses bare `/image/<id>` paths. Also settles the kind the listing
 * record didn't carry. Best effort: an id that fails comes back with url null.
 * When both image + video exist, `url` is the video and `thumbUrl` is the poster.
 */
export async function signFlowMedia(tabId: number, mediaIds: string[]): Promise<SignedFlowMedia[]> {
  const out: SignedFlowMedia[] = mediaIds.map((mediaId) => ({
    mediaId,
    kind: null,
    url: null,
    thumbUrl: null,
  }));
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
          entry.thumbUrl = urls.image ?? urls.video;
        } else if (urls.image) {
          entry.kind = 'image';
          entry.url = urls.image;
          entry.thumbUrl = urls.image;
        }
      } catch {
        /* url stays null */
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(SIGN_CONCURRENCY, out.length) }, worker));
  return out;
}
