import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import type { ExportManifest, Workflow, Workspace } from '@/shared/schema';
import { ExportManifestSchema, FORMAT_VERSION, migrateWorkflow, isAssetNodeType } from '@/shared/schema';
import { db } from '@/storage/db';
import { assetRepo } from '@/storage/repos/assetRepo';
import { workflowRepo } from '@/storage/repos/workflowRepo';
import { formatBytes, nanoid, slugifyFilename } from '@/shared/utils';

/** Asset nodes backed by a local file. Flow assets are a media id only — nothing to pack or rematch. */
function isLocalAssetNode(n: { type: string; data: unknown }): boolean {
  return isAssetNodeType(n.type) && !(n.data as { flowMediaId?: string }).flowMediaId;
}

const APP_VERSION = '0.1.0';

export interface ExportOptions {
  workflowIds: string[];
  includeAssets?: boolean;
  includeOutputs?: boolean;
  format?: 'zip' | 'json';
  kind?: ExportManifest['kind'];
  workspaceIds?: string[];
}

export interface ExportResult {
  blob: Blob;
  filename: string;
  manifest: ExportManifest;
  summary: { workflows: number; nodes: number; assets: number; sizeLabel: string };
}

function stripRuntime(wf: Workflow): Workflow {
  const clone = structuredClone(wf);
  // Remove deletedAt and ensure stable key order via JSON roundtrip later
  delete clone.deletedAt;
  return clone;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return Object.keys(v as object)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = (v as Record<string, unknown>)[k];
          return acc;
        }, {});
    }
    return v;
  }, 2);
}

export async function exportWorkflows(opts: ExportOptions): Promise<ExportResult> {
  const includeAssets = opts.includeAssets ?? true;
  const includeOutputs = opts.includeOutputs ?? false;
  const format = opts.format ?? 'zip';
  const kind = opts.kind ?? 'workflows';

  const workflows: Workflow[] = [];
  for (const id of opts.workflowIds) {
    const wf = await workflowRepo.get(id);
    if (wf) workflows.push(stripRuntime(wf));
  }

  const assetHashes = new Map<string, { mime: string; size: number; originalName: string; blob: Blob }>();
  if (includeAssets) {
    for (const wf of workflows) {
      for (const n of wf.nodes) {
        if (isAssetNodeType(n.type)) {
          const assetId = (n.data as { assetId?: string }).assetId;
          if (!assetId) continue;
          const asset = await assetRepo.get(assetId);
          if (!asset) continue;
          assetHashes.set(asset.sha256, {
            mime: asset.mime,
            size: asset.size,
            originalName: asset.originalName,
            blob: asset.blob,
          });
        }
      }
    }
  }

  const workspaces: { id: string; name: string }[] = [];
  if (opts.workspaceIds?.length) {
    for (const id of opts.workspaceIds) {
      const ws = await db.workspaces.get(id);
      if (ws) workspaces.push({ id: ws.id, name: ws.name });
    }
  } else {
    const ids = new Set(workflows.map((w) => w.workspaceId));
    for (const id of ids) {
      const ws = await db.workspaces.get(id);
      if (ws) workspaces.push({ id: ws.id, name: ws.name });
    }
  }

  const manifest: ExportManifest = {
    format: 'my-x-flows',
    formatVersion: FORMAT_VERSION,
    kind,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    workspaces,
    workflows: workflows.map((w) => ({
      id: w.id,
      name: w.name,
      schemaVersion: w.schemaVersion,
      path: `workflows/${w.id}.json`,
      nodeCount: w.nodes.length,
    })),
    assets: [...assetHashes.entries()].map(([sha256, a]) => ({
      sha256,
      mime: a.mime,
      size: a.size,
      path: `assets/${sha256}${extFromMime(a.mime)}`,
      originalName: a.originalName,
    })),
    includes: { assets: includeAssets, outputs: includeOutputs, runs: false },
  };

  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace('T', '-')
    .slice(0, 13);
  const baseName =
    workflows.length === 1
      ? `${slugifyFilename(workflows[0]!.name)}-${stamp}`
      : `my-x-flows-${stamp}`;

  if (format === 'json') {
    const payload = { ...manifest, workflowsData: workflows };
    const text = stableStringify(payload);
    const blob = new Blob([text], { type: 'application/json' });
    return {
      blob,
      filename: `${baseName}.xflow.json`,
      manifest,
      summary: {
        workflows: workflows.length,
        nodes: workflows.reduce((s, w) => s + w.nodes.length, 0),
        assets: 0,
        sizeLabel: formatBytes(blob.size),
      },
    };
  }

  const files: Record<string, Uint8Array> = {
    'manifest.json': strToU8(stableStringify(manifest)),
  };
  for (const wf of workflows) {
    files[`workflows/${wf.id}.json`] = strToU8(stableStringify(wf));
  }
  for (const [sha, a] of assetHashes) {
    const buf = new Uint8Array(await a.blob.arrayBuffer());
    files[`assets/${sha}${extFromMime(a.mime)}`] = buf;
  }

  const zipped = zipSync(files, { level: 6 });
  const blob = new Blob([zipped], { type: 'application/zip' });
  const ext = kind === 'backup' ? '.xflow-backup.zip' : '.xflow.zip';
  return {
    blob,
    filename: `${baseName}${ext}`,
    manifest,
    summary: {
      workflows: workflows.length,
      nodes: workflows.reduce((s, w) => s + w.nodes.length, 0),
      assets: assetHashes.size,
      sizeLabel: formatBytes(blob.size),
    },
  };
}

