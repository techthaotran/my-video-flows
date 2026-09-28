import { describe, expect, it } from 'vitest';
import { gatherInputs } from '@/engine/RunManager';
import { executors } from '@/engine/executors';
import type { ExecutorContext, NodeOutputValue } from '@/engine/types';
import { migrateWorkflow, type Workflow, type WorkflowNode } from '@/shared/schema';
import type { DriverAction, FlowGeneratePayload } from '@/shared/messaging';

function node(id: string, type: WorkflowNode['type'], data: Record<string, unknown>): WorkflowNode {
  return { id, type, position: { x: 0, y: 0 }, data };
}

function edge(source: string, sourceHandle: string, target: string, targetHandle: string, type: string) {
  return {
    id: `${source}-${target}-${targetHandle}`,
    source,
    sourceHandle,
    target,
    targetHandle,
    type,
  } as Workflow['edges'][number];
}

async function runOrder(
  wf: Workflow,
  order: string[],
  opts: {
    blobs?: Record<string, Blob>;
    onDriver?: (provider: 'flow' | 'gemini', action: DriverAction) => unknown;
  } = {},
) {
  const blobs = opts.blobs ?? {};
  const outputs = new Map<string, NodeOutputValue[]>();
  const generateCalls: Extract<DriverAction, { name: 'generate' }>[] = [];
  const geminiCalls: DriverAction[] = [];

  for (const id of order) {
    const n = wf.nodes.find((x) => x.id === id)!;
    const ctx: ExecutorContext = {
      runId: 'run-1',
      workflow: wf,
      node: n,
      inputs: gatherInputs(wf, id, outputs),
      signal: new AbortController().signal,
      onProgress: () => undefined,
      resolveSlug: () => undefined,
      getAsset: async (assetId) => blobs[assetId],
      saveOutput: async () => 'out',
      putAsset: async (blob) => {
        const aid = `asset:${await blob.text()}`;
        blobs[aid] = blob;
        return aid;
      },
      patchNodeData: async (patch) => {
        Object.assign(n.data, patch);
      },
      patchNodeById: async (otherId, patch) => {
        const target = wf.nodes.find((x) => x.id === otherId);
        if (target) Object.assign(target.data, patch);
      },
      extractLastFrame: async (video) => new Blob([`last-of-${await video.text()}`], { type: 'image/jpeg' }),
      composeVideo: async () => new Blob(),
      flowMediaCache: new Map(),
      callDriver: async (provider, action) => {
        if (provider === 'gemini' && action.name === 'prompt') geminiCalls.push(action);
        if (action.name === 'generate') generateCalls.push(action);
        const custom = opts.onDriver?.(provider, action);
        if (custom !== undefined) return custom as never;
        if (action.name === 'generate') {
          return {
            medias: [{ kind: 'video', mime: 'video/mp4', dataBase64: btoa('clip'), mediaId: `media-of-${id}` }],
          };
        }
        return { texts: ['enhanced: [Character] walks'] };
      },
    };
    outputs.set(id, await executors[n.type]!(ctx));
  }
  return { outputs, generateCalls, geminiCalls };
}

