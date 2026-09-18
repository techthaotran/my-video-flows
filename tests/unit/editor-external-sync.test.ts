import { beforeEach, describe, expect, it } from 'vitest';
import { useEditorStore } from '@/features/editor/store';
import { createEmptyWorkflow } from '@/storage/repos/workflowRepo';
import type { WorkflowNode } from '@/shared/schema';

beforeEach(() => {
  useEditorStore.setState({
    workflowId: null,
    name: '',
    dirty: false,
    dirtyNodeIds: new Set(),
    nameDirty: false,
    lastSyncedAt: 0,
    nodes: [],
    edges: [],
  });
});

function node(id: string, data: Record<string, unknown>): WorkflowNode {
  return { id, type: 'generateVideo', position: { x: 0, y: 0 }, data, slug: id };
}

describe('applyExternalWorkflow', () => {
  it('node khong dirty nhan data moi; node dirty giu ban editor', () => {
    const wf = createEmptyWorkflow('ws');
    wf.updatedAt = 100;
    wf.nodes = [
      node('a', { prompt: 'db-a' }),
      node('b', { prompt: 'db-b' }),
    ];
    useEditorStore.getState().loadWorkflow(wf);

    useEditorStore.getState().updateNodeData('b', { prompt: 'editor-b' });
    expect(useEditorStore.getState().dirtyNodeIds.has('b')).toBe(true);
    expect(useEditorStore.getState().dirty).toBe(true);

    const external = structuredClone(wf);
    external.updatedAt = 200;
    external.nodes = [
      node('a', { prompt: 'runner-a' }),
      node('b', { prompt: 'runner-b' }),
    ];
    useEditorStore.getState().applyExternalWorkflow(external);

    const s = useEditorStore.getState();
    expect(s.nodes.find((n) => n.id === 'a')!.data.data.prompt).toBe('runner-a');
    expect(s.nodes.find((n) => n.id === 'b')!.data.data.prompt).toBe('editor-b');
    expect(s.dirty).toBe(true);
    expect(s.lastSyncedAt).toBe(200);
  });

  it('thay doi ngoai khong vao undo va khong bat dirty neu chua dirty', () => {
    const wf = createEmptyWorkflow('ws');
    wf.updatedAt = 100;
    wf.nodes = [node('a', { prompt: 'cu' })];
    useEditorStore.getState().loadWorkflow(wf);
    useEditorStore.temporal.getState().clear();

    const external = structuredClone(wf);
    external.updatedAt = 200;
    external.nodes = [node('a', { prompt: 'moi' })];
    useEditorStore.getState().applyExternalWorkflow(external);

    const s = useEditorStore.getState();
    expect(s.dirty).toBe(false);
    expect(s.nodes[0]!.data.data.prompt).toBe('moi');
    // pause/resume: khong them past state
    expect(useEditorStore.temporal.getState().pastStates.length).toBe(0);
  });

  it('ban cu hon lastSyncedAt bi bo qua', () => {
    const wf = createEmptyWorkflow('ws');
    wf.updatedAt = 300;
    wf.nodes = [node('a', { prompt: 'moi' })];
    useEditorStore.getState().loadWorkflow(wf);

    const older = structuredClone(wf);
    older.updatedAt = 100;
    older.nodes = [node('a', { prompt: 'cu' })];
    useEditorStore.getState().applyExternalWorkflow(older);

    expect(useEditorStore.getState().nodes[0]!.data.data.prompt).toBe('moi');
    expect(useEditorStore.getState().lastSyncedAt).toBe(300);
  });

  it('locked theo DB', () => {
    const wf = createEmptyWorkflow('ws');
    wf.updatedAt = 100;
    wf.locked = false;
    wf.nodes = [node('a', { prompt: 'x' })];
    useEditorStore.getState().loadWorkflow(wf);

    const external = structuredClone(wf);
    external.updatedAt = 200;
    external.locked = true;
    useEditorStore.getState().applyExternalWorkflow(external);

    const s = useEditorStore.getState();
    expect(s.locked).toBe(true);
    expect(s.nodes[0]!.data.locked).toBe(true);
    expect(s.dirty).toBe(false);
  });
});