export async function exportBackup(): Promise<ExportResult> {
  const all = await workflowRepo.listAllIncludingDeleted();
  const ids = all.filter((w) => !w.deletedAt).map((w) => w.id);
  const ws = await db.workspaces.toArray();
  return exportWorkflows({
    workflowIds: ids,
    workspaceIds: ws.map((w) => w.id),
    includeAssets: true,
    includeOutputs: false,
    format: 'zip',
    kind: 'backup',
  });
}

function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
  };
  return map[mime] ?? '';
}

export interface ImportPreviewItem {
  id: string;
  name: string;
  nodeCount: number;
  assetCount: number;
  warnings: string[];
  workflow: Workflow;
}

export interface ImportPreview {
  manifest: ExportManifest;
  items: ImportPreviewItem[];
  assetBlobs: Map<string, Blob>;
  workspaces: { id: string; name: string }[];
}

export type DupStrategy = 'copy' | 'overwrite' | 'skip';

export interface ImportCommitOptions {
  preview: ImportPreview;
  targetWorkspaceId: string;
  dupStrategy: DupStrategy;
  createWorkspaceFromFile?: boolean;
}

function assertSafePath(path: string): void {
  if (path.includes('..') || path.startsWith('/') || path.includes('\\')) {
    throw new Error(`Đường dẫn không an toàn: ${path}`);
  }
  const allowed =
    path === 'manifest.json' ||
    path.startsWith('workflows/') ||
    path.startsWith('assets/') ||
    path.startsWith('outputs/');
  if (!allowed) throw new Error(`Entry không được phép: ${path}`);
}

async function readAsText(file: Blob): Promise<string> {
  if (typeof file.text === 'function') return file.text();
  if (typeof file.arrayBuffer === 'function') {
    return new TextDecoder().decode(await file.arrayBuffer());
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
    reader.readAsText(file);
  });
}

async function readAsArrayBuffer(file: Blob): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === 'function') return file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
    reader.readAsArrayBuffer(file);
  });
}

