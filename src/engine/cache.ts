/** Hash inputs + node config for output cache reuse */

import { hashBlobContent } from '@/shared/utils';

/** Replace Blobs with content sha256 so two same-size files never collide. */
async function withBlobContentHashes(value: unknown): Promise<unknown> {
  if (value instanceof Blob) {
    return { __blob: true, sha256: await hashBlobContent(value) };
  }
  if (Array.isArray(value)) {
    return Promise.all(value.map(withBlobContentHashes));
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = await withBlobContentHashes(v);
    }
    return out;
  }
  return value;
}

export async function hashValue(value: unknown): Promise<string> {
  const prepared = await withBlobContentHashes(value);
  const json = JSON.stringify(prepared);
  const data = new TextEncoder().encode(json);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function computeInputHash(
  nodeData: unknown,
  inputs: Record<
    string,
    { kind: string; text?: string; outputId?: string; contentHash?: string; size?: number }[]
  >,
): Promise<string> {
  return hashValue({ nodeData, inputs });
}
