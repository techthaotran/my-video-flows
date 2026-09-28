import { FLOW_NO_UPLOAD, type ExecutorContext, type NodeExecutor, type NodeOutputValue } from '@/engine/types';
import { hashValue } from '@/engine/cache';
import {
  composeFashionPrompt,
  FASHION_REF_ROLE,
  FASHION_SYSTEM,
  type FashionRefLabels,
  type FashionRefRole,
} from '@/engine/presets/fashion';
import { promptSystem } from '@/engine/presets/system';
import { annotateAssetLabels, composePrompt, extractLabels, resolveTemplate, type AssetRef } from '@/engine/resolver';
import type { FlowGenerateRef } from '@/shared/messaging';
import { parseFlowMediaUrl } from '@/providers/flow/media';
import { strings } from '@/shared/strings';
import { blobToBase64, hashBlobContent, extractJsonPayload } from '@/shared/utils';
import { orderedClipIds } from '@/media/layout';
import type {
  AssetNodeDataSchema,
  AutoDownloadNodeDataSchema,
  GenerateImageNodeDataSchema,
  GenerateVideoNodeDataSchema,
  MergeVideoNodeDataSchema,
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
type MergeVideoData = z.infer<typeof MergeVideoNodeDataSchema>;
type DownloadData = z.infer<typeof AutoDownloadNodeDataSchema>;

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

/** A generator has something to generate from: its own prompt or incoming text. */
export function hasGeneratePrompt(
  ownPrompt: string | undefined,
  inputs: Record<string, NodeOutputValue[]>,
): boolean {
  if ((ownPrompt ?? '').trim()) return true;
  return Object.values(inputs)
    .flat()
    .some((v) => v.kind === 'text' && !!v.text?.trim());
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

/** `[Label]` của ảnh theo vai trò thời trang, giữ thứ tự và không trùng. */
function fashionLabelsOf(refs: NodeOutputValue[]): FashionRefLabels {
  const labels: FashionRefLabels = {};
  for (const ref of refs) {
    if (!ref.fashionRole || !ref.assetLabel) continue;
    const list = (labels[ref.fashionRole] ??= []);
    if (!list.includes(ref.assetLabel)) list.push(ref.assetLabel);
  }
  return labels;
}

const FASHION_REF_ORDER: Record<FashionRefRole, number> = { scene: 0, model: 1, outfit: 2 };

/**
 * Node phân tích thời trang gắn vai trò cho ảnh nó chuyển tiếp; Ghép prompt đưa ảnh bối cảnh
 * lên đầu (ảnh gốc để chỉnh sửa). Preset khác giữ nguyên.
 */
function fashionOrderedRefs(preset: string, refs: NodeOutputValue[]): NodeOutputValue[] {
  const role = FASHION_REF_ROLE[preset];
  if (role) return refs.map((r) => ({ ...r, fashionRole: role }));
  if (preset !== 'fashionCompose') return refs;
  const rank = (r: NodeOutputValue) => (r.fashionRole ? FASHION_REF_ORDER[r.fashionRole] : 3);
  return [...refs].sort((a, b) => rank(a) - rank(b));
}

function asAssetRefs(refs: NodeOutputValue[]): AssetRef[] {
  return refs
    .filter((r) => r.assetLabel)
    .map((r) => ({ label: r.assetLabel!, kind: r.kind, flowMediaId: r.flowMediaId }));
}

/** The most recent previous scene: a wired clip, or the last frame a Prompt forwarded. */
function continuationOf(values: NodeOutputValue[]): NodeOutputValue | undefined {
  return values
    .filter((v) => v.role === 'continuation' && (v.kind === 'video' || v.kind === 'image'))
    .at(-1);
}

/** Last frame (JPEG) of a continuation value: clips are decoded, forwarded frames pass through. */
async function lastFrameOf(ctx: ExecutorContext, continuation: NodeOutputValue): Promise<Blob> {
  if (!continuation.blob) throw fail(strings.continueNoVideoFile);
  if (continuation.kind === 'image') return continuation.blob;
  ctx.onProgress(3, strings.extractLastFrameProgress);
  return ctx.extractLastFrame(continuation.blob);
}

/**
 * Prompt keeps the previous scene's last frame (asset + `continueFrameAssetId`), so the
 * next scene can be regenerated after the link to the previous Generate Video is removed.
 */
async function promptContinuation(
  ctx: ExecutorContext,
  data: PromptData,
  live: NodeOutputValue | undefined,
): Promise<NodeOutputValue | undefined> {
  let frame: Blob;
  if (live) {
    frame = await lastFrameOf(ctx, live);
    const assetId = await ctx.putAsset(frame, 'previous-scene-last-frame.jpg');
    if (assetId !== data.continueFrameAssetId) {
      await ctx.patchNodeData({ continueFrameAssetId: assetId });
    }
  } else {
    if (!data.continueFrameAssetId) return undefined;
    const cached = await ctx.getAsset(data.continueFrameAssetId);
    if (!cached) throw fail(strings.continueFrameCacheMissing);
    frame = cached;
  }
  return {
    kind: 'image',
    blob: frame,
    mime: frame.type || 'image/jpeg',
    name: strings.continueStartFrameLabel,
    role: 'continuation',
  };
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

/** Hash for prompt reuse: preset + skill + instruction + model + format + upstream texts + image content. */
async function computePromptReuseHash(
  data: PromptData,
  upstream: string[],
  refs: NodeOutputValue[],
): Promise<string> {
  const digestByBlob = new Map<Blob, string>();
  const imageHashes: string[] = [];
  for (const ref of refs) {
    if (ref.kind !== 'image') continue;
    if (ref.contentHash) {
      imageHashes.push(ref.contentHash);
      continue;
    }
    if (ref.blob) {
      let digest = digestByBlob.get(ref.blob);
      if (!digest) {
        digest = await hashBlobContent(ref.blob);
        digestByBlob.set(ref.blob, digest);
        ref.contentHash = digest;
      }
      imageHashes.push(digest);
      continue;
    }
    if (ref.flowMediaId) imageHashes.push(`flow:${ref.flowMediaId}`);
  }
  return hashValue({
    preset: data.preset,
    // Skill thực tế (ghi đè hoặc mặc định): đổi skill mặc định thì kết quả cũ không bị dùng lại.
    system: promptSystem(data),
    instruction: data.instruction ?? '',
    model: data.model ?? '',
    outputFormat: data.outputFormat ?? 'plain',
    upstream,
    images: imageHashes,
  });
}

function imageExt(mime: string): string {
  const sub = mime.split('/')[1]?.split(/[+;]/)[0];
  return sub === 'jpeg' ? 'jpg' : sub || 'png';
}

/**
 * Download a Flow media once per run (signed url via the Flow tab). A failure
 * is dropped from the cache so a later node in the run may try again.
 */
function fetchFlowImage(ctx: ExecutorContext, mediaId: string): Promise<Blob> {
  const cached = ctx.flowMediaCache.get(mediaId);
  if (cached) return cached;
  const pending = ctx
    .callDriver('flow', { name: 'fetchMediaById', payload: { mediaId } })
    .then((res) => {
      const m = res.medias?.[0];
      if (!m?.dataBase64) throw new Error(strings.flowMediaSignFailed);
      return b64ToBlob(m.dataBase64, m.mime || 'image/png');
    });
  ctx.flowMediaCache.set(mediaId, pending);
  pending.catch(() => ctx.flowMediaCache.delete(mediaId));
  return pending;
}

/**
 * Images for Gemini: local blobs as-is; Flow-only refs (`flowMediaId`, no blob)
 * are downloaded from Flow first. A failed download stops the node.
 */
async function geminiImagesOf(
  ctx: ExecutorContext,
  refs: NodeOutputValue[],
): Promise<{ name: string; mime: string; dataBase64: string }[]> {
  const imageRefs = refs.filter((r) => r.kind === 'image' && (r.blob || r.flowMediaId));
  const remote = imageRefs.filter((r) => !r.blob);
  const images = [];
  let fetched = 0;
  for (const ref of imageRefs) {
    let blob = ref.blob;
    if (!blob) {
      fetched++;
      ctx.onProgress(5, strings.promptFetchFlowImage(fetched, remote.length));
      try {
        blob = await fetchFlowImage(ctx, ref.flowMediaId!);
      } catch (e) {
        const label = ref.assetLabel ? `[${ref.assetLabel}]` : (ref.name ?? ref.flowMediaId!);
        throw fail(
          strings.promptFlowImageFetchFailed(label, e instanceof Error ? e.message : String(e)),
          'FLOW_MEDIA_FETCH_FAILED',
        );
      }
    }
    const mime = ref.mime ?? (blob.type || 'image/png');
    const base = ref.name ?? ref.assetLabel ?? ref.flowMediaId ?? 'image';
    images.push({
      name: /\.[a-z0-9]+$/i.test(base) ? base : `${base}.${imageExt(mime)}`,
      mime,
      dataBase64: await blobToBase64(blob),
    });
  }
  return images;
}

const FLOW_URL_IN_PROMPT_RE = /https:\/\/flow-content\.google\/(?:image|video)\//i;

/** Gemini rewrite must keep input labels and must not invent Flow CDN links. */
export function assertGeminiPromptPreserved(input: string, output: string): void {
  if (FLOW_URL_IN_PROMPT_RE.test(output)) {
    throw fail(strings.geminiInsertedFlowUrl);
  }
  const inputLabels = extractLabels(input);
  if (!inputLabels.length) return;
  const outputLabels = new Set(extractLabels(output).map((l) => l.trim().toLowerCase()));
  const missing = inputLabels.filter((l) => !outputLabels.has(l.trim().toLowerCase()));
  if (missing.length) {
    throw fail(strings.geminiDroppedLabels(missing.map((l) => `[${l}]`).join(', ')));
  }
}

/**
 * Prompt node:
 * - this node's instruction comes first, upstream Prompts are concatenated after it;
 * - `[Label]` stays in the body; descriptions gather under `Danh sách tham chiếu` (no URLs);
 * - references and the previous clip are forwarded so the generator receives them
 *   (unless `forwardRefs` is false); fashionCompose merges JSON locally (no Gemini).
 */
export const promptExecutor: NodeExecutor = async (ctx) => {
  const data = ctx.node.data as PromptData;
  const inputs = allInputs(ctx);
  const upstream = inputs
    .filter((v) => v.kind === 'text' && v.role === 'prompt' && v.text?.trim())
    .map((v) => v.text!);
  const refs = refsOf(inputs);
  const continuation = await promptContinuation(ctx, data, continuationOf(inputs));

  let text = annotateAssetLabels(composePrompt(upstream, data.instruction ?? ''), asAssetRefs(refs));
  let reuseHash: string | undefined;
  const keepEdited = !ctx.force && data.outputEdited && !!data.formattedOutput?.trim();
  const reuseSaved =
    !keepEdited && !!ctx.reuseSavedPrompt && !!promptSystem(data) && !!data.formattedOutput?.trim();

  if (keepEdited) {
    ctx.onProgress(100, strings.promptEdited);
    text = data.formattedOutput!;
  } else if (reuseSaved) {
    ctx.onProgress(100, strings.promptReused);
    text = data.formattedOutput!;
  } else if (data.preset === 'fashionCompose') {
    text = composeFashionPrompt(upstream.length ? upstream : text.trim() ? [text] : [], fashionLabelsOf(refs));
  } else {
    const system = promptSystem(data);
    if (system) {
      reuseHash = await computePromptReuseHash(data, upstream, refs);
      const canReuse =
        !ctx.force &&
        data.reusePrompt &&
        !!data.formattedOutput?.trim() &&
        !!data.reuseHash &&
        data.reuseHash === reuseHash;

      if (canReuse) {
        ctx.onProgress(100, strings.promptReused);
        text = data.formattedOutput!;
      } else {
        const inputText = text;
        const images = await geminiImagesOf(ctx, refs);
        ctx.onProgress(10, strings.promptSendingGemini);
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
        // Fashion JSON presets intentionally drop [Label] tags.
        if (!(data.preset in FASHION_SYSTEM)) {
          assertGeminiPromptPreserved(inputText, text);
        }
        if (data.outputFormat === 'json') {
          try {
            const cleaned = extractJsonPayload(text);
            JSON.parse(cleaned);
            text = cleaned;
          } catch {
            throw fail(
              data.preset in FASHION_SYSTEM ? strings.fashionJsonInvalid : strings.promptJsonInvalid,
            );
          }
        }
        ctx.onProgress(100, strings.promptFresh);
      }
    }
  }

  const forwardRefs = data.forwardRefs !== false;
  return [
    { kind: 'text', text, role: 'prompt', reuseHash, outputEdited: keepEdited },
    ...(forwardRefs ? fashionOrderedRefs(data.preset, refs) : []),
    ...(continuation ? [continuation] : []),
  ];
};

/**
 * Reference → what the Flow driver needs: a media id, or a local upload payload.
 * Media from Google Flow (`flowMediaId`) is never uploaded back.
 * Local: reuse Asset `uploaded*` when project + sha match (driver decides).
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

  const sha256 = ref.contentHash ?? (await hashBlobContent(ref.blob));
  ref.contentHash = sha256;
  const sourceId = ref.sourceNodeId;
  const assetNode = sourceId ? ctx.workflow.nodes.find((n) => n.id === sourceId) : undefined;
  const assetData = assetNode?.type === 'asset' ? (assetNode.data as AssetData) : undefined;
  const uploaded =
    assetData?.uploadedMediaId && assetData.uploadedProjectId && assetData.uploadedSha256
      ? {
          mediaId: assetData.uploadedMediaId,
          projectId: assetData.uploadedProjectId,
          sha256: assetData.uploadedSha256,
        }
      : undefined;

  return {
    ...base,
    upload: {
      name: ref.name ?? 'image.png',
      mime: ref.mime ?? ref.blob.type,
      dataBase64: await blobToBase64(ref.blob),
      sha256,
      nodeId: sourceId,
      uploaded,
    },
  };
}

/** Persist new Flow upload ids onto the Asset nodes that produced them. */
async function persistFlowUploads(
  ctx: ExecutorContext,
  uploads: NonNullable<Awaited<ReturnType<ExecutorContext['callDriver']>>['uploads']>,
): Promise<void> {
  for (const u of uploads) {
    await ctx.patchNodeById(u.nodeId, {
      uploadedMediaId: u.mediaId,
      uploadedProjectId: u.projectId,
      uploadedSha256: u.sha256,
    });
  }
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
      resolution: data.resolution,
      timeoutSec: data.timeoutSec,
      logCtx: { runId: ctx.runId, nodeId: ctx.node.id },
    },
  });
  if (result.uploads?.length) await persistFlowUploads(ctx, result.uploads);

  const outputs = await collectMedias(ctx, result.medias ?? [], 'image');
  if (!outputs.length) throw fail('Không lấy được ảnh');
  return outputs.slice(0, data.count);
};