export async function parseImportFile(file: File, limits?: { maxZipMb?: number; maxJsonMb?: number }): Promise<ImportPreview> {
  const maxZip = (limits?.maxZipMb ?? 2048) * 1024 * 1024;
  const maxJson = (limits?.maxJsonMb ?? 20) * 1024 * 1024;

  if (file.name.endsWith('.json') || file.type === 'application/json') {
    if (file.size > maxJson) throw new Error('File JSON vượt giới hạn kích thước');
    const text = await readAsText(file);
    const raw = JSON.parse(text) as Record<string, unknown>;
    const manifest = ExportManifestSchema.parse({
      format: raw.format ?? 'my-x-flows',
      formatVersion: raw.formatVersion ?? 1,
      kind: raw.kind ?? 'workflows',
      appVersion: raw.appVersion ?? '0.0.0',
      exportedAt: raw.exportedAt ?? new Date().toISOString(),
      workspaces: raw.workspaces,
      workflows: raw.workflows ?? (raw.workflowsData as unknown[])?.map((w: unknown, i: number) => {
        const wf = w as Workflow;
        return {
          id: wf.id,
          name: wf.name,
          schemaVersion: wf.schemaVersion,
          path: `inline:${i}`,
          nodeCount: wf.nodes?.length ?? 0,
        };
      }) ?? [],
      assets: raw.assets ?? [],
      includes: raw.includes ?? { assets: false, outputs: false, runs: false },
    });
    if (manifest.formatVersion > FORMAT_VERSION) {
      throw new Error('File được tạo từ phiên bản mới hơn, hãy cập nhật extension');
    }

    const workflowsData = (raw.workflowsData as unknown[]) ?? [];
    const items: ImportPreviewItem[] = workflowsData.map((w) => {
      const migrated = migrateWorkflow(w);
      return {
        id: migrated.id,
        name: migrated.name,
        nodeCount: migrated.nodes.length,
        assetCount: 0,
        warnings: migrated.nodes.some((n) => isLocalAssetNode(n))
          ? ['Thiếu file media (json)']
          : [],
        workflow: {
          ...migrated,
          nodes: migrated.nodes.map((n) =>
            isLocalAssetNode(n)
              ? { ...n, data: { ...n.data, missing: true, assetId: undefined } }
              : n,
          ),
        },
      };
    });

    return {
      manifest,
      items,
      assetBlobs: new Map(),
      workspaces: manifest.workspaces ?? [],
    };
  }

  // zip
  if (file.size > maxZip) throw new Error('File zip vượt giới hạn kích thước');
  const buf = new Uint8Array(await readAsArrayBuffer(file));
  let unzipped: Record<string, Uint8Array>;
  try {
    unzipped = unzipSync(buf);
  } catch {
    throw new Error('Không giải nén được file zip');
  }

  let totalUncompressed = 0;
  for (const [path, data] of Object.entries(unzipped)) {
    assertSafePath(path);
    totalUncompressed += data.byteLength;
    if (totalUncompressed > maxZip * 2) throw new Error('Zip bomb bị từ chối');
  }

  const manifestRaw = unzipped['manifest.json'];
  if (!manifestRaw) throw new Error('Thiếu manifest.json');
  const manifest = ExportManifestSchema.parse(JSON.parse(strFromU8(manifestRaw)));
  if (manifest.formatVersion > FORMAT_VERSION) {
    throw new Error('File được tạo từ phiên bản mới hơn, hãy cập nhật extension');
  }

  const assetBlobs = new Map<string, Blob>();
  for (const a of manifest.assets) {
    const path = a.path ?? `assets/${a.sha256}`;
    assertSafePath(path);
    const data = unzipped[path];
    if (!data) {
      // try without exact path
      const found = Object.keys(unzipped).find((p) => p.startsWith(`assets/${a.sha256}`));
      if (!found) continue;
      assetBlobs.set(a.sha256, new Blob([unzipped[found]!.slice()], { type: a.mime }));
    } else {
      assetBlobs.set(a.sha256, new Blob([data.slice()], { type: a.mime }));
    }
  }

  const items: ImportPreviewItem[] = [];
  for (const entry of manifest.workflows) {
    assertSafePath(entry.path);
    const data = unzipped[entry.path];
    if (!data) throw new Error(`Thiếu workflow: ${entry.path}`);
    const migrated = migrateWorkflow(JSON.parse(strFromU8(data)));
    const warnings: string[] = [];
    let assetCount = 0;
    const nodes = migrated.nodes.map((n) => {
      if (!isLocalAssetNode(n)) return n;
      const d = n.data as { assetId?: string; sha256?: string };
      // look up by referencing assets in file via original asset linkage — use sha from companion if present
      const sha =
        (n.data as { sha256?: string }).sha256 ??
        [...assetBlobs.keys()].find(() => false);
      void d;
      void sha;
      // Assets are rematched on commit by scanning; mark missing if no assets at all
      if (assetBlobs.size === 0 && (n.data as { assetId?: string }).assetId) {
        warnings.push(`Thiếu media cho node ${n.label ?? n.id}`);
        return { ...n, data: { ...n.data, missing: true } };
      }
      assetCount++;
      return n;
    });
    if (migrated.schemaVersion !== migrated.schemaVersion) warnings.push('Đã migrate schema');
    items.push({
      id: migrated.id,
      name: migrated.name,
      nodeCount: migrated.nodes.length,
      assetCount,
      warnings: [...new Set(warnings)],
      workflow: { ...migrated, nodes },
    });
  }

  return {
    manifest,
    items,
    assetBlobs,
    workspaces: manifest.workspaces ?? [],
  };
}

