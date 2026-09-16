/**
 * Phép tính bố cục của node Ghép video — thuần, không đụng WebCodecs/DOM nên
 * dùng được cả ở offscreen (lúc render) lẫn ở editor (lúc xem trước).
 */

export interface LogoPlacement {
  /** Vị trí góc trên-trái của logo, tính theo % chiều rộng / chiều cao khung. */
  xPercent: number;
  yPercent: number;
  /** Chiều rộng logo theo % chiều rộng khung; chiều cao suy ra từ tỉ lệ ảnh. */
  widthPercent: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Hình chữ nhật vẽ logo, tính bằng pixel của khung hình đích. Logo luôn giữ
 * đúng tỉ lệ ảnh gốc và được kẹp lại để không tràn ra ngoài khung.
 */
export function logoRect(
  frame: { width: number; height: number },
  logo: { width: number; height: number },
  place: LogoPlacement,
): Rect {
  const width = Math.max(1, Math.round((frame.width * clamp(place.widthPercent, 1, 100)) / 100));
  const ratio = logo.height / logo.width;
  const height = Math.max(1, Math.round(width * ratio));
  const x = Math.round((frame.width * clamp(place.xPercent, 0, 100)) / 100);
  const y = Math.round((frame.height * clamp(place.yPercent, 0, 100)) / 100);
  return {
    width,
    height,
    x: clamp(x, 0, Math.max(0, frame.width - width)),
    y: clamp(y, 0, Math.max(0, frame.height - height)),
  };
}

/** Kích thước encode phải chẵn — H.264 không nhận chiều lẻ. */
export function evenSize(size: { width: number; height: number }): {
  width: number;
  height: number;
} {
  return {
    width: Math.max(2, Math.round(size.width / 2) * 2),
    height: Math.max(2, Math.round(size.height / 2) * 2),
  };
}

/**
 * Thứ tự ghép cuối cùng: theo `order` đã lưu, bỏ những id không còn nối, rồi
 * nối thêm những nguồn mới (chưa có trong `order`) vào cuối, giữ nguyên thứ tự
 * chúng xuất hiện trong danh sách đầu vào.
 */
export function orderedClipIds(order: readonly string[], connected: readonly string[]): string[] {
  const available = new Set(connected);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const id of order) {
    if (!available.has(id) || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  for (const id of connected) {
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

/** Mốc thời gian (giây) của từng frame trong một clip, theo fps cố định. */
export function frameTimestamps(durationSec: number, fps: number): number[] {
  const count = Math.max(1, Math.round(durationSec * fps));
  const out: number[] = [];
  for (let i = 0; i < count; i++) out.push(i / fps);
  return out;
}

function clamp(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, v));
}
