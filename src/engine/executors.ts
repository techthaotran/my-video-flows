import { FLOW_NO_UPLOAD, type ExecutorContext, type NodeExecutor, type NodeOutputValue } from '@/engine/types';
import { annotateAssetLabels, composePrompt, resolveTemplate, type AssetRef } from '@/engine/resolver';
import type { FlowGenerateRef } from '@/shared/messaging';
import { parseFlowMediaUrl } from '@/providers/flow/media';
import type {
  AssetNodeDataSchema,
  AutoDownloadNodeDataSchema,
  GenerateImageNodeDataSchema,
  GenerateVideoNodeDataSchema,
  PromptNodeDataSchema,
} from '@/shared/schema';
import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_VIDEO_MODEL,
  normalizeModelLabel,
} from '@/shared/schema';
import type { z } from 'zod';

type AssetData = z.infer<typeof AssetNodeDataSchema>;
type PromptData = z.infer<typeof PromptNodeDataSchema>;
type GenImageData = z.infer<typeof GenerateImageNodeDataSchema>;
type GenVideoData = z.infer<typeof GenerateVideoNodeDataSchema>;
type DownloadData = z.infer<typeof AutoDownloadNodeDataSchema>;

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function b64ToBlob(b64: string, mime: string): Blob {
  return new Blob([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], { type: mime });
}

function fail(message: string, code = 'UNKNOWN'): Error {
  return Object.assign(new Error(message), { code });
}

/** Every value that reached this node, whichever handle it came in on. */
function allInputs(ctx: ExecutorContext): NodeOutputValue[] {
  return Object.values(ctx.inputs).flat();
}

