import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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
  FlowBatchError,
  RpcError,
  omniReferenceVideoModel,
  referenceVideoRequest,
  structuredPromptBlock,
  textVideoRequest,
  readWorkflowPoll,
  isMediaNotReadyRpcError,
  WORKFLOW_STATUS_DONE,
  WORKFLOW_STATUS_FAILED,
  RPC_GEN_VIDEO_REFS,
  RPC_MEDIA,
  type PromptPart,
} from '@/providers/flow/rpc/batch';
import { strings } from '@/shared/strings';
import { decodeFreqInner } from '@/providers/flow/rpc/payloadLog';

const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), '../fixtures/providers/flow');

function loadFixture(name: string): { rpcid: string; args: unknown; _source: unknown } {
  return JSON.parse(readFileSync(join(FIXTURE_DIR, name), 'utf8')) as {
    rpcid: string;
    args: unknown;
    _source: unknown;
  };
}

/** Replace random client/batch UUIDs with placeholders for structural compare. */
function scrubUuids(node: unknown): unknown {
  if (typeof node === 'string') {
    if (/^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i.test(node)) {
      return 'UUID';
    }
    return node;
  }
  if (Array.isArray(node)) return node.map(scrubUuids);
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) out[k] = scrubUuids(v);
    return out;
  }
  return node;
}

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

describe('readWorkflowPoll', () => {
  it('reads DONE / FAILED from workflow[5][8]', () => {
    const genParams = new Array(9).fill(null);
    genParams[8] = [WORKFLOW_STATUS_DONE];
    const doneWf = ['wf', 'proj', null, null, null, genParams, null, null];
    expect(readWorkflowPoll([null, 50, [doneWf]])).toEqual({
      done: true,
      failed: false,
      error: null,
      reasons: [],
    });

    genParams[8] = [WORKFLOW_STATUS_FAILED, ['PUBLIC_ERROR_PROMINENT_PEOPLE_FILTER_FAILED'], ['PROMINENT_PERSON']];
    const failWf = ['wf', 'proj', null, null, null, genParams, null, null];
    expect(readWorkflowPoll([null, 50, [failWf]])).toMatchObject({
      done: false,
      failed: true,
      error: 'PUBLIC_ERROR_PROMINENT_PEOPLE_FILTER_FAILED',
      reasons: ['PROMINENT_PERSON'],
    });
  });
});

describe('isMediaNotReadyRpcError', () => {
  it('matches as29s error [5]', () => {
    expect(isMediaNotReadyRpcError(new RpcError(RPC_MEDIA, [5]))).toBe(true);
    expect(isMediaNotReadyRpcError(new RpcError(RPC_MEDIA, 5))).toBe(true);
    expect(isMediaNotReadyRpcError(new RpcError('ogiZ0b', [5]))).toBe(false);
  });
});

describe('flowRenderFailureMessage', () => {
  it('maps prominent-people filter to actionable Vietnamese', () => {
    expect(
      strings.flowRenderFailureMessage('PUBLIC_ERROR_PROMINENT_PEOPLE_FILTER_FAILED', [
        'PROMINENT_PERSON',
      ]),
    ).toMatch(/người nổi tiếng/i);
  });
});

describe('omniReferenceVideoModel', () => {
  it('snaps duration like omniTextVideoModel', () => {
    expect(omniReferenceVideoModel(5)).toBe('abra_r2v_4s');
    expect(omniReferenceVideoModel(undefined)).toBe('abra_r2v_8s');
    expect(omniReferenceVideoModel(30)).toBe('abra_r2v_10s');
  });
});

