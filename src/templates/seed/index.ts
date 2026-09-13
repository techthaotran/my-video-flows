import type { Template } from '@/shared/schema';
import { SCHEMA_VERSION } from '@/shared/schema';

export function getSeedTemplates(): Template[] {
  const now = Date.now();
  return [
    {
      id: 'tpl-dancing-motion',
      name: 'Google Flow Dancing motion control',
      description:
        'Asset Character + Video reference (có sẵn trên Flow) → Prompt thay [Character]/[Video reference] bằng địa chỉ asset → Generate Video.',
      category: 'motion',
      tags: ['flow', 'veo', 'motion'],
      builtIn: true,
      createdAt: now,
      updatedAt: now,
      workflow: {
        id: 'tpl-dancing-motion',
        schemaVersion: SCHEMA_VERSION,
        name: 'Google Flow Dancing motion control',
        locked: false,
        nodes: [
          {
            id: 'note-1',
            type: 'note',
            position: { x: 40, y: 40 },
            data: {
              content:
                'Chọn asset có sẵn trên Google Flow cho 2 node Asset. Prompt thay [Character] và [Video reference] bằng địa chỉ asset đã nối.',
              color: '#1e3a5f',
              fontSize: 13,
            },
          },
          {
            id: 'asset-video',
            type: 'asset',
            slug: 'video',
            label: 'Video',
            position: { x: 40, y: 160 },
            data: {
              kind: 'video',
              assetLabel: 'Video reference',
              slug: 'video',
              source: 'flow',
            },
          },
          {
            id: 'asset-image',
            type: 'asset',
            slug: 'image_model_1',
            label: 'Model Image',
            position: { x: 40, y: 380 },
            data: {
              kind: 'image',
              assetLabel: 'Character',
              slug: 'image_model_1',
              source: 'flow',
            },
          },
          {
            id: 'prompt-1',
            type: 'prompt',
            label: 'Prompt Assistant',
            position: { x: 400, y: 160 },
            data: {
              provider: 'gemini',
              model: '',
              preset: 'custom',
              instruction:
                'Replace the character in the reference video with [Character]. Keep the face 100% identical. Body movements follow the [Video reference].',
              outputFormat: 'plain',
              newChat: true,
            },
          },
          {
            id: 'gen-video-1',
            type: 'generateVideo',
            label: 'Generate Video',
            position: { x: 1000, y: 160 },
            data: {
              model: 'Omni Flash',
              aspectRatio: '9:16',
              count: 1,
              resolution: 720,
              durationSec: 4,
              timeoutSec: 600,
            },
          },
          {
            id: 'download-1',
            type: 'autoDownload',
            label: 'Auto Download',
            position: { x: 1600, y: 240 },
            data: {
              folderTemplate: 'MyXFlows/{{workflow}}/{{date}}',
              filenameTemplate: '{{slug}}_{{index}}',
              conflict: 'uniquify',
              onlyWhenAllDone: false,
            },
          },
        ],
        edges: [
          {
            id: 'e1',
            source: 'asset-video',
            sourceHandle: 'out:video',
            target: 'prompt-1',
            targetHandle: 'in:video',
            type: 'video',
          },
          {
            id: 'e2',
            source: 'asset-image',
            sourceHandle: 'out:image',
            target: 'prompt-1',
            targetHandle: 'in:image',
            type: 'image',
          },
          {
            id: 'e3',
            source: 'prompt-1',
            sourceHandle: 'out:text',
            target: 'gen-video-1',
            targetHandle: 'in:text',
            type: 'text',
          },
          {
            id: 'e4',
            source: 'gen-video-1',
            sourceHandle: 'out:video',
            target: 'download-1',
            targetHandle: 'in:any',
            type: 'video',
          },
        ],
        viewport: { x: 0, y: 0, zoom: 0.85 },
        settings: { concurrency: 1, retry: 2, stopOnError: true },
        createdAt: now,
        updatedAt: now,
      },
    },
  ];
}
