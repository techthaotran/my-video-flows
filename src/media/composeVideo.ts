/**
 * Ruột của node Ghép video — chỉ chạy trong offscreen document, nơi có
 * WebCodecs, OffscreenCanvas và AudioContext.
 *
 * Một lần decode, một lần encode cho cả ba việc (ghép clip, lồng audio, dán
 * logo): từng frame của từng clip được vẽ lên một canvas chung theo fps cố
 * định, dán logo lên trên, rồi encode thẳng ra mp4. Không có bước trung gian
 * nào ghi file tạm nên không mất chất lượng chồng chất.
 */

import {
  ALL_FORMATS,
  AudioBufferSource,
  BlobSource,
  BufferTarget,
  CanvasSource,
  Input,
  Mp4OutputFormat,
  Output,
  Quality,
  VideoSampleSink,
  getFirstEncodableAudioCodec,
  getFirstEncodableVideoCodec,
  type AudioCodec,
  type VideoCodec,
} from 'mediabunny';
import { evenSize, frameTimestamps, logoRect } from '@/media/layout';

export interface ComposeInput {
  clips: Blob[];
  audio?: { blob: Blob; startSec: number };
  logo?: {
    blob: Blob;
    xPercent: number;
    yPercent: number;
    widthPercent: number;
    opacity: number;
  };
  fps: number;
  bitrateMbps: number;
  onProgress?: (progress: number, message: string) => void;
}

const VIDEO_CODEC_PREFERENCE: VideoCodec[] = ['avc', 'hevc', 'vp9', 'av1'];
const AUDIO_CODEC_PREFERENCE: AudioCodec[] = ['aac', 'opus'];
const AUDIO_BITRATE = 192_000;

class ComposeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ComposeError';
  }
}

interface OpenClip {
  input: Input;
  sink: VideoSampleSink;
  durationSec: number;
  width: number;
  height: number;
}

async function openClip(blob: Blob, index: number): Promise<OpenClip> {
  const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
  const track = await input.getPrimaryVideoTrack();
  if (!track) {
    throw new ComposeError(`Clip ${index + 1} không có track video — không ghép được`);
  }
  if (!(await track.canDecode())) {
    throw new ComposeError(
      `Clip ${index + 1} dùng codec trình duyệt không giải mã được (${track.codec ?? 'không rõ'})`,
    );
  }
  const durationSec = await track.computeDuration();
  if (!(durationSec > 0)) {
    throw new ComposeError(`Clip ${index + 1} có độ dài bằng 0`);
  }
  return {
    input,
    sink: new VideoSampleSink(track),
    durationSec,
    width: track.displayWidth,
    height: track.displayHeight,
  };
}

/**
 * Audio đã cắt, dài đúng bằng video: phần vượt quá bị bỏ, phần thiếu để im
 * lặng. Dùng decodeAudioData nên nhận được mp3 / m4a / wav / ogg như nhau.
 */
async function sliceAudio(
  blob: Blob,
  startSec: number,
  durationSec: number,
): Promise<AudioBuffer> {
  const bytes = await blob.arrayBuffer();
  // OfflineAudioContext để tránh chính sách autoplay của AudioContext thường.
  const decodeCtx = new OfflineAudioContext(2, 1, 48_000);
  let decoded: AudioBuffer;
  try {
    decoded = await decodeCtx.decodeAudioData(bytes);
  } catch {
    throw new ComposeError('Không giải mã được file audio — thử mp3, m4a hoặc wav');
  }

  const rate = decoded.sampleRate;
  const channels = decoded.numberOfChannels;
  const startFrame = Math.min(decoded.length, Math.max(0, Math.round(startSec * rate)));
  if (startFrame >= decoded.length) {
    throw new ComposeError(
      `Điểm bắt đầu audio (${startSec.toFixed(1)}s) nằm ngoài file dài ${decoded.duration.toFixed(1)}s`,
    );
  }
  const outFrames = Math.max(1, Math.round(durationSec * rate));
  const copyFrames = Math.min(outFrames, decoded.length - startFrame);

  // createBuffer nhận sampleRate riêng, nên dùng lại context giải mã là đủ —
  // không cần dựng thêm một OfflineAudioContext dài bằng cả bài.
  const out = decodeCtx.createBuffer(channels, outFrames, rate);
  const scratch = new Float32Array(copyFrames);
  for (let ch = 0; ch < channels; ch++) {
    decoded.copyFromChannel(scratch, ch, startFrame);
    out.copyToChannel(scratch, ch, 0);
  }
  return out;
}