export const generateVideoExecutor: NodeExecutor = async (ctx) => {
  const data = ctx.node.data as GenVideoData;
  const { prompt, refs, continuation } = await collectGenerateInputs(ctx, data.prompt);
  // Legacy labels like "google omni flash" must stay Omni — never land on Veo via resolveVideoModel.
  const model = normalizeModelLabel(data.model, DEFAULT_VIDEO_MODEL);

  const frame = continuation ? await lastFrameOf(ctx, continuation) : undefined;
  const continueFrame = frame
    ? { mime: frame.type || 'image/jpeg', dataBase64: await blobToBase64(frame) }
    : undefined;

  const imageRefs = refs.filter((r) => r.kind === 'image').length;
  // Mode is informational for the driver; video never invents a mid-scene image.
  const mode = continueFrame
    ? 'continue-video'
    : imageRefs >= 1
      ? 'frames-to-video'
      : 'text-to-video';

  ctx.onProgress(5, continueFrame ? 'Tạo cảnh tiếp theo…' : 'Tạo video…');
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
      continueFrame,
      timeoutSec: data.timeoutSec,
      logCtx: { runId: ctx.runId, nodeId: ctx.node.id },
    },
  });
  if (result.uploads?.length) await persistFlowUploads(ctx, result.uploads);

  const outputs = await collectMedias(ctx, result.medias ?? [], 'video');
  if (!outputs.length) {
    throw fail(
      'Không lấy được video từ Flow (có thể Flow chưa render video, hoặc bắt nhầm thumbnail). Thử lại khi project Flow đang mở.',
    );
  }
  return outputs.slice(0, data.count);
};

