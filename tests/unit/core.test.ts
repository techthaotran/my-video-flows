import { describe, it, expect, beforeEach } from 'vitest';
import {
  WorkflowSchema,
  migrateWorkflow,
  SCHEMA_VERSION,
  FORMAT_VERSION,
  ExportManifestSchema,
} from '@/shared/schema';
import { topoSort, collectDownstream } from '@/engine/scheduler';
import { wouldCreateCycle, portsCompatible, isValidConnection } from '@/nodes/ports';
import {
  resolveTextContent,
  extractSlugs,
  buildSlugIndex,
  annotateAssetLabels,
  stripAssetLegend,
  composePrompt,
} from '@/engine/resolver';
import { db } from '@/storage/db';
import { workspaceRepo } from '@/storage/repos/workspaceRepo';
import { workflowRepo, createEmptyWorkflow } from '@/storage/repos/workflowRepo';
import { exportWorkflows, parseImportFile, commitImport } from '@/storage/transfer';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('schema', () => {
  it('parses empty workflow', () => {
    const wf = createEmptyWorkflow('ws1');
    expect(WorkflowSchema.parse(wf).schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('migrates unknown node types', () => {
    const wf = migrateWorkflow({
      id: 'a',
      workspaceId: 'w',
      name: 't',
      schemaVersion: 0,
      nodes: [{ id: 'n1', type: 'futureNode', position: { x: 0, y: 0 }, data: { foo: 1 } }],
      edges: [],
      createdAt: 1,
      updatedAt: 1,
    });
    expect(wf.nodes[0]!.type).toBe('unknown');
  });

  it('migrates legacy media/image/video/flowGenerate nodes', () => {
    const wf = migrateWorkflow({
      id: 'a',
      workspaceId: 'w',
      name: 't',
      schemaVersion: 0,
      nodes: [
        { id: 'n1', type: 'media', position: { x: 0, y: 0 }, data: { kind: 'video' } },
        { id: 'n2', type: 'image', position: { x: 0, y: 0 }, data: {} },
        {
          id: 'n3',
          type: 'flowGenerate',
          position: { x: 0, y: 0 },
          data: { mode: 'text-to-image' },
        },
        {
          id: 'n4',
          type: 'geminiGenerate',
          position: { x: 0, y: 0 },
          data: { kind: 'video' },
        },
      ],
      edges: [],
      createdAt: 1,
      updatedAt: 1,
    });
    expect(wf.nodes[0]!.type).toBe('asset');
    expect(wf.nodes[1]!.type).toBe('asset');
    expect(wf.nodes[2]!.type).toBe('generateImage');
    expect(wf.nodes[3]!.type).toBe('generateVideo');
  });

  it('validates export manifest', () => {
    const m = ExportManifestSchema.parse({
      format: 'my-x-flows',
      formatVersion: FORMAT_VERSION,
      kind: 'workflows',
      appVersion: '0.1.0',
      exportedAt: new Date().toISOString(),
      workflows: [],
      assets: [],
      includes: { assets: true, outputs: false, runs: false },
    });
    expect(m.format).toBe('my-x-flows');
  });
});

describe('scheduler', () => {
  const wf = {
    ...createEmptyWorkflow('w'),
    nodes: [
      { id: 'a', type: 'text' as const, position: { x: 0, y: 0 }, data: {} },
      { id: 'b', type: 'generateVideo' as const, position: { x: 0, y: 0 }, data: {} },
      { id: 'c', type: 'autoDownload' as const, position: { x: 0, y: 0 }, data: {} },
      { id: 'n', type: 'note' as const, position: { x: 0, y: 0 }, data: {} },
    ],
    edges: [
      {
        id: 'e1',
        source: 'a',
        sourceHandle: 'out:text',
        target: 'b',
        targetHandle: 'in:text',
        type: 'text' as const,
      },
      {
        id: 'e2',
        source: 'b',
        sourceHandle: 'out:video',
        target: 'c',
        targetHandle: 'in:any',
        type: 'video' as const,
      },
    ],
  };

  it('topo sorts', () => {
    expect(topoSort(wf).order).toEqual(['a', 'b', 'c']);
  });

  it('detects cycle', () => {
    expect(
      wouldCreateCycle(
        [
          { source: 'a', target: 'b' },
          { source: 'b', target: 'c' },
        ],
        'c',
        'a',
      ),
    ).toBe(true);
  });

  it('collects downstream', () => {
    expect([...collectDownstream(wf, 'b')].sort()).toEqual(['b', 'c']);
  });
});

describe('ports', () => {
  it('compatible types', () => {
    expect(portsCompatible('text', 'text')).toBe(true);
    expect(portsCompatible('image', 'any')).toBe(true);
    expect(portsCompatible('text', 'image')).toBe(false);
  });

  it('validates connection', () => {
    const edges: never[] = [];
    const ok = isValidConnection(
      { source: 'a', target: 'b', sourceHandle: 'out:text', targetHandle: 'in:text' },
      edges,
      (id) =>
        id === 'a'
          ? { inputs: [], outputs: [{ id: 'out:text', type: 'text' }] }
          : { inputs: [{ id: 'in:text', type: 'text', maxConnections: 1 }], outputs: [] },
    );
    expect(ok).toBe(true);
  });
});

describe('resolver', () => {
  it('extracts and resolves slugs', () => {
    expect(extractSlugs('hello @video and @image_1')).toEqual(['video', 'image_1']);
    const text = resolveTextContent('use @a', (s) => (s === 'a' ? 'X' : undefined));
    expect(text).toBe('use X');
  });

  it('builds slug index', () => {
    const wf = createEmptyWorkflow('w');
    wf.nodes = [
      {
        id: '1',
        type: 'asset',
        slug: 'video',
        position: { x: 0, y: 0 },
        data: { slug: 'video', kind: 'video', assetLabel: 'Video reference' },
      },
    ];
    expect(buildSlugIndex(wf).get('video')).toBe('1');
  });

  it('keeps [Label] tags and appends a Tham khảo legend for Flow assets', () => {
    const out = annotateAssetLabels('nhân vật [Character] đang mặc một [outfit] ở [Background]', [
      { label: 'Character', kind: 'image', flowMediaId: '5ef8278f-a08d-4b30-a45c-bdd946b37427' },
      { label: 'Outfit', kind: 'image', flowMediaId: 'fcf16651-14f3-4335-9557-0a808bd11946' },
      { label: 'Background', kind: 'image' },
    ]);
    expect(out).toBe(
      'nhân vật [Character] đang mặc một [outfit] ở [Background]\n\n' +
        'Danh sách tham chiếu\n' +
        '[Character]: Tham khảo https://flow-content.google/image/5ef8278f-a08d-4b30-a45c-bdd946b37427\n\n' +
        '[Outfit]: Tham khảo https://flow-content.google/image/fcf16651-14f3-4335-9557-0a808bd11946',
    );
  });

  it('turns [Label]: description into a single Tham khảo line (no URL-in-place, no duplicate)', () => {
    const out = annotateAssetLabels(
      '[Character]: Người mẫu nữ Đông Á (20-25 tuổi), gương mặt thanh tú, trang điểm tự nhiên nhẹ nhàng.',
      [{ label: 'Character', kind: 'image', flowMediaId: '6fc34631-b4e9-4304-a555-cac7a03fd65c' }],
    );
    expect(out).toBe(
      'Danh sách tham chiếu\n' +
        '[Character]: Người mẫu nữ Đông Á (20-25 tuổi), gương mặt thanh tú, trang điểm tự nhiên nhẹ nhàng. Tham khảo https://flow-content.google/image/6fc34631-b4e9-4304-a555-cac7a03fd65c',
    );
  });

  it('restores wrongly inlined Flow URLs then formats Tham khảo', () => {
    const out = annotateAssetLabels(
      'https://flow-content.google/image/6fc34631-b4e9-4304-a555-cac7a03fd65c: Người mẫu nữ Đông Á (20-25 tuổi).',
      [{ label: 'Character', kind: 'image', flowMediaId: '6fc34631-b4e9-4304-a555-cac7a03fd65c' }],
    );
    expect(out).toBe(
      'Danh sách tham chiếu\n' +
        '[Character]: Người mẫu nữ Đông Á (20-25 tuổi). Tham khảo https://flow-content.google/image/6fc34631-b4e9-4304-a555-cac7a03fd65c',
    );
  });

  it('keeps narrative tags and moves definitions into the Tham khảo legend', () => {
    const out = annotateAssetLabels(
      '[Character]: Giới tính & độ tuổi: Nữ, phong cách trẻ trung Đông Á.\n\n' +
        'Shot of [Character] smiling.',
      [{ label: 'Character', kind: 'image', flowMediaId: '6fc34631-b4e9-4304-a555-cac7a03fd65c' }],
    );
    expect(out).toBe(
      'Shot of [Character] smiling.\n\n' +
        'Danh sách tham chiếu\n' +
        '[Character]: Giới tính & độ tuổi: Nữ, phong cách trẻ trung Đông Á. Tham khảo https://flow-content.google/image/6fc34631-b4e9-4304-a555-cac7a03fd65c',
    );
  });

  it('strips a previous Tham khảo legend before re-annotating', () => {
    const once = annotateAssetLabels('[Character] waves', [
      { label: 'Character', kind: 'image', flowMediaId: '5ef8278f-a08d-4b30-a45c-bdd946b37427' },
    ]);
    const again = annotateAssetLabels(once, [
      { label: 'Character', kind: 'image', flowMediaId: '5ef8278f-a08d-4b30-a45c-bdd946b37427' },
      { label: 'Outfit', kind: 'image', flowMediaId: 'fcf16651-14f3-4335-9557-0a808bd11946' },
    ]);
    expect(stripAssetLegend(once)).toBe('[Character] waves');
    expect(again).toBe(
      '[Character] waves\n\n' +
        'Danh sách tham chiếu\n' +
        '[Character]: Tham khảo https://flow-content.google/image/5ef8278f-a08d-4b30-a45c-bdd946b37427\n\n' +
        '[Outfit]: Tham khảo https://flow-content.google/image/fcf16651-14f3-4335-9557-0a808bd11946',
    );
  });

  it('leaves descriptive [Label]: text alone when stripping URL legends', () => {
    const body =
      '[Background]: A cozy aesthetic bedroom with soft warm ambient lighting.\n\n' +
      '[Character]: Tham khảo https://flow-content.google/image/5ef8278f-a08d-4b30-a45c-bdd946b37427';
    expect(stripAssetLegend(body)).toBe(
      '[Background]: A cozy aesthetic bedroom with soft warm ambient lighting.',
    );
  });

  it('composes the instruction before upstream prompts', () => {
    expect(composePrompt(['scene 1', '  '], 'scene 2')).toBe('scene 2\n\nscene 1');
  });
});

describe('repos + transfer', () => {
  it('workspace + workflow CRUD', async () => {
    const ws = await workspaceRepo.ensureDefault();
    const wf = await workflowRepo.create(createEmptyWorkflow(ws.id, 'Test'));
    expect(wf.name).toBe('Test');
    wf.nodes.push({
      id: 't1',
      type: 'text',
      position: { x: 0, y: 0 },
      data: { content: 'hi', slug: 't' },
      slug: 't',
    });
    await workflowRepo.save(wf);
    const got = await workflowRepo.get(wf.id);
    expect(got?.nodes).toHaveLength(1);
  });

  it('export json → import round-trip structure', async () => {
    const ws = await workspaceRepo.ensureDefault();
    const wf = await workflowRepo.create({
      ...createEmptyWorkflow(ws.id, 'Round'),
      nodes: [
        { id: 'n1', type: 'text', position: { x: 1, y: 2 }, data: { content: 'hello' }, slug: 't' },
      ],
      edges: [],
    });
    await workflowRepo.save(wf);

    const exported = await exportWorkflows({
      workflowIds: [wf.id],
      format: 'json',
      includeAssets: false,
    });
    const file = new File([exported.blob], exported.filename, { type: 'application/json' });
    const preview = await parseImportFile(file);
    expect(preview.items).toHaveLength(1);
    expect(preview.manifest.formatVersion).toBeLessThanOrEqual(FORMAT_VERSION);

    const created = await commitImport({
      preview,
      targetWorkspaceId: ws.id,
      dupStrategy: 'copy',
    });
    expect(created[0]!.id).not.toBe(wf.id);
    expect(created[0]!.enabled).toBe(false);
    // Text nodes are imported as Prompt nodes (schema v3).
    expect(created[0]!.nodes[0]!).toMatchObject({ type: 'prompt', data: { instruction: 'hello' } });
  });

  it('rejects newer formatVersion', async () => {
    const payload = {
      format: 'my-x-flows',
      formatVersion: 999,
      kind: 'workflows',
      appVersion: '9.9.9',
      exportedAt: new Date().toISOString(),
      workflows: [],
      workflowsData: [],
      assets: [],
      includes: { assets: false, outputs: false, runs: false },
    };
    const file = new File([JSON.stringify(payload)], 'x.xflow.json', { type: 'application/json' });
    await expect(parseImportFile(file)).rejects.toThrow(/phiên bản mới hơn/);
  });
});
