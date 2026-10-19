/** Nội suy keyframe thuần (không phụ thuộc three) - dùng chung cho preview và export để hai bên ra cùng một khung hình. */

import type { Actor, CameraDef, CameraKey, EaseName, SceneDef, Vec3 } from './schema';

export function ease(name: EaseName | undefined, u: number): number {
  const x = Math.min(1, Math.max(0, u));
  switch (name) {
    case 'easeIn':
      return x * x;
    case 'easeOut':
      return 1 - (1 - x) * (1 - x);
    case 'easeInOut':
      return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
    default:
      return x;
  }
}

const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const lerpVec = (a: Vec3, b: Vec3, u: number): Vec3 => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];

interface Keyed {
  t: number;
  ease?: EaseName;
}

/** Tìm đoạn [a, b] chứa t và tỉ lệ đã ease. Ngoài biên thì giữ nguyên key đầu/cuối. */
export function segmentAt<K extends Keyed>(keys: K[], t: number): { a: K; b: K; u: number } {
  if (t <= keys[0].t) return { a: keys[0], b: keys[0], u: 0 };
  const last = keys[keys.length - 1];
  if (t >= last.t) return { a: last, b: last, u: 0 };
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (t >= a.t && t <= b.t) {
      const span = b.t - a.t;
      return { a, b, u: span > 0 ? ease(b.ease, (t - a.t) / span) : 1 };
    }
  }
  return { a: last, b: last, u: 0 };
}

export interface ActorState {
  pos: Vec3;
  /** Radian quanh trục Y */
  yaw: number;
  clip: string;
  /** Thời điểm bắt đầu clip hiện tại (giây, theo timeline) */
  clipStart: number;
  moving: boolean;
}

const MOVING_SPEED = 0.05;

export function actorStateAt(actor: Actor, t: number): ActorState {
  const { a, b, u } = segmentAt(actor.keys, t);
  const pos = lerpVec(a.pos, b.pos, u);

  let yaw = (actor.yaw * Math.PI) / 180;
  let moving = false;
  for (let i = 0; i < actor.keys.length - 1; i++) {
    const k0 = actor.keys[i];
    const k1 = actor.keys[i + 1];
    if (k0.t > t) break;
    const dx = k1.pos[0] - k0.pos[0];
    const dz = k1.pos[2] - k0.pos[2];
    const dist = Math.hypot(dx, dz);
    const span = k1.t - k0.t;
    const speed = span > 0 ? dist / span : 0;
    if (speed > MOVING_SPEED) {
      yaw = Math.atan2(dx, dz);
      if (t < k1.t) moving = true;
    }
  }

  let clip: string | undefined;
  let clipStart = 0;
  for (const key of actor.keys) {
    if (key.t > t) break;
    if (key.clip) {
      clip = key.clip;
      clipStart = key.t;
    }
  }
  return { pos, yaw, clip: clip ?? (moving ? 'walk' : 'idle'), clipStart, moving };
}

export interface CameraState {
  pos: Vec3;
  lookAt: Vec3;
  /** Góc nhìn dọc (độ) */
  fov: number;
  /** Tiêu cự tương đương full-frame (mm) */
  focal: number;
}

/**
 * Cạnh dọc của cảm biến full-frame 36x24 (mm): khung ngang dùng cạnh 24, khung dọc (9:16) xoay máy nên dùng cạnh 36.
 * Nhờ vậy "24mm" trong cảnh khớp với cách hiểu tiêu cự tương đương của điện thoại/máy ảnh.
 */
function sensorHeight(aspect: number): number {
  return aspect >= 1 ? 24 : 36;
}

/** Góc nhìn dọc (độ) từ tiêu cự; `aspect` = rộng / cao của khung hình */
export function focalToFov(focal: number, aspect = 16 / 9): number {
  return (2 * Math.atan(sensorHeight(aspect) / (2 * focal)) * 180) / Math.PI;
}

export function fovToFocal(fov: number, aspect = 16 / 9): number {
  return sensorHeight(aspect) / (2 * Math.tan((fov * Math.PI) / 360));
}

function keyFov(key: CameraKey, cam: CameraDef, aspect: number): number {
  if (key.focal) return focalToFov(key.focal, aspect);
  if (key.fov) return key.fov;
  return cam.focal ? focalToFov(cam.focal, aspect) : cam.fov;
}

export function cameraStateAt(scene: SceneDef, cameraId: string, t: number): CameraState {
  const cam: CameraDef = scene.cameras.find((c) => c.id === cameraId) ?? scene.cameras[0];
  const { a, b, u } = segmentAt(cam.keys, t);
  // Nội suy theo tiêu cự (mm) cho giống thao tác zoom ống kính thật.
  const aspect = scene.size.width / scene.size.height;
  const focal = lerp(fovToFocal(keyFov(a, cam, aspect), aspect), fovToFocal(keyFov(b, cam, aspect), aspect), u);
  return {
    pos: lerpVec(a.pos, b.pos, u),
    lookAt: lerpVec(a.lookAt, b.lookAt, u),
    fov: focalToFov(focal, aspect),
    focal,
  };
}

/** Camera đang "lên hình" theo danh sách shots tại thời điểm t. */
export function activeCameraAt(scene: SceneDef, t: number): string {
  if (scene.shots.length === 0) return scene.cameras[0].id;
  let id = scene.shots[0].camera;
  for (const shot of scene.shots) {
    if (shot.t > t) break;
    id = shot.camera;
  }
  return id;
}

export function frameCount(scene: SceneDef): number {
  return Math.max(1, Math.round(scene.duration * scene.fps));
}

export interface ShotSpan {
  from: number;
  to: number;
  camera: string;
  note?: string;
}

/** Các đoạn liên tiếp phủ kín [0, duration], mỗi đoạn một camera - dùng cho timeline và danh sách kịch bản. */
export function shotSpans(scene: SceneDef): ShotSpan[] {
  if (scene.shots.length === 0) return [{ from: 0, to: scene.duration, camera: scene.cameras[0].id }];
  const shots = scene.shots.filter((s) => s.t < scene.duration);
  return shots.map((s, i) => ({
    from: i === 0 ? 0 : s.t,
    to: i + 1 < shots.length ? shots[i + 1].t : scene.duration,
    camera: s.camera,
    note: s.note,
  }));
}
