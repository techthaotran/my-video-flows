import { describe, expect, it } from 'vitest';
import { MEDIA_ACCEPT, kindFromExtension, kindFromMime, mediaKindOf } from '@/shared/media';
import { assetRepo } from '@/storage/repos/assetRepo';
import { AssetSchema, AUDIO_ASSET_LABEL, defaultKindForLabel } from '@/shared/schema';

describe('nhận dạng loại media', () => {
  it('lấy theo MIME khi MIME nói rõ', () => {
    expect(kindFromMime('audio/mpeg')).toBe('audio');
    expect(kindFromMime('AUDIO/MP3')).toBe('audio');
    expect(kindFromMime('video/mp4')).toBe('video');
    expect(kindFromMime('image/png')).toBe('image');
  });

  it('bỏ qua MIME chung chung để đuôi file quyết định', () => {
    expect(kindFromMime('application/octet-stream')).toBeUndefined();
    expect(mediaKindOf({ type: 'application/octet-stream', name: 'nhac-nen.mp3' })).toBe('audio');
  });

  it('mp3 không có MIME vẫn ra audio, không bị đoán thành ảnh', () => {
    // Chrome trả type rỗng khi hệ điều hành không có mapping cho .mp3.
    expect(mediaKindOf({ type: '', name: 'voice.mp3' })).toBe('audio');
    expect(mediaKindOf({ type: undefined, name: 'VOICE.MP3' })).toBe('audio');
  });

  it('nhận các định dạng audio hay dùng khác', () => {
    for (const name of ['a.m4a', 'a.wav', 'a.ogg', 'a.flac', 'a.aac', 'a.opus']) {
      expect(kindFromExtension(name)).toBe('audio');
    }
  });

  it('không đoán bừa khi cả MIME lẫn đuôi đều vô nghĩa', () => {
    expect(mediaKindOf({ type: '', name: 'khong-duoi' })).toBeUndefined();
    expect(mediaKindOf({ type: '', name: 'file.xyz' })).toBeUndefined();
  });

  it('accept của input file có cả MIME lẫn đuôi — MIME rỗng vẫn chọn được mp3', () => {
    expect(MEDIA_ACCEPT).toContain('audio/*');
    expect(MEDIA_ACCEPT).toContain('.mp3');
    expect(MEDIA_ACCEPT).toContain('.m4a');
  });
});

describe('lưu asset audio', () => {
  it('mp3 được ghi với kind audio, kể cả khi blob không có MIME', async () => {
    const withMime = await assetRepo.put(new Blob(['a'], { type: 'audio/mpeg' }), 'nhac.mp3');
    expect(withMime.kind).toBe('audio');

    const noMime = await assetRepo.put(new Blob(['khac'], { type: '' }), 'voice.mp3');
    expect(noMime.kind).toBe('audio');
  });

  it('schema asset chấp nhận kind audio', () => {
    expect(
      AssetSchema.parse({
        id: 'a',
        sha256: 'h',
        mime: 'audio/mpeg',
        size: 1,
        originalName: 'nhac.mp3',
        kind: 'audio',
        createdAt: 1,
      }).kind,
    ).toBe('audio');
  });

  it('có đúng một label dành cho audio nên tự chuyển label được', () => {
    expect(defaultKindForLabel(AUDIO_ASSET_LABEL)).toBe('audio');
  });
});
