import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BatchRpcCmd, BatchRpcResult } from '@/providers/flow/rpc/runner';
import type { FlowGeneratePayload, FlowUploadRef } from '@/shared/messaging';

const rpc = vi.fn<(tabId: number, cmd: BatchRpcCmd) => Promise<BatchRpcResult>>();
const PROJECT = 'fcf16651-14f3-4335-9557-0a808bd11946';
const OTHER_PROJECT = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const STORED = '11111111-1111-1111-1111-111111111111';
const FRESH = '22222222-2222-2222-2222-222222222222';
const OUT = '33333333-3333-3333-3333-333333333333';

vi.mock('@/providers/flow/rpc/runner', () => ({
  runBatchRpc: (tabId: number, cmd: BatchRpcCmd) => rpc(tabId, cmd),
  reviveTabIfNeeded: async (tabId: number) => tabId,
}));
vi.mock('@/providers/flow/rpc/project', () => ({
  resolveFlowProjectId: async () => PROJECT,
}));

const { generateViaRpc } = await import('@/providers/flow/rpc/generate');

function envelope(rpcid: string, inner: unknown): string {
  const chunk = JSON.stringify([['wrb.fr', rpcid, JSON.stringify(inner), null, null, null, 'generic']]);
  return `)]}'\n${chunk.length}\n${chunk}`;
}

function errorEnvelope(rpcid: string, detail: unknown): string {
  const chunk = JSON.stringify([['wrb.fr', rpcid, null, null, null, detail, 'generic']]);
  return `)]}'\n${chunk.length}\n${chunk}`;
}

function tinyPngB64(): string {
  // Minimal non-empty payload for compress/upload path.
  return btoa('png-bytes-for-upload-reuse-test');
}

function uploadRef(partial: Partial<FlowUploadRef> & Pick<FlowUploadRef, 'sha256' | 'nodeId'>): FlowUploadRef {
  return {
    name: 'a.png',
    mime: 'image/png',
    dataBase64: tinyPngB64(),
    ...partial,
  };
}

function imagePayload(upload: FlowUploadRef): FlowGeneratePayload {
  return {
    mode: 'text-to-image',
    prompt: 'test',
    model: 'Nano Banana 2',
    aspectRatio: '9:16',
    outputsPerPrompt: 1,
    resolution: '1K',
    refs: [{ kind: 'image', label: 'Character', upload }],
  };
}

function fakeFlow(opts?: { mediaNotFoundRounds?: number }) {
  let maseQ = 0;
  let notFoundLeft = opts?.mediaNotFoundRounds ?? 0;
  const calls: string[] = [];
  rpc.mockImplementation(async (_tab, cmd) => {
    calls.push(cmd.rpcid);
    switch (cmd.rpcid) {
      case 'maseQ': {
        maseQ++;
        const id = maseQ === 1 ? FRESH : `44444444-4444-4444-4444-${String(maseQ).padStart(12, '0')}`;
        return { status: 200, text: envelope('maseQ', [[id, PROJECT, 'op', 'CAE']]) };
      }
      case 'ogiZ0b': {
        if (notFoundLeft > 0) {
          notFoundLeft--;
          return {
            status: 200,
            text: errorEnvelope('ogiZ0b', [5, null, 'Media not found.']),
          };
        }
        return {
          status: 200,
          text: envelope('ogiZ0b', [[`https://flow-content.google/image/${OUT}?sig=1`]]),
        };
      }
      default:
        return { status: 200, text: envelope(cmd.rpcid, []) };
    }
  });
  return { calls, maseQCount: () => maseQ };
}

beforeEach(() => {
  rpc.mockReset();
});
afterEach(() => {
  rpc.mockReset();
});

