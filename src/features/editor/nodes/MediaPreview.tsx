import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Clapperboard,
  ExternalLink,
  ImagePlus,
  Loader2,
  Maximize2,
  Pause,
  Play,
  Repeat,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { cn } from '@/shared/utils';

/** React Flow ignores drag/pan/wheel that start on these elements. */
const NO_CANVAS = 'nodrag nopan nowheel';

/** Stage box per aspect ratio — portrait clips stay tall without blowing up the node. */
function stageStyle(aspect: string | undefined): { className: string; style: React.CSSProperties } {
  switch (aspect) {
    case '16:9':
      return { className: 'w-full', style: { aspectRatio: '16 / 9' } };
    case '4:3':
      return { className: 'w-full', style: { aspectRatio: '4 / 3' } };
    case '1:1':
      return { className: 'mx-auto h-[320px]', style: { aspectRatio: '1 / 1' } };
    case '3:4':
      return { className: 'mx-auto h-[360px]', style: { aspectRatio: '3 / 4' } };
    case '9:16':
    default:
      return { className: 'mx-auto h-[400px]', style: { aspectRatio: '9 / 16' } };
  }
}

function formatClock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function GenerateMediaStage({
  kind,
  url,
  aspectRatio,
  running,
  progress,
  statusMessage,
  ready,
}: {
  kind: 'image' | 'video';
  url: string | null;
  aspectRatio?: string;
  running: boolean;
  progress?: number;
  statusMessage?: string;
  /** Prompt or inputs present — the node can generate. */
  ready: boolean;
}) {
  const stage = stageStyle(aspectRatio);
  return (
    <div className="rounded-xl bg-[radial-gradient(ellipse_at_top,hsl(217_33%_16%),hsl(222_47%_5%))] p-2 ring-1 ring-border/70">
      <div
        className={cn(
          'relative max-w-full overflow-hidden rounded-lg bg-black shadow-[0_8px_30px_rgb(0_0_0/0.45)]',
          stage.className,
        )}
        style={stage.style}
      >
        {url && kind === 'video' && <NodeVideoPlayer src={url} />}
        {url && kind === 'image' && <NodeImage src={url} />}
        {!url && !running && <EmptyStage kind={kind} ready={ready} />}
        {running && (
          <RunningOverlay progress={progress ?? 0} message={statusMessage} over={!!url} kind={kind} />
        )}
      </div>
    </div>
  );
}

