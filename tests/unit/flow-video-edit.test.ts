import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  editVideoRequest,
  editVideoSegment,
  FlowBatchError,
  OMNI_EDIT_MAX_SEC,
  RPC_GEN_VIDEO_EDIT,
  type PromptPart,
} from '@/providers/flow/rpc/batch';
import { decodeFreqInner, describeSubmit } from '@/providers/flow/rpc/payloadLog';
import {
  flowVideoUploadPath,
  FlowVideoUploadError,
  parseDurationSec,
  readVideoUploadResponse,
  uploadVideoToFlow,
} from '@/providers/flow/rpc/videoUpload';
import { readMp4VideoInfo } from '@/media/mp4Info';
import { makeMp4 } from '../fixtures/media/mp4';

const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), '../fixtures/providers/flow');
const PROJECT = 'fcf16651-14f3-4335-9557-0a808bd11946';
const VIDEO = '984be8b3-1a4f-4e72-a011-9f8d6b8081fc';
const IMAGE = 'ca256356-496b-4ac4-a520-92147ab5ab59';
const UUID_RE = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i;

function fixture(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(FIXTURE_DIR, name), 'utf8')) as Record<string, unknown>;
}

/** Client / batch UUIDs are random per request: compare their position, not value. */
function scrub(node: unknown): unknown {
  if (typeof node === 'string') return UUID_RE.test(node) ? 'UUID' : node;
  if (Array.isArray(node)) return node.map(scrub);
  return node;
}

describe('editVideoRequest (jIps6)', () => {
  const captured = fixture('jips6-edit.json');
  const prompt = 'Replace the person in the video with the woman in the image, keep camera and motion';

  it('rebuilds the captured Flow UI request', () => {
    // The UI did not anchor the image in the prompt; it rode only the image-ref slot.
    const freq = editVideoRequest({
      video: { mediaId: VIDEO, startFrame: 0, endFrame: 192 },
      parts: [{ type: 'text', text: prompt }],
      projectId: PROJECT,
      aspect: '9:16',
    });
    const built = JSON.parse(
      JSON.stringify(decodeFreqInner(freq))
        .replaceAll(VIDEO, 'VIDEO_ID')
        .replaceAll(PROJECT, 'PROJECT_ID'),
    ) as unknown[];
    const want = JSON.parse(
      JSON.stringify(captured.args)
        .replaceAll('"IMAGE_ID"', `"${IMAGE}"`)
        .replace(/"(CLIENT_UUID_[AB]|BATCH_UUID)"/g, '"UUID"'),
    ) as unknown[][][];
    // Same item with the image ref removed from item[8] (no image part in this prompt).
    want[0]![0]![8] = [];
    expect(scrub(built)).toEqual(scrub(want));
  });

  it('lists anchored images in item[8] in prompt order, after the video slot', () => {
    const parts: PromptPart[] = [
      { type: 'text', text: 'Thay ma-nơ-canh bằng ' },
      { type: 'image', mediaId: IMAGE, name: 'Model' },
      { type: 'text', text: ', giữ góc máy' },
    ];
    const inner = decodeFreqInner(
      editVideoRequest({ video: editVideoSegment(VIDEO, 4), parts, projectId: PROJECT }),
    ) as unknown[][][];
    const item = inner[0]![0]!;
    expect(item[0]).toEqual([null, VIDEO, 0, 96]);
    expect(item[2]).toBe('abra_edit');
    expect(item[8]).toEqual([[null, IMAGE]]);
    expect(item).toHaveLength(9);
  });

  it('refuses an empty segment and a video id reused as an image ref', () => {
    const text: PromptPart[] = [{ type: 'text', text: 'x' }];
    expect(() =>
      editVideoRequest({ video: { mediaId: VIDEO, startFrame: 0, endFrame: 0 }, parts: text, projectId: PROJECT }),
    ).toThrow(FlowBatchError);
    expect(() =>
      editVideoRequest({
        video: editVideoSegment(VIDEO, 4),
        parts: [{ type: 'image', mediaId: VIDEO, name: 'V' }],
        projectId: PROJECT,
      }),
    ).toThrow(/video id also listed/);
  });

  it('counts the segment in frames of the clip (24 fps fallback) and caps at the Omni limit', () => {
    expect(editVideoSegment(VIDEO, 8)).toEqual({ mediaId: VIDEO, startFrame: 0, endFrame: 192 });
    // Studio 3D exports 30 fps: 8s must be 240 frames, not 192 (6.4s).
    expect(editVideoSegment(VIDEO, 8, 30).endFrame).toBe(240);
    expect(editVideoSegment(VIDEO, 4.04).endFrame).toBe(97);
    expect(editVideoSegment(VIDEO, 30, 30).endFrame).toBe(OMNI_EDIT_MAX_SEC * 30);
  });
});