export async function composeVideo(input: ComposeInput): Promise<Blob> {
  const report = input.onProgress ?? (() => undefined);
  if (!input.clips.length) throw new ComposeError('Chưa nối video nào vào node');

  const fps = Math.max(1, Math.round(input.fps));
  const clips: OpenClip[] = [];
  let logoBitmap: ImageBitmap | undefined;

  try {
    report(2, 'Đọc các clip…');
    for (const [i, blob] of input.clips.entries()) {
      clips.push(await openClip(blob, i));
    }
    const totalDuration = clips.reduce((sum, c) => sum + c.durationSec, 0);

    // Khung hình đích lấy theo clip đầu tiên; clip khác tỉ lệ được letterbox vào.
    const frame = evenSize({ width: clips[0]!.width, height: clips[0]!.height });
    const canvas = new OffscreenCanvas(frame.width, frame.height);
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new ComposeError('Không tạo được canvas để render');

    if (input.logo) {
      try {
        logoBitmap = await createImageBitmap(input.logo.blob);
      } catch {
        throw new ComposeError('Không đọc được ảnh logo');
      }
    }
    const logoBox =
      input.logo && logoBitmap
        ? logoRect(frame, { width: logoBitmap.width, height: logoBitmap.height }, input.logo)
        : undefined;

    const videoCodec = await getFirstEncodableVideoCodec(VIDEO_CODEC_PREFERENCE, {
      width: frame.width,
      height: frame.height,
    });
    if (!videoCodec) throw new ComposeError('Trình duyệt không encode được video ở kích thước này');

    const target = new BufferTarget();
    const output = new Output({ format: new Mp4OutputFormat(), target });
    const videoSource = new CanvasSource(canvas, {
      codec: videoCodec,
      quality: new Quality({ bitrate: Math.round(input.bitrateMbps * 1_000_000) }),
      keyFrameInterval: 2,
    });
    output.addVideoTrack(videoSource, { frameRate: fps });

    // Audio phải chuẩn bị trước output.start(): mp4 không thêm track sau khi đã mở.
    let audioSource: AudioBufferSource | undefined;
    let audioBuffer: AudioBuffer | undefined;
    if (input.audio) {
      report(5, 'Cắt audio…');
      audioBuffer = await sliceAudio(input.audio.blob, input.audio.startSec, totalDuration);
      const audioCodec = await getFirstEncodableAudioCodec(AUDIO_CODEC_PREFERENCE, {
        numberOfChannels: audioBuffer.numberOfChannels,
        sampleRate: audioBuffer.sampleRate,
      });
      if (!audioCodec) throw new ComposeError('Trình duyệt không encode được audio');
      audioSource = new AudioBufferSource({
        codec: audioCodec,
        quality: new Quality({ bitrate: AUDIO_BITRATE }),
      });
      output.addAudioTrack(audioSource);
    }

    await output.start();
    if (audioSource && audioBuffer) {
      await audioSource.add(audioBuffer);
      audioSource.close();
    }

    const frameDuration = 1 / fps;
    let elapsed = 0;
    let written = 0;
    const totalFrames = Math.max(1, Math.round(totalDuration * fps));

    for (const [i, clip] of clips.entries()) {
      const clipStart = elapsed;
      const stamps = frameTimestamps(clip.durationSec, fps);
      let hasDrawn = false;
      for await (const sample of clip.sink.samplesAtTimestamps(stamps)) {
        // null = chưa có frame nào cho mốc này; giữ nguyên frame vừa vẽ.
        if (sample) {
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, frame.width, frame.height);
          sample.drawWithFit(ctx, { fit: 'contain' });
          sample.close();
          hasDrawn = true;
          if (logoBitmap && logoBox) {
            ctx.globalAlpha = Math.min(1, Math.max(0, input.logo!.opacity / 100));
            ctx.drawImage(logoBitmap, logoBox.x, logoBox.y, logoBox.width, logoBox.height);
            ctx.globalAlpha = 1;
          }
        } else if (!hasDrawn) {
          continue;
        }
        await videoSource.add(elapsed, frameDuration);
        elapsed += frameDuration;
        written++;
        if (written % fps === 0) {
          report(
            10 + Math.round((written / totalFrames) * 85),
            `Ghép clip ${i + 1}/${clips.length} — ${elapsed.toFixed(1)}s/${totalDuration.toFixed(1)}s`,
          );
        }
      }
      // Clip thiếu frame (decoder trả null ở cuối) không được làm lệch mốc bắt
      // đầu của clip sau — nếu không, tổng video sẽ ngắn dần so với audio.
      elapsed = clipStart + clip.durationSec;
    }
    videoSource.close();

    if (!written) throw new ComposeError('Không đọc được frame nào từ các clip');

    report(97, 'Đóng gói mp4…');
    await output.finalize();
    if (!target.buffer) throw new ComposeError('Encode xong nhưng không có dữ liệu ra');
    report(100, 'Xong');
    return new Blob([target.buffer], { type: 'video/mp4' });
  } finally {
    logoBitmap?.close();
    for (const clip of clips) {
      try {
        clip.input.dispose();
      } catch {
        /* input đã đóng */
      }
    }
  }
}
