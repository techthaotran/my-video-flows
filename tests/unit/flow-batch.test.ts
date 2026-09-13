import { describe, it, expect } from 'vitest';
import {
  firstPayload,
  parseEnvelope,
  readImages,
  readMediaUrls,
  readTextVideoSubmit,
  readUploadedMediaId,
  extractVideoMediaIdsFromText,
  videoRequest,
  resolveVideoModel,
} from '@/providers/flow/rpc/batch';

describe('flow batch parseEnvelope', () => {
  it('parses length-prefixed maseQ upload response (JS split trap)', () => {
    const media = '5ef8278f-a08d-4b30-a45c-bdd946b37427';
    const project = 'fcf16651-14f3-4335-9557-0a808bd11946';
    const op = 'fabb038b-3e4f-4d04-b5db-efb4e0fa2e0d';
    const inner = JSON.stringify([
      [media, project, op, 'CAE', null, [[1, 2], null, null, null, null, null, [null, null, null, null, 1]]],
    ]);
    const chunk = JSON.stringify([['wrb.fr', 'maseQ', inner, null, null, null, 'generic']]);
    const text = `)]}'\n${chunk.length}\n${chunk}`;

    const results = parseEnvelope(text);
    expect(results).toHaveLength(1);
    expect(results[0]!.rpcid).toBe('maseQ');
    expect(readUploadedMediaId(firstPayload(text, 'maseQ'))).toBe(media);
  });
});

describe('flow batch readImages', () => {
  const ref = '6fc34631-b4e9-4304-a555-cac7a03fd65c';
  const scene = '22222222-2222-2222-2222-000000000001';

  it('does not swallow prompt prose after a bare CDN address into the media id', () => {
    const images = readImages([
      `https://flow-content.google/image/${ref} Young East Asian woman with bright porcelain skin`,
      `https://flow-content.google/image/${scene}?sig=1`,
    ]);
    expect(images.map((i) => i.mediaId)).toEqual([scene, ref]);
    expect(images[0]!.url).toContain('?sig=');
  });

  it('still reads a clean signed result when that is the only url', () => {
    const images = readImages([[`https://flow-content.google/image/${scene}?sig=abc`]]);
    expect(images).toEqual([{ mediaId: scene, url: `https://flow-content.google/image/${scene}?sig=abc` }]);
  });
});

describe('flow batch submit salvage', () => {
  const media = 'bbbbbbbb-0000-0000-0000-000000000001';
  const project = 'fcf16651-14f3-4335-9557-0a808bd11946';

  it('readTextVideoSubmit recovers when the workflow row is nested differently', () => {
    expect(readTextVideoSubmit([null, null, null, [[media, project, 'wf', 'PENDING']]])).toEqual({
      mediaId: media,
      projectId: project,
    });
    // Slot drifted — row still findable by walk.
    expect(readTextVideoSubmit({ weird: [[[media, project, 'wf']]] })).toEqual({
      mediaId: media,
      projectId: project,
    });
  });

  it('extractVideoMediaIdsFromText finds CDN video ids', () => {
    expect(
      extractVideoMediaIdsFromText(
        `noise https://flow-content.google/video/${media}?sig=1 more https://flow-content.google/video/${media}?sig=2`,
      ),
    ).toEqual([media]);
  });
});

describe('flow batch readMediaUrls', () => {
  it('extracts a video url even when surrounding prose is present', () => {
    const id = 'aaaaaaaa-0000-0000-0000-000000000001';
    const urls = readMediaUrls(
      [`prefix https://flow-content.google/video/${id}?sig=1 trailing words`],
      id,
    );
    expect(urls.video).toBe(`https://flow-content.google/video/${id}?sig=1`);
  });
});

describe('flow batch videoRequest', () => {
  it('nests prompt group as one slot (FlowKit shape)', () => {
    const freq = videoRequest({
      prompt: 'hello',
      projectId: 'proj',
      sourceMediaId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      aspect: '9:16',
    });
    const outer = JSON.parse(freq) as unknown[][][];
    const encoded = outer[0]![0]![1] as string;
    const inner = JSON.parse(encoded) as unknown[];
    const wrap = inner[0] as unknown[];
    const item = wrap[0] as unknown[];
    expect(item).toHaveLength(6);
    expect(Array.isArray(item[0])).toBe(true);
    expect((item[0] as unknown[])[0]).toBeNull();
    expect((item[0] as unknown[])[1]).toBeNull();
    expect(item[1]).toBe(resolveVideoModel(undefined));
  });

  it('maps Veo labels to i2v wire ids with lite as the default', () => {
    expect(resolveVideoModel('Veo 3.1 Lite Low Priority')).toBe('veo_3_1_i2v_lite_low_priority');
    expect(resolveVideoModel('Veo')).toBe('veo_3_1_i2v_lite');
    expect(resolveVideoModel(undefined)).toBe('veo_3_1_i2v_lite');
  });
});
