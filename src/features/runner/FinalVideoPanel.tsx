import type { ReactNode } from 'react';
import { Clapperboard, Film, Hourglass, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExportVideoButton, NodeVideoPlayer } from '@/features/editor/nodes/MediaPreview';
import { useOutputUrl } from '@/features/editor/nodes/useMediaUrl';
import type { RunnerMergeInfo } from '@/features/runner/selectors';
import type { RunnerNodeStatus } from '@/features/runner/store';
import { strings } from '@/shared/strings';
import { cn } from '@/shared/utils';

interface FinalVideoPanelProps {
  merge: RunnerMergeInfo | null;
  ready: boolean;
  canAct: boolean;
  status?: RunnerNodeStatus;
  onMerge: () => void;
}

export function FinalVideoPanel({ merge, ready, canAct, status, onMerge }: FinalVideoPanelProps) {
  const previewUrl = useOutputUrl(merge?.previewOutputId);

  if (!merge) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
        <Film className="h-5 w-5 opacity-50" />
        <p className="text-sm">{strings.runnerNoMerge}</p>
      </div>
    );
  }

  const running = status?.status === 'running' || status?.status === 'queued';
  const errored = status?.status === 'error';
  const progress =
    status?.progress != null && Number.isFinite(status.progress)
      ? Math.max(0, Math.min(100, status.progress))
      : null;
  const showProgress = running;
  const hasClips = merge.clipNodeIds.length > 0;
  const canMerge = canAct && ready && !running;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3">
      <div className="rounded-xl bg-[radial-gradient(ellipse_at_top,hsl(217_33%_16%),hsl(222_47%_5%))] p-2 ring-1 ring-border/70">
        <div
          className={cn(
            'relative mx-auto w-full overflow-hidden rounded-lg bg-black',
            running && 'media-shimmer',
          )}
          style={{
            aspectRatio: cssAspect(merge.aspectRatio),
            maxHeight: 'min(52vh, 420px)',
          }}
        >
          {previewUrl ? (
            <>
              <NodeVideoPlayer src={previewUrl} />
              {running ? <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" /> : null}
            </>
          ) : (
            <EmptyStage
              ready={ready}
              hasClips={hasClips}
              errored={errored}
              errorText={status?.error ?? status?.message}
            />
          )}
        </div>
      </div>

      {/* Progress luôn chiếm chỗ rõ ràng khi đang ghép */}
      <div
        className={cn(
          'rounded-lg border px-3 py-2.5 transition-colors',
          showProgress
            ? 'border-sky-500/35 bg-sky-500/10'
            : 'border-border/60 bg-background/40',
        )}
      >
        <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
          <span className="min-w-0 truncate text-muted-foreground">
            {showProgress
              ? (status?.message ?? strings.mergeRunning)
              : ready
                ? strings.mergeResultTitle
                : strings.runnerWaitingClips}
          </span>
          <span
            className={cn(
              'shrink-0 font-mono text-[11px] tabular-nums',
              showProgress ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            {showProgress && progress != null ? `${Math.round(progress)}%` : showProgress ? '…' : '—'}
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              'h-full rounded-full transition-[width] duration-300',
              showProgress
                ? 'bg-gradient-to-r from-lime-400 to-emerald-400'
                : 'bg-muted-foreground/20',
            )}
            style={{
              width: showProgress
                ? `${Math.max(progress != null ? progress : 4, 4)}%`
                : '0%',
            }}
          />
        </div>
      </div>

      {errored && (status?.error || status?.message) ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
          {status.error ?? status.message}
        </p>
      ) : null}

      {!previewUrl && !running && !errored ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {!hasClips
            ? strings.mergeNotReady
            : !ready
              ? strings.mergeWaitingClips
              : strings.mergeResultEmptyHint}
        </p>
      ) : null}

      <div className="mt-auto flex flex-col gap-2">
        <Button
          type="button"
          size="sm"
          className="w-full gap-1.5 shadow-sm shadow-primary/15"
          disabled={!canMerge}
          title={!ready ? strings.runnerWaitingClips : undefined}
          onClick={onMerge}
        >
          {running ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Film className="h-3.5 w-3.5" />
          )}
          {running
            ? `${strings.mergeRunning}${progress != null ? ` ${Math.round(progress)}%` : ''}`
            : strings.mergeRun}
        </Button>
        <ExportVideoButton
          url={previewUrl}
          disabled={running || !previewUrl}
          className="w-full justify-center"
        />
      </div>
    </div>
  );
}

function EmptyStage({
  ready,
  hasClips,
  errored,
  errorText,
}: {
  ready: boolean;
  hasClips: boolean;
  errored: boolean;
  errorText?: string;
}) {
  let icon: ReactNode = <Clapperboard className="h-5 w-5" />;
  let title: string = strings.mergeResultEmpty;
  let hint: string = strings.mergeResultEmptyHint;

  if (!hasClips) {
    icon = <Film className="h-5 w-5" />;
    hint = strings.mergeNotReady;
  } else if (!ready) {
    icon = <Hourglass className="h-5 w-5" />;
    title = strings.runnerWaitingClips;
    hint = strings.mergeWaitingClips;
  } else if (errored && errorText) {
    title = strings.statusError;
    hint = errorText;
  }

  return (
    <div
      className={cn(
        'flex h-full w-full flex-col items-center justify-center gap-2 px-3 py-8 text-center',
        errored ? 'text-destructive' : 'text-muted-foreground',
      )}
    >
      <div
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-full ring-1',
          ready && hasClips && !errored
            ? 'bg-primary/10 text-primary ring-primary/40'
            : 'bg-muted/60 ring-border',
        )}
      >
        {icon}
      </div>
      <div className="text-[11px] font-medium text-foreground/90">{title}</div>
      <div className="text-[10px] leading-snug">{hint}</div>
    </div>
  );
}

function cssAspect(aspectRatio: string): string {
  const [w, h] = aspectRatio.split(':');
  if (!w || !h) return '9 / 16';
  return `${w} / ${h}`;
}
