import { describe, expect, it } from 'vitest';
import { evenSize, frameTimestamps, logoRect, orderedClipIds } from '@/media/layout';
import { orderClipsForMerge } from '@/engine/executors';
import { sourceAllowed } from '@/nodes/ports';
import { DEFAULT_PORTS } from '@/nodes/ports';
import { MergeVideoNodeDataSchema, migrateWorkflow } from '@/shared/schema';
import type { NodeOutputValue } from '@/engine/types';

function clip(sourceNodeId: string, name = sourceNodeId): NodeOutputValue {
  return { kind: 'video', sourceNodeId, name, blob: new Blob([name]) };
}

describe('thứ tự ghép', () => {
  it('giữ thứ tự đã lưu và đẩy nguồn mới xuống cuối', () => {
    expect(orderedClipIds(['b', 'a'], ['a', 'b', 'c'])).toEqual(['b', 'a', 'c']);
  });

  it('bỏ id của node đã ngắt kết nối', () => {
    expect(orderedClipIds(['b', 'x', 'a'], ['a', 'b'])).toEqual(['b', 'a']);
  });

  it('không nhân đôi khi order có id trùng', () => {
    expect(orderedClipIds(['a', 'a', 'b'], ['a', 'b'])).toEqual(['a', 'b']);
  });

  it('order rỗng thì giữ nguyên thứ tự đầu vào', () => {
    expect(orderedClipIds([], ['c', 'a', 'b'])).toEqual(['c', 'a', 'b']);
  });

  it('chỉ lấy value kind=video và xếp theo order', () => {
    const values: NodeOutputValue[] = [
      clip('v2'),
      { kind: 'audio', sourceNodeId: 'a1', blob: new Blob(['nhac']) },
      clip('v1'),
      { kind: 'image', sourceNodeId: 'logo', blob: new Blob(['png']) },
    ];
    expect(orderClipsForMerge(['v1', 'v2'], values).map((v) => v.sourceNodeId)).toEqual(['v1', 'v2']);
  });

  it('giữ nguyên thứ tự nội bộ khi một node sinh nhiều clip', () => {
    const values = [clip('v1', 'v1-a'), clip('v1', 'v1-b'), clip('v0')];
    expect(orderClipsForMerge(['v0', 'v1'], values).map((v) => v.name)).toEqual([
      'v0',
      'v1-a',
      'v1-b',
    ]);
  });
});

describe('bố cục logo', () => {
  const frame = { width: 1080, height: 1920 };

  it('kích thước theo % chiều rộng khung, chiều cao giữ tỉ lệ ảnh', () => {
    const rect = logoRect(frame, { width: 200, height: 100 }, {
      xPercent: 0,
      yPercent: 0,
      widthPercent: 20,
    });
    expect(rect).toMatchObject({ x: 0, y: 0, width: 216, height: 108 });
  });

  it('kẹp lại để logo không tràn khỏi khung', () => {
    const rect = logoRect(frame, { width: 100, height: 100 }, {
      xPercent: 100,
      yPercent: 100,
      widthPercent: 20,
    });
    expect(rect.x + rect.width).toBe(frame.width);
    expect(rect.y + rect.height).toBe(frame.height);
  });

  it('% ngoài khoảng hợp lệ được kẹp thay vì tính sai', () => {
    const rect = logoRect(frame, { width: 100, height: 100 }, {
      xPercent: -50,
      yPercent: Number.NaN,
      widthPercent: 500,
    });
    expect(rect.x).toBe(0);
    expect(rect.y).toBe(0);
    expect(rect.width).toBe(frame.width);
  });
});

describe('kích thước encode', () => {
  it('làm tròn về số chẵn — H.264 không nhận chiều lẻ', () => {
    expect(evenSize({ width: 1079, height: 1921 })).toEqual({ width: 1080, height: 1922 });
  });

  it('không bao giờ trả về 0', () => {
    expect(evenSize({ width: 0, height: 1 })).toEqual({ width: 2, height: 2 });
  });
});

describe('mốc frame', () => {
  it('đủ số frame theo fps và bắt đầu từ 0', () => {
    const stamps = frameTimestamps(2, 30);
    expect(stamps).toHaveLength(60);
    expect(stamps[0]).toBe(0);
    expect(stamps.at(-1)).toBeCloseTo(59 / 30);
  });

  it('clip cực ngắn vẫn có ít nhất 1 frame', () => {
    expect(frameTimestamps(0.001, 30)).toEqual([0]);
  });
});

describe('node Ghép video trong workflow', () => {
  it('nhận video/audio/ảnh vào, xuất video', () => {
    const ports = DEFAULT_PORTS.mergeVideo;
    expect(ports.inputs.map((p) => p.type)).toEqual(['video', 'audio', 'image']);
    expect(ports.inputs.find((p) => p.type === 'audio')?.maxConnections).toBe(1);
    expect(ports.inputs.find((p) => p.type === 'image')?.maxConnections).toBe(1);
    expect(ports.outputs).toEqual([{ id: 'out:video', type: 'video' }]);
  });

  it('nhận nguồn từ asset và generate, và chính nó nối được vào Auto Download', () => {
    expect(sourceAllowed('generateVideo', 'mergeVideo')).toBe(true);
    expect(sourceAllowed('asset', 'mergeVideo')).toBe(true);
    expect(sourceAllowed('mergeVideo', 'autoDownload')).toBe(true);
    expect(sourceAllowed('prompt', 'mergeVideo')).toBe(false);
  });

  it('default data hợp lệ và audio cắt từ giây 0', () => {
    expect(MergeVideoNodeDataSchema.parse({})).toMatchObject({
      order: [],
      fps: 30,
      audioStartSec: 0,
      logoOpacity: 100,
    });
  });

  it('workflow cũ (schema v4, chưa có node này) vẫn load được', () => {
    const wf = migrateWorkflow({
      id: 'w',
      schemaVersion: 4,
      workspaceId: 'ws',
      name: 'cũ',
      nodes: [{ id: 'a', type: 'generateVideo', position: { x: 0, y: 0 }, data: { prompt: 'x' } }],
      edges: [],
      createdAt: 1,
      updatedAt: 1,
    });
    expect(wf.schemaVersion).toBe(5);
    expect(wf.nodes[0]!.type).toBe('generateVideo');
  });
});
