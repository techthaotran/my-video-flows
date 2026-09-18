import { describe, expect, it } from 'vitest';
import { buildRunnerView, selectCanEdit } from '@/features/runner/selectors';
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

function edge(
  source: string,
  target: string,
  targetHandle: string,
  type: Workflow['edges'][number]['type'] = 'video',
): Workflow['edges'][number] {
  return {
    id: `${source}-${target}-${targetHandle}`,
    source,
    sourceHandle: `out:${type}`,
    target,
    targetHandle,
    type,
  };
}

function wf(nodes: WorkflowNode[], edges: Workflow['edges'] = []): Workflow {
  return { ...createEmptyWorkflow('ws'), nodes, edges };
}

describe('buildRunnerView', () => {
  it('so o asset bang so node Asset; disabled bi an', () => {
    const view = buildRunnerView(
      wf([
        node('a1', 'asset', { assetLabel: 'Character', kind: 'image' }),
        node('a2', 'asset', { assetLabel: 'Outfit', kind: 'image' }, { disabled: true }),
        node('n', 'note', { text: 'x' }),
      ]),
    );
    expect('graphError' in view).toBe(false);
    if ('graphError' in view) return;
    expect(view.assetSlots).toHaveLength(1);
    expect(view.assetSlots[0]!.label).toBe('Character');
  });

  it('thu tu clip theo order; node khong noi Merge xep sau', () => {
    const view = buildRunnerView(
      wf(
        [
          node('v1', 'generateVideo', { prompt: '1', aspectRatio: '16:9' }),
          node('v2', 'generateVideo', { prompt: '2', aspectRatio: '9:16' }),
          node('solo', 'generateVideo', { prompt: 's' }),
          node('m', 'mergeVideo', { order: ['v2', 'v1'] }),
        ],
        [edge('v1', 'm', 'in:video'), edge('v2', 'm', 'in:video')],
      ),
    );
    if ('graphError' in view) throw new Error(view.graphError);
    expect(view.generateItems.map((i) => i.nodeId)).toEqual(['v2', 'v1', 'solo']);
    expect(view.generateItems.find((i) => i.nodeId === 'solo')!.inMerge).toBe(false);
    expect(view.merge?.clipNodeIds).toEqual(['v2', 'v1']);
    expect(view.merge?.aspectRatio).toBe('9:16');
  });

  it('khong co Merge -> merge null; chi generateImage van hien', () => {
    const view = buildRunnerView(wf([node('img', 'generateImage', { prompt: 'p' })]));
    if ('graphError' in view) throw new Error(view.graphError);
    expect(view.merge).toBeNull();
    expect(view.generateItems).toHaveLength(1);
    expect(view.generateItems[0]!.type).toBe('generateImage');
  });

  it('nhieu Prompt noi vao generate theo thu tu canh', () => {
    const view = buildRunnerView(
      wf(
        [
          node('p1', 'prompt', { preset: 'enhance', instruction: 'a' }),
          node('p2', 'prompt', { preset: 'custom', instruction: 'b' }),
          node('v', 'generateVideo', { prompt: 'x' }),
        ],
        [
          edge('p1', 'v', 'in:text', 'text'),
          edge('p2', 'v', 'in:text', 'text'),
        ],
      ),
    );
    if ('graphError' in view) throw new Error(view.graphError);
    expect(view.generateItems[0]!.promptNodes.map((p) => p.nodeId)).toEqual(['p1', 'p2']);
  });

  it('graph co vong -> graphError', () => {
    const view = buildRunnerView(
      wf(
        [node('a', 'generateVideo', {}), node('b', 'generateVideo', {})],
        [
          edge('a', 'b', 'in:video'),
          {
            id: 'b-a',
            source: 'b',
            sourceHandle: 'out:video',
            target: 'a',
            targetHandle: 'in:video',
            type: 'video',
          },
        ],
      ),
    );
    expect('graphError' in view).toBe(true);
  });
});

describe('selectCanEdit', () => {
  it('locked/deleted -> khong sua duoc', () => {
    const base = createEmptyWorkflow('ws');
    expect(selectCanEdit(base)).toBe(true);
    expect(selectCanEdit({ ...base, locked: true })).toBe(false);
    expect(selectCanEdit({ ...base, deletedAt: Date.now() })).toBe(false);
  });
});
