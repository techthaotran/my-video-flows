import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Clapperboard,
  Film,
  Loader2,
  Square,
  Volume2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEditorStore } from '@/features/editor/store';
import { useAssetUrl } from '@/features/editor/IncomingAssets';
import type { IncomingItem } from '@/features/editor/incomingInputs';
import { ExportVideoButton, NodeVideoPlayer } from '@/features/editor/nodes/MediaPreview';
import { useMediaDuration, useOutputUrl } from '@/features/editor/nodes/useMediaUrl';
import { logoRect, moveInOrder, orderedClipIds } from '@/media/layout';
import { strings } from '@/shared/strings';
import { cn } from '@/shared/utils';

/** React Flow bỏ qua drag/pan/wheel bắt đầu trên phần tử có class này. */
const NO_CANVAS = 'nodrag nopan nowheel';

/** Khung kéo thả logo — đủ to để đặt chính xác mà không làm node quá cao. */
const LOGO_STAGE_HEIGHT = 240;

export interface MergeVideoBodyProps {
  nodeId: string;
  data: Record<string, unknown>;
  items: IncomingItem[];
  status?: string;
  progress?: number;
  statusMessage?: string;
  previewUrl: string | null;
  onChange: (patch: Record<string, unknown>) => void;
  onRun: () => void;
  onStop: () => void;
}

