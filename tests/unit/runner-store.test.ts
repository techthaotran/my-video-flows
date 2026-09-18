import { beforeEach, describe, expect, it } from 'vitest';
import { useRunnerStore } from '@/features/runner/store';
import type { NodeRun } from '@/shared/schema';

beforeEach(() => {
  useRunnerStore.getState().reset();
});

function nr(partial: Partial<NodeRun> & { runId: string; nodeId: string }): NodeRun {
  return {
    id: `${partial.runId}-${partial.nodeId}`,
    status: 'success',
    outputIds: [],
    logs: [],
    ...partial,
  };
}

describe('useRunnerStore', () => {
  it('hydrate tu latestNodeRuns', () => {
    const latest = new Map<string, NodeRun>([
      ['v1', nr({ runId: 'r1', nodeId: 'v1', status: 'error', error: 'boom' })],
      ['v2', nr({ runId: 'r2', nodeId: 'v2', status: 'success' })],
    ]);
    useRunnerStore.getState().hydrate({
      workflowId: 'wf',
      latestNodeRuns: latest,
      runningRunIds: ['r3'],
    });
    const s = useRunnerStore.getState();
    expect(s.workflowId).toBe('wf');
    expect(s.nodeStatus.v1?.error).toBe('boom');
    expect(s.trackedRunIds).toEqual(['r3']);
  });

  it('applyEvent bo qua node la', () => {
    useRunnerStore.getState().hydrate({
      workflowId: 'wf',
      latestNodeRuns: new Map(),
      runningRunIds: [],
    });
    useRunnerStore.getState().applyEvent(
      { type: 'node.status', runId: 'r1', nodeId: 'unknown', status: 'running' },
      new Set(['v1']),
    );
    expect(useRunnerStore.getState().nodeStatus.unknown).toBeUndefined();
  });

  it('node.status cua node thuoc workflow them run chua theo doi', () => {
    useRunnerStore.getState().hydrate({
      workflowId: 'wf',
      latestNodeRuns: new Map(),
      runningRunIds: [],
    });
    useRunnerStore.getState().applyEvent(
      { type: 'node.status', runId: 'r-new', nodeId: 'v1', status: 'running', progress: 10 },
      new Set(['v1']),
    );
    const s = useRunnerStore.getState();
    expect(s.trackedRunIds).toContain('r-new');
    expect(s.nodeStatus.v1?.progress).toBe(10);
  });

  it('run.done theo workflowId go run va chuyen node dang chay sang cancelled', () => {
    useRunnerStore.setState({
      workflowId: 'wf',
      trackedRunIds: ['r1'],
      nodeStatus: {
        v1: { runId: 'r1', status: 'running', progress: 40 },
        v2: { runId: 'r1', status: 'success' },
      },
    });
    useRunnerStore.getState().applyEvent(
      { type: 'run.done', runId: 'r1', workflowId: 'wf', status: 'cancelled' },
      new Set(['v1', 'v2']),
    );
    const s = useRunnerStore.getState();
    expect(s.trackedRunIds).toEqual([]);
    expect(s.nodeStatus.v1?.status).toBe('cancelled');
    expect(s.nodeStatus.v2?.status).toBe('success');
  });
});
