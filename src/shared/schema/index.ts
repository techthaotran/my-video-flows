import { z } from 'zod';

/**
 * v3: node Text gộp vào Prompt.
 * v4: Prompt có `continueFrameAssetId` (optional) - không cần biến đổi dữ liệu cũ.
 * v5: thêm node `mergeVideo` - node type mới, dữ liệu node cũ giữ nguyên shape.
 */
export const SCHEMA_VERSION = 5;
export const FORMAT_VERSION = 1;

export const PortTypeSchema = z.enum(['text', 'image', 'video', 'audio', 'any']);
export type PortType = z.infer<typeof PortTypeSchema>;

export const NodeTypeSchema = z.enum([
  'asset',
  'text',
  'prompt',
  'generateImage',
  'generateVideo',
  'mergeVideo',
  'autoDownload',
  'note',
  'unknown',
]);
export type NodeType = z.infer<typeof NodeTypeSchema>;

export const ASSET_LABELS = [
  'Outfit',
  'Background',
  'Character',
  'Video reference',
  'Video expand',
  'Audio voice',
] as const;
export type AssetLabel = (typeof ASSET_LABELS)[number];
export const AssetLabelSchema = z.enum(ASSET_LABELS);
/** Label duy nhất dành cho audio — đủ để tự chuyển khi người dùng chọn file audio. */
export const AUDIO_ASSET_LABEL: AssetLabel = 'Audio voice';

/** Labels mirror Flow's composer; rpc/batch.ts maps them to wire ids. */
export const IMAGE_MODELS = ['Nano Banana 2', 'Nano Banana 2 Lite'] as const;
export const VIDEO_MODELS = [
  'Omni Flash',
  'Veo 3.1 Lite',
  'Veo 3.1 Lite Low Priority',
  'Veo 3.1 Fast (Ultra)',
] as const;
export const DEFAULT_IMAGE_MODEL = IMAGE_MODELS[0];
export const DEFAULT_VIDEO_MODEL = VIDEO_MODELS[0];
export const VIDEO_DURATIONS = [4, 6, 8, 10] as const;

/** Labels saved by earlier builds, so old workflows still show a selected model. */
const LEGACY_MODEL_LABELS: Record<string, string> = {
  'nano banana pro': 'Nano Banana 2',
  'google nano banana': 'Nano Banana 2',
  imagen: 'Nano Banana 2',
  'gemini image': 'Nano Banana 2',
  'google omni flash': 'Omni Flash',
  veo: 'Veo 3.1 Lite',
  'gemini video': 'Veo 3.1 Fast (Ultra)',
};

export function normalizeModelLabel(model: string | undefined, fallback: string): string {
  if (!model) return fallback;
  return LEGACY_MODEL_LABELS[model.trim().toLowerCase()] ?? model;
}
export const ASPECT_RATIOS = ['9:16', '16:9', '1:1', '4:3', '3:4'] as const;
export const RESOLUTIONS = [720, 1080] as const;

export const ViewportSchema = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number(),
});

export const WorkflowSettingsSchema = z.object({
  concurrency: z.number().int().min(1).max(8).default(1),
  retry: z.number().int().min(0).max(10).default(2),
  stopOnError: z.boolean().default(true),
  downloadFolder: z.string().optional(),
});

export const AssetNodeDataSchema = z.object({
  assetId: z.string().optional(),
  kind: z.enum(['image', 'video', 'audio']).optional(),
  assetLabel: AssetLabelSchema.default('Character'),
  slug: z.string().optional(),
  mime: z.string().optional(),
  missing: z.boolean().optional(),
  originalName: z.string().optional(),
  /** Nguồn file — local picker hoặc import từ Google Flow */
  source: z.enum(['local', 'flow']).optional(),
  /**
   * Asset đã có trên Flow: chỉ giữ media id, không tải blob về và không bao
   * giờ upload lại khi run.
   */
  flowMediaId: z.string().optional(),
  /** Signed URL lúc chọn — chỉ để preview, có thể hết hạn. */
  flowPreviewUrl: z.string().optional(),
});

export const TextNodeDataSchema = z.object({
  content: z.string().default(''),
  slug: z.string().optional(),
});

export const PromptNodeDataSchema = z.object({
  provider: z.literal('gemini').default('gemini'),
  model: z.string().default(''),
  preset: z
    .enum(['enhance', 'analyzeImage', 'script', 'summarize', 'translate', 'brainstorm', 'custom'])
    .default('custom'),
  instruction: z.string().default(''),
  outputFormat: z.enum(['plain', 'json']).default('plain'),
  newChat: z.boolean().default(true),
  /** Output của lần chạy gần nhất (read-only trên UI). */
  formattedOutput: z.string().optional(),
  /**
   * Asset (IndexedDB) giữ frame cuối của cảnh trước lần nối gần nhất.
   * Vẫn chuyển tiếp khi đã xoá liên kết tới Generate Video trước; xoá field để tạo cảnh mới.
   */
  continueFrameAssetId: z.string().optional(),
});

