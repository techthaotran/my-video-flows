import { describe, expect, it } from 'vitest';
import {
  imageRequest,
  referenceVideoRequest,
  textVideoRequest,
  uploadRequest,
  videoRequest,
  CAPTCHA_SLOT,
  RPC_GEN_IMAGE,
  RPC_GEN_VIDEO,
  RPC_GEN_VIDEO_REFS,
  RPC_GEN_VIDEO_TEXT,
  RPC_UPLOAD_IMAGE,
} from '@/providers/flow/rpc/batch';
import {
  chunkForLog,
  decodeFreqInner,
  describeSubmit,
  extractAnchoredMediaIds,
  extractWireMediaIds,
  sanitizeFreq,
  summarizeSubmit,
} from '@/providers/flow/rpc/payloadLog';

const PROJECT = 'fcf16651-14f3-4335-9557-0a808bd11946';
const CHAR = '5ef8278f-a08d-4b30-a45c-bdd946b37427';
const OUTFIT = 'aaaaaaaa-1111-2222-3333-444444444444';
const START = '11111111-1111-1111-1111-111111111111';

describe('payloadLog extractWireMediaIds', () => {
  it('reads ref media ids from imageRequest (ogiZ0b)', () => {
    const freq = imageRequest({
      prompt: '[Character] waves',
      projectId: PROJECT,
      model: 'NARWHAL',
      refMediaIds: [CHAR, OUTFIT],
    });
    expect(extractWireMediaIds(RPC_GEN_IMAGE, freq)).toEqual([CHAR, OUTFIT]);
  });

  it('reads the start-frame id from videoRequest (eb1hJf)', () => {
    const freq = videoRequest({
      prompt: 'move',
      projectId: PROJECT,
      sourceMediaId: START,
      model: 'veo_3_1_i2v_lite',
    });
    expect(extractWireMediaIds(RPC_GEN_VIDEO, freq)).toEqual([START]);
  });

  it('returns no media ids for text-only Omni (YhhmEf)', () => {
    const freq = textVideoRequest({
      prompt: 'a walk',
      projectId: PROJECT,
      model: 'abra_t2v_4s',
      aspect: '9:16',
    });
    expect(extractWireMediaIds(RPC_GEN_VIDEO_TEXT, freq)).toEqual([]);
  });

  it('reads item[1] and anchored parts from MZZa6b', () => {
    const freq = referenceVideoRequest({
      parts: [
        { type: 'text', text: 'hi ' },
        { type: 'image', mediaId: CHAR, name: 'Character' },
        { type: 'text', text: ' and ' },
        { type: 'image', mediaId: OUTFIT, name: 'Outfit' },
      ],
      projectId: PROJECT,
      model: 'abra_r2v_4s',
      aspect: '9:16',
    });
    expect(extractWireMediaIds(RPC_GEN_VIDEO_REFS, freq)).toEqual([CHAR, OUTFIT]);
    expect(extractAnchoredMediaIds(freq)).toEqual([CHAR, OUTFIT]);
  });
});

describe('describeSubmit', () => {
  it('flags Omni + 2 refs that never reach the wire (current YhhmEf)', () => {
    const prompt =
      `[Character] wears [Outfit]\n\n` +
      `https://flow-content.google/image/${CHAR}\n` +
      `https://flow-content.google/image/${OUTFIT}`;
    const freq = textVideoRequest({
      prompt,
      projectId: PROJECT,
      model: 'abra_t2v_8s',
      aspect: '9:16',
    });
    const d = describeSubmit({
      rpcid: RPC_GEN_VIDEO_TEXT,
      freq,
      model: 'abra_t2v_8s',
      prompt,
      refs: [
        { label: 'Character', kind: 'image', source: 'flow', mediaId: CHAR },
        { label: 'Outfit', kind: 'image', source: 'flow', mediaId: OUTFIT },
      ],
    });
    expect(d.wireMediaIds).toEqual([]);
    expect(d.missingRefs).toHaveLength(2);
    expect(d.urlsInPrompt).toHaveLength(2);
    expect(d.labelsInPrompt).toEqual(['Character', 'Outfit']);
    expect(summarizeSubmit(d)).toContain('ref 0/2 vào wire, 2 link');
  });

  it('keeps CAPTCHA_SLOT and redacts upload base64', () => {
    const b64 = 'A'.repeat(300);
    const freq = uploadRequest({ imageB64: b64, projectId: PROJECT });
    const cleaned = sanitizeFreq(freq) as unknown[];
    const flat = JSON.stringify(cleaned);
    expect(flat).toContain(CAPTCHA_SLOT);
    expect(flat).not.toContain(b64);
    expect(flat).toMatch(/\[base64 image\/jpeg \d+(B|KB|MB)\]/);
    expect(extractWireMediaIds(RPC_UPLOAD_IMAGE, freq)).toEqual([]);
  });

  it('chunks prompts longer than 4000 characters', () => {
    const prompt = 'x'.repeat(9000);
    const freq = textVideoRequest({
      prompt: 'short',
      projectId: PROJECT,
      model: 'abra_t2v_4s',
    });
    const d = describeSubmit({
      rpcid: RPC_GEN_VIDEO_TEXT,
      freq,
      prompt,
      refs: [],
    });
    expect(Array.isArray(d.prompt)).toBe(true);
    expect((d.prompt as string[]).join('')).toBe(prompt);
    expect(d.promptLength).toBe(9000);
    expect(chunkForLog(prompt)).toHaveLength(3);
  });

  it('decodeFreqInner unwraps the batchexecute envelope', () => {
    const freq = imageRequest({ prompt: 'p', projectId: PROJECT });
    const inner = decodeFreqInner(freq);
    expect(Array.isArray(inner)).toBe(true);
  });
});
