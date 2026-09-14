import type { Template } from '@/shared/schema';
import { SCHEMA_VERSION } from '@/shared/schema';

/** Built-in: Character + Outfit → Prompt → Omni Flash (media id slots, no CDN links). */
export function getSeedTemplates(): Template[] {
  const now = Date.now();
  return [
    {
      id: 'tpl-character-outfit-omni',
      name: 'Nhân vật + trang phục → Omni Flash',
      description:
        'Asset Character + Outfit (có sẵn trên Flow) → Prompt giữ [Label] và mô tả → Generate Video Omni Flash neo ảnh trong structured prompt (MZZa6b).',
      category: 'character',
      tags: ['flow', 'omni', 'character'],
      builtIn: true,
      createdAt: now,
      updatedAt: now,
      workflow: {
        id: 'tpl-character-outfit-omni',
        schemaVersion: SCHEMA_VERSION,
        name: 'Nhân vật + trang phục → Omni Flash',
        locked: false,
        nodes: [
          {
            id: 'note-1',
            type: 'note',
            position: { x: 40, y: 40 },
            data: {
              content:
                'Chọn 2 ảnh có sẵn trên Google Flow cho Character và Outfit. Đặt [Label] đúng chỗ neo ảnh trong câu. Omni Flash gửi MZZa6b (abra_r2v_*) với media id — không dán link Flow.',
              color: '#1e3a5f',
              fontSize: 13,
            },
          },
          {
            id: 'asset-character',
            type: 'asset',
            slug: 'character',
            label: 'Character',
            position: { x: 40, y: 160 },
            data: {
              kind: 'image',
              assetLabel: 'Character',
              slug: 'character',
              source: 'flow',
            },
          },
          {
            id: 'asset-outfit',
            type: 'asset',
            slug: 'outfit',
            label: 'Outfit',
            position: { x: 40, y: 380 },
            data: {
              kind: 'image',
              assetLabel: 'Outfit',
              slug: 'outfit',
              source: 'flow',
            },
          },
          {
            id: 'prompt-1',
            type: 'prompt',
            label: 'Prompt',
            position: { x: 400, y: 220 },
            data: {
              provider: 'gemini',
              model: '',
              preset: 'custom',
              instruction:
                'Video dọc 9:16 dài 4 giây, phong cách quay thực tế.\n' +
                '[Character] mặc [Outfit] đi bộ về phía máy quay trên con phố đầy nắng, khẽ mỉm cười.\n' +
                'Giữ nguyên gương mặt, kiểu tóc và từng chi tiết trang phục như ảnh tham chiếu; không thêm, bớt hay đổi màu quần áo và phụ kiện.\n' +
                'Góc máy: toàn thân đến trung cảnh, máy lùi chậm.\n' +
                'Ánh sáng: nắng tự nhiên buổi sáng, mềm.\n\n' +
                '[Character]: Cô gái Đông Á 20-25 tuổi, mặt trái xoan, da sáng, tóc đen thẳng ngang vai.\n\n' +
                '[Outfit]: Áo blazer linen màu kem dáng rộng, áo ba lỗ trắng, quần jeans ống rộng, sneaker trắng.',
              outputFormat: 'plain',
              newChat: true,
            },
          },
          {
            id: 'gen-video-1',
            type: 'generateVideo',
            label: 'Generate Video',
            position: { x: 1000, y: 220 },
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
            position: { x: 1600, y: 280 },
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
            source: 'asset-character',
            sourceHandle: 'out:image',
            target: 'prompt-1',
            targetHandle: 'in:image',
            type: 'image',
          },
          {
            id: 'e2',
            source: 'asset-outfit',
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
        settings: { concurrency: 1, retry: 0, stopOnError: true },
        createdAt: now,
        updatedAt: now,
      },
    },
  ];
}