export async function commitImport(opts: ImportCommitOptions): Promise<Workflow[]> {
  const { preview, targetWorkspaceId, dupStrategy } = opts;
  const created: Workflow[] = [];

  await db.transaction('rw', db.workflows, db.workspaces, db.assets, db.workflowRevisions, async () => {
    let workspaceId = targetWorkspaceId;

    if (opts.createWorkspaceFromFile && preview.workspaces[0]) {
      const now = Date.now();
      const ws: Workspace = {
        id: nanoid(),
        name: preview.workspaces[0].name,
        isCurrent: false,
        createdAt: now,
        updatedAt: now,
      };
      await db.workspaces.add(ws);
      workspaceId = ws.id;
    }

    // Import assets first
    const hashToAssetId = new Map<string, string>();
    for (const [sha, blob] of preview.assetBlobs) {
      const meta = preview.manifest.assets.find((a) => a.sha256 === sha);
      const rec = await assetRepo.putFromHash(sha, blob, {
        mime: meta?.mime ?? blob.type,
        originalName: meta?.originalName ?? sha,
        workflowId: undefined,
      });
      hashToAssetId.set(sha, rec.id);
    }

    for (const item of preview.items) {
      const existing = await db.workflows.get(item.id);
      const nameClash = await db.workflows
        .where('workspaceId')
        .equals(workspaceId)
        .filter((w) => w.name === item.name && !w.deletedAt)
        .first();

      if (existing || nameClash) {
        if (dupStrategy === 'skip') continue;
        if (dupStrategy === 'overwrite' && existing) {
          // save revision of old
          await db.workflowRevisions.add({
            id: nanoid(),
            workflowId: existing.id,
            workflow: existing,
            createdAt: Date.now(),
          });
          const updated = remapMediaAssets(
            { ...item.workflow, id: existing.id, workspaceId, enabled: false, updatedAt: Date.now() },
            hashToAssetId,
            preview,
          );
          await db.workflows.put(updated);
          created.push(updated);
          continue;
        }
      }

      // copy (default)
      const newId = nanoid();
      let name = item.name;
      if (nameClash || existing) name = `${item.name} (nhập)`;
      const wf = remapMediaAssets(
        {
          ...item.workflow,
          id: newId,
          workspaceId,
          name,
          enabled: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          deletedAt: undefined,
        },
        hashToAssetId,
        preview,
      );
      await db.workflows.add(wf);
      created.push(wf);
    }
  });

  return created;
}

function remapMediaAssets(
  wf: Workflow,
  hashToAssetId: Map<string, string>,
  preview: ImportPreview,
): Workflow {
  // Match assets: if node has sha256 in data use it; else try single-asset heuristic via manifest order
  const hashes = [...hashToAssetId.keys()];
  let hashIdx = 0;
  return {
    ...wf,
    nodes: wf.nodes.map((n) => {
      if (!isLocalAssetNode(n)) return n;
      const data = { ...n.data } as Record<string, unknown>;
      const sha = typeof data.sha256 === 'string' ? data.sha256 : undefined;
      if (sha && hashToAssetId.has(sha)) {
        data.assetId = hashToAssetId.get(sha);
        data.missing = false;
      } else if (hashes[hashIdx] && preview.assetBlobs.size > 0) {
        // Best-effort: assign next available asset for media nodes that had assets
        if (data.assetId || data.missing) {
          data.assetId = hashToAssetId.get(hashes[hashIdx]!);
          data.sha256 = hashes[hashIdx];
          data.missing = false;
          hashIdx++;
        }
      } else if (!hashToAssetId.size) {
        data.missing = true;
        data.assetId = undefined;
      }
      return { ...n, data };
    }),
  };
}

/** Remap node/edge ids when inserting into an open workflow */
export function remapInsertNodes(
  source: Workflow,
  existingSlugs: Set<string>,
): { nodes: Workflow['nodes']; edges: Workflow['edges']; slugMap: Map<string, string> } {
  const idMap = new Map<string, string>();
  const slugMap = new Map<string, string>();

  const nodes = source.nodes.map((n) => {
    const newId = nanoid();
    idMap.set(n.id, newId);
    let slug = n.slug;
    if (slug) {
      let next = slug;
      let i = 2;
      while (existingSlugs.has(next) || [...slugMap.values()].includes(next)) {
        next = `${slug}_${i++}`;
      }
      if (next !== slug) slugMap.set(slug, next);
      existingSlugs.add(next);
      slug = next;
    }
    const data = { ...n.data } as Record<string, unknown>;
    if (typeof data.slug === 'string' && slugMap.has(data.slug)) {
      data.slug = slugMap.get(data.slug);
    } else if (slug) {
      data.slug = slug;
    }
    // Update @slug refs in text content
    if (typeof data.content === 'string') {
      data.content = replaceSlugs(data.content, slugMap);
    }
    if (typeof data.instruction === 'string') {
      data.instruction = replaceSlugs(data.instruction, slugMap);
    }
    return { ...n, id: newId, slug, data };
  });

  // Second pass for prompt/text refs across all nodes
  for (const n of nodes) {
    const data = n.data as Record<string, unknown>;
    if (typeof data.content === 'string') data.content = replaceSlugs(data.content, slugMap);
    if (typeof data.instruction === 'string') data.instruction = replaceSlugs(data.instruction, slugMap);
  }

  const edges = source.edges.map((e) => ({
    ...e,
    id: nanoid(),
    source: idMap.get(e.source) ?? e.source,
    target: idMap.get(e.target) ?? e.target,
  }));

  return { nodes, edges, slugMap };
}

function replaceSlugs(text: string, slugMap: Map<string, string>): string {
  let out = text;
  for (const [from, to] of slugMap) {
    out = out.replaceAll(`@${from}`, `@${to}`);
  }
  return out;
}
