import { ArrowDown, ArrowUp, Clapperboard, Image as ImageIcon, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NodeVideoPlayer } from '@/features/editor/nodes/MediaPreview';
import { useOutputUrl } from '@/features/editor/nodes/useMediaUrl';
import { EditableText } from '@/features/runner/EditableText';
import type { RunnerGenerateItem } from '@/features/runner/selectors';
import type { RunnerNodeStatus } from '@/features/runner/store';
import {
  ASPECT_RATIOS,
  IMAGE_MODELS,
  VIDEO_DURATIONS,
  VIDEO_MODELS,
} from '@/shared/schema';
import { strings } from '@/shared/strings';
import { cn } from '@/shared/utils';

const PROMPT_PRESETS = [
  'custom',
  'enhance',
  'analyzeImage',
  'script',
  'summarize',
  'translate',
  'brainstorm',
] as const;

interface GenerateItemListProps {
  items: RunnerGenerateItem[];
  nodeStatus: Record<string, RunnerNodeStatus>;
  canEdit: boolean;
  canAct: boolean;
  onUpdateField: (nodeId: string, patch: Record<string, unknown>) => void;
  onMove: (nodeId: string, dir: -1 | 1) => void;
  onRegenerate: (nodeId: string) => void;
}

export function GenerateItemList({
  items,
  nodeStatus,
  canEdit,
  canAct,
  onUpdateField,
  onMove,
  onRegenerate,
}: GenerateItemListProps) {
  if (!items.length) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
          <Clapperboard className="h-4 w-4" />
        </div>
        <p className="text-sm text-muted-foreground">{strings.runnerEmptyGenerates}</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3 p-3">
      {items.map((item, index) => (
        <GenerateItemCard
          key={item.nodeId}
          index={index}
          item={item}
          status={nodeStatus[item.nodeId]}
          canEdit={canEdit}
          canAct={canAct}
          onUpdateField={onUpdateField}
          onMove={onMove}
          onRegenerate={onRegenerate}
        />
      ))}
    </ul>
  );
}

function statusLabel(status?: RunnerNodeStatus): string {
  if (!status) return '';
  switch (status.status) {
    case 'queued':
      return strings.statusQueued;
    case 'running':
      return strings.statusRunning;
    case 'success':
      return strings.statusSuccess;
    case 'error':
      return strings.statusError;
    case 'cancelled':
      return strings.statusCancelled;
    case 'skipped':
      return strings.statusSkipped;
    default:
      return status.status;
  }
}

function StatusBadge({ status }: { status?: RunnerNodeStatus }) {
  if (!status) return null;
  const progress =
    status.progress != null && status.status === 'running'
      ? ` ${Math.round(status.progress)}%`
      : '';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium',
        status.status === 'error' && 'bg-destructive/20 text-destructive',
        status.status === 'running' && 'bg-sky-500/20 text-sky-100',
        status.status === 'success' && 'bg-emerald-500/20 text-emerald-100',
        status.status === 'queued' && 'bg-muted text-muted-foreground',
        status.status === 'cancelled' && 'bg-muted text-muted-foreground',
        status.status === 'skipped' && 'bg-muted text-muted-foreground',
      )}
    >
      {statusLabel(status)}
      {progress}
    </span>
  );
}

