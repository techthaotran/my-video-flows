import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  loadRunnerState,
  mergeNow,
  moveClip,
  openEditor,
  pickFlowAsset,
  pickLocalAsset,
  regenerate,
  runAll,
  setRunnerErrorHandler,
  stopAll,
  updateNodeField,
} from '@/features/runner/actions';
import { AssetSlotList } from '@/features/runner/AssetSlotList';
import { FinalVideoPanel } from '@/features/runner/FinalVideoPanel';
import { GenerateItemList } from '@/features/runner/GenerateItemList';
import { RunnerToolbar } from '@/features/runner/RunnerToolbar';
import {
  buildRunnerView,
  selectCanEdit,
  selectIsRunning,
  selectMergeReady,
} from '@/features/runner/selectors';
import { useRunnerStore } from '@/features/runner/store';
import { connectRunEvents } from '@/shared/messaging';
import { strings } from '@/shared/strings';
import { cn } from '@/shared/utils';
import { workflowRepo } from '@/storage/repos/workflowRepo';

function workflowIdFromUrl(): string | null {
  const id = new URLSearchParams(window.location.search).get('id');
  return id && id.length > 0 ? id : null;
}

export function RunnerApp() {
  const workflowId = useMemo(() => workflowIdFromUrl(), []);
  const [banner, setBanner] = useState<string | null>(null);
  const workflow = useLiveQuery(
    () => (workflowId ? workflowRepo.get(workflowId) : Promise.resolve(undefined)),
    [workflowId],
  );

  const nodeStatus = useRunnerStore((s) => s.nodeStatus);
  const trackedRunIds = useRunnerStore((s) => s.trackedRunIds);
  const applyEvent = useRunnerStore((s) => s.applyEvent);
  const reset = useRunnerStore((s) => s.reset);

  const nodeIdsRef = useRef<ReadonlySet<string>>(new Set());
  useEffect(() => {
    nodeIdsRef.current = new Set((workflow?.nodes ?? []).map((n) => n.id));
  }, [workflow]);

  useEffect(() => {
    setRunnerErrorHandler((message) => setBanner(message));
  }, []);

  useEffect(() => {
    if (!workflowId) return;
    void loadRunnerState(workflowId);

    const channel = connectRunEvents((ev) => {
      applyEvent(ev, nodeIdsRef.current);
      if (ev.type === 'log.snapshot') {
        void loadRunnerState(workflowId);
      }
    });

    return () => {
      channel.disconnect();
      reset();
    };
  }, [workflowId, applyEvent, reset]);

  useEffect(() => {
    if (!workflow) return;
    document.title = `${strings.runnerTitle} - ${workflow.name}`;
  }, [workflow]);

  const view = useMemo(() => (workflow ? buildRunnerView(workflow) : null), [workflow]);
  const canEdit = workflow ? selectCanEdit(workflow) : false;
  const canAct = !!workflow && !workflow.deletedAt;
  const running = selectIsRunning({ trackedRunIds });
  const merge = view && !('graphError' in view) ? view.merge : null;
  const mergeReady = workflow && merge ? selectMergeReady(workflow, merge) : false;

  if (!workflowId) {
    return <CenterMsg text={strings.runnerNotFound} />;
  }
  if (workflow === undefined) {
    return <CenterMsg text={strings.runnerLoading} />;
  }
  if (!workflow) {
    return <CenterMsg text={strings.runnerNotFound} />;
  }
  if (!view) {
    return <CenterMsg text={strings.runnerLoading} />;
  }
  if ('graphError' in view) {
    return (
      <div className="flex h-screen flex-col bg-background text-foreground">
        <RunnerToolbar
          name={workflow.name}
          locked={!!workflow.locked}
          running={false}
          canAct={false}
          onRun={() => undefined}
          onStop={() => undefined}
          onOpenEditor={() => void openEditor(workflowId)}
        />
        <CenterMsg text={view.graphError} />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <RunnerToolbar
        name={workflow.name}
        locked={!!workflow.locked}
        running={running}
        canAct={canAct}
        onRun={() => void runAll(workflowId)}
        onStop={() => void stopAll(workflowId)}
        onOpenEditor={() => void openEditor(workflowId)}
      />
      {(workflow.deletedAt || banner) && (
        <div className="shrink-0 border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {workflow.deletedAt ? strings.runnerDeleted : banner}
        </div>
      )}
      {!workflow.deletedAt && workflow.locked ? (
        <div className="shrink-0 border-b border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs text-amber-100">
          {strings.runnerLocked}
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-[17.5rem_minmax(0,1fr)_20rem]">
        {/* Left: upload assets */}
        <aside className="flex min-h-0 flex-col border-r border-border/80 bg-card/25">
          <SectionHeader
            title={strings.runnerAssetsColumn}
            meta={strings.runnerAssetCount(view.assetSlots.length)}
          />
          <div className="min-h-0 flex-1 overflow-y-auto">
            <AssetSlotList
              slots={view.assetSlots}
              canEdit={canEdit}
              onPickLocal={(slot, file) => void pickLocalAsset(workflowId, slot, file, workflow)}
              onPickFlow={(slot, item) => void pickFlowAsset(workflowId, slot, item, workflow)}
            />
          </div>
        </aside>

        {/* Center: generated scenes */}
        <main className="flex min-h-0 min-w-0 flex-col bg-[radial-gradient(ellipse_at_top,hsl(84_81%_44%/0.04),transparent_50%)]">
          <SectionHeader
            title={strings.runnerScenesColumn}
            meta={strings.runnerSceneCount(view.generateItems.length)}
          />
          <div className="min-h-0 flex-1 overflow-y-auto">
            <GenerateItemList
              items={view.generateItems}
              nodeStatus={nodeStatus}
              canEdit={canEdit}
              canAct={canAct}
              onUpdateField={(nodeId, patch) =>
                void updateNodeField(workflowId, nodeId, patch, workflow)
              }
              onMove={(nodeId, dir) => {
                if (!view.merge) return;
                void moveClip(workflowId, view.merge, nodeId, dir, workflow);
              }}
              onRegenerate={(nodeId) => void regenerate(workflowId, nodeId)}
            />
          </div>
        </main>

        {/* Right: final merge video */}
        <aside className="flex min-h-0 flex-col border-l border-border/80 bg-card/30">
          <SectionHeader
            title={strings.runnerFinalColumn}
            meta={view.merge ? (view.merge.slug ?? view.merge.nodeId) : '—'}
            monoMeta
          />
          <div className="min-h-0 flex-1 overflow-y-auto">
            <FinalVideoPanel
              merge={view.merge}
              ready={mergeReady}
              canAct={canAct}
              status={view.merge ? nodeStatus[view.merge.nodeId] : undefined}
              onMerge={() => {
                if (!view.merge) return;
                void mergeNow(workflowId, view.merge.nodeId);
              }}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  meta,
  monoMeta,
}: {
  title: string;
  meta: string;
  monoMeta?: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/70 px-3 py-2.5">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </h2>
      <span
        className={cn(
          'max-w-[9rem] truncate rounded-md bg-muted/70 px-1.5 py-0.5 text-[10px] text-muted-foreground',
          monoMeta ? 'font-mono' : 'tabular-nums',
        )}
        title={meta}
      >
        {meta}
      </span>
    </div>
  );
}

function CenterMsg({ text }: { text: string }) {
  return (
    <div className="flex h-screen items-center justify-center bg-background px-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
