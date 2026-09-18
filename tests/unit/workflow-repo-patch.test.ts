import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/storage/db';
import {
  WORKFLOW_ERROR,
  createEmptyWorkflow,
  workflowRepo,
} from '@/storage/repos/workflowRepo';
import type { WorkflowNode } from '@/shared/schema';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

function node(id: string, type: WorkflowNode['type'], data: Record<string, unknown>): WorkflowNode {
  return { id, type, position: { x: 0, y: 0 }, data };
}

describe('workflowRepo.patchNodeData', () => {
  it('gộp đúng field và không tạo revision', async () => {
    const wf = createEmptyWorkflow('ws');
    wf.nodes = [node('v1', 'generateVideo', { prompt: 'cũ', model: 'Veo 3.1 Lite' })];
    await workflowRepo.save(wf);
    const revsBefore = await db.workflowRevisions.where('workflowId').equals(wf.id).count();

    const updated = await workflowRepo.patchNodeData(wf.id, 'v1', { prompt: 'mới' });
    const data = updated.nodes[0]!.data as { prompt: string; model: string };
    expect(data.prompt).toBe('mới');
    expect(data.model).toBe('Veo 3.1 Lite');

    const revsAfter = await db.workflowRevisions.where('workflowId').equals(wf.id).count();
    expect(revsAfter).toBe(revsBefore);
  });

  it('ném WORKFLOW_DELETED khi workflow đã xoá mềm', async () => {
    const wf = createEmptyWorkflow('ws');
    wf.nodes = [node('v1', 'generateVideo', { prompt: 'x' })];
    await workflowRepo.save(wf);
    await workflowRepo.softDelete(wf.id);

    await expect(workflowRepo.patchNodeData(wf.id, 'v1', { prompt: 'y' })).rejects.toMatchObject({
      code: WORKFLOW_ERROR.deleted,
    });
  });

  it('ném WORKFLOW_NODE_NOT_FOUND khi không có node', async () => {
    const wf = createEmptyWorkflow('ws');
    wf.nodes = [node('v1', 'generateVideo', { prompt: 'x' })];
    await workflowRepo.save(wf);

    await expect(workflowRepo.patchNodeData(wf.id, 'missing', { prompt: 'y' })).rejects.toMatchObject({
      code: WORKFLOW_ERROR.nodeNotFound,
    });
  });

  it('hai patch liên tiếp vào hai node đều còn', async () => {
    const wf = createEmptyWorkflow('ws');
    wf.nodes = [
      node('a', 'generateVideo', { prompt: 'A' }),
      node('b', 'generateVideo', { prompt: 'B' }),
    ];
    await workflowRepo.save(wf);

    await workflowRepo.patchNodeData(wf.id, 'a', { prompt: 'A2' });
    await workflowRepo.patchNodeData(wf.id, 'b', { prompt: 'B2' });

    const saved = await workflowRepo.get(wf.id);
    expect((saved!.nodes.find((n) => n.id === 'a')!.data as { prompt: string }).prompt).toBe('A2');
    expect((saved!.nodes.find((n) => n.id === 'b')!.data as { prompt: string }).prompt).toBe('B2');
  });
});

describe('workflowRepo.saveFromEditor', () => {
  it('giữ data DB cho node không dirty và lấy data editor cho node dirty', async () => {
    const wf = createEmptyWorkflow('ws');
    wf.nodes = [
      node('a', 'generateVideo', { prompt: 'db-a', model: 'Veo 3.1 Lite' }),
      node('b', 'generateVideo', { prompt: 'db-b', model: 'Veo 3.1 Lite' }),
    ];
    await workflowRepo.save(wf);

    // Cửa sổ "Chạy" patch node a trong lúc editor đang mở.
    await workflowRepo.patchNodeData(wf.id, 'a', { prompt: 'runner-a' });

    const editor = structuredClone(await workflowRepo.get(wf.id))!;
    // Editor đã sửa b trước khi nhận bản runner (dirty), và vẫn giữ bản cũ của a.
    const nodeA = editor.nodes.find((n) => n.id === 'a')!;
    const nodeB = editor.nodes.find((n) => n.id === 'b')!;
    nodeA.data = { ...nodeA.data, prompt: 'editor-stale-a' };
    nodeB.data = { ...nodeB.data, prompt: 'editor-b' };
    // Editor thêm cấu trúc mới (node c).
    editor.nodes.push(node('c', 'generateVideo', { prompt: 'editor-c' }));
    editor.name = 'Tên editor';

    const saved = await workflowRepo.saveFromEditor(editor, new Set(['b', 'c']));
    expect(saved.name).toBe('Tên editor');
    expect(saved.nodes.map((n) => n.id)).toEqual(['a', 'b', 'c']);
    expect((saved.nodes.find((n) => n.id === 'a')!.data as { prompt: string }).prompt).toBe('runner-a');
    expect((saved.nodes.find((n) => n.id === 'b')!.data as { prompt: string }).prompt).toBe('editor-b');
    expect((saved.nodes.find((n) => n.id === 'c')!.data as { prompt: string }).prompt).toBe('editor-c');
  });
});
