/**
 * Addresses of media that already live on Google Flow. Pure helpers — no chrome
 * APIs — so the editor UI, the engine and the RPC layer share one spelling.
 */

export const FLOW_MEDIA_HOST = 'flow-content.google';

export type FlowMediaKind = 'image' | 'video';

const UUID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
const MEDIA_URL_RE = new RegExp(`${FLOW_MEDIA_HOST.replace('.', '\\.')}/(image|video)/(${UUID})`);

/**
 * The stable address of a Flow media item: the CDN path without its signature.
 * This is what `[Label]` placeholders are replaced with; the signed variant
 * Flow hands out expires, the media id in the path does not.
 */
export function flowMediaUrl(kind: FlowMediaKind, mediaId: string): string {
  return `https://${FLOW_MEDIA_HOST}/${kind}/${mediaId}`;
}

/** Pull `{kind, mediaId}` out of any Flow CDN url (signed or not). */
export function parseFlowMediaUrl(url: string | null | undefined): { kind: FlowMediaKind; mediaId: string } | null {
  if (!url) return null;
  const m = MEDIA_URL_RE.exec(url.replace(/\\u002F|\\\//g, '/'));
  if (!m) return null;
  return { kind: m[1] as FlowMediaKind, mediaId: m[2]! };
}