describe('describeSubmit jIps6', () => {
  const parts: PromptPart[] = [
    { type: 'text', text: 'Thay bằng ' },
    { type: 'image', mediaId: IMAGE, name: 'Model' },
  ];

  it('puts the input video and image refs on the wire with nothing missing', () => {
    const freq = editVideoRequest({ video: editVideoSegment(VIDEO, 4), parts, projectId: PROJECT });
    const d = describeSubmit({
      rpcid: RPC_GEN_VIDEO_EDIT,
      freq,
      prompt: 'Thay bằng [Model]',
      refs: [
        { kind: 'video', source: 'upload', mediaId: VIDEO, label: 'Video reference' },
        { kind: 'image', source: 'flow', mediaId: IMAGE, label: 'Model' },
      ],
    });
    expect(d.wireMediaIds).toEqual([VIDEO, IMAGE]);
    expect(d.anchoredMediaIds).toEqual([IMAGE]);
    expect(d.missingRefs).toEqual([]);
  });

  it('flags an image ref that is on the wire but not anchored in the prompt', () => {
    const freq = editVideoRequest({ video: editVideoSegment(VIDEO, 4), parts, projectId: PROJECT });
    const inner = decodeFreqInner(freq) as unknown[][][];
    const other = '33333333-3333-3333-3333-333333333333';
    (inner[0]![0]![8] as unknown[]).push([null, other]);
    const d = describeSubmit({ rpcid: RPC_GEN_VIDEO_EDIT, freq: rebuild(freq, inner), prompt: '' });
    expect(d.missingRefs.map((r) => r.mediaId)).toEqual([other]);
  });
});

/** Re-encode a mutated inner payload into the same f.req envelope. */
function rebuild(freq: string, inner: unknown): string {
  const outer = JSON.parse(freq) as unknown[][][];
  outer[0]![0]![1] = JSON.stringify(inner);
  return JSON.stringify(outer);
}

describe('readMp4VideoInfo', () => {
  it('reads duration, frame count and fps of the video track (mdhd v0 and v1)', () => {
    expect(readMp4VideoInfo(makeMp4(4))).toEqual({ durationSec: 4, frames: 96, fps: 24 });
    expect(readMp4VideoInfo(makeMp4(8, { version: 1, timescale: 90000, fps: 30 }))).toEqual({
      durationSec: 8,
      frames: 240,
      fps: 30,
    });
  });

  it('returns null for bytes without a moov box', () => {
    expect(readMp4VideoInfo(new TextEncoder().encode('not a video at all'))).toBeNull();
    expect(readMp4VideoInfo(makeMp4(4).slice(0, 40))).toBeNull();
  });
});

describe('Flow video upload (Scotty)', () => {
  const finalize = fixture('video-upload-finalize.json');

  it('reads the media id and clip length from the captured finalize response', () => {
    expect(readVideoUploadResponse(finalize)).toEqual({ mediaId: 'MEDIA_ID', durationSec: 4 });
    expect(parseDurationSec('4.04s')).toBe(4.04);
    expect(parseDurationSec('4')).toBeNull();
    expect(() => readVideoUploadResponse({ media: {} })).toThrow(FlowVideoUploadError);
  });

  it('starts a resumable upload, then sends the bytes with upload, finalize', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchFn = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      if (calls.length === 1) {
        return new Response('', { status: 200, headers: { 'x-goog-upload-url': '/upload/next?id=1' } });
      }
      return new Response(JSON.stringify(finalize), {
        status: 200,
        headers: { 'x-goog-upload-status': 'final' },
      });
    });
    const bytes = makeMp4(4);
    const out = await uploadVideoToFlow(fetchFn as typeof fetch, {
      projectId: PROJECT,
      name: 'cảnh 1.mp4',
      bytes,
    });
    expect(out).toEqual({ mediaId: 'MEDIA_ID', durationSec: 4 });
    expect(calls[0]!.url).toBe(flowVideoUploadPath(PROJECT));
    expect(calls[0]!.init.headers).toMatchObject({
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(bytes.byteLength),
      Slug: encodeURIComponent('cảnh 1.mp4'),
    });
    expect(calls[1]!.url).toBe('/upload/next?id=1');
    expect(calls[1]!.init.headers).toMatchObject({
      'X-Goog-Upload-Command': 'upload, finalize',
      'X-Goog-Upload-Offset': '0',
    });
    expect((calls[1]!.init.body as Blob).size).toBe(bytes.byteLength);
  });

  it('fails clearly when Flow gives no upload url or the finalize is not final', async () => {
    const noUrl = vi.fn(async () => new Response('', { status: 403 }));
    await expect(
      uploadVideoToFlow(noUrl as typeof fetch, { projectId: PROJECT, name: 'a.mp4', bytes: makeMp4(4) }),
    ).rejects.toThrow(/HTTP 403/);

    let n = 0;
    const active = vi.fn(async () =>
      ++n === 1
        ? new Response('', { status: 200, headers: { 'x-goog-upload-url': '/u' } })
        : new Response('{}', { status: 200, headers: { 'x-goog-upload-status': 'active' } }),
    );
    await expect(
      uploadVideoToFlow(active as typeof fetch, { projectId: PROJECT, name: 'a.mp4', bytes: makeMp4(4) }),
    ).rejects.toThrow(FlowVideoUploadError);
  });
});
