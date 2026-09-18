import { Lock, Play, Square, Workflow } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { strings } from '@/shared/strings';
import { cn } from '@/shared/utils';

interface RunnerToolbarProps {
  name: string;
  locked: boolean;
  running: boolean;
  canAct: boolean;
  onRun: () => void;
  onStop: () => void;
  onOpenEditor: () => void;
}

export function RunnerToolbar({
  name,
  locked,
  running,
  canAct,
  onRun,
  onStop,
  onOpenEditor,
}: RunnerToolbarProps) {
  return (
    <header className="relative flex h-14 shrink-0 items-center gap-3 border-b border-border/80 bg-card/90 px-4 backdrop-blur-sm">
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 items-center rounded-md bg-primary/15 px-2 text-xs font-semibold tracking-wide text-primary">
            {strings.runnerTitle}
          </span>
          <h1 className="truncate text-sm font-semibold text-foreground">{name}</h1>
          {locked ? (
            <span
              className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[11px] text-amber-200"
              title={strings.runnerLocked}
            >
              <Lock className="h-3 w-3" />
              {strings.lock}
            </span>
          ) : null}
          {running ? (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-sky-500/15 px-2 py-0.5 text-[11px] text-sky-200">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-300 opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-sky-300" />
              </span>
              {strings.runnerRunningHint}
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={onOpenEditor}
          disabled={!canAct}
        >
          <Workflow className="h-3.5 w-3.5" />
          {strings.runnerOpenEditor}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={cn(
            'gap-1.5',
            running
              ? 'border-destructive/40 text-destructive hover:bg-destructive/10'
              : 'opacity-50',
          )}
          disabled={!running || !canAct}
          onClick={onStop}
        >
          <Square className="h-3.5 w-3.5" />
          {strings.runnerStop}
        </Button>
        <Button
          type="button"
          size="sm"
          className={cn('min-w-[8.5rem] gap-1.5 shadow-sm shadow-primary/20', running && 'opacity-90')}
          disabled={!canAct || running}
          onClick={onRun}
        >
          <Play className="h-3.5 w-3.5" />
          {strings.runnerRunAll}
        </Button>
      </div>
    </header>
  );
}
