/**
 * Nhận dạng loại media của một file người dùng chọn từ máy.
 *
 * Không tin mỗi `file.type`: Chrome lấy MIME từ đăng ký của hệ điều hành, nên
 * cùng một file `.mp3` có thể ra `audio/mpeg`, `audio/mp3`, hoặc chuỗi rỗng khi
 * máy không có mapping. Rơi vào chuỗi rỗng mà đoán theo mặc định thì mp3 bị coi
 * là ảnh và node asset xuất sai cổng.
 */

export type MediaKind = 'image' | 'video' | 'audio';

const EXTENSION_KIND: Record<string, MediaKind> = {
  // audio
  mp3: 'audio',
  m4a: 'audio',
  aac: 'audio',
  wav: 'audio',
  ogg: 'audio',
  oga: 'audio',
  opus: 'audio',
  flac: 'audio',
  weba: 'audio',
  // video
  mp4: 'video',
  m4v: 'video',
  mov: 'video',
  webm: 'video',
  mkv: 'video',
  avi: 'video',
  // image
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  webp: 'image',
  gif: 'image',
  avif: 'image',
  bmp: 'image',
};

/** Danh sách cho thuộc tính `accept` của input file — kèm đuôi vì MIME có thể rỗng. */
export const MEDIA_ACCEPT = [
  'image/*',
  'video/*',
  'audio/*',
  ...Object.keys(EXTENSION_KIND).map((e) => `.${e}`),
].join(',');

export function kindFromExtension(name: string | undefined): MediaKind | undefined {
  const ext = (name ?? '').split('.').pop()?.toLowerCase();
  return ext ? EXTENSION_KIND[ext] : undefined;
}

export function kindFromMime(mime: string | undefined): MediaKind | undefined {
  const m = (mime ?? '').toLowerCase();
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('audio/')) return 'audio';
  // Một số máy trả `application/octet-stream` cho mp3/m4a — để đuôi file quyết định.
  return undefined;
}

/** MIME trước, đuôi file sau; `undefined` khi cả hai đều không nói lên điều gì. */
export function mediaKindOf(file: { type?: string; name?: string }): MediaKind | undefined {
  return kindFromMime(file.type) ?? kindFromExtension(file.name);
}
