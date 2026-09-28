import { describe, expect, it } from 'vitest';
import { extractJsonPayload } from '@/shared/utils';

describe('extractJsonPayload', () => {
  it('lấy object đầy đủ khi Gemini bỏ dở một bản rồi viết lại', () => {
    const raw =
      '{"type": "scene", "summary": "A bright studio", "lighting": "Soft, clean directional' +
      '{\n"type": "scene",\n"summary": "Bright indoor studio",\n"mood": "Relaxed {cozy}"\n}';
    expect(JSON.parse(extractJsonPayload(raw))).toEqual({
      type: 'scene',
      summary: 'Bright indoor studio',
      mood: 'Relaxed {cozy}',
    });
  });

  it('giữ object ngoài cùng khi có object lồng nhau', () => {
    const raw = 'Kết quả: {"type": "model", "identity": {"hair": "black"}} xong';
    expect(JSON.parse(extractJsonPayload(raw))).toEqual({
      type: 'model',
      identity: { hair: 'black' },
    });
  });

  it('bóc code fence json', () => {
    expect(extractJsonPayload('```json\n{"a": 1}\n```')).toBe('{"a": 1}');
  });

  it('chuỗi có dấu nháy thoát không làm lệch ngoặc', () => {
    const raw = '{"summary": "tag \\"LOEWE\\" {x}", "type": "scene"}';
    expect(JSON.parse(extractJsonPayload(raw)).type).toBe('scene');
  });
});
