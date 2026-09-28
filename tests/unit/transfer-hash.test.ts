import { beforeEach, describe, expect, it } from 'vitest';
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import { db } from '@/storage/db';
import { workspaceRepo } from '@/storage/repos/workspaceRepo';
import { workflowRepo, createEmptyWorkflow } from '@/storage/repos/workflowRepo';
import { assetRepo } from '@/storage/repos/assetRepo';
import {
  exportWorkflows,
  exportWorkspace,
  parseImportFile,
  commitImport,
  ingestPreviewAssets,
  remapMediaAssets,
  remapInsertNodes,
} from '@/storage/transfer';
import { strings } from '@/shared/strings';
import { SCHEMA_VERSION, type ExportManifest, type Workflow } from '@/shared/schema';
import { nanoid, sha256 } from '@/shared/utils';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

function pngBytes(marker: number): Uint8Array {
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, marker, marker ^ 0xff]);
}

function pngBlob(marker: number): Blob {
  return new Blob([pngBytes(marker).slice()], { type: 'image/png' });
}

async function hashOf(marker: number): Promise<string> {
  return sha256(pngBlob(marker));
}

/** Build a zip transfer file. fake-indexeddb strips Blob bytes under jsdom, so pack bytes here. */
function buildZip(opts: {
  kind?: ExportManifest['kind'];
  workspace?: { id: string; name: string };
  workflow: Workflow;
  assets: { sha256: string; bytes: Uint8Array; originalName: string }[];
}): Blob {
  const wf = opts.workflow;
  const manifest: ExportManifest = {
    format: 'my-x-flows',
    formatVersion: 1,
    kind: opts.kind ?? 'workflows',
    appVersion: '0.1.0',
    exportedAt: new Date().toISOString(),
    workspaces: opts.workspace ? [opts.workspace] : [],
    workflows: [
      {
        id: wf.id,
        name: wf.name,
        schemaVersion: wf.schemaVersion,
        path: `workflows/${wf.id}.json`,
        nodeCount: wf.nodes.length,
      },
    ],
    assets: opts.assets.map((a) => ({
      sha256: a.sha256,
      mime: 'image/png',
      size: a.bytes.byteLength,
      path: `assets/${a.sha256}.png`,
      originalName: a.originalName,
    })),
    includes: { assets: true, outputs: false, runs: false },
  };
  const files: Record<string, Uint8Array> = {
    'manifest.json': strToU8(JSON.stringify(manifest)),
    [`workflows/${wf.id}.json`]: strToU8(JSON.stringify(wf)),
  };
  for (const a of opts.assets) {
    files[`assets/${a.sha256}.png`] = a.bytes;
  }
  return new Blob([zipSync(files)], { type: 'application/zip' });
}

