import { useEffect, useRef, useState } from 'react';
import { useEditorStore } from '@/features/editor/store';

/**
 * Object URL của một output đã lưu trong IndexedDB. Trả null khi chưa có output
 * hoặc output không kèm blob (vd node chỉ ra text).
 *
 * URL cũ chỉ được thu hồi **sau khi** URL mới đã hiển thị. Thu hồi ngay trong
 * cleanup của effect là sai: React đã render lại với `url` cũ (state chưa đổi)
 * trong lúc blob mới còn đang đọc từ IndexedDB, nên thẻ `<video>` trỏ vào một
 * blob vừa bị huỷ và bắn `error`.
 */
export function useOutputUrl(outputId?: string, bust?: unknown): string | null {
  const [url, setUrl] = useState<string | null>(null);
  const previous = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const publish = (next: string | null) => {
      const stale = previous.current;
      previous.current = next;
      setUrl(next);
      if (stale && stale !== next) URL.revokeObjectURL(stale);
    };

    void (async () => {
      if (!outputId) {
        if (!cancelled) publish(null);
        return;
      }
      const { runRepo } = await import('@/storage/repos/runRepo');
      // Thử lại một nhịp — service worker có thể ghi IndexedDB xong sau khi UI đọc.
      let out = await runRepo.getOutput(outputId);
      if (!out?.blob) {
        await new Promise((r) => setTimeout(r, 50));
        if (cancelled) return;
        out = await runRepo.getOutput(outputId);
      }
      if (cancelled) return;
      if (!out?.blob) {
        publish(null);
        return;
      }
      const next = URL.createObjectURL(out.blob);
      if (cancelled) {
        URL.revokeObjectURL(next);
        return;
      }
      publish(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [outputId, bust]);

  // Chỉ thu hồi khi component biến mất hẳn.
  useEffect(
    () => () => {
      if (previous.current) URL.revokeObjectURL(previous.current);
      previous.current = null;
    },
    [],
  );

  return url;
}

/**
 * Object URL của kết quả gần nhất mà một node đang hiển thị (`previewOutputId`).
 * Đọc qua store để node đã memo của React Flow vẫn cập nhật khi có output mới.
 *
 * `previewRev` đổi mỗi lần node nhận output nên đủ để nạp lại, kể cả khi output
 * id trùng với lần trước. Không dựa vào trạng thái chạy: running → success
 * không đổi nội dung, nạp lại theo nó chỉ tạo thêm một nhịp không có video.
 */
export function useNodeOutputUrl(nodeId: string): string | null {
  const previewId = useEditorStore(
    (s) => s.nodes.find((n) => n.id === nodeId)?.data.data.previewOutputId as string | undefined,
  );
  const previewRev = useEditorStore(
    (s) => s.nodes.find((n) => n.id === nodeId)?.data.data.previewRev as number | undefined,
  );
  return useOutputUrl(previewId, previewRev);
}

/** Độ dài (giây) của một file media, đọc từ metadata — null khi chưa đọc được. */
export function useMediaDuration(url: string | null, kind: 'video' | 'audio'): number | null {
  const [duration, setDuration] = useState<number | null>(null);

  useEffect(() => {
    setDuration(null);
    if (!url) return;
    const el = document.createElement(kind);
    el.preload = 'metadata';
    const onLoaded = () => {
      if (Number.isFinite(el.duration)) setDuration(el.duration);
    };
    el.addEventListener('loadedmetadata', onLoaded);
    el.src = url;
    return () => {
      el.removeEventListener('loadedmetadata', onLoaded);
      el.removeAttribute('src');
    };
  }, [url, kind]);

  return duration;
}