function GenerateItemCard({
  index,
  item,
  status,
  canEdit,
  canAct,
  onUpdateField,
  onMove,
  onRegenerate,
}: {
  index: number;
  item: RunnerGenerateItem;
  status?: RunnerNodeStatus;
  canEdit: boolean;
  canAct: boolean;
  onUpdateField: GenerateItemListProps['onUpdateField'];
  onMove: GenerateItemListProps['onMove'];
  onRegenerate: GenerateItemListProps['onRegenerate'];
}) {
  const previewUrl = useOutputUrl(item.previewOutputId);
  const models = item.type === 'generateVideo' ? VIDEO_MODELS : IMAGE_MODELS;
  const running = status?.status === 'running';
  const errored = status?.status === 'error';

  return (
    <li
      className={cn(
        'overflow-hidden rounded-xl border bg-card/65 shadow-sm shadow-black/10',
        errored ? 'border-destructive/40' : running ? 'border-sky-500/35' : 'border-border/80',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-md bg-primary/15 px-1.5 text-xs font-semibold tabular-nums text-primary">
            {String(index + 1).padStart(2, '0')}
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">
              {item.type === 'generateVideo' ? strings.nodeGenerateVideo : strings.nodeGenerateImage}
            </div>
            <div className="truncate font-mono text-[10px] text-muted-foreground/80">
              {item.slug ?? item.nodeId}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={status} />
          {item.inMerge ? (
            <div className="flex items-center rounded-md border border-border/70 bg-background/40 p-0.5">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                disabled={!canEdit}
                title={strings.runnerMoveUp}
                onClick={() => onMove(item.nodeId, -1)}
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                disabled={!canEdit}
                title={strings.runnerMoveDown}
                onClick={() => onMove(item.nodeId, 1)}
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1.5"
            disabled={!canAct || running}
            onClick={() => onRegenerate(item.nodeId)}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', running && 'animate-spin')} />
            {strings.runnerRegenerate}
          </Button>
        </div>
      </div>

      {running && status?.progress != null ? (
        <div className="h-1.5 w-full bg-muted">
          <div
            className="h-full bg-gradient-to-r from-lime-400 to-emerald-400 transition-[width] duration-300"
            style={{ width: `${Math.max(2, Math.min(100, status.progress))}%` }}
          />
        </div>
      ) : null}

      <div className="grid gap-3 p-3 lg:grid-cols-[minmax(11rem,15rem)_minmax(0,1fr)]">
        <div
          className={cn(
            'relative flex min-h-[11rem] items-center justify-center overflow-hidden rounded-lg border border-border/70 bg-background/50',
            running && 'media-shimmer',
          )}
        >
          {previewUrl && item.type === 'generateVideo' ? (
            <NodeVideoPlayer src={previewUrl} />
          ) : previewUrl ? (
            <img src={previewUrl} alt="" className="h-full w-full object-contain" />
          ) : (
            <div className="flex flex-col items-center gap-1.5 px-3 text-center text-muted-foreground">
              {item.type === 'generateVideo' ? (
                <Clapperboard className="h-5 w-5 opacity-50" />
              ) : (
                <ImageIcon className="h-5 w-5 opacity-50" />
              )}
              <span className="text-xs">{strings.mergeClipNoPreview}</span>
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-3">
          {status?.error || (status?.status === 'error' && status.message) ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
              {status.error ?? status.message}
            </p>
          ) : null}

          {item.promptNodes.map((p) => (
            <div
              key={p.nodeId}
              className="space-y-2 rounded-lg border border-border/60 bg-background/35 p-2.5"
            >
              <div className="font-mono text-[10px] text-muted-foreground">{p.slug ?? p.nodeId}</div>
              <label className="block space-y-1 text-xs">
                <span className="text-muted-foreground">{strings.runnerPresetLabel}</span>
                <select
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm disabled:opacity-60"
                  value={p.preset}
                  disabled={!canEdit}
                  onChange={(e) => onUpdateField(p.nodeId, { preset: e.target.value })}
                >
                  {PROMPT_PRESETS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1 text-xs">
                <span className="text-muted-foreground">{strings.runnerInstructionLabel}</span>
                <EditableText
                  multiline
                  rows={3}
                  value={p.instruction}
                  disabled={!canEdit}
                  onCommit={(instruction) => onUpdateField(p.nodeId, { instruction })}
                />
              </label>
              {p.formattedOutput ? (
                <label className="block space-y-1 text-xs">
                  <span className="text-muted-foreground">{strings.runnerGeminiOutput}</span>
                  <textarea
                    readOnly
                    rows={3}
                    className="w-full rounded-md border border-input bg-muted/40 px-2 py-1.5 text-sm text-muted-foreground"
                    value={p.formattedOutput}
                  />
                </label>
              ) : null}
            </div>
          ))}

          <label className="block space-y-1 text-xs">
            <span className="text-muted-foreground">{strings.runnerPromptLabel}</span>
            <EditableText
              multiline
              rows={4}
              value={item.prompt}
              disabled={!canEdit}
              onCommit={(prompt) => onUpdateField(item.nodeId, { prompt })}
            />
          </label>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <FieldSelect
              label={strings.model}
              value={item.model}
              disabled={!canEdit}
              options={models.map((m) => ({ value: m, label: m }))}
              onChange={(model) => onUpdateField(item.nodeId, { model })}
            />
            <FieldSelect
              label={strings.aspectRatio}
              value={item.aspectRatio}
              disabled={!canEdit}
              options={ASPECT_RATIOS.map((r) => ({ value: r, label: r }))}
              onChange={(aspectRatio) => onUpdateField(item.nodeId, { aspectRatio })}
            />
            {item.type === 'generateVideo' ? (
              <FieldSelect
                label={strings.durationSec}
                value={String(item.durationSec ?? 8)}
                disabled={!canEdit}
                options={VIDEO_DURATIONS.map((d) => ({ value: String(d), label: `${d}s` }))}
                onChange={(v) => onUpdateField(item.nodeId, { durationSec: Number(v) })}
              />
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}

function FieldSelect({
  label,
  value,
  disabled,
  options,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <select
        className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm disabled:opacity-60"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
