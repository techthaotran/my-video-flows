import { db } from '@/storage/db';
import type { Workspace } from '@/shared/schema';
import { nanoid } from '@/shared/utils';

const MAX_NAME_LEN = 80;

export const workspaceRepo = {
  async list(): Promise<Workspace[]> {
    return db.workspaces.orderBy('updatedAt').reverse().toArray();
  },

  async get(id: string): Promise<Workspace | undefined> {
    return db.workspaces.get(id);
  },

  async getCurrent(): Promise<Workspace | undefined> {
    return db.workspaces.filter((w) => w.isCurrent).first();
  },

  async create(name: string): Promise<Workspace> {
    const now = Date.now();
    const ws: Workspace = {
      id: nanoid(),
      name: name.slice(0, MAX_NAME_LEN),
      isCurrent: false,
      createdAt: now,
      updatedAt: now,
    };
    await db.workspaces.add(ws);
    return ws;
  },

  async rename(id: string, name: string): Promise<void> {
    await db.workspaces.update(id, { name: name.slice(0, MAX_NAME_LEN), updatedAt: Date.now() });
  },

  async setCurrent(id: string): Promise<void> {
    await db.transaction('rw', db.workspaces, async () => {
      const all = await db.workspaces.toArray();
      for (const w of all) {
        await db.workspaces.update(w.id, { isCurrent: w.id === id, updatedAt: Date.now() });
      }
    });
  },

  async remove(id: string, opts?: { force?: boolean }): Promise<void> {
    const all = await this.list();
    if (all.length <= 1) {
      throw new Error('Không thể xoá workspace cuối cùng');
    }
    const active = await db.workflows
      .where('workspaceId')
      .equals(id)
      .filter((w) => !w.deletedAt)
      .toArray();
    if (active.length > 0) {
      if (!opts?.force) {
        throw new Error(`Workspace còn ${active.length} workflow, hãy chuyển hoặc xoá trước`);
      }
      const now = Date.now();
      await db.transaction('rw', db.workflows, async () => {
        for (const w of active) {
          await db.workflows.update(w.id, { deletedAt: now, enabled: false, updatedAt: now });
        }
      });
    }
    const wasCurrent = all.find((w) => w.id === id)?.isCurrent;
    await db.workspaces.delete(id);
    if (wasCurrent) {
      const next = (await this.list())[0];
      if (next) await this.setCurrent(next.id);
    }
  },

  async ensureDefault(): Promise<Workspace> {
    const existing = await this.list();
    if (existing.length > 0) {
      const current = existing.find((w) => w.isCurrent) ?? existing[0]!;
      if (!current.isCurrent) await this.setCurrent(current.id);
      return current;
    }
    const now = Date.now();
    const label = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(now);
    const ws: Workspace = {
      id: nanoid(),
      name: label,
      isCurrent: true,
      createdAt: now,
      updatedAt: now,
    };
    await db.workspaces.add(ws);
    return ws;
  },
};
