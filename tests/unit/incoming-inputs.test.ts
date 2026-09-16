import { describe, expect, it } from 'vitest';
import type { Edge } from '@xyflow/react';
import type { FlowNode } from '@/features/editor/store';
import { resolveIncomingItems } from '@/features/editor/incomingInputs';
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