/** Classic video pipeline after schema v6 migrate: Asset → Prompt enhance → Generate Video. */
async function runVideoGraph(times: number) {
  const wf = migrateWorkflow({
    id: 'video-reg',
    workspaceId: 'ws',
    schemaVersion: 5,
    name: 'Video hồi quy',
    locked: false,
    nodes: [
      node('asset', 'asset', {
        kind: 'image',
        assetLabel: 'Character',
        source: 'local',
        assetId: 'local-char',
      }),
      node('prompt', 'prompt', {
        preset: 'enhance',
        instruction: '[Character] walks in soft light',
        outputFormat: 'plain',
        newChat: true,
        // v5: no reusePrompt / forwardRefs - migrate sets reusePrompt false
      }),
      node('gen', 'generateVideo', {
        model: 'Omni Flash',
        aspectRatio: '9:16',
        count: 1,
        resolution: 720,
        durationSec: 4,
      }),
    ],
    edges: [
      edge('asset', 'out:image', 'prompt', 'in:image', 'image'),
      edge('prompt', 'out:text', 'gen', 'in:text', 'text'),
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
    settings: { concurrency: 1, retry: 0, stopOnError: true },
    createdAt: 1,
    updatedAt: 1,
  });

  const promptData = wf.nodes.find((n) => n.id === 'prompt')!.data as {
    reusePrompt?: boolean;
    forwardRefs?: boolean;
  };
  expect(promptData.reusePrompt).toBe(false);
  expect(promptData.forwardRefs).toBe(true);

  const geminiCalls: DriverAction[] = [];
  const flowCalls: Extract<DriverAction, { name: 'generate' }>[] = [];
  const blob = new Blob(['char-png'], { type: 'image/png' });

  for (let i = 0; i < times; i++) {
    const { generateCalls, geminiCalls: g } = await runOrder(wf, ['asset', 'prompt', 'gen'], {
      blobs: { 'local-char': blob },
      onDriver: (provider, action) => {
        if (provider === 'gemini' && action.name === 'prompt') {
          return { texts: [`enhanced-${i}: [Character] walks in soft light`] };
        }
        if (action.name === 'generate') {
          return {
            medias: [{ kind: 'video', mime: 'video/mp4', dataBase64: btoa('clip'), mediaId: `vid-${i}` }],
          };
        }
        return {};
      },
    });
    geminiCalls.push(...g);
    flowCalls.push(...generateCalls);

    const payload = flowCalls[i]!.payload as FlowGeneratePayload;
    expect(payload.refs?.[0]).toMatchObject({ kind: 'image', label: 'Character' });
    expect(payload.prompt).toContain('[Character]');
    expect(payload.prompt).not.toContain('flow-content.google');
  }

  return { geminiCalls, flowCalls };
}

describe('video workflow regression (schema v6)', () => {
  it('migrated enhance prompt still calls Gemini every run and forwards refs', async () => {
    const { geminiCalls, flowCalls } = await runVideoGraph(2);
    expect(geminiCalls).toHaveLength(2);
    expect(flowCalls).toHaveLength(2);
    expect(geminiCalls[0]).toMatchObject({
      name: 'prompt',
      payload: expect.objectContaining({
        instruction: expect.stringContaining('Enhance and improve'),
      }),
    });
  });

  it('migrated continue-scene graph still forwards last-frame continuation', async () => {
    const wf = migrateWorkflow({
      id: 'video-continue',
      workspaceId: 'ws',
      schemaVersion: 5,
      name: 'Cảnh tiếp',
      locked: false,
      nodes: [
        node('p1', 'prompt', { preset: 'custom', instruction: 'Scene 1', newChat: true }),
        node('v1', 'generateVideo', { model: 'Omni Flash', aspectRatio: '9:16', count: 1 }),
        node('p2', 'prompt', { preset: 'custom', instruction: 'Scene 2', newChat: true }),
        node('v2', 'generateVideo', { model: 'Omni Flash', aspectRatio: '9:16', count: 1 }),
      ],
      edges: [
        edge('p1', 'out:text', 'v1', 'in:text', 'text'),
        edge('v1', 'out:video', 'p2', 'in:video', 'video'),
        edge('p2', 'out:text', 'v2', 'in:text', 'text'),
      ],
      viewport: { x: 0, y: 0, zoom: 1 },
      settings: { concurrency: 1, retry: 0, stopOnError: true },
      createdAt: 1,
      updatedAt: 1,
    });

    expect((wf.nodes.find((n) => n.id === 'p2')!.data as { reusePrompt?: boolean }).reusePrompt).toBe(
      false,
    );

    const { generateCalls } = await runOrder(wf, ['p1', 'v1', 'p2', 'v2']);
    expect(generateCalls).toHaveLength(2);
    const first = generateCalls[0]!.payload as FlowGeneratePayload;
    const second = generateCalls[1]!.payload as FlowGeneratePayload;
    expect(first.continueFrame).toBeUndefined();
    expect(second.mode).toBe('continue-video');
    expect(second.continueFrame).toEqual({
      mime: 'image/jpeg',
      dataBase64: btoa('last-of-clip'),
    });
  });
});
