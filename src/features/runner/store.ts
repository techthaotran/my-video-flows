import { create } from 'zustand';
import type { NodeRun, NodeRunStatus } from '@/shared/schema';
import type { SwToUiEvent } from '@/shared/messaging';

/** Trạng thái chạy gần nhất của một node. Runtime-only, không persist. */
export interface RunnerNodeStatus {
  runId: string;
  status: NodeRunStatus;
  progress?: number;
  message?: string;
  error?: string;
  errorCode?: string;
}

export interface RunnerHydrateInput {
  workflowId: string;
  latestNodeRuns: Map<string, NodeRun>;
  runningRunIds: string[];
}

export interface RunnerState {
  workflowId: string | null;
  nodeStatus: Record<string, RunnerNodeStatus>;
  trackedRunIds: string[];

  hydrate: (input: RunnerHydrateInput) => void;
  applyEvent: (ev: SwToUiEvent, nodeIds: ReadonlySet<string>) => void;
  trackRun: (runId: string) => void;
  reset: () => void;
}

function fromNodeRun(nr: NodeRun): RunnerNodeStatus {
  return {
    runId: nr.runId,
    status: nr.status,
    progress: nr.progress,
    message: nr.message,
    error: nr.error,
    errorCode: nr.errorCode,
  };
}

export const useRunnerStore = create<RunnerState>((set, get) => ({
  workflowId: null,
  nodeStatus: {},
  trackedRunIds: [],

  hydrate(input) {
    const nodeStatus: Record<string, RunnerNodeStatus> = {};
    for (const [nodeId, nr] of input.latestNodeRuns) {
      nodeStatus[nodeId] = fromNodeRun(nr);
    }
    set({
      workflowId: input.workflowId,
      nodeStatus,
      trackedRunIds: [...input.runningRunIds],
    });
  },

  trackRun(runId) {
    const { trackedRunIds } = get();
    if (trackedRunIds.includes(runId)) return;
    set({ trackedRunIds: [...trackedRunIds, runId] });
  },

  reset() {
    set({ workflowId: null, nodeStatus: {}, trackedRunIds: [] });
  },

  applyEvent(ev, nodeIds) {
    if (ev.type === 'node.status' || ev.type === 'node.progress') {
      if (!nodeIds.has(ev.nodeId)) return;
      const { trackedRunIds, nodeStatus, workflowId } = get();
      const nextTracked =
        workflowId && !trackedRunIds.includes(ev.runId)
          ? [...trackedRunIds, ev.runId]
          : trackedRunIds;

      const prev = nodeStatus[ev.nodeId];
      const status: NodeRunStatus =
        ev.type === 'node.progress' ? 'running' : ev.status;
      const message = ev.message;
      const error =
        status === 'error' ? (message ?? prev?.error) : status === 'success' ? undefined : prev?.error;

      set({
        trackedRunIds: nextTracked,
        nodeStatus: {
          ...nodeStatus,
          [ev.nodeId]: {
            runId: ev.runId,
            status,
            progress: ev.progress ?? (ev.type === 'node.progress' ? ev.progress : prev?.progress),
            message,
            error,
            errorCode: prev?.errorCode,
          },
        },
      });
      return;
    }

    if (ev.type === 'run.done') {
      const { trackedRunIds, nodeStatus, workflowId } = get();
      const tracked = trackedRunIds.includes(ev.runId);
      const sameWorkflow = ev.workflowId != null && ev.workflowId === workflowId;
      if (!tracked && !sameWorkflow) return;

      const nextTracked = trackedRunIds.filter((id) => id !== ev.runId);
      const nextStatus = { ...nodeStatus };
      for (const [nodeId, st] of Object.entries(nextStatus)) {
        if (st.runId !== ev.runId) continue;
        if (st.status !== 'queued' && st.status !== 'running') continue;
        nextStatus[nodeId] = {
          ...st,
          status: ev.status === 'error' ? 'error' : 'cancelled',
          error: ev.status === 'error' ? ev.error : st.error,
          message: ev.error ?? st.message,
        };
      }
      set({ trackedRunIds: nextTracked, nodeStatus: nextStatus });
    }
  },
}));
