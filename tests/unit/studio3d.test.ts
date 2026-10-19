import { describe, expect, it } from 'vitest';
import demo from '../../studio3d/scenes/demo.json';
import manifest from '../../studio3d/public/models/manifest.json';
import { ManifestSchema, SceneSchema, validateScene } from '@/studio3d/schema';
import { activeCameraAt, actorStateAt, cameraStateAt, ease, focalToFov, fovToFocal, frameCount, shotSpans } from '@/studio3d/timeline';
import { insideBlock, pathCollisions } from '@/studio3d/analysis';

const scene = SceneSchema.parse(demo);

describe('studio3d schema', () => {
  it('cảnh demo và manifest hợp lệ', () => {
    expect(validateScene(scene, ManifestSchema.parse(manifest))).toEqual([]);
  });

  it('báo model không có trong manifest và keys sai thứ tự', () => {
    const bad = SceneSchema.parse({
      ...demo,
      actors: [{ id: 'x', model: 'ghost', keys: [{ t: 2, pos: [0, 0, 0] }, { t: 1, pos: [0, 0, 0] }] }],
    });
    const errors = validateScene(bad, ManifestSchema.parse(manifest));
    expect(errors).toHaveLength(2);
  });
});

describe('studio3d timeline', () => {
  it('ease giữ đầu mút', () => {
    for (const n of ['linear', 'easeIn', 'easeOut', 'easeInOut'] as const) {
      expect(ease(n, 0)).toBe(0);
      expect(ease(n, 1)).toBe(1);
    }
  });

  it('nhân vật đi: vị trí nội suy, quay theo hướng đi, clip walk rồi idle', () => {
    const a = scene.actors.find((x) => x.id === 'a')!;
    const start = actorStateAt(a, 0);
    expect(start.pos).toEqual([-5, 0, 1.5]);
    const mid = actorStateAt(a, 2);
    expect(mid.moving).toBe(true);
    expect(mid.clip).toBe('walk');
    expect(mid.yaw).toBeGreaterThan(1.2);
    const wave = actorStateAt(a, 5);
    expect(wave.clip).toBe('wave');
    expect(wave.clipStart).toBe(4.2);
    expect(wave.moving).toBe(false);
  });

  it('camera nội suy và frameCount theo fps', () => {
    expect(cameraStateAt(scene, 'wide', 0).pos).toEqual([-3, 3, 9]);
    expect(cameraStateAt(scene, 'wide', 99).pos).toEqual([0.5, 1.7, 4.5]);
    expect(cameraStateAt(scene, 'top', 0).pos[1]).toBe(9);
    expect(frameCount(scene)).toBe(180);
  });

  it('shots chọn đúng camera theo thời gian', () => {
    expect(activeCameraAt(scene, 0)).toBe('wide');
    expect(activeCameraAt(scene, 3)).toBe('close-a');
    expect(activeCameraAt(scene, 5.9)).toBe('top');
  });

  it('không có shots thì dùng camera đầu tiên', () => {
    expect(activeCameraAt({ ...scene, shots: [] }, 4)).toBe('wide');
  });

  it('file cũ chỉ có `camera` được nâng thành cameras[main]', () => {
    const { cameras, shots: _s, ...rest } = demo as Record<string, unknown> & { cameras: { keys: unknown[] }[] };
    const legacy = SceneSchema.parse({ ...rest, camera: { fov: 45, keys: cameras[0].keys } });
    expect(legacy.cameras.map((c) => c.id)).toEqual(['main']);
  });

  it('báo shot trỏ tới camera không tồn tại', () => {
    const bad = SceneSchema.parse({ ...demo, shots: [{ t: 0, camera: 'nope' }] });
    expect(validateScene(bad, ManifestSchema.parse(manifest))).toHaveLength(1);
  });
});

describe('studio3d tiêu cự', () => {
  it('quy đổi mm <-> fov khứ hồi, khung dọc dùng cạnh cảm biến 36mm', () => {
    expect(fovToFocal(focalToFov(35))).toBeCloseTo(35, 6);
    // 24mm ngang: góc dọc khoảng 53 độ
    expect(focalToFov(24, 16 / 9)).toBeCloseTo(53.13, 1);
    expect(focalToFov(24, 9 / 16)).toBeGreaterThan(focalToFov(24, 16 / 9));
  });

  it('focal ở key ưu tiên hơn fov, nội suy theo mm', () => {
    const s = SceneSchema.parse({
      ...demo,
      cameras: [
        {
          id: 'c',
          focal: 24,
          keys: [
            { t: 0, pos: [0, 1, 5], lookAt: [0, 1, 0] },
            { t: 2, pos: [0, 1, 5], lookAt: [0, 1, 0], focal: 50, fov: 90 },
          ],
        },
      ],
      shots: [],
    });
    expect(cameraStateAt(s, 'c', 0).focal).toBeCloseTo(24, 6);
    expect(cameraStateAt(s, 'c', 1).focal).toBeCloseTo(37, 6);
    expect(cameraStateAt(s, 'c', 2).focal).toBeCloseTo(50, 6);
  });
});

describe('studio3d bối cảnh', () => {
  const m = ManifestSchema.parse(manifest);
  const withBlocks = (blocks: unknown[], extra: Record<string, unknown> = {}) =>
    SceneSchema.parse({ ...demo, environment: { blocks }, ...extra });

  it('mặc định style clay, không có khối', () => {
    expect(scene.style).toBe('clay');
    expect(scene.environment.blocks).toEqual([]);
  });

  it('insideBlock tính cả góc xoay yaw', () => {
    const [b] = withBlocks([{ pos: [0, 0, 0], size: [4, 2, 0.2], yaw: 90 }]).environment.blocks;
    expect(insideBlock(b, 0, 0, 1.5)).toBe(true);
    expect(insideBlock(b, 1.5, 0, 0)).toBe(false);
  });

  it('báo nhân vật đi xuyên tường, bỏ qua khối thấp như thảm và vật thể không phải nhân vật', () => {
    const s = withBlocks([
      { id: 'wall', pos: [-3, 0, 1.4], size: [0.2, 3, 3] },
      { id: 'rug', pos: [-3, 0, 1.4], size: [3, 0.02, 3] },
    ]);
    const warnings = pathCollisions(s, m);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('"a"');
    expect(warnings[0]).toContain('"wall"');
  });

  it('báo reference.camera không tồn tại', () => {
    const s = withBlocks([], { reference: { image: 'refs/x.jpg', camera: 'nope' } });
    expect(validateScene(s, m)).toEqual(['reference.camera "nope" không tồn tại']);
  });
});

describe('studio3d shotSpans', () => {
  it('đoạn liên tiếp phủ kín cảnh, đoạn đầu luôn bắt đầu từ 0, giữ note', () => {
    const spans = shotSpans(scene);
    expect(spans.map((s) => [s.from, s.to, s.camera])).toEqual([
      [0, 3, 'wide'],
      [3, 5, 'close-a'],
      [5, 6, 'top'],
    ]);
    expect(spans[0].note).toBe('Toàn cảnh, máy dolly vào.');
  });

  it('không có shots thì một đoạn dùng camera đầu tiên; shot nằm ngoài thời lượng bị bỏ', () => {
    expect(shotSpans({ ...scene, shots: [] })).toEqual([{ from: 0, to: 6, camera: 'wide' }]);
    const late = shotSpans({ ...scene, shots: [{ t: 1, camera: 'top' }, { t: 9, camera: 'wide' }] });
    expect(late).toEqual([{ from: 0, to: 6, camera: 'top', note: undefined }]);
  });
});