export function MergeVideoBody(props: MergeVideoBodyProps) {
  const { data, items, onChange } = props;
  const running = props.status === 'running';

  const clipItems = useMemo(() => items.filter((i) => i.portType === 'video'), [items]);
  const order = useMemo(
    () =>
      orderedClipIds(
        (data.order as string[]) ?? [],
        clipItems.map((i) => i.sourceNodeId),
      ),
    [data.order, clipItems],
  );
  const orderedClips = useMemo(
    () => order.map((id) => clipItems.find((i) => i.sourceNodeId === id)).filter((i) => !!i),
    [order, clipItems],
  );
  const audioItem = items.find((i) => i.portType === 'audio');
  const logoItem = items.find((i) => i.portType === 'image');

  // Độ dài từng clip do hàng của nó tự đọc và báo lên — tổng quyết định đoạn
  // audio được cắt, nên hiển thị luôn cho người dùng đối chiếu.
  const [durations, setDurations] = useState<Record<string, number>>({});
  const reportDuration = useCallback((nodeId: string, seconds: number | null) => {
    setDurations((prev) => {
      if (seconds == null) {
        if (!(nodeId in prev)) return prev;
        const next = { ...prev };
        delete next[nodeId];
        return next;
      }
      if (prev[nodeId] === seconds) return prev;
      return { ...prev, [nodeId]: seconds };
    });
  }, []);
  const totalDuration = orderedClips.reduce(
    (sum, c) => sum + (durations[c.sourceNodeId] ?? 0),
    0,
  );
  const knowAllDurations =
    orderedClips.length > 0 && orderedClips.every((c) => durations[c.sourceNodeId] != null);

  // Khung hình đích lấy theo clip đầu tiên — preview logo phải khớp tỉ lệ đó.
  const firstClipNodeId = orderedClips[0]?.sourceNodeId;
  const aspectRatio = useEditorStore((s) => {
    const src = s.nodes.find((n) => n.id === firstClipNodeId);
    const value = src?.data.data.aspectRatio;
    return typeof value === 'string' && value ? value : '9:16';
  });

  const move = (index: number, delta: number) => {
    onChange({ order: moveInOrder(order, index, delta) });
  };

  return (
    <div className="min-w-0 space-y-2 overflow-hidden">
      <Section
        title={strings.mergeOrderTitle}
        badge={
          orderedClips.length
            ? strings.mergeOrderCount(
                orderedClips.length,
                knowAllDurations ? formatSeconds(totalDuration) : strings.mergeDurationUnknown,
              )
            : undefined
        }
      >
        {orderedClips.length ? (
          <ol className="space-y-1">
            {orderedClips.map((item, i) => (
              <ClipRow
                key={item.sourceNodeId}
                item={item}
                index={i}
                last={i === orderedClips.length - 1}
                onMove={(delta) => move(i, delta)}
                onDuration={reportDuration}
              />
            ))}
          </ol>
        ) : (
          <Empty>{strings.mergeOrderEmpty}</Empty>
        )}
      </Section>

      <Section title={strings.mergeAudioTitle}>
        {audioItem ? (
          <AudioSection
            item={audioItem}
            startSec={Number(data.audioStartSec ?? 0)}
            videoDuration={knowAllDurations ? totalDuration : null}
            onChange={onChange}
          />
        ) : (
          <Empty>{strings.mergeAudioEmpty}</Empty>
        )}
      </Section>

      <Section title={strings.mergeLogoTitle}>
        {logoItem ? (
          <LogoEditor
            item={logoItem}
            aspectRatio={aspectRatio}
            xPercent={Number(data.logoXPercent ?? 4)}
            yPercent={Number(data.logoYPercent ?? 4)}
            widthPercent={Number(data.logoWidthPercent ?? 18)}
            opacity={Number(data.logoOpacity ?? 100)}
            onChange={onChange}
          />
        ) : (
          <Empty>{strings.mergeLogoEmpty}</Empty>
        )}
      </Section>

      <Section title={strings.mergeOutputTitle}>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-[11px]">
            <span className="text-muted-foreground">{strings.mergeFps}</span>
            <NumberInput
              value={Number(data.fps ?? 30)}
              min={1}
              max={60}
              step={1}
              onChange={(v) => onChange({ fps: Math.round(v) })}
            />
          </label>
          <label className="flex items-center gap-1.5 text-[11px]">
            <span className="text-muted-foreground">{strings.mergeBitrate}</span>
            <NumberInput
              value={Number(data.bitrateMbps ?? 8)}
              min={0.5}
              max={50}
              step={0.5}
              onChange={(v) => onChange({ bitrateMbps: v })}
            />
          </label>
        </div>
        <div className="mt-1 text-[10px] leading-snug text-muted-foreground">
          {strings.mergeFrameHint}
        </div>
      </Section>

      <Section title={strings.mergeResultTitle}>
        <MergeStage
          url={props.previewUrl}
          aspectRatio={aspectRatio}
          running={running}
          hasClips={orderedClips.length > 0}
        />
        {running && <MergeProgress progress={props.progress ?? 0} message={props.statusMessage} />}
      </Section>

      <div className="flex gap-1.5">
        <Button
          type="button"
          size="sm"
          className="min-w-0 flex-1 gap-1.5"
          disabled={running || !orderedClips.length}
          title={orderedClips.length ? undefined : strings.mergeNotReady}
          onClick={(e) => {
            e.stopPropagation();
            props.onRun();
          }}
        >
          {running ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
          ) : (
            <Film className="h-3.5 w-3.5 shrink-0" />
          )}
          <span className="truncate">
            {running ? `${strings.mergeRunning} ${Math.round(props.progress ?? 0)}%` : strings.mergeRun}
          </span>
        </Button>
        <ExportVideoButton
          url={props.previewUrl}
          disabled={running}
          onClick={(e) => e.stopPropagation()}
        />
        {running && (
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="shrink-0 gap-1 px-2"
            title={strings.stop}
            onClick={(e) => {
              e.stopPropagation();
              props.onStop();
            }}
          >
            <Square className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Một clip trong danh sách ghép: thumbnail, tên + id node nguồn, độ dài, và nút
 * đổi thứ tự. Thumbnail lấy từ file của asset, hoặc từ kết quả gần nhất của node
 * generate phía trước.
 */
function ClipRow({
  item,
  index,
  last,
  onMove,
  onDuration,
}: {
  item: IncomingItem;
  index: number;
  last: boolean;
  onMove: (delta: number) => void;
  onDuration: (nodeId: string, seconds: number | null) => void;
}) {
  const source = useEditorStore((s) => s.nodes.find((n) => n.id === item.sourceNodeId));
  const previewOutputId = source?.data.data.previewOutputId as string | undefined;
  const assetUrl = useAssetUrl(item.flowMediaId ? undefined : item.assetId, item.missing);
  const outputUrl = useOutputUrl(item.assetId ? undefined : previewOutputId);
  const url = assetUrl ?? outputUrl ?? (item.flowPreviewUrl || null);
  const duration = useMediaDuration(url, 'video');
  const label = source?.data.label ?? item.title;
  const slug = source?.data.slug;

  const sourceNodeId = item.sourceNodeId;
  useEffect(() => {
    onDuration(sourceNodeId, duration);
    return () => onDuration(sourceNodeId, null);
  }, [sourceNodeId, duration, onDuration]);

  return (
    <li className="flex items-center gap-2 rounded border border-border/60 bg-muted/30 p-1">
      <span className="w-4 shrink-0 text-center font-mono text-[11px] text-emerald-300">
        {index + 1}
      </span>
      <ClipThumb url={url} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[11px] font-medium" title={label}>
          {label}
        </div>
        <div className="truncate font-mono text-[10px] text-muted-foreground" title={item.sourceNodeId}>
          {slug ? `@${slug}` : `#${item.sourceNodeId.slice(0, 8)}`}
        </div>
      </div>
      <span className="shrink-0 tabular-nums text-[10px] text-muted-foreground">
        {duration != null ? formatSeconds(duration) : url ? '…' : strings.mergeClipNoPreview}
      </span>
      <IconButton label={strings.mergeMoveUp} disabled={index === 0} onClick={() => onMove(-1)}>
        <ArrowUp className="h-3 w-3" />
      </IconButton>
      <IconButton label={strings.mergeMoveDown} disabled={last} onClick={() => onMove(1)}>
        <ArrowDown className="h-3 w-3" />
      </IconButton>
    </li>
  );
}

function ClipThumb({ url }: { url: string | null }) {
  return (
    <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-black ring-1 ring-border">
      {url ? (
        <video
          src={url}
          muted
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          <Clapperboard className="h-3.5 w-3.5" />
        </div>
      )}
    </div>
  );
}

function AudioSection({
  item,
  startSec,
  videoDuration,
  onChange,
}: {
  item: IncomingItem;
  startSec: number;
  /** Tổng độ dài video, null khi chưa đọc đủ độ dài mọi clip. */
  videoDuration: number | null;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const url = useAssetUrl(item.flowMediaId ? undefined : item.assetId, item.missing);
  const audioDuration = useMediaDuration(url, 'audio');
  const endSec = videoDuration != null ? startSec + videoDuration : null;
  const startTooLate = audioDuration != null && startSec >= audioDuration;
  const tooShort =
    !startTooLate && audioDuration != null && endSec != null && endSec > audioDuration;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-[11px]">
        <Volume2 className="h-3.5 w-3.5 shrink-0 text-pink-300" />
        <span className="min-w-0 flex-1 truncate" title={item.title}>
          {item.title}
        </span>
        <span className="shrink-0 tabular-nums text-muted-foreground">
          {audioDuration != null ? formatSeconds(audioDuration) : strings.mergeDurationUnknown}
        </span>
      </div>
      {url && <audio src={url} controls className={cn('h-8 w-full', NO_CANVAS)} />}
      <label className="flex items-center gap-2 text-[11px]">
        <span className="shrink-0 text-muted-foreground">{strings.mergeAudioStart}</span>
        <NumberInput
          value={startSec}
          min={0}
          max={audioDuration ?? undefined}
          step={0.5}
          onChange={(v) => onChange({ audioStartSec: v })}
        />
        {endSec != null && (
          <span className="min-w-0 truncate text-[10px] text-muted-foreground">
            {strings.mergeAudioRange(formatSeconds(startSec), formatSeconds(endSec))}
          </span>
        )}
      </label>
      <div
        className={cn(
          'text-[10px] leading-snug',
          startTooLate || tooShort ? 'text-amber-300' : 'text-muted-foreground',
        )}
      >
        {startTooLate
          ? strings.mergeAudioStartTooLate
          : tooShort
            ? strings.mergeAudioTooShort
            : strings.mergeAudioStartHint}
      </div>
    </div>
  );
}

/** Khung kết quả riêng của node ghép — không dùng chung với node generate. */
function MergeStage({
  url,
  aspectRatio,
  running,
  hasClips,
}: {
  url: string | null;
  aspectRatio: string;
  running: boolean;
  hasClips: boolean;
}) {
  return (
    <div className="rounded-lg bg-[radial-gradient(ellipse_at_top,hsl(217_33%_16%),hsl(222_47%_5%))] p-2 ring-1 ring-border/70">
      <div
        className={cn('relative mx-auto overflow-hidden rounded-md bg-black', NO_CANVAS)}
        style={{ height: 320, aspectRatio: cssAspect(aspectRatio) }}
      >
        {url ? (
          <NodeVideoPlayer src={url} />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-4 text-center">
            <div
              className={cn(
                'flex h-11 w-11 items-center justify-center rounded-full ring-1',
                hasClips
                  ? 'bg-primary/10 text-primary ring-primary/40'
                  : 'bg-muted/60 text-muted-foreground ring-border',
              )}
            >
              <Film className="h-5 w-5" />
            </div>
            <div className="text-[11px] font-medium text-foreground/90">
              {strings.mergeResultEmpty}
            </div>
            <div className="text-[10px] leading-snug text-muted-foreground">
              {hasClips ? strings.mergeResultEmptyHint : strings.mergeNotReady}
            </div>
          </div>
        )}
        {running && url && <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px]" />}
      </div>
    </div>
  );
}

/** Thanh tiến độ ghép — % và bước đang chạy do offscreen báo về. */
function MergeProgress({ progress, message }: { progress: number; message?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(progress)));
  return (
    <div className="mt-2 space-y-1">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="min-w-0 truncate">{message || strings.mergeRunning}</span>
        <span className="ml-2 shrink-0 tabular-nums text-primary">{pct}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-gradient-to-r from-lime-400 to-emerald-400 transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function LogoEditor({
  item,
  aspectRatio,
  xPercent,
  yPercent,
  widthPercent,
  opacity,
  onChange,
}: {
  item: IncomingItem;
  aspectRatio: string;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  opacity: number;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const localUrl = useAssetUrl(item.flowMediaId ? undefined : item.assetId, item.missing);
  const url = item.flowMediaId ? (item.flowPreviewUrl ?? null) : localUrl;
  const stageRef = useRef<HTMLDivElement>(null);
  const [natural, setNatural] = useState({ width: 1, height: 1 });
  const [stage, setStage] = useState({ width: 0, height: 0 });

  const box = logoRect(stage.width ? stage : { width: 1, height: 1 }, natural, {
    xPercent,
    yPercent,
    widthPercent,
  });

  const startDrag = useCallback(
    (e: React.PointerEvent, mode: 'move' | 'resize') => {
      e.preventDefault();
      e.stopPropagation();
      const rect = stageRef.current?.getBoundingClientRect();
      if (!rect) return;
      const origin = { x: e.clientX, y: e.clientY };
      const from = { xPercent, yPercent, widthPercent };
      // Giới hạn kéo theo đúng kích thước logo đang hiển thị, để phần trăm lưu
      // lại không chạy quá mép trong khi ảnh đã dừng.
      const maxX = 100 - (box.width / rect.width) * 100;
      const maxY = 100 - (box.height / rect.height) * 100;
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);

      const onMove = (ev: PointerEvent) => {
        const dx = ((ev.clientX - origin.x) / rect.width) * 100;
        const dy = ((ev.clientY - origin.y) / rect.height) * 100;
        if (mode === 'move') {
          onChange({
            logoXPercent: round1(clamp(from.xPercent + dx, 0, Math.max(0, maxX))),
            logoYPercent: round1(clamp(from.yPercent + dy, 0, Math.max(0, maxY))),
          });
        } else {
          onChange({ logoWidthPercent: round1(clamp(from.widthPercent + dx, 2, 100)) });
        }
      };
      const onUp = () => {
        target.releasePointerCapture(e.pointerId);
        target.removeEventListener('pointermove', onMove);
        target.removeEventListener('pointerup', onUp);
      };
      target.addEventListener('pointermove', onMove);
      target.addEventListener('pointerup', onUp);
    },
    [xPercent, yPercent, widthPercent, box.width, box.height, onChange],
  );

  return (
    <div className="space-y-1.5">
      <div
        ref={(el) => {
          stageRef.current = el;
          if (el && el.clientWidth !== stage.width) {
            setStage({ width: el.clientWidth, height: el.clientHeight });
          }
        }}
        className={cn(
          'relative mx-auto overflow-hidden rounded-md bg-[linear-gradient(135deg,hsl(217_33%_12%),hsl(222_47%_6%))] ring-1 ring-border',
          NO_CANVAS,
        )}
        style={{ height: LOGO_STAGE_HEIGHT, aspectRatio: cssAspect(aspectRatio) }}
      >
        <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-25">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="border border-white/15" />
          ))}
        </div>
        {url && (
          <img
            src={url}
            alt=""
            draggable={false}
            onPointerDown={(e) => startDrag(e, 'move')}
            onLoad={(e) =>
              setNatural({
                width: e.currentTarget.naturalWidth || 1,
                height: e.currentTarget.naturalHeight || 1,
              })
            }
            className="absolute cursor-move select-none outline outline-1 outline-primary/70"
            style={{
              left: box.x,
              top: box.y,
              width: box.width,
              height: box.height,
              opacity: clamp(opacity, 0, 100) / 100,
            }}
          />
        )}
        {url && (
          <div
            role="presentation"
            onPointerDown={(e) => startDrag(e, 'resize')}
            className="absolute h-3 w-3 cursor-nwse-resize rounded-sm bg-primary ring-1 ring-background"
            style={{ left: box.x + box.width - 6, top: box.y + box.height - 6 }}
          />
        )}
      </div>
      <div className="text-center text-[10px] text-muted-foreground">
        {strings.mergeLogoDragHint}
      </div>
      <div className="flex items-center gap-3">
        <label className="flex flex-1 items-center gap-1.5 text-[11px]">
          <span className="shrink-0 text-muted-foreground">{strings.mergeLogoSize}</span>
          <input
            type="range"
            min={2}
            max={100}
            step={1}
            value={widthPercent}
            className={cn('min-w-0 flex-1', NO_CANVAS)}
            onChange={(e) => onChange({ logoWidthPercent: Number(e.target.value) })}
          />
          <span className="w-9 shrink-0 text-right tabular-nums">{Math.round(widthPercent)}%</span>
        </label>
        <label className="flex flex-1 items-center gap-1.5 text-[11px]">
          <span className="shrink-0 text-muted-foreground">{strings.mergeLogoOpacity}</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={opacity}
            className={cn('min-w-0 flex-1', NO_CANVAS)}
            onChange={(e) => onChange({ logoOpacity: Number(e.target.value) })}
          />
          <span className="w-9 shrink-0 text-right tabular-nums">{Math.round(opacity)}%</span>
        </label>
      </div>
    </div>
  );
}

function Section({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-border/60 bg-background/40 p-2">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </span>
        {badge && (
          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded border border-dashed border-border py-2 text-center text-[11px] text-muted-foreground">
      {children}
    </div>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      disabled={disabled}
      className={cn(
        'flex h-5 w-5 shrink-0 items-center justify-center rounded border border-border text-muted-foreground transition-colors',
        disabled ? 'opacity-30' : 'hover:bg-muted hover:text-foreground',
        NO_CANVAS,
      )}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {children}
    </button>
  );
}

function NumberInput({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="number"
      value={Number.isFinite(value) ? value : 0}
      min={min}
      max={max}
      step={step}
      className={cn(
        'w-20 rounded border border-border bg-background px-1.5 py-0.5 text-right text-[11px] tabular-nums',
        NO_CANVAS,
      )}
      onChange={(e) => {
        const next = Number(e.target.value);
        if (!Number.isFinite(next)) return;
        onChange(clamp(next, min ?? -Infinity, max ?? Infinity));
      }}
    />
  );
}

function formatSeconds(sec: number): string {
  if (!Number.isFinite(sec)) return strings.mergeDurationUnknown;
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const m = Math.floor(sec / 60);
  return `${m}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
}

function cssAspect(aspectRatio: string): string {
  const [w, h] = aspectRatio.split(':');
  return Number(w) > 0 && Number(h) > 0 ? `${w} / ${h}` : '9 / 16';
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
