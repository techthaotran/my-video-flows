/** Render từng khung theo thời gian cố định rồi encode mp4 bằng mediabunny (WebCodecs, chạy ngay trên trang dev). */

import {
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  Quality,
  getFirstEncodableVideoCodec,
  type VideoCodec,
} from 'mediabunny';
import { Stage, type ViewMode } from './stage';
import type { Manifest, SceneDef } from './schema';
import { frameCount, shotSpans } from './timeline';
import { strings } from '@/shared/strings';

const CODECS: VideoCodec[] = ['avc', 'hevc', 'vp9', 'av1'];
const BITRATE = 12_000_000;

export async function exportMp4(
  def: SceneDef,
  manifest: Manifest,
  options: { view: ViewMode; showLabels: boolean },
  onProgress: (done: number, total: number) => void,
): Promise<Blob> {
  const { width, height } = evenSize(def.size.width, def.size.height);
  const codec = await getFirstEncodableVideoCodec(CODECS, { width, height });
  if (!codec) throw new Error('Trình duyệt không encode được video ở kích thước này');

  const glCanvas = document.createElement('canvas');
  const stage = new Stage(glCanvas, def);
  stage.viewMode = options.view;
  stage.showLabels = options.showLabels;
  stage.setSize(width, height);
  await stage.load(manifest);

  // WebGL canvas chỉ giữ buffer đến khi compositor chạy, nên chép sang canvas 2D ngay sau render.
  const out2d = document.createElement('canvas');
  out2d.width = width;
  out2d.height = height;
  const ctx = out2d.getContext('2d');
  if (!ctx) throw new Error('Không tạo được canvas 2D');

  const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() });
  const source = new CanvasSource(out2d, { codec, quality: new Quality({ bitrate: BITRATE }), keyFrameInterval: 2 });
  output.addVideoTrack(source, { frameRate: def.fps });
  await output.start();

  const total = frameCount(def);
  try {
    for (let i = 0; i < total; i++) {
      const t = i / def.fps;
      stage.seek(t);
      stage.render();
      ctx.drawImage(glCanvas, 0, 0, width, height);
      await source.add(t, 1 / def.fps);
      onProgress(i + 1, total);
    }
    source.close();
    await output.finalize();
  } finally {
    stage.dispose();
  }
  const buffer = (output.target as BufferTarget).buffer;
  if (!buffer) throw new Error('Không có dữ liệu mp4');
  return new Blob([buffer], { type: 'video/mp4' });
}

const PLAN_SIZE = { width: 1600, height: 1200 };
const PLAN_HEADER = 64;
const PLAN_LEGEND_LINE = 30;

/**
 * Sơ đồ máy quay nhìn từ trên (PNG) để gửi kèm video cho AI: vị trí, hướng, khung nhìn của mọi máy,
 * quỹ đạo máy, đường đi nhân vật, nhãn khối bối cảnh; chú thích tiêu cự và thời điểm lên hình của từng máy.
 */
export async function exportPlanPng(def: SceneDef, manifest: Manifest, t: number): Promise<Blob> {
  const { width, height } = PLAN_SIZE;
  const glCanvas = document.createElement('canvas');
  const stage = new Stage(glCanvas, def);
  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('Không tạo được canvas 2D');
  try {
    stage.viewMode = 'plan';
    stage.setSize(width, height);
    await stage.load(manifest);
    stage.seek(t);
    stage.render();
    ctx.drawImage(glCanvas, 0, 0, width, height);
  } finally {
    stage.dispose();
  }

  ctx.fillStyle = 'rgba(20,22,26,0.88)';
  ctx.fillRect(0, 0, width, PLAN_HEADER);
  ctx.fillStyle = '#fff';
  ctx.font = '600 28px system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(strings.studio3dPlanTitle(def.title, t), 24, PLAN_HEADER / 2);

  const spans = shotSpans(def);
  const lines = def.cameras.map((cam) => {
    const ranges = spans
      .filter((s) => s.camera === cam.id)
      .map((s) => strings.studio3dShotRange(s.from, s.to))
      .join(', ');
    const focal = stage.cameraStates.get(cam.id)?.focal ?? 0;
    return { color: Stage.colorOf(def, cam.id), text: strings.studio3dPlanLegendCamera(cam.label ?? cam.id, focal, ranges) };
  });
  lines.push({ color: '#4f86ff', text: strings.studio3dPlanLegendPath }, { color: '', text: strings.studio3dPlanLegendUp });
  ctx.font = '22px system-ui, sans-serif';
  const boxW = Math.max(...lines.map((l) => ctx.measureText(l.text).width)) + 72;
  const boxH = lines.length * PLAN_LEGEND_LINE + 24;
  const y0 = height - boxH - 20;
  ctx.fillStyle = 'rgba(20,22,26,0.88)';
  ctx.beginPath();
  ctx.roundRect(20, y0, boxW, boxH, 10);
  ctx.fill();
  lines.forEach((l, i) => {
    const y = y0 + 12 + i * PLAN_LEGEND_LINE + PLAN_LEGEND_LINE / 2;
    if (l.color) {
      ctx.fillStyle = l.color;
      ctx.fillRect(36, y - 8, 16, 16);
    }
    ctx.fillStyle = '#fff';
    ctx.fillText(l.text, 64, y);
  });

  return new Promise((resolve, reject) =>
    out.toBlob((b) => (b ? resolve(b) : reject(new Error('Không tạo được ảnh PNG'))), 'image/png'),
  );
}

function evenSize(w: number, h: number): { width: number; height: number } {
  return { width: w - (w % 2), height: h - (h % 2) };
}
