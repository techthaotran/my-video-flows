import { beforeEach, describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import demo from '../../studio3d/scenes/demo.json';
import { db } from '@/storage/db';
import { commitImport, parseImportFile } from '@/storage/transfer';
import { getNodePorts } from '@/nodes/registry';
import { isValidConnection } from '@/nodes/ports';
import { VIDEO_DURATIONS, type NodeType } from '@/shared/schema';
import { sha256 } from '@/shared/utils';
import { SceneSchema } from '@/studio3d/schema';
import { buildFlowPackage, clipDuration, clipPrompt, flowProblems, PREVIZ_LABEL, sceneAspectRatio } from '@/studio3d/flowWorkflow';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

const flow = {
  character: 'refs/x.png',
  characterPrompt: '[Character]: cô gái áo hồng.',
  common: ['Giữ nguyên trang phục.'],
};

/** Cảnh demo (6s, 3 shot) gắn thêm khối flow và prompt cho từng shot */
const scene = SceneSchema.parse({
  ...demo,
  size: { width: 720, height: 1280 },
  flow,
  shots: demo.shots.map((s, i) => ({ ...s, prompt: `[Character] làm việc ${i + 1}.` })),
});

const IMAGE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 7, 8]);

/** Ba đoạn previz giả (nội dung khác nhau để sha khác nhau) */
const PREVIZ = [1, 2, 3].map((n) => new Uint8Array([0, 0, 0, 8, 0x66, 0x74, 0x79, 0x70, n]));

async function zipOf(now: number, opts: { previz?: boolean } = {}): Promise<{ file: File; workflowId: string }> {
  const blob = new Blob([IMAGE.slice()], { type: 'image/png' });
  const sha = await sha256(blob);
  const clips = opts.previz
    ? await Promise.all(
        PREVIZ.map(async (bytes, i) => ({
          sha256: await sha256(new Blob([bytes.slice()], { type: 'video/mp4' })),
          size: bytes.length,
          originalName: `demo-shot${i + 1}.mp4`,
        })),
      )
    : [];
  const pkg = buildFlowPackage(scene, { sha256: sha, mime: 'image/png', size: IMAGE.length, originalName: 'x.png', ext: '.png' }, now, clips);
  const zip = zipSync({
    'manifest.json': strToU8(JSON.stringify(pkg.manifest)),
    [pkg.manifest.workflows[0].path]: strToU8(JSON.stringify(pkg.workflow)),
    [pkg.imagePath]: IMAGE.slice(),
    ...Object.fromEntries(pkg.previzPaths.map((path, i) => [path, PREVIZ[i]!.slice()])),
  });
  return { file: new File([zip.slice()], 'scene.xflow.zip', { type: 'application/zip' }), workflowId: pkg.workflow.id };
}

