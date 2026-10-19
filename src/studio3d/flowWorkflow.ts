/**
 * Dựng workflow Google Flow (định dạng import .xflow.zip của extension) từ một cảnh Studio 3D:
 * một Asset Character (ảnh người mẫu đóng gói kèm), mỗi shot một nhánh Prompt -> Generate Video,
 * ghép bằng Merge Video rồi Auto Download.
 * Có previz (video mô hình trắng cắt theo shot) thì mỗi clip thêm Asset `Video reference` nối thẳng vào
 * Generate Video: Omni chỉnh sửa video theo chuyển động và góc máy của previz.
 * Logic thuần để test được; đọc file, cắt previz và nén zip nằm ở `scripts/studio3d-flow.ts`.
 */

import {
  ASPECT_RATIOS,
  FORMAT_VERSION,
  SCHEMA_VERSION,
  VIDEO_DURATIONS,
  type ExportManifest,
  type Workflow,
  type WorkflowEdge,
  type WorkflowNode,
} from '@/shared/schema';
import { isOmniFlashModel } from '@/providers/flow/rpc/batch';
import type { SceneDef } from './schema';
import { shotSpans, type ShotSpan } from './timeline';

/** Ảnh người mẫu đã đọc từ đĩa */
export interface FlowImage {
  sha256: string;
  mime: string;
  size: number;
  originalName: string;
  /** Đuôi file kèm dấu chấm, ví dụ `.jpg` */
  ext: string;
}

/** Một đoạn previz đã cắt đúng một shot (mp4) */
export interface FlowPrevizClip {
  sha256: string;
  size: number;
  originalName: string;
}

export interface FlowPackage {
  manifest: ExportManifest;
  workflow: Workflow;
  /** Đường dẫn ảnh trong zip */
  imagePath: string;
  /** Đường dẫn từng clip previz trong zip, theo thứ tự shot (rỗng khi không có previz) */
  previzPaths: string[];
}

/** Nhãn asset của clip previz; Omni chỉ nhận video tham chiếu qua chỉnh sửa video (tối đa 10s). */
export const PREVIZ_LABEL = 'Video reference';
const PREVIZ_TAG = `[${PREVIZ_LABEL}]`;
/** Dòng dẫn đầu prompt khi clip có previz: chỉ rõ video là tham chiếu chuyển động, không phải hình. */
const PREVIZ_LEAD = [
  `Dùng ${PREVIZ_TAG} (mô hình trắng dựng 3D) làm tham chiếu chuyển động và góc máy: giữ đúng đường đi, tư thế, nhịp bước, vị trí và chuyển động máy quay, khung hình theo từng giây.`,
  'Thay ma-nơ-canh bằng [Character] thật, thay các khối xám bằng bối cảnh thật. Không giữ màu xanh, khối trơn hay bất kỳ dấu vết mô hình 3D nào.',
  '',
];

const CHARACTER_TAG = '[Character]';
/** Shot dài hơn thời lượng chọn được ít hơn mức này thì vẫn chấp nhận (sai số làm tròn) */
const DURATION_TOLERANCE = 0.05;
const APP_VERSION = '0.1.0';
const LAYOUT = { row: 340, rowPreviz: 560, top: 120, prompt: 400, generate: 860, merge: 1300, download: 1700 };

/** Những gì còn thiếu để xuất workflow; rỗng = xuất được. */
export function flowProblems(scene: SceneDef, opts: { previz?: boolean } = {}): string[] {
  if (!scene.flow) return ['Cảnh chưa có khối "flow" (ảnh người mẫu và mô tả nhân vật)'];
  const problems: string[] = [];
  if (opts.previz && !isOmniFlashModel(scene.flow.model)) {
    problems.push(`flow.model là "${scene.flow.model}": chỉ Omni Flash nhận video previz làm tham chiếu`);
  }
  if (!scene.flow.characterPrompt.includes(CHARACTER_TAG)) {
    problems.push(`flow.characterPrompt phải có ${CHARACTER_TAG} để neo ảnh người mẫu`);
  }
  if (scene.shots.length === 0) problems.push('Cảnh chưa có shots: mỗi shot là một clip Flow');
  scene.shots.forEach((shot, i) => {
    if (!shot.prompt?.trim()) problems.push(`Shot ${i + 1}: thiếu prompt`);
  });
  for (const [i, span] of shotSpans(scene).entries()) {
    if (clipDuration(span) === undefined) {
      problems.push(`Shot ${i + 1}: dài ${(span.to - span.from).toFixed(1)}s, vượt thời lượng tối đa ${Math.max(...VIDEO_DURATIONS)}s của Flow`);
    }
  }
  return problems;
}

