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

  async seedIfEmpty(): Promise<void> {
    const count = await db.templates.count();
    if (count > 0) return;
    const seeds = getSeedTemplates();
    await db.templates.bulkPut(seeds);
  },
};