/**
 * Các clip nối vào Merge Video, xếp đúng thứ tự người dùng đặt trên node. Một
 * node nguồn sinh nhiều clip (count > 1) thì giữ nguyên thứ tự nội bộ của nó.
 */
export function orderClipsForMerge(
  order: readonly string[],
  values: NodeOutputValue[],
): NodeOutputValue[] {
  const clips = values.filter((v) => v.kind === 'video');
  const byNode = new Map<string, NodeOutputValue[]>();
  for (const clip of clips) {
    const key = clip.sourceNodeId ?? clip.outputId ?? '';
    byNode.set(key, [...(byNode.get(key) ?? []), clip]);
  }
  return orderedClipIds(order, [...byNode.keys()]).flatMap((id) => byNode.get(id) ?? []);
}

/**
 * Merge Video: ghép các clip theo thứ tự, thay toàn bộ tiếng gốc bằng audio nối
 * vào (cắt từ `audioStartSec` cho tới khi hết video), và dán logo lên mỗi frame.
 * Toàn bộ chạy trong offscreen document bằng WebCodecs — không gọi Flow/Gemini.
 */
export const mergeVideoExecutor: NodeExecutor = async (ctx) => {
  const data = ctx.node.data as MergeVideoData;
  const inputs = allInputs(ctx);

  const clips = orderClipsForMerge(data.order ?? [], inputs);
  if (!clips.length) throw fail(strings.mergeNoClips, 'UPLOAD_FAILED');
  const missing = clips.find((c) => !c.blob);
  if (missing) {
    throw fail(strings.mergeClipNoFile(missing.name ?? 'video'), FLOW_NO_UPLOAD);
  }

  const audioValue = inputs.find((v) => v.kind === 'audio');
  if (audioValue && !audioValue.blob) {
    throw fail(strings.mergeAudioNoFile(audioValue.name ?? 'audio'), FLOW_NO_UPLOAD);
  }
  const logoValue = inputs.find((v) => v.kind === 'image');
  if (logoValue && !logoValue.blob) {
    throw fail(strings.mergeLogoNoFile(logoValue.name ?? 'logo'), FLOW_NO_UPLOAD);
  }

  ctx.onProgress(2, strings.mergeStarting(clips.length));
  const blob = await ctx.composeVideo({
    clips: clips.map((c) => c.blob!),
    audio: audioValue?.blob
      ? { blob: audioValue.blob, startSec: data.audioStartSec }
      : undefined,
    logo: logoValue?.blob
      ? {
          blob: logoValue.blob,
          xPercent: data.logoXPercent,
          yPercent: data.logoYPercent,
          widthPercent: data.logoWidthPercent,
          opacity: data.logoOpacity,
        }
      : undefined,
    fps: data.fps,
    bitrateMbps: data.bitrateMbps,
    onProgress: (progress, message) => ctx.onProgress(progress, message),
  });

  return [{ kind: 'video', blob, mime: 'video/mp4', name: strings.mergeOutputName }];
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
  mergeVideo: mergeVideoExecutor,
  autoDownload: autoDownloadExecutor,
};
