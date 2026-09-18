import { useEffect, useRef, useState } from 'react';
import { FolderOpen, Image as ImageIcon, ImagePlus, Music2, Pause, Play, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FlowAssetPicker, type FlowAssetPickResult } from '@/features/editor/FlowAssetPicker';
import { useAssetUrl } from '@/features/editor/IncomingAssets';
import type { RunnerAssetSlot } from '@/features/runner/selectors';
import { strings } from '@/shared/strings';
import { cn } from '@/shared/utils';

const ACCEPT_BY_KIND = {
  image: 'image/*,.png,.jpg,.jpeg,.webp,.gif',
  video: 'video/*,.mp4,.mov,.webm,.mkv',
  audio: 'audio/*,.mp3,.m4a,.wav,.ogg,.flac',
} as const;

const KIND_LABEL = {
  image: strings.kindImage,
  video: strings.kindVideo,
  audio: strings.kindAudio,
} as const;

interface AssetSlotListProps {
  slots: RunnerAssetSlot[];
  canEdit: boolean;
  onPickLocal: (slot: RunnerAssetSlot, file: File) => void;
  onPickFlow: (slot: RunnerAssetSlot, item: FlowAssetPickResult) => void;
}

export function AssetSlotList({ slots, canEdit, onPickLocal, onPickFlow }: AssetSlotListProps) {
  if (!slots.length) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
          <ImageIcon className="h-4 w-4" />
        </div>
        <p className="text-sm text-muted-foreground">{strings.runnerEmptyAssets}</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2.5 p-3">
      {slots.map((slot) => (
        <AssetSlotCard
          key={slot.nodeId}
          slot={slot}
          canEdit={canEdit}
          onPickLocal={onPickLocal}
          onPickFlow={onPickFlow}
        />
      ))}
    </ul>
  );
}

function KindIcon({ kind }: { kind: RunnerAssetSlot['kind'] }) {
  if (kind === 'video') return <Video className="h-3.5 w-3.5" />;
  if (kind === 'audio') return <Music2 className="h-3.5 w-3.5" />;
  return <ImageIcon className="h-3.5 w-3.5" />;
}

function formatClock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Player audio riêng: thanh progress cao, dễ nhìn (không dùng chrome native bị cắt). */
function AudioPreview({ src, name }: { src: string; name?: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    setPlaying(false);
    setCurrent(0);
    setDuration(0);
  }, [src]);

  const pct = duration > 0 ? (current / duration) * 100 : 0;

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => setPlaying(false));
    else el.pause();
  };

  const seek = (value: number) => {
    const el = audioRef.current;
    if (!el || !Number.isFinite(el.duration)) return;
    el.currentTime = value;
    setCurrent(value);
  };

  return (
    <div className="flex w-full flex-col gap-2.5 px-2.5 py-3">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        className="hidden"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => setPlaying(false)}
      />
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm shadow-primary/25 transition hover:brightness-110"
          title={playing ? strings.runnerPause : strings.runnerPlay}
          onClick={toggle}
        >
          {playing ? (
            <Pause className="h-4 w-4 fill-current" />
          ) : (
            <Play className="ml-0.5 h-4 w-4 fill-current" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium text-foreground">
            {name || strings.kindAudio}
          </div>
          <div className="mt-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
            {formatClock(current)} / {formatClock(duration)}
          </div>
        </div>
      </div>
      <div className="relative h-4">
        <div className="absolute inset-x-0 top-1/2 h-2.5 -translate-y-1/2 rounded-full bg-muted" />
        <div
          className="absolute left-0 top-1/2 h-2.5 -translate-y-1/2 rounded-full bg-gradient-to-r from-lime-400 to-emerald-400"
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-lime-300 shadow"
          style={{ left: `${pct}%` }}
        />
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.05}
          value={current}
          disabled={!duration}
          onChange={(e) => seek(Number(e.target.value))}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-default"
          aria-label={strings.preview}
        />
      </div>
    </div>
  );
}