describe('studio3d flowWorkflow', () => {
  it('báo thiếu flow, thiếu prompt, thiếu [Character]', () => {
    expect(flowProblems(SceneSchema.parse(demo))).toHaveLength(1);
    const noPrompt = SceneSchema.parse({ ...demo, flow: { ...flow, characterPrompt: 'cô gái' } });
    expect(flowProblems(noPrompt)).toEqual([
      'flow.characterPrompt phải có [Character] để neo ảnh người mẫu',
      'Shot 1: thiếu prompt',
      'Shot 2: thiếu prompt',
      'Shot 3: thiếu prompt',
    ]);
  });

  it('thời lượng clip là mức Flow nhỏ nhất đủ chứa shot; shot quá 10s thì không xuất được', () => {
    expect(clipDuration({ from: 0, to: 3, camera: 'a' })).toBe(4);
    expect(clipDuration({ from: 0, to: 8, camera: 'a' })).toBe(8);
    expect(clipDuration({ from: 0, to: 8.02, camera: 'a' })).toBe(8);
    expect(clipDuration({ from: 0, to: 12, camera: 'a' })).toBeUndefined();
    const long = SceneSchema.parse({ ...scene, duration: 30, shots: [{ t: 0, camera: 'wide', prompt: 'x' }] });
    expect(flowProblems(long)).toEqual(['Shot 1: dài 30.0s, vượt thời lượng tối đa 10s của Flow']);
  });

  it('tỉ lệ khung và prompt ghép đủ tiêu đề, phần chung, mô tả nhân vật', () => {
    expect(sceneAspectRatio(scene)).toBe('9:16');
    expect(sceneAspectRatio(SceneSchema.parse(demo))).toBe('16:9');
    expect(clipPrompt(scene, 1).split('\n')).toEqual([
      'Video dọc 9:16 dài 4 giây, một cảnh quay liền không cắt.',
      '[Character] làm việc 2.',
      'Giữ nguyên trang phục.',
      '',
      '[Character]: cô gái áo hồng.',
    ]);
  });

  it('zip import được: ảnh người mẫu gắn sẵn, cạnh hợp lệ, thời lượng hợp lệ', async () => {
    const { file } = await zipOf(1_700_000_000_000);
    const preview = await parseImportFile(file);
    expect(preview.items[0].warnings).toEqual([]);
    expect(preview.assetBlobs.size).toBe(1);

    const [wf] = await commitImport({ preview, targetWorkspaceId: 'ws-1', dupStrategy: 'copy' });
    const character = wf.nodes.find((n) => n.id === 'asset-character')!;
    expect(character.data.missing).toBe(false);
    expect(character.data.assetId).toBeTruthy();
    expect(wf.workspaceId).toBe('ws-1');

    const byId = new Map(wf.nodes.map((n) => [n.id, n]));
    const accepted: typeof wf.edges = [];
    for (const e of wf.edges) {
      const ok = isValidConnection(
        e as never,
        accepted as never,
        (id) => {
          const n = byId.get(id);
          return n ? getNodePorts(n.type as NodeType, n.data) : undefined;
        },
        (id) => byId.get(id)?.type as NodeType,
      );
      expect(ok, e.id).toBe(true);
      accepted.push(e);
    }
    const clips = wf.nodes.filter((n) => n.type === 'generateVideo');
    expect(clips).toHaveLength(3);
    for (const c of clips) expect(VIDEO_DURATIONS as readonly number[]).toContain(c.data.durationSec);
    expect(wf.settings.retry).toBe(0);
  });

  it('previz: prompt có dòng dẫn [Video reference], dài đúng bằng shot', () => {
    const lines = clipPrompt(scene, 1, { previz: true }).split('\n');
    expect(lines[0]).toBe('Video dọc 9:16 dài 2 giây, một cảnh quay liền không cắt.');
    expect(lines[1]).toContain(`[${PREVIZ_LABEL}]`);
    expect(lines).toContain('[Character] làm việc 2.');
  });

  it('previz: chỉ Omni, đủ một clip cho mỗi shot', () => {
    const veo = SceneSchema.parse({ ...scene, flow: { ...flow, model: 'Veo 3.1 - Fast' } });
    expect(flowProblems(veo, { previz: true })).toEqual([
      'flow.model là "Veo 3.1 - Fast": chỉ Omni Flash nhận video previz làm tham chiếu',
    ]);
    expect(flowProblems(veo)).toEqual([]);
    const image = { sha256: 'a', mime: 'image/png', size: 1, originalName: 'x.png', ext: '.png' };
    expect(() => buildFlowPackage(scene, image, 1, [{ sha256: 'b', size: 1, originalName: 'p.mp4' }])).toThrow(
      'Có 1 clip previz nhưng cảnh có 3 shot',
    );
  });

  it('previz: zip import được, mỗi Generate Video nhận đúng một Asset Video reference', async () => {
    const { file } = await zipOf(1_700_000_000_000, { previz: true });
    const preview = await parseImportFile(file);
    expect(preview.items[0].warnings).toEqual([]);
    expect(preview.assetBlobs.size).toBe(4);

    const [wf] = await commitImport({ preview, targetWorkspaceId: 'ws-1', dupStrategy: 'copy' });
    const byId = new Map(wf.nodes.map((n) => [n.id, n]));
    const accepted: typeof wf.edges = [];
    for (const e of wf.edges) {
      const ok = isValidConnection(
        e as never,
        accepted as never,
        (id) => {
          const n = byId.get(id);
          return n ? getNodePorts(n.type as NodeType, n.data) : undefined;
        },
        (id) => byId.get(id)?.type as NodeType,
      );
      expect(ok, e.id).toBe(true);
      accepted.push(e);
    }
    for (const gen of wf.nodes.filter((n) => n.type === 'generateVideo')) {
      const videos = wf.edges
        .filter((e) => e.target === gen.id && e.targetHandle === 'in:video')
        .map((e) => byId.get(e.source)!);
      expect(videos).toHaveLength(1);
      expect(videos[0]!.data).toMatchObject({ kind: 'video', assetLabel: PREVIZ_LABEL, missing: false });
    }
  });
});
