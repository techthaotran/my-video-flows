/**
 * Định dạng cảnh 3D (file `studio3d/scenes/*.json`) - AI (Claude/Cursor) viết file này,
 * người dùng xem lại trong Studio 3D rồi mới export mp4.
 * Đơn vị: mét; trục Y hướng lên; góc quay tính bằng độ.
 */

import { z } from 'zod';

export const SCENE_VERSION = 1;

const Vec3 = z.tuple([z.number(), z.number(), z.number()]);
export type Vec3 = z.infer<typeof Vec3>;

export const EASES = ['linear', 'easeIn', 'easeOut', 'easeInOut'] as const;
export type EaseName = (typeof EASES)[number];
const Ease = z.enum(EASES);

const ActorKey = z.object({
  t: z.number().min(0),
  pos: Vec3,
  /** Tên clip animation (idle, walk, run, wave...). Bỏ trống = tự chọn walk khi đang di chuyển, idle khi đứng. */
  clip: z.string().optional(),
  ease: Ease.optional(),
});
export type ActorKey = z.infer<typeof ActorKey>;

const Actor = z.object({
  id: z.string().min(1),
  /** id trong `studio3d/public/models/manifest.json` */
  model: z.string().min(1),
  label: z.string().optional(),
  /** Chiều cao mong muốn (m); bỏ trống = theo manifest */
  height: z.number().positive().optional(),
  /** Hướng nhìn ban đầu (độ, 0 = nhìn về +Z); khi di chuyển tự quay theo hướng đi */
  yaw: z.number().default(0),
  keys: z.array(ActorKey).min(1),
});
export type Actor = z.infer<typeof Actor>;

/** Tiêu cự (mm, quy đổi theo khổ full-frame 36x24) - ưu tiên hơn `fov` khi có cả hai */
const Focal = z.number().min(8).max(400);

const CameraKey = z.object({
  t: z.number().min(0),
  pos: Vec3,
  lookAt: Vec3,
  focal: Focal.optional(),
  fov: z.number().min(10).max(120).optional(),
  ease: Ease.optional(),
});
export type CameraKey = z.infer<typeof CameraKey>;

const CameraDef = z.object({
  id: z.string().min(1),
  label: z.string().optional(),
  focal: Focal.optional(),
  fov: z.number().min(10).max(120).default(45),
  keys: z.array(CameraKey).min(1),
});
export type CameraDef = z.infer<typeof CameraDef>;

/** Cắt cảnh: từ `t` trở đi dùng camera `camera` (dùng khi export "theo shots") */
const Shot = z.object({
  t: z.number().min(0),
  camera: z.string().min(1),
  /** Mô tả ngắn shot này (hiện trong danh sách kịch bản để duyệt) */
  note: z.string().optional(),
  /**
   * Prompt Google Flow cho clip của shot này (diễn biến + máy quay), dùng `[Character]` để neo ảnh người mẫu.
   * Dòng tiêu đề (tỉ lệ, thời lượng) và phần chung trong `flow` được ghép thêm khi xuất workflow.
   */
  prompt: z.string().optional(),
});
export type Shot = z.infer<typeof Shot>;

/** Khối tĩnh của bối cảnh (tường, sàn, bàn, kệ...) - AI dựng từ ảnh bối cảnh */
const Block = z.object({
  id: z.string().optional(),
  label: z.string().optional(),
  shape: z.enum(['box', 'cylinder', 'sphere']).default('box'),
  /** Tâm của mặt đáy (m) */
  pos: Vec3,
  /** Rộng (X), cao (Y), sâu (Z) theo mét; cylinder/sphere dùng X làm đường kính */
  size: Vec3,
  /** Xoay quanh trục Y (độ) */
  yaw: z.number().default(0),
  color: z.string().optional(),
});
export type Block = z.infer<typeof Block>;

/** Ảnh bối cảnh gốc, lồng lên khung hình của camera chụp ảnh để căn khối cho khớp */
const Reference = z.object({
  /** Đường dẫn dưới `studio3d/public/`, ví dụ `refs/phong-khach.jpg` */
  image: z.string().min(1),
  /** id camera tái tạo đúng góc chụp của ảnh */
  camera: z.string().optional(),
  opacity: z.number().min(0).max(1).default(0.5),
});
export type Reference = z.infer<typeof Reference>;

/** Thiết lập xuất workflow Google Flow cho extension (`pnpm studio3d:flow`) */
const FlowSettings = z.object({
  /** Ảnh người mẫu dưới `studio3d/public/`, đóng gói vào .xflow.zip làm Asset Character */
  character: z.string().min(1),
  /** Mô tả người mẫu và trang phục, bắt đầu bằng `[Character]:` - ghép vào cuối mọi prompt */
  characterPrompt: z.string().min(1),
  /** Các dòng chung ghép sau prompt của shot (giữ trang phục, bối cảnh, ánh sáng...) */
  common: z.array(z.string()).default([]),
  model: z.string().default('Omni Flash'),
  resolution: z.number().int().default(720),
});
export type FlowSettings = z.infer<typeof FlowSettings>;

