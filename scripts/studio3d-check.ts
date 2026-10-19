/**
 * `pnpm studio3d:check [file...]` - kiểm tra file cảnh Studio 3D (mặc định: mọi file trong studio3d/scenes).
 * Thoát mã 1 nếu có lỗi; cảnh báo (đi xuyên khối...) không làm thất bại.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ManifestSchema, SceneSchema, validateScene } from '../src/studio3d/schema';
import { pathCollisions, sceneSummary } from '../src/studio3d/analysis';
import { flowProblems } from '../src/studio3d/flowWorkflow';

const root = resolve(import.meta.dirname, '..');
const publicDir = join(root, 'studio3d/public');
const manifest = ManifestSchema.parse(JSON.parse(readFileSync(join(publicDir, 'models/manifest.json'), 'utf8')));

const args = process.argv.slice(2);
const files = args.length
  ? args.map((f) => resolve(f))
  : readdirSync(join(root, 'studio3d/scenes'))
      .filter((f) => f.endsWith('.json'))
      .map((f) => join(root, 'studio3d/scenes', f));

let failed = false;
for (const file of files) {
  console.log(`\n== ${file.replace(root + '/', '')}`);
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    console.log(`LỖI: JSON hỏng - ${e instanceof Error ? e.message : String(e)}`);
    failed = true;
    continue;
  }
  const parsed = SceneSchema.safeParse(raw);
  if (!parsed.success) {
    for (const i of parsed.error.issues) console.log(`LỖI: ${i.path.join('.')}: ${i.message}`);
    failed = true;
    continue;
  }
  const scene = parsed.data;
  const errors = validateScene(scene, manifest);
  if (scene.reference && !existsSync(join(publicDir, scene.reference.image))) {
    errors.push(`Không thấy ảnh studio3d/public/${scene.reference.image}`);
  }
  // Khối flow là tuỳ chọn; đã khai báo thì phải xuất được workflow.
  if (scene.flow) {
    errors.push(...flowProblems(scene));
    if (!existsSync(join(publicDir, scene.flow.character))) errors.push(`Không thấy ảnh người mẫu studio3d/public/${scene.flow.character}`);
  }
  for (const e of errors) console.log(`LỖI: ${e}`);
  if (errors.length) failed = true;
  for (const w of pathCollisions(scene, manifest)) console.log(`CẢNH BÁO: ${w}`);
  console.log(sceneSummary(scene));
}
process.exit(failed ? 1 : 0);
