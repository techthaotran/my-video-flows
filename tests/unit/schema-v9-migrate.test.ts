import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION, migrateWorkflow, upgradeStoredWorkflow } from '@/shared/schema';

function v8Workflow() {
  return {
    id: 'wf',
    workspaceId: 'ws',
    name: 'lookbook cũ',
    schemaVersion: 8,
    nodes: [
      {
        id: 'a1',
        type: 'asset',
        label: 'Character',
        position: { x: 0, y: 0 },
        data: { kind: 'image', assetLabel: 'Character', slug: 'character', source: 'local' },
      },
      {
        id: 'a2',
        type: 'asset',
        label: 'Áo',
        position: { x: 0, y: 200 },
        data: { kind: 'image', assetLabel: 'Outfit', slug: 'outfit', source: 'local' },
      },
      {
        id: 'p1',
        type: 'prompt',
        position: { x: 300, y: 0 },
        data: {
          preset: 'custom',
          instruction: '[Character] mặc [Outfit] đi bộ.\n\n[Character]: cô gái tóc dài.',
          formattedOutput: '[Character] mặc [Outfit]',
        },
      },
      {
        id: 'g1',
        type: 'generateVideo',
        position: { x: 600, y: 0 },
        data: { prompt: 'thêm [Character] cười' },
      },
      {
        id: 'n1',
        type: 'note',
        position: { x: 0, y: -200 },
        data: { content: 'Ảnh [Character] là người mẫu.' },
      },
    ],
    edges: [],
    createdAt: 1,
    updatedAt: 1,
  };
}

describe('schema v9 migrate: Character → Model', () => {
  it('đổi nhãn asset và nhãn node Character thành Model, giữ nhãn khác', () => {
    const wf = migrateWorkflow(v8Workflow());
    expect(wf.schemaVersion).toBe(SCHEMA_VERSION);
    const [model, outfit] = wf.nodes;
    expect(model!.label).toBe('Model');
    expect((model!.data as Record<string, unknown>).assetLabel).toBe('Model');
    expect(outfit!.label).toBe('Áo');
    expect((outfit!.data as Record<string, unknown>).assetLabel).toBe('Outfit');
  });

  it('đổi [Character] thành [Model] trong prompt, output đã định dạng, Generate và Note', () => {
    const wf = migrateWorkflow(v8Workflow());
    const data = (id: string) => wf.nodes.find((n) => n.id === id)!.data as Record<string, unknown>;
    expect(data('p1').instruction).toBe('[Model] mặc [Outfit] đi bộ.\n\n[Model]: cô gái tóc dài.');
    expect(data('p1').formattedOutput).toBe('[Model] mặc [Outfit]');
    expect(data('g1').prompt).toBe('thêm [Model] cười');
    expect(data('n1').content).toBe('Ảnh [Model] là người mẫu.');
  });

  it('workflow đã lưu ở v8 được nâng cấp khi mở', () => {
    const stored = { ...migrateWorkflow(v8Workflow()), schemaVersion: 8 };
    const asset = stored.nodes[0]!;
    stored.nodes[0] = { ...asset, data: { ...asset.data, assetLabel: 'Character' } };
    const upgraded = upgradeStoredWorkflow(stored);
    expect(upgraded.schemaVersion).toBe(SCHEMA_VERSION);
    expect((upgraded.nodes[0]!.data as Record<string, unknown>).assetLabel).toBe('Model');
  });

  it('workflow v9 không bị đổi lại', () => {
    const wf = migrateWorkflow({ ...v8Workflow(), schemaVersion: 9 });
    expect((wf.nodes[0]!.data as Record<string, unknown>).assetLabel).toBe('Character');
  });
});
