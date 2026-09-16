/**
 * Hợp đồng giữa service worker và offscreen document cho node Ghép video.
 *
 * Media không đi qua message (blob không serialize được, base64 thì quá nặng
 * cho nhiều clip): cả đầu vào lẫn kết quả đều nằm trong bảng assets của
 * IndexedDB, message chỉ mang asset id.
 */

export const COMPOSE_REQUEST = 'offscreen.composeVideo';
export const COMPOSE_PROGRESS = 'offscreen.composeProgress';

export interface ComposeVideoRequest {
  type: typeof COMPOSE_REQUEST;
  jobId: string;
  /** Asset id của từng clip, đúng thứ tự ghép. */
  clipAssetIds: string[];
  audio?: {
    assetId: string;
    /** Giây bắt đầu cắt trong file audio; cắt tới khi hết video. */
    startSec: number;
  };
  logo?: {
    assetId: string;
    xPercent: number;
    yPercent: number;
    widthPercent: number;
    /** 0–100. */
    opacity: number;
  };
  fps: number;
  bitrateMbps: number;
}

export interface ComposeVideoProgress {
  type: typeof COMPOSE_PROGRESS;
  jobId: string;
  /** 0–100. */
  progress: number;
  message: string;
}

export interface ComposeVideoResult {
  /** Asset id của file mp4 kết quả. */
  assetId?: string;
  error?: string;
}