export const GenerateImageNodeDataSchema = z.object({
  prompt: z.string().default(''),
  model: z.string().default(DEFAULT_IMAGE_MODEL),
  aspectRatio: z.string().default('9:16'),
  count: z.number().int().min(1).max(4).default(1),
  resolution: z.number().int().default(720),
  timeoutSec: z.number().int().min(30).max(3600).default(600),
  retry: z.number().int().min(0).max(10).optional(),
  previewOutputId: z.string().optional(),
});

export const GenerateVideoNodeDataSchema = z.object({
  prompt: z.string().default(''),
  model: z.string().default(DEFAULT_VIDEO_MODEL),
  aspectRatio: z.string().default('9:16'),
  count: z.number().int().min(1).max(4).default(1),
  resolution: z.number().int().default(720),
  durationSec: z.number().int().min(1).max(30).default(4),
  timeoutSec: z.number().int().min(30).max(3600).default(600),
  retry: z.number().int().min(0).max(10).optional(),
  previewOutputId: z.string().optional(),
});

/** Vị trí + kích thước logo tính theo % khung hình, nên đổi resolution vẫn đúng chỗ. */
export const MergeVideoNodeDataSchema = z.object({
  /**
   * Thứ tự ghép, theo id node nguồn. Node nguồn mới nối vào mà chưa có trong
   * danh sách sẽ được ghép sau cùng.
   */
  order: z.array(z.string()).default([]),
  fps: z.number().int().min(1).max(60).default(30),
  bitrateMbps: z.number().min(0.5).max(50).default(8),
  /** Giây bắt đầu cắt audio; điểm kết thúc luôn bằng tổng độ dài video. */
  audioStartSec: z.number().min(0).default(0),
  logoXPercent: z.number().min(0).max(100).default(4),
  logoYPercent: z.number().min(0).max(100).default(4),
  logoWidthPercent: z.number().min(1).max(100).default(18),
  logoOpacity: z.number().min(0).max(100).default(100),
  previewOutputId: z.string().optional(),
});

export const AutoDownloadNodeDataSchema = z.object({
  folderTemplate: z.string().default('MyXFlows/{{workflow}}/{{date}}'),
  filenameTemplate: z.string().default('{{slug}}_{{index}}'),
  conflict: z.enum(['uniquify', 'overwrite']).default('uniquify'),
  onlyWhenAllDone: z.boolean().default(false),
});

export const NoteNodeDataSchema = z.object({
  content: z.string().default(''),
  color: z.string().default('#1e3a5f'),
  fontSize: z.number().default(13),
  size: z.object({ w: z.number(), h: z.number() }).optional(),
});

export const UnknownNodeDataSchema = z.object({
  originalType: z.string(),
  raw: z.unknown().optional(),
});

export const NodeDataSchemas = {
  asset: AssetNodeDataSchema,
  text: TextNodeDataSchema,
  prompt: PromptNodeDataSchema,
  generateImage: GenerateImageNodeDataSchema,
  generateVideo: GenerateVideoNodeDataSchema,
  mergeVideo: MergeVideoNodeDataSchema,
  autoDownload: AutoDownloadNodeDataSchema,
  note: NoteNodeDataSchema,
  unknown: UnknownNodeDataSchema,
} as const;

export type NodeDataMap = {
  [K in keyof typeof NodeDataSchemas]: z.infer<(typeof NodeDataSchemas)[K]>;
};

export function isAssetNodeType(type: string): type is 'asset' {
  return type === 'asset';
}

export function defaultKindForLabel(label: AssetLabel): 'image' | 'video' | 'audio' {
  if (label === 'Audio voice') return 'audio';
  if (label === 'Video reference' || label === 'Video expand') return 'video';
  return 'image';
}

export const WorkflowNodeSchema = z.object({
  id: z.string(),
  type: NodeTypeSchema,
  slug: z.string().optional(),
  label: z.string().optional(),
  position: z.object({ x: z.number(), y: z.number() }),
  size: z.object({ w: z.number(), h: z.number() }).optional(),
  data: z.record(z.unknown()).default({}),
  disabled: z.boolean().optional(),
});

export const WorkflowEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  sourceHandle: z.string(),
  target: z.string(),
  targetHandle: z.string(),
  type: PortTypeSchema,
});

