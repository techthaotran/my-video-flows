/** Kiểm tra bố cục cảnh mà schema không bắt được - dùng cho `pnpm studio3d:check` để AI tự sửa trước khi người dùng mở Studio. */

import type { Block, Manifest, SceneDef } from './schema';
import { actorStateAt } from './timeline';

/** Bán kính thân nhân vật (m) khi xét va chạm với khối */
const BODY_RADIUS = 0.2;
const SAMPLE_STEP = 0.1;
/** Khối thấp hơn mức này (thảm, bậc thấp) đi lên được, không tính va chạm */
const WALKABLE_HEIGHT = 0.2;

/** Điểm (x, z) có nằm trong hình chiếu đáy của khối (đã nới thêm `margin`) và thấp hơn đỉnh khối không. */
export function insideBlock(block: Block, x: number, y: number, z: number, margin = 0): boolean {
  const [bx, by, bz] = block.pos;
  const [sx, sy, sz] = block.size;
  if (y >= by + sy || y + 1.5 <= by) return false;
  const yaw = (-block.yaw * Math.PI) / 180;
  const dx = x - bx;
  const dz = z - bz;
  const lx = dx * Math.cos(yaw) + dz * Math.sin(yaw);
  const lz = -dx * Math.sin(yaw) + dz * Math.cos(yaw);
  if (block.shape !== 'box') return Math.hypot(lx, lz) < sx / 2 + margin;
  return Math.abs(lx) < sx / 2 + margin && Math.abs(lz) < sz / 2 + margin;
}

/** Cảnh báo khi nhân vật đi xuyên khối bối cảnh. Mỗi cặp (nhân vật, khối) chỉ báo lần đầu. */
export function pathCollisions(scene: SceneDef, manifest: Manifest): string[] {
  const characters = new Set(manifest.models.filter((m) => m.kind === 'character').map((m) => m.id));
  const out: string[] = [];
  for (const actor of scene.actors) {
    if (!characters.has(actor.model)) continue;
    const reported = new Set<Block>();
    for (let t = 0; t <= scene.duration + 1e-9; t += SAMPLE_STEP) {
      const [x, y, z] = actorStateAt(actor, t).pos;
      for (const block of scene.environment.blocks) {
        if (block.size[1] < WALKABLE_HEIGHT || reported.has(block) || !insideBlock(block, x, y, z, BODY_RADIUS)) continue;
        reported.add(block);
        out.push(`"${actor.id}" đi xuyên khối "${block.id ?? block.label ?? '?'}" lúc t=${t.toFixed(1)}s`);
      }
    }
  }
  return out;
}

/** Tóm tắt kích thước cảnh để AI soát nhanh tỉ lệ. */
export function sceneSummary(scene: SceneDef): string {
  const blocks = scene.environment.blocks;
  const xs = blocks.flatMap((b) => [b.pos[0] - b.size[0] / 2, b.pos[0] + b.size[0] / 2]);
  const zs = blocks.flatMap((b) => [b.pos[2] - b.size[2] / 2, b.pos[2] + b.size[2] / 2]);
  const ys = blocks.map((b) => b.pos[1] + b.size[1]);
  const span = (v: number[]) => (v.length ? `${Math.min(...v).toFixed(1)}..${Math.max(...v).toFixed(1)}` : '-');
  return [
    `${scene.title}: ${scene.duration}s, ${scene.size.width}x${scene.size.height}, style=${scene.style}`,
    `${scene.actors.length} đối tượng, ${scene.cameras.length} camera, ${blocks.length} khối bối cảnh`,
    `Bối cảnh: X ${span(xs)} m, Z ${span(zs)} m, cao nhất ${ys.length ? Math.max(...ys).toFixed(1) : '-'} m`,
  ].join('\n');
}