/** One entry per referenced media — the same asset can arrive directly and via a Prompt. */
function dedupeRefs(values: NodeOutputValue[]): NodeOutputValue[] {
  const seen = new Set<string>();
  return values.filter((v) => {
    const key = v.flowMediaId
      ? `flow:${v.flowMediaId}`
      : v.localAssetId
        ? `local:${v.localAssetId}`
        : v.outputId
          ? `out:${v.outputId}`
          : '';
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function refsOf(values: NodeOutputValue[]): NodeOutputValue[] {
  return dedupeRefs(values.filter((v) => v.role === 'ref' && v.kind !== 'text'));
}

function asAssetRefs(refs: NodeOutputValue[]): AssetRef[] {
  return refs
    .filter((r) => r.assetLabel)
    .map((r) => ({ label: r.assetLabel!, kind: r.kind, flowMediaId: r.flowMediaId }));
}

/** The most recent previous clip a Prompt forwarded (or that was wired in). */
function continuationOf(values: NodeOutputValue[]): NodeOutputValue | undefined {
  return values.filter((v) => v.role === 'continuation' && v.kind === 'video').at(-1);
}

/**
 * Asset node: a Flow asset is only its media id — nothing is downloaded or
 * uploaded. A local file is handed on as a blob and uploaded once per run.
 */
export const assetExecutor: NodeExecutor = async (ctx) => {
  const data = ctx.node.data as AssetData;
  const label = data.assetLabel;

  if (data.flowMediaId) {
    return [
      { kind: data.kind ?? 'image', flowMediaId: data.flowMediaId, assetLabel: label, name: label, fromAsset: true, fromFlow: true },
    ];
  }
  if (data.source === 'flow') {
    throw fail(
      `Asset [${label}] lấy từ Google Flow nhưng mất media id — chọn lại từ Flow (asset Flow không được upload lại)`,
      FLOW_NO_UPLOAD,
    );
  }

  if (!data.assetId || data.missing) throw fail(`Asset [${label}] chưa chọn file`, 'UPLOAD_FAILED');
  const blob = await ctx.getAsset(data.assetId);
  if (!blob) throw fail(`Không tìm thấy file của asset [${label}]`, 'UPLOAD_FAILED');
  const kind =
    data.kind ??
    (blob.type.startsWith('video/') ? 'video' : blob.type.startsWith('audio/') ? 'audio' : 'image');
  return [
    { kind, blob, mime: blob.type, name: label, assetLabel: label, localAssetId: data.assetId, fromAsset: true },
  ];
};

const PRESET_SYSTEM: Record<string, string> = {
  enhance: 'Enhance and improve the following prompt for generative AI video/image.',
  analyzeImage: 'Analyze the provided image(s) in detail.',
  script: 'Write a short video script based on the inputs.',
  summarize: 'Summarize the following content concisely.',
  translate: 'Translate the following content to Vietnamese.',
  brainstorm: 'Brainstorm creative ideas based on the inputs.',
  custom: '',
};

/**
 * Prompt node:
 * - this node's instruction comes first, upstream Prompts are concatenated after it;
 * - `[Label]` stays in the body; a trailing legend maps each linked asset to its Flow URL;
 * - references and the previous clip are forwarded so the generator receives them.
 */
export const promptExecutor: NodeExecutor = async (ctx) => {
  const data = ctx.node.data as PromptData;
  const inputs = allInputs(ctx);
  const upstream = inputs
    .filter((v) => v.kind === 'text' && v.role === 'prompt' && v.text?.trim())
    .map((v) => v.text!);
  const refs = refsOf(inputs);
  const continuation = continuationOf(inputs);

  let text = annotateAssetLabels(composePrompt(upstream, data.instruction ?? ''), asAssetRefs(refs));

  const system = PRESET_SYSTEM[data.preset] ?? '';
  if (system) {
    const images = [];
    for (const ref of refs) {
      if (ref.kind !== 'image' || !ref.blob) continue;
      images.push({ name: ref.name ?? 'image.png', mime: ref.mime ?? ref.blob.type, dataBase64: await blobToBase64(ref.blob) });
    }
    ctx.onProgress(10, 'Gửi prompt tới Gemini…');
    const result = await ctx.callDriver('gemini', {
      name: 'prompt',
      payload: {
        model: data.model,
        instruction: system,
        texts: [text],
        images,
        newChat: data.newChat,
        outputFormat: data.outputFormat,
      },
    });
    text = result.texts?.[0] ?? '';
    if (data.outputFormat === 'json') {
      try {
        JSON.parse(text);
      } catch {
        throw fail('Output không phải JSON hợp lệ');
      }
    }
  }

  return [
    { kind: 'text', text, role: 'prompt' },
    ...refs,
    ...(continuation ? [continuation] : []),
  ];
};

/**
 * Reference → what the Flow driver needs: a media id, or a one-time upload for
 * local images. Media from Google Flow is never uploaded back.
 */
async function toFlowRef(ctx: ExecutorContext, ref: NodeOutputValue): Promise<FlowGenerateRef | null> {
  if (ref.kind !== 'image' && ref.kind !== 'video' && ref.kind !== 'audio') return null;
  const base = { kind: ref.kind, label: ref.assetLabel };
  if (ref.flowMediaId) return { ...base, mediaId: ref.flowMediaId };
  if (ref.fromFlow) {
    throw fail(
      `${ref.assetLabel ? `[${ref.assetLabel}]` : (ref.name ?? 'Media')} đến từ Google Flow nhưng không có media id — không upload lại lên Flow. Chạy lại node nguồn hoặc chọn asset từ Flow.`,
      FLOW_NO_UPLOAD,
    );
  }
  if (ref.kind !== 'image' || !ref.blob) return base;
  return {
    ...base,
    upload: {
      name: ref.name ?? 'image.png',
      mime: ref.mime ?? ref.blob.type,
      dataBase64: await blobToBase64(ref.blob),
      cacheKey: `${ctx.runId}:${ref.localAssetId ?? ref.outputId ?? crypto.randomUUID()}`,
    },
  };
}

/** Shared by both generators: prompt text, references and the previous clip. */
async function collectGenerateInputs(ctx: ExecutorContext, ownPrompt: string | undefined) {
  const inputs = allInputs(ctx);
  const refs = refsOf(inputs);
  const incoming = inputs
    .filter((v) => v.kind === 'text' && v.text?.trim())
    .map((v) => v.text!)
    .join('\n\n');
  const prompt = annotateAssetLabels((ownPrompt ?? '').trim() || incoming, asAssetRefs(refs));
  if (!prompt) throw fail('Thiếu prompt — nối node Prompt hoặc nhập prompt');
  const flowRefs = (await Promise.all(refs.map((r) => toFlowRef(ctx, r)))).filter(
    (r): r is FlowGenerateRef => r != null,
  );
  return { prompt, refs: flowRefs, continuation: continuationOf(inputs) };
}

/** Driver medias → node outputs, keeping the Flow media id so later nodes reference it. */
async function collectMedias(
  ctx: ExecutorContext,
  medias: NonNullable<Awaited<ReturnType<ExecutorContext['callDriver']>>['medias']>,
  kind: 'image' | 'video',
): Promise<NodeOutputValue[]> {
  const outputs: NodeOutputValue[] = [];
  for (const m of medias) {
    let blob: Blob | undefined;
    if (m.dataBase64) {
      blob = b64ToBlob(m.dataBase64, m.mime);
    } else if (m.url) {
      try {
        const fetched = await ctx.callDriver('flow', { name: 'fetchMedia', payload: { url: m.url } });
        const fm = fetched.medias?.[0];
        if (fm?.dataBase64) blob = b64ToBlob(fm.dataBase64, fm.mime || m.mime);
      } catch {
        /* ignore */
      }
    }
    if (!blob) continue;
    if (kind === 'video' && !(m.kind === 'video' || blob.type.startsWith('video/'))) continue;
    outputs.push({
      kind,
      blob,
      mime: blob.type || (kind === 'video' ? 'video/mp4' : 'image/png'),
      flowMediaId: m.mediaId ?? parseFlowMediaUrl(m.url)?.mediaId,
      fromFlow: true,
    });
  }
  return outputs;
}

export const generateImageExecutor: NodeExecutor = async (ctx) => {
  const data = ctx.node.data as GenImageData;
  const { prompt, refs } = await collectGenerateInputs(ctx, data.prompt);
  const model = normalizeModelLabel(data.model, DEFAULT_IMAGE_MODEL);

  ctx.onProgress(5, 'Tạo ảnh…');
  const result = await ctx.callDriver('flow', {
    name: 'generate',
    payload: {
      mode: 'text-to-image',
      model,
      aspectRatio: data.aspectRatio,
      outputsPerPrompt: data.count,
      prompt,
      refs,
      timeoutSec: data.timeoutSec,
    },
  });

  const outputs = await collectMedias(ctx, result.medias ?? [], 'image');
  if (!outputs.length) throw fail('Không lấy được ảnh');
  return outputs.slice(0, data.count);
};

export const generateVideoExecutor: NodeExecutor = async (ctx) => {
  const data = ctx.node.data as GenVideoData;
  const { prompt, refs, continuation } = await collectGenerateInputs(ctx, data.prompt);
  // Legacy labels like "google omni flash" must stay Omni — never land on Veo via resolveVideoModel.
  const model = normalizeModelLabel(data.model, DEFAULT_VIDEO_MODEL);

  const continueFrom = continuation?.blob
    ? { mime: continuation.mime ?? continuation.blob.type, dataBase64: await blobToBase64(continuation.blob) }
    : undefined;
  if (continuation && !continueFrom) throw fail('Cảnh trước chưa có file video để nối tiếp');

  const imageRefs = refs.filter((r) => r.kind === 'image').length;
  // Mode is informational for the driver; video never invents a mid-scene image.
  const mode = continueFrom
    ? 'continue-video'
    : imageRefs >= 1
      ? 'frames-to-video'
      : 'text-to-video';

  ctx.onProgress(5, continueFrom ? 'Tạo cảnh tiếp theo…' : 'Tạo video…');
  const result = await ctx.callDriver('flow', {
    name: 'generate',
    payload: {
      mode,
      model,
      aspectRatio: data.aspectRatio,
      outputsPerPrompt: data.count,
      durationSec: data.durationSec,
      prompt,
      refs,
      continueFrom,
      timeoutSec: data.timeoutSec,
    },
  });

  const outputs = await collectMedias(ctx, result.medias ?? [], 'video');
  if (!outputs.length) {
    throw fail(
      'Không lấy được video từ Flow (có thể Flow chưa render video, hoặc bắt nhầm thumbnail). Thử lại khi project Flow đang mở.',
    );
  }
  return outputs.slice(0, data.count);
};

export const autoDownloadExecutor: NodeExecutor = async (ctx) => {
  const data = ctx.node.data as DownloadData;
  const all = Object.values(ctx.inputs).flat();
  const date = new Date().toISOString().slice(0, 10);
  let index = 1;
  for (const item of all) {
    if (!item.blob) continue;
    const folder = resolveTemplate(data.folderTemplate, {
      workflow: ctx.workflow.name,
      date,
      slug: item.name ?? 'output',
    });
    const filename = resolveTemplate(data.filenameTemplate, {
      workflow: ctx.workflow.name,
      date,
      slug: item.name ?? 'output',
      index: String(index),
    });
    const ext =
      item.mime?.includes('mp4')
        ? '.mp4'
        : item.mime?.includes('png')
          ? '.png'
          : item.mime?.includes('webp')
            ? '.webp'
            : '';
    const path = `${folder}/${filename}${ext}`;
    const url = URL.createObjectURL(item.blob);
    await chrome.downloads.download({
      url,
      filename: path,
      conflictAction: data.conflict === 'overwrite' ? 'overwrite' : 'uniquify',
      saveAs: false,
    });
    index++;
  }
  return [];
};

export const executors: Record<string, NodeExecutor> = {
  asset: assetExecutor,
  prompt: promptExecutor,
  generateImage: generateImageExecutor,
  generateVideo: generateVideoExecutor,
  autoDownload: autoDownloadExecutor,
};