export const WorkflowSchema = z
  .object({
    id: z.string(),
    schemaVersion: z.number().int().default(SCHEMA_VERSION),
    workspaceId: z.string(),
    name: z.string().min(1),
    enabled: z.boolean().default(false),
    locked: z.boolean().default(false),
    nodes: z.array(WorkflowNodeSchema).default([]),
    edges: z.array(WorkflowEdgeSchema).default([]),
    viewport: ViewportSchema.default({ x: 0, y: 0, zoom: 1 }),
    settings: WorkflowSettingsSchema.default({}),
    createdAt: z.number(),
    updatedAt: z.number(),
    sourceTemplateId: z.string().optional(),
    deletedAt: z.number().optional(),
  })
  .strict();

export type Workflow = z.infer<typeof WorkflowSchema>;
export type WorkflowNode = z.infer<typeof WorkflowNodeSchema>;
export type WorkflowEdge = z.infer<typeof WorkflowEdgeSchema>;
export type WorkflowSettings = z.infer<typeof WorkflowSettingsSchema>;

export const WorkspaceSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  isCurrent: z.boolean().default(false),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type Workspace = z.infer<typeof WorkspaceSchema>;

export const AssetSchema = z.object({
  id: z.string(),
  sha256: z.string(),
  workflowId: z.string().optional(),
  mime: z.string(),
  size: z.number(),
  originalName: z.string(),
  kind: z.enum(['image', 'video', 'audio', 'other']).default('other'),
  createdAt: z.number(),
});
export type AssetMeta = z.infer<typeof AssetSchema>;

export const TemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().default(''),
  category: z.string().default('general'),
  tags: z.array(z.string()).default([]),
  thumbnail: z.string().optional(),
  workflow: WorkflowSchema.omit({ workspaceId: true, enabled: true }).passthrough(),
  builtIn: z.boolean().default(false),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type Template = z.infer<typeof TemplateSchema>;

export const RunStatusSchema = z.enum(['queued', 'running', 'success', 'error', 'cancelled']);
export type RunStatus = z.infer<typeof RunStatusSchema>;

export const NodeRunStatusSchema = z.enum([
  'queued',
  'running',
  'success',
  'error',
  'skipped',
  'cancelled',
]);
export type NodeRunStatus = z.infer<typeof NodeRunStatusSchema>;

export const RunSchema = z.object({
  id: z.string(),
  workflowId: z.string(),
  status: RunStatusSchema,
  startedAt: z.number(),
  finishedAt: z.number().optional(),
  error: z.string().optional(),
  fromNodeId: z.string().optional(),
  mode: z.enum(['full', 'node', 'only', 'from', 'runAll']).default('full'),
});
export type Run = z.infer<typeof RunSchema>;

export const NodeRunSchema = z.object({
  id: z.string(),
  runId: z.string(),
  nodeId: z.string(),
  status: NodeRunStatusSchema,
  progress: z.number().min(0).max(100).optional(),
  message: z.string().optional(),
  error: z.string().optional(),
  errorCode: z.string().optional(),
  outputIds: z.array(z.string()).default([]),
  startedAt: z.number().optional(),
  finishedAt: z.number().optional(),
  inputHash: z.string().optional(),
  logs: z.array(z.object({ ts: z.number(), message: z.string() })).default([]),
});
export type NodeRun = z.infer<typeof NodeRunSchema>;

export const OutputSchema = z.object({
  id: z.string(),
  nodeRunId: z.string(),
  kind: z.enum(['text', 'image', 'video', 'audio', 'any']),
  mime: z.string().optional(),
  text: z.string().optional(),
  size: z.number().optional(),
  /** Media id trên Google Flow của kết quả generate - để dùng lại mà không upload. */
  flowMediaId: z.string().optional(),
  createdAt: z.number(),
});
export type OutputMeta = z.infer<typeof OutputSchema>;

export const ExportManifestSchema = z
  .object({
    format: z.literal('my-x-flows'),
    formatVersion: z.number().int(),
    kind: z.enum(['workflows', 'workspace', 'backup']),
    appVersion: z.string(),
    exportedAt: z.string(),
    workspaces: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
    workflows: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        schemaVersion: z.number(),
        path: z.string(),
        nodeCount: z.number(),
      }),
    ),
    assets: z.array(
      z.object({
        sha256: z.string(),
        mime: z.string(),
        size: z.number(),
        path: z.string().optional(),
        originalName: z.string(),
      }),
    ),
    includes: z.object({
      assets: z.boolean(),
      outputs: z.boolean(),
      runs: z.boolean(),
    }),
  })
  .strict();

export type ExportManifest = z.infer<typeof ExportManifestSchema>;

export const AppSettingsSchema = z.object({
  downloadFolder: z.string().default('MyXFlows'),
  importMaxZipMb: z.number().default(2048),
  importMaxJsonMb: z.number().default(20),
  defaultConcurrency: z.number().int().min(1).max(8).default(1),
  defaultGeminiModel: z.string().default(''),
  remoteConfigUrl: z.string().default(''),
  maxSpeed: z.boolean().default(false),
  remindBackupDays: z.number().optional(),
});
export type AppSettings = z.infer<typeof AppSettingsSchema>;