describe('Flow local upload reuse (uploaded*)', () => {
  it('same project + sha → second generate does not call maseQ', async () => {
    const upload = uploadRef({
      sha256: 'abc',
      nodeId: 'asset-1',
      uploaded: { mediaId: STORED, projectId: PROJECT, sha256: 'abc' },
    });
    const flow = fakeFlow();

    const first = await generateViaRpc(1, imagePayload(upload), () => undefined, new AbortController().signal);
    expect(flow.calls.filter((c) => c === 'maseQ')).toHaveLength(0);
    expect(first.uploads ?? []).toHaveLength(0);

    flow.calls.length = 0;
    const second = await generateViaRpc(1, imagePayload(upload), () => undefined, new AbortController().signal);
    expect(flow.calls.filter((c) => c === 'maseQ')).toHaveLength(0);
    expect(second.medias?.[0]?.mediaId).toBe(OUT);
  });

  it('different project or sha → uploads again via maseQ', async () => {
    const wrongProject = uploadRef({
      sha256: 'abc',
      nodeId: 'asset-1',
      uploaded: { mediaId: STORED, projectId: OTHER_PROJECT, sha256: 'abc' },
    });
    const flow = fakeFlow();
    const r1 = await generateViaRpc(1, imagePayload(wrongProject), () => undefined, new AbortController().signal);
    expect(flow.calls.filter((c) => c === 'maseQ')).toHaveLength(1);
    expect(r1.uploads?.[0]).toMatchObject({
      nodeId: 'asset-1',
      mediaId: FRESH,
      projectId: PROJECT,
      sha256: 'abc',
    });

    rpc.mockReset();
    const wrongSha = uploadRef({
      sha256: 'new-sha',
      nodeId: 'asset-1',
      uploaded: { mediaId: STORED, projectId: PROJECT, sha256: 'abc' },
    });
    const flow2 = fakeFlow();
    await generateViaRpc(1, imagePayload(wrongSha), () => undefined, new AbortController().signal);
    expect(flow2.calls.filter((c) => c === 'maseQ')).toHaveLength(1);
  });

  it('stored media gone → re-upload once from blob; second miss fails clearly', async () => {
    const upload = uploadRef({
      sha256: 'abc',
      nodeId: 'asset-1',
      uploaded: { mediaId: STORED, projectId: PROJECT, sha256: 'abc' },
    });

    // First generate: ogiZ0b says Media not found → clear stored → maseQ → success.
    const flow = fakeFlow({ mediaNotFoundRounds: 1 });
    const ok = await generateViaRpc(1, imagePayload(upload), () => undefined, new AbortController().signal);
    expect(flow.calls.filter((c) => c === 'maseQ')).toHaveLength(1);
    expect(ok.uploads?.[0]?.mediaId).toBe(FRESH);
    expect(upload.uploaded?.mediaId).toBe(FRESH);

    // Second consecutive miss after re-upload → clear error (no infinite retry).
    upload.uploaded = { mediaId: STORED, projectId: PROJECT, sha256: 'abc' };
    rpc.mockReset();
    fakeFlow({ mediaNotFoundRounds: 99 });
    await expect(
      generateViaRpc(1, imagePayload(upload), () => undefined, new AbortController().signal),
    ).rejects.toThrow(/không tìm thấy ảnh đã upload/i);
  });

  it('video Media not found with stored upload → original error, no maseQ retry wrap', async () => {
    const upload = uploadRef({
      sha256: 'abc',
      nodeId: 'asset-1',
      uploaded: { mediaId: STORED, projectId: PROJECT, sha256: 'abc' },
    });
    const calls: string[] = [];
    rpc.mockImplementation(async (_tab, cmd) => {
      calls.push(cmd.rpcid);
      // Omni + ảnh local: MZZa6b. Báo Media not found như lỗi render video (không phải id upload ảnh).
      if (cmd.rpcid === 'MZZa6b') {
        return {
          status: 200,
          text: errorEnvelope('MZZa6b', [5, null, 'Media not found.']),
        };
      }
      return { status: 200, text: envelope(cmd.rpcid, []) };
    });

    const promise = generateViaRpc(
      1,
      {
        mode: 'frames-to-video',
        model: 'Omni Flash',
        prompt: '[Character] walks',
        durationSec: 4,
        refs: [{ kind: 'image', label: 'Character', upload }],
      },
      () => undefined,
      new AbortController().signal,
    );
    await expect(promise).rejects.toSatisfy((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      return /Media not found/i.test(msg) && !/không tìm thấy ảnh đã upload/i.test(msg);
    });
    expect(calls.filter((c) => c === 'maseQ')).toHaveLength(0);
    // Id đã lưu vẫn còn - video path không xoá / upload lại.
    expect(upload.uploaded?.mediaId).toBe(STORED);
  });
});