/** Thời lượng Flow nhỏ nhất đủ chứa shot; undefined nếu shot quá dài. */
export function clipDuration(span: ShotSpan): number | undefined {
  const length = span.to - span.from;
  return VIDEO_DURATIONS.find((d) => d >= length - DURATION_TOLERANCE);
}

/** Tỉ lệ khung Flow gần nhất với kích thước cảnh. */
export function sceneAspectRatio(scene: SceneDef): string {
  const target = scene.size.width / scene.size.height;
  const ratio = (r: string) => {
    const [w, h] = r.split(':').map(Number);
    return w / h;
  };
  return [...ASPECT_RATIOS].sort((a, b) => Math.abs(ratio(a) - target) - Math.abs(ratio(b) - target))[0];
}

/** Độ dài clip ghi trong prompt: có previz thì clip ra đúng bằng shot, không thì mức Flow. */
function clipSeconds(span: ShotSpan, previz: boolean): string {
  if (!previz) return String(clipDuration(span));
  return String(Math.round((span.to - span.from) * 10) / 10).replace('.', ',');
}

/**
 * Prompt đầy đủ của một clip: tiêu đề + (dòng dẫn previz) + prompt của shot + phần chung + mô tả nhân vật.
 */
export function clipPrompt(scene: SceneDef, shotIndex: number, opts: { previz?: boolean } = {}): string {
  const flow = scene.flow!;
  const span = shotSpans(scene)[shotIndex];
  const orientation = scene.size.height > scene.size.width ? 'dọc' : 'ngang';
  const head = `Video ${orientation} ${sceneAspectRatio(scene)} dài ${clipSeconds(span, !!opts.previz)} giây, một cảnh quay liền không cắt.`;
  return [
    head,
    ...(opts.previz ? PREVIZ_LEAD : []),
    scene.shots[shotIndex].prompt!.trim(),
    ...flow.common,
    '',
    flow.characterPrompt,
  ].join('\n');
}

