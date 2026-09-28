import { describe, expect, it } from 'vitest';
import type { Edge } from '@xyflow/react';
import type { FlowNode } from '@/features/editor/store';
import { computePromptPreview, resolveIncomingItems } from '@/features/editor/incomingInputs';
import type { NodeType } from '@/shared/schema';

function flowNode(id: string, nodeType: NodeType, data: Record<string, unknown> = {}): FlowNode {
  return { id, type: 'workflow', position: { x: 0, y: 0 }, data: { nodeType, data } };
}

function flowEdge(source: string, target: string, targetHandle: string): Edge {
  return { id: `${source}-${target}`, source, target, sourceHandle: 'out', targetHandle };
}

describe('cached last frame on Prompt', () => {
  it('shows the kept frame on the Prompt and forwards it to Generate Video once the clip link is gone', () => {
    const nodes = [
      flowNode('p', 'prompt', { instruction: 'Scene 2', continueFrameAssetId: 'frame-1' }),
      flowNode('g', 'generateVideo'),
    ];
    const edges = [flowEdge('p', 'g', 'in:text')];

    const onPrompt = resolveIncomingItems('p', nodes, edges);
    expect(onPrompt).toEqual([
      expect.objectContaining({ origin: 'cache', role: 'continuation', kind: 'image', assetId: 'frame-1' }),
    ]);

    const onGenerate = resolveIncomingItems('g', nodes, edges);
    expect(onGenerate).toContainEqual(
      expect.objectContaining({ origin: 'prompt', role: 'continuation', assetId: 'frame-1' }),
    );
  });

  it('prefers the linked clip over the kept frame', () => {
    const nodes = [
      flowNode('v1', 'generateVideo'),
      flowNode('p', 'prompt', { instruction: 'Scene 2', continueFrameAssetId: 'frame-1' }),
    ];
    const onPrompt = resolveIncomingItems('p', nodes, [flowEdge('v1', 'p', 'in:video')]);
    expect(onPrompt.filter((i) => i.role === 'continuation')).toEqual([
      expect.objectContaining({ origin: 'edge', sourceNodeId: 'v1' }),
    ]);
  });
});

describe('Prompt preview with Gemini presets', () => {
  const scene = JSON.stringify({ type: 'scene', summary: 'Bright studio', lighting: 'soft daylight' });
  const model = JSON.stringify({ type: 'model', summary: 'Young woman', identity: { hair: 'black bun' } });

  it('shows the last Gemini result instead of the pre-run preview', () => {
    const nodes = [
      flowNode('a', 'asset', { assetLabel: 'Background', flowMediaId: 'm-scene', kind: 'image' }),
      flowNode('s', 'prompt', { preset: 'fashionScene', formattedOutput: scene }),
    ];
    expect(computePromptPreview('s', nodes, [flowEdge('a', 's', 'in:image')]).text).toBe(scene);
  });

  it('is empty before the preset node has run', () => {
    const nodes = [flowNode('s', 'prompt', { preset: 'fashionScene', instruction: 'x' })];
    expect(computePromptPreview('s', nodes, []).text).toBe('');
  });

  it('fashionCompose merges upstream results and drops refs of forwardRefs=false nodes', () => {
    const nodes = [
      flowNode('a', 'asset', { assetLabel: 'Background', flowMediaId: 'm-scene', kind: 'image' }),
      flowNode('s', 'prompt', { preset: 'fashionScene', formattedOutput: scene, forwardRefs: false }),
      flowNode('b', 'asset', { assetLabel: 'Character', flowMediaId: 'm-model', kind: 'image' }),
      flowNode('m', 'prompt', { preset: 'fashionModel', formattedOutput: model }),
      flowNode('c', 'prompt', { preset: 'fashionCompose' }),
    ];
    const edges = [
      flowEdge('a', 's', 'in:image'),
      flowEdge('b', 'm', 'in:image'),
      flowEdge('s', 'c', 'in:text'),
      flowEdge('m', 'c', 'in:text'),
    ];
    const preview = computePromptPreview('c', nodes, edges);
    expect(preview.text).toContain('Young woman');
    expect(preview.text).toContain('soft daylight');
    expect(preview.text.indexOf('Young woman')).toBeLessThan(preview.text.indexOf('soft daylight'));
    expect(preview.refs.map((r) => r.flowMediaId)).toEqual(['m-model']);
  });
});