function AssetSlotCard({
  slot,
  canEdit,
  onPickLocal,
  onPickFlow,
}: {
  slot: RunnerAssetSlot;
  canEdit: boolean;
  onPickLocal: AssetSlotListProps['onPickLocal'];
  onPickFlow: AssetSlotListProps['onPickFlow'];
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [flowOpen, setFlowOpen] = useState(false);
  const localUrl = useAssetUrl(slot.assetId, slot.missing);
  const previewUrl = slot.source === 'flow' ? (slot.flowPreviewUrl ?? null) : localUrl;
  const hasAsset = Boolean(previewUrl) && !slot.missing;

  return (
    <li
      className={cn(
        'overflow-hidden rounded-xl border bg-card/70 shadow-sm shadow-black/10 transition-colors',
        slot.missing
          ? 'border-destructive/45'
          : hasAsset
            ? 'border-primary/25'
            : 'border-border/80',
      )}
    >
      <div className="flex items-start justify-between gap-2 px-3 pb-1 pt-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium leading-tight">{slot.label}</div>
          <div className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground/80">
            {slot.slug ?? slot.nodeId}
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-muted/80 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          <KindIcon kind={slot.kind} />
          {KIND_LABEL[slot.kind]}
        </span>
      </div>

      <div className="px-3 pt-2">
        <div
          className={cn(
            'relative overflow-hidden rounded-lg border bg-background/60',
            slot.kind === 'audio' ? 'min-h-[5.5rem]' : 'flex h-32 items-center justify-center',
            hasAsset ? 'border-border/60' : 'border-dashed border-border',
            slot.missing && 'border-destructive/50',
          )}
        >
          {previewUrl && slot.kind === 'image' ? (
            <img src={previewUrl} alt="" className="h-full w-full object-cover" />
          ) : previewUrl && slot.kind === 'video' ? (
            <video src={previewUrl} className="h-full w-full object-cover" muted playsInline />
          ) : previewUrl && slot.kind === 'audio' ? (
            <AudioPreview src={previewUrl} name={slot.originalName} />
          ) : (
            <div className="flex h-32 flex-col items-center justify-center gap-1.5 px-3 text-center">
              <KindIcon kind={slot.kind} />
              <span className="text-xs text-muted-foreground">
                {slot.missing ? strings.runnerMissingFile : strings.dropOrPick}
              </span>
            </div>
          )}
          {hasAsset && slot.kind !== 'audio' ? (
            <span className="absolute left-2 top-2 rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-lime-200 backdrop-blur-sm">
              {strings.runnerHasAsset}
            </span>
          ) : null}
        </div>
        {slot.originalName && slot.kind !== 'audio' ? (
          <p className="mt-1.5 truncate text-[11px] text-muted-foreground" title={slot.originalName}>
            {slot.originalName}
          </p>
        ) : !hasAsset ? (
          <p className="mt-1.5 text-[11px] text-muted-foreground/70">{strings.runnerNoAsset}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-1.5 p-3 pt-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 flex-1 gap-1.5"
          disabled={!canEdit}
          onClick={() => fileRef.current?.click()}
        >
          <FolderOpen className="h-3.5 w-3.5" />
          {strings.pickFromLocal}
        </Button>
        {slot.kind !== 'audio' ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 flex-1 gap-1.5"
            disabled={!canEdit}
            onClick={() => setFlowOpen(true)}
          >
            <ImagePlus className="h-3.5 w-3.5" />
            {strings.pickFromFlow}
          </Button>
        ) : null}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT_BY_KIND[slot.kind]}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) onPickLocal(slot, file);
        }}
      />
      {slot.kind !== 'audio' ? (
        <FlowAssetPicker
          open={flowOpen}
          onOpenChange={setFlowOpen}
          kind={slot.kind}
          onPicked={(item) => onPickFlow(slot, item)}
        />
      ) : null}
    </li>
  );
}
