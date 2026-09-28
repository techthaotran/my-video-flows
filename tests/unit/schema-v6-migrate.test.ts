import { describe, expect, it } from 'vitest';
import {
  IMAGE_RESOLUTIONS,
  PromptNodeDataSchema,
  GenerateImageNodeDataSchema,
  migrateWorkflow,
  validateNodeData,
  SCHEMA_VERSION,
} from '@/shared/schema';

describe('schema v6 migrate', () => {
  it('workflow v5 có node prompt → reusePrompt: false, forwardRefs: true', () => {
    const wf = migrateWorkflow({
      id: 'wf',
      workspaceId: 'ws',
      name: 'video cũ',
      schemaVersion: 5,
      nodes: [
        {
          id: 'p1',
          type: 'prompt',
          position: { x: 0, y: 0 },
          data: { instruction: 'viết script', preset: 'script' },
        },
      ],
      edges: [],
      createdAt: 1,
      updatedAt: 1,
    });

    expect(wf.schemaVersion).toBe(SCHEMA_VERSION);
    expect(wf.schemaVersion).toBe(SCHEMA_VERSION);
    const data = wf.nodes[0]!.data as Record<string, unknown>;
    expect(data.reusePrompt).toBe(false);
    expect(data.forwardRefs).toBe(true);
  });

  it('node prompt mới (parse schema) → reusePrompt: true', () => {
    const data = PromptNodeDataSchema.parse({});
    expect(data.reusePrompt).toBe(true);
    expect(data.forwardRefs).toBe(true);
  });

  it('generateImage resolution số → 1K; giữ IMAGE_RESOLUTIONS', () => {
    expect(IMAGE_RESOLUTIONS).toEqual(['1K', '2K']);
    const wf = migrateWorkflow({
      id: 'wf',
      workspaceId: 'ws',
      name: 'ảnh cũ',
      schemaVersion: 5,
      nodes: [
        {
          id: 'g1',
          type: 'generateImage',
          position: { x: 0, y: 0 },
          data: { prompt: 'x', resolution: 720 },
        },
      ],
      edges: [],
      createdAt: 1,
      updatedAt: 1,
    });
    expect((wf.nodes[0]!.data as Record<string, unknown>).resolution).toBe('1K');
    expect(GenerateImageNodeDataSchema.parse({}).resolution).toBe('1K');
  });

  it('migrate rồi validateNodeData: prompt reusePrompt false, ảnh resolution 1K', () => {
    const wf = migrateWorkflow({
      id: 'draft-wf',
      workspaceId: 'ws',
      name: 'bản nháp cũ',
      schemaVersion: 5,
      nodes: [
        {
          id: 'p1',
          type: 'prompt',
          position: { x: 0, y: 0 },
          data: { instruction: 'script', preset: 'script' },
        },
        {
          id: 'g1',
          type: 'generateImage',
          position: { x: 100, y: 0 },
          data: { prompt: 'x', resolution: 720 },
        },
      ],
      edges: [],
      createdAt: 1,
      updatedAt: 1,
    });

    const prompt = validateNodeData('prompt', wf.nodes[0]!.data) as { reusePrompt: boolean };
    const image = validateNodeData('generateImage', wf.nodes[1]!.data) as { resolution: string };
    expect(prompt.reusePrompt).toBe(false);
    expect(image.resolution).toBe('1K');
  });

  it('workflow v6 → v7: chỉ nâng version, field mới optional/default an toàn', () => {
    const wf = migrateWorkflow({
      id: 'wf',
      workspaceId: 'ws',
      name: 'fashion v6',
      schemaVersion: 6,
      nodes: [
        {
          id: 'a1',
          type: 'asset',
          position: { x: 0, y: 0 },
          data: { kind: 'image', assetLabel: 'Character', assetId: 'x' },
        },
        {
          id: 'p1',
          type: 'prompt',
          position: { x: 0, y: 0 },
          data: {
            preset: 'fashionModel',
            reusePrompt: true,
            forwardRefs: true,
            formattedOutput: 'cũ',
          },
        },
      ],
      edges: [],
      createdAt: 1,
      updatedAt: 1,
    });

    expect(wf.schemaVersion).toBe(SCHEMA_VERSION);
    const asset = wf.nodes[0]!.data as Record<string, unknown>;
    const prompt = wf.nodes[1]!.data as Record<string, unknown>;
    expect(asset.uploadedMediaId).toBeUndefined();
    expect(prompt.systemPrompt).toBeUndefined();
    expect(prompt.outputEdited).toBeUndefined();
    expect(validateNodeData('prompt', prompt)).toMatchObject({ outputEdited: false });
    expect(prompt.formattedOutput).toBe('cũ');
    expect(prompt.reusePrompt).toBe(true);
  });

  it('v7 → v8: node fashionScene bật chuyển tiếp ảnh, node khác giữ nguyên', () => {
    const wf = migrateWorkflow({
      id: 'wf',
      workspaceId: 'ws',
      name: 'thời trang',
      schemaVersion: 7,
      nodes: [
        { id: 's', type: 'prompt', position: { x: 0, y: 0 }, data: { preset: 'fashionScene', forwardRefs: false } },
        { id: 'o', type: 'prompt', position: { x: 0, y: 0 }, data: { preset: 'script', forwardRefs: false } },
      ],
      edges: [],
      createdAt: 1,
      updatedAt: 1,
    });
    expect((wf.nodes[0]!.data as { forwardRefs?: boolean }).forwardRefs).toBe(true);
    expect((wf.nodes[1]!.data as { forwardRefs?: boolean }).forwardRefs).toBe(false);
  });
});
