import { db } from '@/storage/db';
import type { Template } from '@/shared/schema';
import { nanoid } from '@/shared/utils';
import { getSeedTemplates } from '@/templates/seed';

export const templateRepo = {
  async list(): Promise<Template[]> {
    return db.templates.orderBy('updatedAt').reverse().toArray();
  },

  async get(id: string): Promise<Template | undefined> {
    return db.templates.get(id);
  },

  async put(template: Template): Promise<void> {
    await db.templates.put(template);
  },

  async saveFromWorkflow(
    workflow: Template['workflow'],
    meta: { name: string; description?: string; category?: string; tags?: string[] },
  ): Promise<Template> {
    const now = Date.now();
    const t: Template = {
      id: nanoid(),
      name: meta.name,
      description: meta.description ?? '',
      category: meta.category ?? 'user',
      tags: meta.tags ?? [],
      workflow: structuredClone(workflow),
      builtIn: false,
      createdAt: now,
      updatedAt: now,
    };
    await db.templates.put(t);
    return t;
  },

  async remove(id: string): Promise<void> {
    const t = await this.get(id);
    if (t?.builtIn) throw new Error('Không xoá được template có sẵn');
    await db.templates.delete(id);
  },

  /**
   * Upsert every built-in seed by id on each boot.
   * User-saved templates (`builtIn: false`) are untouched.
   * Built-ins removed from seed are deleted from DB.
   * Empty DB is seeded by the same upsert path.
   */
  async syncBuiltIns(): Promise<void> {
    const seeds = getSeedTemplates();
    const seedIds = new Set(seeds.map((s) => s.id));
    const now = Date.now();

    for (const seed of seeds) {
      const existing = await db.templates.get(seed.id);
      if (existing && !existing.builtIn) continue;
      await db.templates.put({
        ...seed,
        createdAt: existing?.createdAt ?? seed.createdAt,
        updatedAt: now,
        builtIn: true,
      });
    }

    const all = await db.templates.toArray();
    for (const t of all) {
      if (!t.builtIn) continue;
      if (seedIds.has(t.id)) continue;
      await db.templates.delete(t.id);
    }
  },
};