describe('referenceVideoRequest (MZZa6b)', () => {
  const PROJECT = 'PROJECT_ID';
  const MEDIA_A = '32e97d88-50ba-4b08-8968-3accde97f933';
  const MEDIA_B = 'c9902ae1-c258-4b44-99f7-a34bd4885133';

  const fixtureParts: PromptPart[] = [
    { type: 'text', text: 'chiếc ' },
    { type: 'image', mediaId: MEDIA_A, name: 'long' },
    { type: 'text', text: ' bay lơ lửng trên đầu con mèo ' },
    { type: 'image', mediaId: MEDIA_B, name: 'test-upload-cat.jpg' },
    { type: 'text', text: '  rồi từ từ hạ xuống đầu nó' },
  ];

  it('rebuilds the sp1007 MZZa6b fixture structure (UUIDs scrubbed)', () => {
    const fixture = loadFixture('mzza6b-r2v.json');
    const freq = referenceVideoRequest({
      parts: fixtureParts,
      projectId: PROJECT,
      aspect: 1,
      model: 'veo_3_1_r2v_lite_low_priority',
    });
    const built = decodeFreqInner(freq) as unknown[];
    const builtScrubbed = scrubUuids(
      JSON.parse(
        JSON.stringify(built)
          .replaceAll(MEDIA_A, 'MEDIA_A')
          .replaceAll(MEDIA_B, 'MEDIA_B')
          .replaceAll(PROJECT, 'PROJECT_ID'),
      ),
    );
    const fixtureScrubbed = scrubUuids(
      JSON.parse(
        JSON.stringify(fixture.args)
          .replaceAll('"CLIENT_UUID_A"', '"UUID"')
          .replaceAll('"CLIENT_UUID_B"', '"UUID"')
          .replaceAll('"BATCH_UUID"', '"UUID"'),
      ),
    );
    expect(builtScrubbed).toEqual(fixtureScrubbed);
  });

  it('throws on duplicate mediaId, adjacent text, or empty text', () => {
    expect(() =>
      referenceVideoRequest({
        parts: [
          { type: 'image', mediaId: MEDIA_A, name: 'A' },
          { type: 'image', mediaId: MEDIA_A, name: 'A2' },
        ],
        projectId: PROJECT,
        model: 'abra_r2v_4s',
      }),
    ).toThrow(FlowBatchError);

    expect(() =>
      referenceVideoRequest({
        parts: [
          { type: 'text', text: 'a' },
          { type: 'text', text: 'b' },
        ],
        projectId: PROJECT,
        model: 'abra_r2v_4s',
      }),
    ).toThrow(/adjacent text/i);

    expect(() =>
      referenceVideoRequest({
        parts: [{ type: 'text', text: '' }],
        projectId: PROJECT,
        model: 'abra_r2v_4s',
      }),
    ).toThrow(/empty text/i);
  });

  it('structuredPromptBlock matches wire fragment shape', () => {
    expect(structuredPromptBlock(fixtureParts)).toEqual([
      null,
      null,
      [
        [
          ['chiếc '],
          [null, [[MEDIA_A, 'long']]],
          [' bay lơ lửng trên đầu con mèo '],
          [null, [[MEDIA_B, 'test-upload-cat.jpg']]],
          ['  rồi từ từ hạ xuống đầu nó'],
        ],
      ],
    ]);
  });
});

describe('fixture contrast notes (YhhmEf / eb1hJf)', () => {
  it('documents YhhmEf trailer drift: capture [uuid,2] vs app [uuid,1]', () => {
    const fixture = loadFixture('yhhmef-t2v.json');
    const trailer = (fixture.args as unknown[])[2] as unknown[];
    expect(trailer[1]).toBe(2);

    const freq = textVideoRequest({
      prompt: 'x',
      projectId: 'PROJECT_ID',
      model: 'abra_t2v_4s',
      aspect: '16:9',
    });
    const inner = decodeFreqInner(freq) as unknown[];
    expect((inner[2] as unknown[])[1]).toBe(1);
  });

  it('documents eb1hJf crop drift: capture [null,null,1,1] vs app FULL_FRAME_CROP', () => {
    const fixture = loadFixture('eb1hjf-i2v.json');
    const item = ((fixture.args as unknown[])[0] as unknown[])[0] as unknown[];
    const crop = (item[4] as unknown[])[5];
    expect(crop).toEqual([null, null, 1, 1]);

    const freq = videoRequest({
      prompt: 'x',
      projectId: 'PROJECT_ID',
      sourceMediaId: '11111111-1111-1111-1111-111111111111',
      aspect: '16:9',
    });
    const built = decodeFreqInner(freq) as unknown[];
    const builtItem = (built[0] as unknown[])[0] as unknown[];
    const builtCrop = (builtItem[4] as unknown[])[5];
    expect(builtCrop).not.toEqual([null, null, 1, 1]);
    expect(Array.isArray(builtCrop)).toBe(true);
  });
});

describe('MEDIA_GENERATION_SETTINGS alignment (plan 2.5)', () => {
  it('MZZa6b parts order matches UI structuredPrompt (text/image/text/image/text)', () => {
    const fixture = loadFixture('mzza6b-r2v.json');
    const item = ((fixture.args as unknown[])[0] as unknown[])[0] as unknown[];
    const parts = ((item[0] as unknown[])[2] as unknown[])[0] as unknown[];
    expect(parts).toHaveLength(5);
    expect(parts[0]).toEqual(['chiếc ']);
    expect((parts[1] as unknown[])[0]).toBeNull();
    expect(parts[2]).toEqual([' bay lơ lửng trên đầu con mèo ']);
    expect((parts[3] as unknown[])[0]).toBeNull();
    expect(parts[4]).toEqual(['  rồi từ từ hạ xuống đầu nó']);
    expect(item[2]).toBe('veo_3_1_r2v_lite_low_priority');
    expect(item[3]).toBe(1);
    expect(RPC_GEN_VIDEO_REFS).toBe('MZZa6b');
  });
});
