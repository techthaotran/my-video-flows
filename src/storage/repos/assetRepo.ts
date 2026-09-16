import { db, type AssetRecord } from '@/storage/db';
import { nanoid, sha256 } from '@/shared/utils';
import { mediaKindOf } from '@/shared/media';

function assetKind(mime: string, originalName?: string): 'image' | 'video' | 'audio' | 'other' {
  return mediaKindOf({ type: mime, name: originalName }) ?? 'other';
}

export const assetRepo = {
  async put(blob: Blob, originalName: string, workflowId?: string): Promise<AssetRecord> {
    const hash = await sha256(blob);
    const existing = await db.assets.where('sha256').equals(hash).first();
    if (existing) {
      if (workflowId && !existing.workflowId) {
        await db.assets.update(existing.id, { workflowId });
      }
      return existing;
    }
    const record: AssetRecord = {
      id: nanoid(),
      sha256: hash,
      workflowId,
      mime: blob.type || 'application/octet-stream',
      size: blob.size,
      originalName,
      kind: assetKind(blob.type, originalName),
      createdAt: Date.now(),
      blob,
    };
    await db.assets.add(record);
    return record;
  },

  async get(id: string): Promise<AssetRecord | undefined> {
    return db.assets.get(id);
  },

  async getByHash(hash: string): Promise<AssetRecord | undefined> {
    return db.assets.where('sha256').equals(hash).first();
  },

  async listByWorkflow(workflowId: string): Promise<AssetRecord[]> {
    return db.assets.where('workflowId').equals(workflowId).toArray();
  },

  async putFromHash(
    hash: string,
    blob: Blob,
    meta: { mime: string; originalName: string; workflowId?: string },
  ): Promise<AssetRecord> {
    const existing = await this.getByHash(hash);
    if (existing) return existing;
    const actual = await sha256(blob);
    if (actual !== hash) throw new Error(`sha256 không khớp: expected ${hash}`);
    const record: AssetRecord = {
      id: nanoid(),
      sha256: hash,
      workflowId: meta.workflowId,
      mime: meta.mime,
      size: blob.size,
      originalName: meta.originalName,
      kind: assetKind(meta.mime, meta.originalName),
      createdAt: Date.now(),
      blob,
    };
    await db.assets.add(record);
    return record;
  },

  async orphanCleanup(): Promise<number> {
    const assets = await db.assets.toArray();
    const workflows = await db.workflows.toArray();
    const used = new Set<string>();
    for (const wf of workflows) {
      for (const n of wf.nodes) {
        if (n.type === 'asset') {
          const assetId = (n.data as { assetId?: string }).assetId;
          if (assetId) used.add(assetId);
        }
        if (n.type === 'prompt') {
          const frameId = (n.data as { continueFrameAssetId?: string }).continueFrameAssetId;
          if (frameId) used.add(frameId);
        }
      }
    }
    const orphans = assets.filter((a) => !used.has(a.id));
    await db.assets.bulkDelete(orphans.map((a) => a.id));
    return orphans.length;
  },
};