describe('transfer hash remap', () => {
  it('export ghi sha256 vào data từng node Asset local', async () => {
    const ws = await workspaceRepo.ensureDefault();
    const rec = await assetRepo.put(pngBlob(1), 'scene.png');
    const wf = await workflowRepo.create({
      ...createEmptyWorkflow(ws.id, 'Stamp sha'),
      nodes: [
        {
          id: 'n1',
          type: 'asset',
          label: 'scene',
          position: { x: 0, y: 0 },
          data: {
            assetId: rec.id,
            kind: 'image',
            assetLabel: 'Character',
            mime: 'image/png',
            originalName: 'scene.png',
            source: 'local',
          },
        },
      ],
      edges: [],
    });
    await workflowRepo.save(wf);

    // json format skips packing blobs (fake-indexeddb loses Blob bytes under jsdom)
    const exported = await exportWorkflows({
      workflowIds: [wf.id],
      includeAssets: false,
      format: 'json',
    });
    const raw = JSON.parse(await exported.blob.text()) as {
      workflowsData: Workflow[];
    };
    expect((raw.workflowsData[0]!.nodes[0]!.data as { sha256?: string }).sha256).toBe(rec.sha256);
  });

  it('3 ảnh export → import đúng từng node dù đảo thứ tự asset trong manifest', async () => {
    const ws = await workspaceRepo.ensureDefault();
    const sceneSha = await hashOf(1);
    const modelSha = await hashOf(2);
    const outfitSha = await hashOf(3);

    const wfId = nanoid();
    const wf: Workflow = {
      id: wfId,
      schemaVersion: SCHEMA_VERSION,
      workspaceId: ws.id,
      name: 'Fashion 3',
      enabled: false,
      locked: false,
      nodes: [
        {
          id: 'n-scene',
          type: 'asset',
          label: 'scene',
          position: { x: 0, y: 0 },
          data: {
            assetId: 'old-scene',
            kind: 'image',
            assetLabel: 'Character',
            mime: 'image/png',
            originalName: 'scene.png',
            source: 'local',
            sha256: sceneSha,
          },
        },
        {
          id: 'n-model',
          type: 'asset',
          label: 'model',
          position: { x: 100, y: 0 },
          data: {
            assetId: 'old-model',
            kind: 'image',
            assetLabel: 'Character',
            mime: 'image/png',
            originalName: 'model.png',
            source: 'local',
            sha256: modelSha,
          },
        },
        {
          id: 'n-outfit',
          type: 'asset',
          label: 'outfit',
          position: { x: 200, y: 0 },
          data: {
            assetId: 'old-outfit',
            kind: 'image',
            assetLabel: 'Outfit',
            mime: 'image/png',
            originalName: 'outfit.png',
            source: 'local',
            sha256: outfitSha,
          },
        },
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      settings: { concurrency: 1, retry: 0, stopOnError: true },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Manifest assets intentionally reversed vs node order
    const zipBlob = buildZip({
      workspace: { id: ws.id, name: 'Default' },
      workflow: wf,
      assets: [
        { sha256: outfitSha, bytes: pngBytes(3), originalName: 'outfit.png' },
        { sha256: modelSha, bytes: pngBytes(2), originalName: 'model.png' },
        { sha256: sceneSha, bytes: pngBytes(1), originalName: 'scene.png' },
      ],
    });

    // Extra shuffle: reverse again after parse of what buildZip wrote
    const unzipped = unzipSync(new Uint8Array(await zipBlob.arrayBuffer()));
    const manifest = JSON.parse(strFromU8(unzipped['manifest.json']!)) as ExportManifest;
    manifest.assets = [...manifest.assets].reverse();
    const files: Record<string, Uint8Array> = { ...unzipped };
    files['manifest.json'] = strToU8(JSON.stringify(manifest));
    const file = new File([zipSync(files)], 'shuffled.xflow.zip', { type: 'application/zip' });

    const preview = await parseImportFile(file);
    expect(preview.items[0]!.assetCount).toBe(3);
    expect(preview.items[0]!.warnings).toEqual([]);

    const created = await commitImport({
      preview,
      targetWorkspaceId: ws.id,
      dupStrategy: 'copy',
    });
    expect(created).toHaveLength(1);

    const byLabel = Object.fromEntries(created[0]!.nodes.map((n) => [n.label, n]));
    for (const [label, expectedSha] of [
      ['scene', sceneSha],
      ['model', modelSha],
      ['outfit', outfitSha],
    ] as const) {
      const data = byLabel[label]!.data as { assetId?: string; missing?: boolean; sha256?: string };
      expect(data.missing).toBe(false);
      expect(data.sha256).toBe(expectedSha);
      const rec = await assetRepo.get(data.assetId!);
      expect(rec?.sha256).toBe(expectedSha);
    }
  });

  it('exportWorkspace → import tạo workspace mới', async () => {
    const source = await workspaceRepo.create('Trước Gương 3');
    await workspaceRepo.setCurrent(source.id);
    const wf = await workflowRepo.create({
      ...createEmptyWorkflow(source.id, 'WF A'),
      nodes: [],
      edges: [],
    });
    await workflowRepo.save(wf);

    const exported = await exportWorkspace(source.id);
    expect(exported.manifest.kind).toBe('workspace');
    expect(exported.manifest.workspaces).toEqual([{ id: source.id, name: 'Trước Gương 3' }]);
    expect(exported.manifest.workflows).toHaveLength(1);

    const other = await workspaceRepo.create('Đích khác');
    const file = new File([exported.blob], exported.filename, { type: 'application/zip' });
    const preview = await parseImportFile(file);
    expect(preview.manifest.kind).toBe('workspace');

    const before = await db.workspaces.toArray();
    const created = await commitImport({
      preview,
      targetWorkspaceId: other.id,
      dupStrategy: 'copy',
    });
    expect(created).toHaveLength(1);
    expect(created[0]!.workspaceId).not.toBe(source.id);
    expect(created[0]!.workspaceId).not.toBe(other.id);

    const after = await db.workspaces.toArray();
    expect(after.length).toBe(before.length + 1);
    const newWs = after.find((w) => w.id === created[0]!.workspaceId);
    expect(newWs?.name).toBe('Trước Gương 3');
  });

  it('node Asset Flow giữ media id và có cảnh báo theo từng node', async () => {
    const ws = await workspaceRepo.ensureDefault();
    const wf = await workflowRepo.create({
      ...createEmptyWorkflow(ws.id, 'Flow assets'),
      nodes: [
        {
          id: 'n-flow-a',
          type: 'asset',
          label: 'Flow outfit',
          position: { x: 0, y: 0 },
          data: {
            kind: 'image',
            assetLabel: 'Outfit',
            source: 'flow',
            flowMediaId: 'flow-media-a',
          },
        },
        {
          id: 'n-flow-b',
          type: 'asset',
          label: 'Flow scene',
          position: { x: 100, y: 0 },
          data: {
            kind: 'image',
            assetLabel: 'Character',
            source: 'flow',
            flowMediaId: 'flow-media-b',
          },
        },
      ],
      edges: [],
    });
    await workflowRepo.save(wf);

    const exported = await exportWorkflows({
      workflowIds: [wf.id],
      includeAssets: true,
      format: 'zip',
    });
    expect(exported.manifest.assets).toHaveLength(0);

    const file = new File([exported.blob], exported.filename, { type: 'application/zip' });
    const preview = await parseImportFile(file);
    expect(preview.items[0]!.warnings).toEqual([
      strings.importFlowAssetMissing('Flow outfit'),
      strings.importFlowAssetMissing('Flow scene'),
    ]);
    expect(
      preview.items[0]!.workflow.nodes.map((n) => (n.data as { flowMediaId?: string }).flowMediaId),
    ).toEqual(['flow-media-a', 'flow-media-b']);

    const created = await commitImport({
      preview,
      targetWorkspaceId: ws.id,
      dupStrategy: 'copy',
    });
    expect(
      created[0]!.nodes.map((n) => (n.data as { flowMediaId?: string }).flowMediaId),
    ).toEqual(['flow-media-a', 'flow-media-b']);
  });

  it('hash hit trong preview xoá missing:true cũ', async () => {
    const ws = await workspaceRepo.ensureDefault();
    const sceneSha = await hashOf(11);
    const wfId = nanoid();
    const wf: Workflow = {
      id: wfId,
      schemaVersion: SCHEMA_VERSION,
      workspaceId: ws.id,
      name: 'Stale missing',
      enabled: false,
      locked: false,
      nodes: [
        {
          id: 'n1',
          type: 'asset',
          label: 'scene',
          position: { x: 0, y: 0 },
          data: {
            assetId: 'foreign-id',
            kind: 'image',
            assetLabel: 'Character',
            mime: 'image/png',
            originalName: 'scene.png',
            source: 'local',
            sha256: sceneSha,
            missing: true,
          },
        },
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      settings: { concurrency: 1, retry: 0, stopOnError: true },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const file = new File(
      [
        buildZip({
          workspace: { id: ws.id, name: 'Default' },
          workflow: wf,
          assets: [{ sha256: sceneSha, bytes: pngBytes(11), originalName: 'scene.png' }],
        }),
      ],
      'stale.xflow.zip',
      { type: 'application/zip' },
    );
    const preview = await parseImportFile(file);
    const data = preview.items[0]!.workflow.nodes[0]!.data as { missing?: boolean };
    expect(data.missing).toBe(false);
  });

  it('chèn node: ingest + hash remap không giữ assetId ngoại', async () => {
    const ws = await workspaceRepo.ensureDefault();
    const sceneSha = await hashOf(21);
    const foreignId = 'exporter-asset-id-xyz';
    const wfId = nanoid();
    const wf: Workflow = {
      id: wfId,
      schemaVersion: SCHEMA_VERSION,
      workspaceId: ws.id,
      name: 'Insert me',
      enabled: false,
      locked: false,
      nodes: [
        {
          id: 'n1',
          type: 'asset',
          label: 'scene',
          slug: 'scene',
          position: { x: 0, y: 0 },
          data: {
            assetId: foreignId,
            kind: 'image',
            assetLabel: 'Character',
            mime: 'image/png',
            originalName: 'scene.png',
            source: 'local',
            sha256: sceneSha,
            slug: 'scene',
          },
        },
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      settings: { concurrency: 1, retry: 0, stopOnError: true },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const file = new File(
      [
        buildZip({
          workspace: { id: ws.id, name: 'Default' },
          workflow: wf,
          assets: [{ sha256: sceneSha, bytes: pngBytes(21), originalName: 'scene.png' }],
        }),
      ],
      'insert.xflow.zip',
      { type: 'application/zip' },
    );
    const preview = await parseImportFile(file);
    const item = preview.items[0]!;

    // Same path as EditorApp "Chèn node"
    const hashToAssetId = await ingestPreviewAssets(preview);
    const withLocal = remapMediaAssets(item.workflow, hashToAssetId);
    const { nodes } = remapInsertNodes(withLocal, new Set());

    const data = nodes[0]!.data as { assetId?: string; missing?: boolean; sha256?: string };
    expect(data.assetId).not.toBe(foreignId);
    expect(data.missing).toBe(false);
    expect(data.sha256).toBe(sceneSha);
    const rec = await assetRepo.get(data.assetId!);
    expect(rec?.sha256).toBe(sceneSha);
    expect(await assetRepo.get(foreignId)).toBeUndefined();
  });

  it('file cũ không có sha256 trên node → missing: true', async () => {
    const ws = await workspaceRepo.ensureDefault();
    const bytes = pngBytes(9);
    const hash = await sha256(new Blob([bytes.slice()], { type: 'image/png' }));

    const wfId = nanoid();
    const legacyWf: Workflow = {
      id: wfId,
      schemaVersion: SCHEMA_VERSION,
      workspaceId: ws.id,
      name: 'Legacy',
      enabled: false,
      locked: false,
      nodes: [
        {
          id: 'n1',
          type: 'asset',
          label: 'old',
          position: { x: 0, y: 0 },
          data: {
            assetId: 'legacy-local-id',
            kind: 'image',
            assetLabel: 'Character',
            mime: 'image/png',
            originalName: 'old.png',
            source: 'local',
            // no sha256
          },
        },
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      settings: { concurrency: 1, retry: 0, stopOnError: true },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const zipBlob = buildZip({
      workspace: { id: ws.id, name: 'Default' },
      workflow: legacyWf,
      assets: [{ sha256: hash, bytes, originalName: 'old.png' }],
    });
    const file = new File([zipBlob], 'legacy.xflow.zip', { type: 'application/zip' });

    const preview = await parseImportFile(file);
    const previewNode = preview.items[0]!.workflow.nodes[0]!;
    expect((previewNode.data as { missing?: boolean }).missing).toBe(true);
    expect(preview.items[0]!.warnings.length).toBeGreaterThan(0);
    expect(preview.items[0]!.assetCount).toBe(0);

    const created = await commitImport({
      preview,
      targetWorkspaceId: ws.id,
      dupStrategy: 'copy',
    });
    const data = created[0]!.nodes[0]!.data as { missing?: boolean; assetId?: string };
    expect(data.missing).toBe(true);
    expect(data.assetId).toBeUndefined();
  });

  it('export strips uploaded* from Asset nodes but keeps local image files', async () => {
    const ws = await workspaceRepo.ensureDefault();
    const hash = await hashOf(9);
    const asset = await assetRepo.put(pngBlob(9), 'keep.png', 'wf-up');
    expect(asset.sha256).toBe(hash);

    const wf = createEmptyWorkflow(ws.id, 'upload-strip');
    wf.id = 'wf-up';
    wf.schemaVersion = SCHEMA_VERSION;
    wf.nodes = [
      {
        id: 'a1',
        type: 'asset',
        position: { x: 0, y: 0 },
        data: {
          assetId: asset.id,
          kind: 'image',
          assetLabel: 'Character',
          source: 'local',
          uploadedMediaId: 'media-should-strip',
          uploadedProjectId: 'project-should-strip',
          uploadedSha256: hash,
        },
      },
    ];
    await workflowRepo.save(wf);

    // json + không kèm blob: fake-indexeddb mất bytes Blob dưới jsdom
    const result = await exportWorkflows({
      workflowIds: [wf.id],
      includeAssets: false,
      format: 'json',
    });
    const raw = JSON.parse(await result.blob.text()) as { workflowsData: Workflow[] };
    const data = raw.workflowsData[0]!.nodes[0]!.data as Record<string, unknown>;
    expect(data.uploadedMediaId).toBeUndefined();
    expect(data.uploadedProjectId).toBeUndefined();
    expect(data.uploadedSha256).toBeUndefined();
    expect(data.sha256).toBe(hash);
    expect(data.assetId).toBe(asset.id);
  });
});
