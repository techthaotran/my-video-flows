import { describe, expect, it } from 'vitest';
import { firstMergeNode, isMergeReady, mergeClipNodeIds } from '@/engine/mergeReady';
import { createEmptyWorkflow } from '@/storage/repos/workflowRepo';
import type { Workflow, WorkflowNode } from '@/shared/schema';

function node(
  id: string,
  type: WorkflowNode['type'],
  data: Record<string, unknown> = {},
  extra?: Partial<WorkflowNode>,
): WorkflowNode {
  return { id, type, position: { x: 0, y: 0 }, data, ...extra };
}

function edge(source: string, target: string, targetHandle = 'in:video'): Workflow['edges'][number] {
  return {
    id: `${source}-${target}-${targetHandle}`,
    source,
    sourceHandle: 'out:video',
    target,
    targetHandle,
    type: 'video',
  };
}

function wf(nodes: WorkflowNode[], edges: Workflow['edges']): Workflow {
  const base = createEmptyWorkflow('ws');
  return { ...base, nodes, edges };
}

describe('mergeClipNodeIds / isMergeReady', () => {
  it('đủ clip → ready; thiếu clip → không ready; không có clip → không ready', () => {
    const ready = wf(
      [
        node('v1', 'generateVideo', { previewOutputId: 'o1' }),
        node('v2', 'generateVideo', { previewOutputId: 'o2' }),
        node('m', 'mergeVideo', { order: ['v1', 'v2'] }),
      ],
      [edge('v1', 'm'), edge('v2', 'm')],
    );
    expect(mergeClipNodeIds(ready, 'm')).toEqual(['v1', 'v2']);
    expect(isMergeReady(ready, 'm')).toBe(true);

    const missing = wf(
      [
        node('v1', 'generateVideo', { previewOutputId: 'o1' }),
        node('v2', 'generateVideo', {}),
        node('m', 'mergeVideo', { order: ['v1', 'v2'] }),
      ],
      [edge('v1', 'm'), edge('v2', 'm')],
    );
    expect(isMergeReady(missing, 'm')).toBe(false);

    const empty = wf([node('m', 'mergeVideo', { order: [] })], []);
    expect(mergeClipNodeIds(empty, 'm')).toEqual([]);
    expect(isMergeReady(empty, 'm')).toBe(false);
  });

  it('clip disabled bị bỏ', () => {
    const graph = wf(
      [
        node('v1', 'generateVideo', { previewOutputId: 'o1' }),
        node('v2', 'generateVideo', { previewOutputId: 'o2' }, { disabled: true }),
        node('m', 'mergeVideo', { order: ['v1', 'v2'] }),
      ],
      [edge('v1', 'm'), edge('v2', 'm')],
    );
    expect(mergeClipNodeIds(graph, 'm')).toEqual(['v1']);
    expect(isMergeReady(graph, 'm')).toBe(true);
  });

  it('thứ tự theo order và clip mới xếp cuối', () => {
    const graph = wf(
      [
        node('v1', 'generateVideo', { previewOutputId: 'o1' }),
        node('v2', 'generateVideo', { previewOutputId: 'o2' }),
        node('v3', 'generateVideo', { previewOutputId: 'o3' }),
        node('m', 'mergeVideo', { order: ['v2', 'v1'] }),
      ],
      [edge('v1', 'm'), edge('v2', 'm'), edge('v3', 'm')],
    );
    expect(mergeClipNodeIds(graph, 'm')).toEqual(['v2', 'v1', 'v3']);
  });

  it('asset có assetId hoặc flowMediaId đều coi là có video', () => {
    const local = wf(
      [
        node('a', 'asset', { assetId: 'blob-1', kind: 'video' }),
        node('m', 'mergeVideo', { order: ['a'] }),
      ],
      [edge('a', 'm')],
    );
    expect(isMergeReady(local, 'm')).toBe(true);

    const flow = wf(
      [
        node('a', 'asset', { flowMediaId: 'flow-1', kind: 'video' }),
        node('m', 'mergeVideo', { order: ['a'] }),
      ],
      [edge('a', 'm')],
    );
    expect(isMergeReady(flow, 'm')).toBe(true);
  });
});

describe('firstMergeNode', () => {
  it('nhiều Merge chọn node đầu theo topo (A-01)', () => {
    const graph = wf(
      [
        node('v1', 'generateVideo', { previewOutputId: 'o1' }),
        node('m1', 'mergeVideo', { order: ['v1'] }),
        node('m2', 'mergeVideo', { order: ['v1'] }),
      ],
      [edge('v1', 'm1'), edge('v1', 'm2')],
    );
    expect(firstMergeNode(graph)?.id).toBe('m1');
  });

  it('graph có vòng không ném lỗi', () => {
    const cycle = wf(
      [
        node('a', 'generateVideo', {}),
        node('b', 'generateVideo', {}),
        node('m', 'mergeVideo', { order: ['a'] }),
      ],
      [
        edge('a', 'b'),
        {
          id: 'b-a',
          source: 'b',
          sourceHandle: 'out:video',
          target: 'a',
          targetHandle: 'in:video',
          type: 'video',
        },
        edge('a', 'm'),
      ],
    );
    expect(() => firstMergeNode(cycle)).not.toThrow();
    expect(firstMergeNode(cycle)).toBeUndefined();
  });
});