/** File cũ chỉ có `camera` (một góc): tự chuyển thành `cameras: [{ id: 'main', ... }]`. */
function upgradeLegacyCamera(input: unknown): unknown {
  if (input && typeof input === 'object' && 'camera' in input && !('cameras' in input)) {
    const { camera, ...rest } = input as Record<string, unknown>;
    return { ...rest, cameras: [{ id: 'main', ...(camera as object) }] };
  }
  return input;
}

export const SceneSchema = z.preprocess(
  upgradeLegacyCamera,
  z.object({
    version: z.literal(SCENE_VERSION),
    title: z.string().min(1),
    /** Ghi chú kịch bản / ý đồ cho người duyệt */
    notes: z.string().optional(),
    fps: z.number().int().min(1).max(60).default(30),
    size: z
      .object({ width: z.number().int().min(64).max(3840), height: z.number().int().min(64).max(2160) })
      .default({ width: 1280, height: 720 }),
    duration: z.number().positive().max(300),
    background: z.string().default('#dfe6ee'),
    ground: z.boolean().default(true),
    /** clay = mô hình trắng (khối xám, nhân vật xanh, có viền) để làm video tham khảo; color = màu theo manifest */
    style: z.enum(['clay', 'color']).default('clay'),
    environment: z.object({ blocks: z.array(Block).default([]) }).default({ blocks: [] }),
    reference: Reference.optional(),
    flow: FlowSettings.optional(),
    actors: z.array(Actor),
    /** Nhiều góc camera, mỗi góc có đường đi riêng */
    cameras: z.array(CameraDef).min(1),
    /** Danh sách cắt cảnh giữa các camera; bỏ trống = dùng camera đầu tiên suốt cảnh */
    shots: z.array(Shot).default([]),
  }),
);
export type SceneDef = z.infer<typeof SceneSchema>;

export const ManifestEntrySchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['character', 'prop']),
  /** Đường dẫn .glb dưới `models/`; bỏ trống = dùng hình khối thay thế (fallback) */
  file: z.string().optional(),
  /** Chiều cao mặc định (m) để scale model */
  height: z.number().positive().optional(),
  /** alias clip dùng trong cảnh -> tên clip thật trong file glb */
  clips: z.record(z.string()).optional(),
  fallback: z
    .object({
      shape: z.enum(['humanoid', 'box', 'cylinder', 'sphere']).default('box'),
      size: Vec3.default([1, 1, 1]),
      color: z.string().default('#8899aa'),
    })
    .optional(),
});
export type ManifestEntry = z.infer<typeof ManifestEntrySchema>;

export const ManifestSchema = z.object({ models: z.array(ManifestEntrySchema) });
export type Manifest = z.infer<typeof ManifestSchema>;

/** Kiểm tra tham chiếu chéo mà zod không bắt được; trả danh sách lỗi tiếng Việt. */
export function validateScene(scene: SceneDef, manifest: Manifest): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const known = new Set(manifest.models.map((m) => m.id));
  for (const actor of scene.actors) {
    if (ids.has(actor.id)) errors.push(`Trùng id nhân vật/vật thể: ${actor.id}`);
    ids.add(actor.id);
    if (!known.has(actor.model)) errors.push(`"${actor.id}": model "${actor.model}" không có trong manifest`);
    if (!isSorted(actor.keys.map((k) => k.t))) errors.push(`"${actor.id}": keys phải tăng dần theo t`);
  }
  const cameraIds = new Set<string>();
  for (const cam of scene.cameras) {
    if (cameraIds.has(cam.id)) errors.push(`Trùng id camera: ${cam.id}`);
    cameraIds.add(cam.id);
    if (!isSorted(cam.keys.map((k) => k.t))) errors.push(`Camera "${cam.id}": keys phải tăng dần theo t`);
  }
  for (const shot of scene.shots) {
    if (!cameraIds.has(shot.camera)) errors.push(`Shot t=${shot.t}: camera "${shot.camera}" không tồn tại`);
  }
  if (!isSorted(scene.shots.map((x) => x.t))) errors.push('Shots phải tăng dần theo t');
  if (scene.reference?.camera && !cameraIds.has(scene.reference.camera)) {
    errors.push(`reference.camera "${scene.reference.camera}" không tồn tại`);
  }
  return errors;
}

function isSorted(values: number[]): boolean {
  return values.every((v, i) => i === 0 || v >= values[i - 1]);
}
