/**
 * `pnpm studio3d:flow <file cảnh> [--previz <mp4>]` - xuất workflow Google Flow dạng .xflow.zip
 * (kèm ảnh người mẫu) vào `studio3d/flows/<tên cảnh>.xflow.zip`, import trong side panel là chạy được ngay.
 *
 * `--previz`: mp4 export "Theo shots" của cả cảnh từ Studio 3D. Script cắt đúng từng shot (ffmpeg)
 * và gắn mỗi đoạn làm Asset `Video reference` của clip tương ứng (Omni chỉnh sửa video theo previz).
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, extname, join, resolve } from 'node:path';
import { strToU8, zipSync } from 'fflate';
import { readMp4VideoInfo } from '../src/media/mp4Info';
import { SceneSchema, type SceneDef } from '../src/studio3d/schema';
import { buildFlowPackage, flowProblems, type FlowPrevizClip } from '../src/studio3d/flowWorkflow';
import { shotSpans } from '../src/studio3d/timeline';

const MIME: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

/** Lệch độ dài cho phép giữa file previz và cảnh (làm tròn khung cuối khi encode). */
const PREVIZ_TOLERANCE_SEC = 0.15;

function fail(message: string): never {
  console.log(`LỖI: ${message}`);
  process.exit(1);
}

function parseArgs(argv: string[]): { sceneFile?: string; previzFile?: string } {
  const out: { sceneFile?: string; previzFile?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--previz') out.previzFile = argv[++i];
    else if (!out.sceneFile) out.sceneFile = argv[i];
  }
  return out;
}

/** Cắt previz cả cảnh thành từng shot (encode lại để cắt đúng khung, bỏ tiếng). */
function cutPreviz(scene: SceneDef, file: string, slug: string): { clips: FlowPrevizClip[]; bytes: Uint8Array[] } {
  const info = readMp4VideoInfo(new Uint8Array(readFileSync(file)));
  if (!info) fail(`không đọc được video previz ${file} (cần mp4 export từ Studio 3D)`);
  if (Math.abs(info.durationSec - scene.duration) > PREVIZ_TOLERANCE_SEC) {
    fail(
      `previz dài ${info.durationSec.toFixed(2)}s nhưng cảnh dài ${scene.duration}s - export lại với góc "Theo shots" cho cả cảnh`,
    );
  }
  if (spawnSync('ffmpeg', ['-version']).status !== 0) fail('cần ffmpeg để cắt previz (brew install ffmpeg)');

  const dir = mkdtempSync(join(tmpdir(), 'studio3d-previz-'));
  try {
    const clips: FlowPrevizClip[] = [];
    const bytes: Uint8Array[] = [];
    for (const [i, span] of shotSpans(scene).entries()) {
      const out = join(dir, `${slug}-shot${i + 1}.mp4`);
      const cut = spawnSync('ffmpeg', [
        '-v', 'error', '-y',
        '-ss', span.from.toFixed(3), '-i', file, '-t', (span.to - span.from).toFixed(3),
        '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart',
        out,
      ]);
      if (cut.status !== 0) fail(`ffmpeg cắt shot ${i + 1} thất bại: ${cut.stderr.toString().trim()}`);
      const data = new Uint8Array(readFileSync(out));
      const got = readMp4VideoInfo(data);
      const want = span.to - span.from;
      if (!got || Math.abs(got.durationSec - want) > PREVIZ_TOLERANCE_SEC) {
        fail(`đoạn previz shot ${i + 1} dài ${got?.durationSec.toFixed(2) ?? '?'}s, cần ${want.toFixed(2)}s`);
      }
      clips.push({
        sha256: createHash('sha256').update(data).digest('hex'),
        size: data.length,
        originalName: `${slug}-shot${i + 1}.mp4`,
      });
      bytes.push(data);
    }
    return { clips, bytes };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const root = resolve(import.meta.dirname, '..');
const { sceneFile, previzFile } = parseArgs(process.argv.slice(2));
if (!sceneFile) {
  console.log('Cách dùng: pnpm studio3d:flow studio3d/scenes/<cảnh>.json [--previz <mp4 export Theo shots>]');
  process.exit(1);
}

const scene = SceneSchema.parse(JSON.parse(readFileSync(resolve(sceneFile), 'utf8')));
const slug = basename(sceneFile, '.json');
const problems = flowProblems(scene, { previz: !!previzFile });
if (problems.length > 0) {
  for (const p of problems) console.log(`LỖI: ${p}`);
  process.exit(1);
}

const imageFile = join(root, 'studio3d/public', scene.flow!.character);
const ext = extname(imageFile).toLowerCase();
const mime = MIME[ext];
if (!mime) {
  console.log(`LỖI: ảnh người mẫu phải là jpg, png hoặc webp (${scene.flow!.character})`);
  process.exit(1);
}
let bytes: Buffer;
try {
  bytes = readFileSync(imageFile);
} catch {
  console.log(`LỖI: không đọc được ảnh studio3d/public/${scene.flow!.character}`);
  process.exit(1);
}

const previz = previzFile ? cutPreviz(scene, resolve(previzFile), slug) : { clips: [], bytes: [] };
const sha256 = createHash('sha256').update(bytes).digest('hex');
const pkg = buildFlowPackage(
  scene,
  { sha256, mime, size: bytes.length, originalName: basename(imageFile), ext: ext === '.jpeg' ? '.jpg' : ext },
  Date.now(),
  previz.clips,
);
const zip = zipSync(
  {
    'manifest.json': strToU8(JSON.stringify(pkg.manifest, null, 2)),
    [pkg.manifest.workflows[0].path]: strToU8(JSON.stringify(pkg.workflow, null, 2)),
    [pkg.imagePath]: new Uint8Array(bytes),
    ...Object.fromEntries(pkg.previzPaths.map((path, i) => [path, previz.bytes[i]!])),
  },
  { level: 6 },
);

const outDir = join(root, 'studio3d/flows');
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, `${slug}.xflow.zip`);
writeFileSync(outFile, zip);
const clips = pkg.workflow.nodes.filter((n) => n.type === 'generateVideo');
console.log(`Đã xuất ${outFile.replace(root + '/', '')}`);
console.log(`${clips.length} clip: ${clips.map((n) => `${n.label} ${n.data.durationSec}s`).join(', ')}`);
console.log(previzFile ? `Có previz: mỗi clip nối 1 Asset "Video reference" (Omni chỉnh sửa video theo previz)` : 'Không có previz: góc máy chỉ đi qua chữ trong prompt');