function EmptyStage({ kind, ready }: { kind: 'image' | 'video'; ready: boolean }) {
  const Icon = kind === 'video' ? Clapperboard : ImagePlus;
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[linear-gradient(135deg,hsl(217_33%_10%),hsl(222_47%_6%))] text-center">
      <div
        className={cn(
          'flex h-12 w-12 items-center justify-center rounded-full ring-1',
          ready ? 'bg-primary/10 text-primary ring-primary/40' : 'bg-muted/60 text-muted-foreground ring-border',
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className={cn('text-[11px] font-medium', ready ? 'text-foreground/90' : 'text-muted-foreground')}>
        {ready ? 'Sẵn sàng generate' : kind === 'video' ? 'Chưa có video' : 'Chưa có ảnh'}
      </div>
      <div className="max-w-[80%] text-[10px] leading-snug text-muted-foreground">
        {ready ? 'Bấm nút bên dưới để tạo' : 'Nhập prompt hoặc nối text/ảnh vào node'}
      </div>
    </div>
  );
}

function RunningOverlay({
  progress,
  message,
  over,
  kind,
}: {
  progress: number;
  message?: string;
  over: boolean;
  kind: 'image' | 'video';
}) {
  const pct = Math.max(0, Math.min(100, Math.round(progress)));
  return (
    <div
      className={cn(
        'absolute inset-0 flex flex-col items-center justify-center gap-3 px-4 text-center',
        over ? 'bg-black/60 backdrop-blur-[2px]' : 'bg-[linear-gradient(135deg,hsl(217_33%_10%),hsl(222_47%_6%))]',
      )}
    >
      {!over && <div className="media-shimmer absolute inset-0" />}
      <div className="relative flex items-center gap-2 text-primary">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-lg font-semibold tabular-nums">{pct}%</span>
      </div>
      <div className="relative h-1 w-3/4 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-lime-400 to-emerald-400 transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="relative line-clamp-3 max-w-full break-words text-[10px] leading-snug text-white/70">
        {message || (kind === 'video' ? 'Đang tạo video…' : 'Đang tạo ảnh…')}
      </div>
    </div>
  );
}

function NodeImage({ src }: { src: string }) {
  return (
    <button
      type="button"
      className={cn('group relative block h-full w-full', NO_CANVAS)}
      title="Mở ảnh trong tab mới"
      onClick={(e) => {
        e.stopPropagation();
        window.open(src, '_blank');
      }}
    >
      <img src={src} alt="" className="h-full w-full object-contain" draggable={false} />
      <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
        <ExternalLink className="h-3.5 w-3.5" />
      </span>
    </button>
  );
}

/** Compact player that lives on a canvas node — every control stops canvas drag. */
export function NodeVideoPlayer({ src, onError }: { src: string; onError?: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [loop, setLoop] = useState(true);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hover, setHover] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setPlaying(false);
    setCurrent(0);
    setDuration(0);
    setFailed(false);
  }, [src]);

  const toggle = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => setPlaying(false));
    else v.pause();
  }, []);

  const seek = (value: number) => {
    const v = videoRef.current;
    if (!v || !Number.isFinite(v.duration)) return;
    v.currentTime = value;
    setCurrent(value);
  };

  const pct = duration ? (current / duration) * 100 : 0;
  const showChrome = hover || !playing;

  if (failed) {
    return (
      <div className="flex h-full w-full items-center justify-center p-4 text-center text-[11px] text-red-300">
        Không phát được video (file hỏng hoặc định dạng không hỗ trợ)
      </div>
    );
  }

  return (
    <div
      ref={frameRef}
      className={cn('group relative h-full w-full select-none bg-black', NO_CANVAS)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onKeyDown={(e) => {
        if (e.code === 'Space') {
          e.preventDefault();
          e.stopPropagation();
          toggle();
        }
      }}
      tabIndex={0}
    >
      <video
        ref={videoRef}
        src={src}
        className="h-full w-full cursor-pointer object-contain"
        muted={muted}
        loop={loop}
        playsInline
        preload="metadata"
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          void frameRef.current?.requestFullscreen?.();
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onError={() => {
          setFailed(true);
          onError?.();
        }}
      />

      {!playing && (
        <button
          type="button"
          className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white shadow-lg ring-1 ring-white/30 backdrop-blur-md transition hover:scale-105 hover:bg-white/25"
          title="Phát (Space)"
          onClick={(e) => {
            e.stopPropagation();
            toggle();
          }}
        >
          <Play className="ml-0.5 h-6 w-6 fill-current" />
        </button>
      )}

      <div
        className={cn(
          'absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-2 pb-1.5 pt-6 transition-opacity duration-200',
          showChrome ? 'opacity-100' : 'opacity-0',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative mb-1 h-3">
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/20" />
          <div
            className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-lime-400"
            style={{ width: `${pct}%` }}
          />
          <div
            className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow"
            style={{ left: `${pct}%` }}
          />
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.01}
            value={current}
            onChange={(e) => seek(Number(e.target.value))}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label="Tua video"
          />
        </div>
        <div className="flex items-center gap-1 text-white">
          <PlayerBtn title={playing ? 'Tạm dừng' : 'Phát'} onClick={toggle}>
            {playing ? <Pause className="h-3.5 w-3.5 fill-current" /> : <Play className="h-3.5 w-3.5 fill-current" />}
          </PlayerBtn>
          <span className="font-mono text-[10px] tabular-nums text-white/80">
            {formatClock(current)} / {formatClock(duration)}
          </span>
          <div className="ml-auto flex items-center gap-0.5">
            <PlayerBtn title={loop ? 'Tắt lặp' : 'Bật lặp'} onClick={() => setLoop(!loop)} active={loop}>
              <Repeat className="h-3.5 w-3.5" />
            </PlayerBtn>
            <PlayerBtn title={muted ? 'Bật tiếng' : 'Tắt tiếng'} onClick={() => setMuted(!muted)}>
              {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            </PlayerBtn>
            <PlayerBtn title="Mở trong tab mới" onClick={() => window.open(src, '_blank')}>
              <ExternalLink className="h-3.5 w-3.5" />
            </PlayerBtn>
            <PlayerBtn title="Toàn màn hình" onClick={() => void frameRef.current?.requestFullscreen?.()}>
              <Maximize2 className="h-3.5 w-3.5" />
            </PlayerBtn>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlayerBtn({
  title,
  onClick,
  active,
  children,
}: {
  title: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        'flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-white/15',
        active ? 'text-lime-300' : 'text-white/90',
      )}
    >
      {children}
    </button>
  );
}
