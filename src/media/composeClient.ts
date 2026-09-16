/**
 * Phía service worker của node Ghép video: đẩy media vào IndexedDB, nhờ
 * offscreen document render, rồi lấy mp4 kết quả ra.
 */

import { assetRepo } from '@/storage/repos/assetRepo';
import { sendToOffscreen } from '@/media/offscreenBridge';
import {
  COMPOSE_PROGRESS,
  COMPOSE_REQUEST,
  type ComposeVideoProgress,
  type ComposeVideoRequest,
  type ComposeVideoResult,
} from '@/media/composeTypes';
import { nanoid } from '@/shared/utils';

/** Render im lặng lâu hơn mốc này thì coi như treo — encode luôn báo tiến độ mỗi giây. */
const STALL_TIMEOUT_MS = 180_000;

export interface ComposeVideoJob {
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
  workflowId?: string;
  onProgress?: (progress: number, message: string) => void;
}

export async function composeVideoInOffscreen(job: ComposeVideoJob): Promise<Blob> {
  const jobId = nanoid();
  const clipAssetIds: string[] = [];
  for (const clip of job.clips) {
    clipAssetIds.push((await assetRepo.put(clip, 'merge-input.mp4', job.workflowId)).id);
  }

  const request: ComposeVideoRequest = {
    type: COMPOSE_REQUEST,
    jobId,
    clipAssetIds,
    audio: job.audio
      ? {
          assetId: (await assetRepo.put(job.audio.blob, 'merge-audio', job.workflowId)).id,
          startSec: job.audio.startSec,
        }
      : undefined,
    logo: job.logo
      ? {
          assetId: (await assetRepo.put(job.logo.blob, 'merge-logo', job.workflowId)).id,
          xPercent: job.logo.xPercent,
          yPercent: job.logo.yPercent,
          widthPercent: job.logo.widthPercent,
          opacity: job.logo.opacity,
        }
      : undefined,
    fps: job.fps,
    bitrateMbps: job.bitrateMbps,
  };

  let stall: ReturnType<typeof setTimeout> | undefined;
  let onStalled: (() => void) | undefined;
  const armStallTimer = () => {
    if (stall) clearTimeout(stall);
    stall = setTimeout(() => onStalled?.(), STALL_TIMEOUT_MS);
  };

  const onMessage = (msg: unknown) => {
    const p = msg as ComposeVideoProgress | undefined;
    if (p?.type !== COMPOSE_PROGRESS || p.jobId !== jobId) return;
    armStallTimer();
    job.onProgress?.(p.progress, p.message);
  };
  chrome.runtime.onMessage.addListener(onMessage);

  try {
    const stalled = new Promise<never>((_, reject) => {
      onStalled = () => reject(new Error('Ghép video không phản hồi — thử lại với ít clip hơn'));
      armStallTimer();
    });
    const reply = (await Promise.race([
      sendToOffscreen(request) as Promise<ComposeVideoResult | undefined>,
      stalled,
    ])) as ComposeVideoResult | undefined;

    if (reply?.error) throw new Error(reply.error);
    if (!reply?.assetId) throw new Error('Ghép video không trả về kết quả');
    const asset = await assetRepo.get(reply.assetId);
    if (!asset) throw new Error('Không đọc được file video đã ghép');
    return asset.blob;
  } finally {
    if (stall) clearTimeout(stall);
    chrome.runtime.onMessage.removeListener(onMessage);
  }
}