function migrateNode(n: Record<string, unknown>): Record<string, unknown> {
  const type = String(n.type ?? '');
  const data = (typeof n.data === 'object' && n.data !== null ? n.data : {}) as Record<
    string,
    unknown
  >;

  if (type === 'media' || type === 'image' || type === 'video') {
    const kind =
      type === 'video' || data.kind === 'video'
        ? 'video'
        : type === 'image' || data.kind === 'image'
          ? 'image'
          : data.kind === 'audio'
            ? 'audio'
            : 'image';
    const assetLabel =
      typeof data.assetLabel === 'string' && ASSET_LABELS.includes(data.assetLabel as AssetLabel)
        ? data.assetLabel
        : kind === 'video'
          ? 'Video reference'
          : kind === 'audio'
            ? 'Audio voice'
            : 'Character';
    return {
      ...n,
      type: 'asset',
      data: { ...data, kind, assetLabel },
    };
  }

  if (type === 'text') {
    // Text tĩnh = Prompt không có input; handle out:text giữ nguyên nên edge không đổi.
    return {
      ...n,
      type: 'prompt',
      data: PromptNodeDataSchema.parse({ instruction: String(data.content ?? '') }),
    };
  }

  if (type === 'flowGenerate') {
    const mode = String(data.mode ?? 'auto');
    if (mode === 'text-to-image') {
      return {
        ...n,
        type: 'generateImage',
        data: {
          model: normalizeModelLabel(data.model as string | undefined, DEFAULT_IMAGE_MODEL),
          aspectRatio: data.aspectRatio || '9:16',
          count: data.outputsPerPrompt ?? 1,
          resolution: 720,
          timeoutSec: data.timeoutSec ?? 600,
          retry: data.retry,
        },
      };
    }
    return {
      ...n,
      type: 'generateVideo',
      data: {
        model: normalizeModelLabel(data.model as string | undefined, DEFAULT_VIDEO_MODEL),
        aspectRatio: data.aspectRatio || '9:16',
        count: data.outputsPerPrompt ?? 1,
        resolution: 720,
        durationSec: 4,
        timeoutSec: data.timeoutSec ?? 600,
        retry: data.retry,
      },
    };
  }

  if (type === 'geminiGenerate') {
    if (data.kind === 'video') {
      return {
        ...n,
        type: 'generateVideo',
        data: {
          model: normalizeModelLabel(data.model as string | undefined, DEFAULT_VIDEO_MODEL),
          aspectRatio: '9:16',
          count: 1,
          resolution: 720,
          durationSec: 4,
          timeoutSec: data.timeoutSec ?? 300,
          retry: data.retry,
        },
      };
    }
    return {
      ...n,
      type: 'generateImage',
      data: {
        model: normalizeModelLabel(data.model as string | undefined, DEFAULT_IMAGE_MODEL),
        aspectRatio: '9:16',
        count: 1,
        resolution: 720,
        timeoutSec: data.timeoutSec ?? 300,
        retry: data.retry,
      },
    };
  }

  return n;
}

export function migrateWorkflow(raw: unknown): Workflow {
  const obj = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  let current = { ...obj };

  if (Array.isArray(current.nodes)) {
    current.nodes = (current.nodes as Record<string, unknown>[]).map((n) => {
      const migrated = migrateNode(n);
      const parsed = NodeTypeSchema.safeParse(migrated.type);
      if (!parsed.success || parsed.data === 'unknown') {
        return {
          ...migrated,
          type: 'unknown',
          data: { originalType: String(n.type ?? 'unknown'), raw: n.data },
        };
      }
      return migrated;
    });
  }

  // Remap legacy edge handles if needed — keep as-is
  return WorkflowSchema.parse({
    ...current,
    schemaVersion: SCHEMA_VERSION,
    createdAt: current.createdAt ?? Date.now(),
    updatedAt: current.updatedAt ?? Date.now(),
  });
}

/** Nâng cấp workflow đã lưu trong IndexedDB (không đi qua import). */
export function upgradeStoredWorkflow(wf: Workflow): Workflow {
  if ((wf.schemaVersion ?? 0) >= SCHEMA_VERSION) return wf;
  return {
    ...wf,
    schemaVersion: SCHEMA_VERSION,
    nodes: wf.nodes.map((n) => migrateNode(n as Record<string, unknown>) as WorkflowNode),
  };
}

export function validateNodeData(type: NodeType, data: unknown) {
  const schema = NodeDataSchemas[type as keyof typeof NodeDataSchemas];
  if (!schema) return data ?? {};
  return schema.parse(data ?? {});
}