export function buildFlowPackage(
  scene: SceneDef,
  image: FlowImage,
  now: number,
  previz: FlowPrevizClip[] = [],
): FlowPackage {
  const withPreviz = previz.length > 0;
  // Mỗi clip có thêm node previz dưới Prompt nên hàng cao hơn.
  const row = withPreviz ? LAYOUT.rowPreviz : LAYOUT.row;
  const problems = flowProblems(scene, { previz: withPreviz });
  if (withPreviz && previz.length !== shotSpans(scene).length) {
    problems.push(`Có ${previz.length} clip previz nhưng cảnh có ${shotSpans(scene).length} shot`);
  }
  if (problems.length > 0) throw new Error(problems.join('\n'));
  const flow = scene.flow!;
  const spans = shotSpans(scene);
  const imagePath = `assets/${image.sha256}${image.ext}`;
  const id = `wf-studio3d-${image.sha256.slice(0, 12)}-${now}`;

  const nodes: WorkflowNode[] = [
    {
      id: 'note-guide',
      type: 'note',
      position: { x: 40, y: -200 },
      size: { w: 1100, h: 150 },
      data: {
        color: '#1e3a5f',
        fontSize: 13,
        content: [
          `Xuất từ Studio 3D: ${scene.title}.`,
          withPreviz
            ? 'Ảnh người mẫu và clip previz từng shot đã có sẵn: Omni theo chuyển động, góc máy của previz. Bấm Generate trên từng clip, ưng hết thì bấm Ghép video.'
            : 'Ảnh người mẫu đã có sẵn. Bấm Generate trên từng clip, ưng hết thì bấm Ghép video (không tốn thêm lượt Flow).',
          'Chữ trên màn hình thêm trong CapCut. Lời thoại: thêm Asset Audio voice (mp3) nối vào node ghép.',
        ].join('\n'),
      },
    },
    {
      id: 'asset-character',
      type: 'asset',
      slug: 'character',
      label: 'Người mẫu',
      position: { x: 40, y: LAYOUT.top + ((spans.length - 1) * row) / 2 },
      data: {
        kind: 'image',
        assetLabel: 'Character',
        slug: 'character',
        source: 'local',
        sha256: image.sha256,
        mime: image.mime,
        originalName: image.originalName,
      },
    },
  ];
  const edges: WorkflowEdge[] = [];
  const generateIds: string[] = [];
  const previzPaths = previz.map((clip) => `assets/${clip.sha256}.mp4`);

  spans.forEach((span, i) => {
    const n = i + 1;
    const y = LAYOUT.top + i * row;
    const title = `Clip ${n} (${span.from.toFixed(1)}-${span.to.toFixed(1)}s)`;
    nodes.push(
      {
        id: `prompt-${n}`,
        type: 'prompt',
        label: `Prompt clip ${n}`,
        position: { x: LAYOUT.prompt, y },
        data: {
          provider: 'gemini',
          model: '',
          preset: 'custom',
          instruction: clipPrompt(scene, i, { previz: withPreviz }),
          outputFormat: 'plain',
          newChat: true,
          reusePrompt: true,
          forwardRefs: true,
        },
      },
      {
        id: `gen-${n}`,
        type: 'generateVideo',
        slug: `clip${n}`,
        label: title,
        position: { x: LAYOUT.generate, y },
        data: {
          model: flow.model,
          aspectRatio: sceneAspectRatio(scene),
          count: 1,
          resolution: flow.resolution,
          durationSec: clipDuration(span)!,
          timeoutSec: 900,
        },
      },
    );
    generateIds.push(`gen-${n}`);
    const clip = previz[i];
    if (clip) {
      nodes.push({
        id: `previz-${n}`,
        type: 'asset',
        slug: `previz${n}`,
        label: `Previz clip ${n}`,
        position: { x: LAYOUT.prompt, y: y + 300 },
        data: {
          kind: 'video',
          assetLabel: PREVIZ_LABEL,
          slug: `previz${n}`,
          source: 'local',
          sha256: clip.sha256,
          mime: 'video/mp4',
          originalName: clip.originalName,
        },
      });
      // Thẳng vào Generate Video: Prompt (preset custom) không cần thấy video.
      edges.push({ id: `e-previz-${n}`, source: `previz-${n}`, sourceHandle: 'out:video', target: `gen-${n}`, targetHandle: 'in:video', type: 'video' });
    }
    edges.push(
      { id: `e-char-${n}`, source: 'asset-character', sourceHandle: 'out:image', target: `prompt-${n}`, targetHandle: 'in:image', type: 'image' },
      { id: `e-prompt-${n}`, source: `prompt-${n}`, sourceHandle: 'out:text', target: `gen-${n}`, targetHandle: 'in:text', type: 'text' },
      { id: `e-merge-${n}`, source: `gen-${n}`, sourceHandle: 'out:video', target: 'merge', targetHandle: 'in:video', type: 'video' },
    );
  });

  const middle = LAYOUT.top + ((spans.length - 1) * row) / 2;
  nodes.push(
    {
      id: 'merge',
      type: 'mergeVideo',
      slug: 'final',
      label: `Ghép ${spans.length} clip`,
      position: { x: LAYOUT.merge, y: middle },
      data: { order: generateIds, fps: scene.fps, bitrateMbps: 8, audioStartSec: 0, logoXPercent: 4, logoYPercent: 4, logoWidthPercent: 18, logoOpacity: 100 },
    },
    {
      id: 'download',
      type: 'autoDownload',
      label: 'Auto Download',
      position: { x: LAYOUT.download, y: middle + 40 },
      data: { folderTemplate: 'MyXFlows/{{workflow}}/{{date}}', filenameTemplate: '{{slug}}_{{index}}', conflict: 'uniquify', onlyWhenAllDone: false },
    },
  );
  edges.push({ id: 'e-download', source: 'merge', sourceHandle: 'out:video', target: 'download', targetHandle: 'in:any', type: 'video' });

  const workflow: Workflow = {
    id,
    schemaVersion: SCHEMA_VERSION,
    workspaceId: 'imported',
    name: scene.title,
    enabled: false,
    locked: false,
    nodes,
    edges,
    viewport: { x: 0, y: 0, zoom: 0.7 },
    // Không tự retry lỗi generate (quy tắc dự án): báo lỗi rõ để người dùng quyết định chạy lại.
    settings: { concurrency: 1, retry: 0, stopOnError: true },
    createdAt: now,
    updatedAt: now,
  };

  const manifest: ExportManifest = {
    format: 'my-x-flows',
    formatVersion: FORMAT_VERSION,
    kind: 'workflows',
    appVersion: APP_VERSION,
    exportedAt: new Date(now).toISOString(),
    workflows: [{ id, name: workflow.name, schemaVersion: SCHEMA_VERSION, path: `workflows/${id}.json`, nodeCount: nodes.length }],
    assets: [
      { sha256: image.sha256, mime: image.mime, size: image.size, path: imagePath, originalName: image.originalName },
      ...previz.map((clip, i) => ({
        sha256: clip.sha256,
        mime: 'video/mp4',
        size: clip.size,
        path: previzPaths[i],
        originalName: clip.originalName,
      })),
    ],
    includes: { assets: true, outputs: false, runs: false },
  };
  return { manifest, workflow, imagePath, previzPaths };
}
