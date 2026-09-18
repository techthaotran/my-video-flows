import { assetRepo } from '@/storage/repos/assetRepo';
import { runRepo } from '@/storage/repos/runRepo';
import { workflowRepo } from '@/storage/repos/workflowRepo';
import type { FlowAssetPickResult } from '@/features/editor/FlowAssetPicker';
import { moveInOrder } from '@/media/layout';
import { localAssetPatch, mediaKindOf } from '@/shared/media';
import { sendToSw } from '@/shared/messaging';
import { strings } from '@/shared/strings';
import type { Workflow } from '@/shared/schema';
import {
  selectCanEdit,
  type RunnerAssetSlot,
  type RunnerMergeInfo,
} from '@/features/runner/selectors';
import { useRunnerStore } from '@/features/runner/store';

type UserErrorHandler = (message: string) => void;

let reportError: UserErrorHandler = (message) => {
  console.warn('[runner]', message);
};

/** Gắn handler hiện thông báo lỗi cho UI (toast / banner). */
export function setRunnerErrorHandler(handler: UserErrorHandler) {
  reportError = handler;
}

async function withUserError<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch (e) {
    reportError(e instanceof Error ? e.message : String(e));
    return undefined;
  }
}

export async function loadRunnerState(workflowId: string): Promise<void> {
  const [latest, running] = await Promise.all([
    runRepo.latestNodeRuns(workflowId),
    runRepo.listRunning(),
  ]);
  const runningRunIds = running.filter((r) => r.workflowId === workflowId).map((r) => r.id);
  useRunnerStore.getState().hydrate({ workflowId, latestNodeRuns: latest, runningRunIds });
}

export async function updateNodeField(
  workflowId: string,
  nodeId: string,
  patch: Record<string, unknown>,
  wf: Workflow,
): Promise<void> {
  if (!selectCanEdit(wf)) return;
  await withUserError(() => workflowRepo.patchNodeData(workflowId, nodeId, patch));
}

export async function pickLocalAsset(
  workflowId: string,
  slot: RunnerAssetSlot,
  file: File,
  wf: Workflow,
): Promise<void> {
  if (!selectCanEdit(wf)) return;
  await withUserError(async () => {
    const kind = mediaKindOf(file);
    if (kind !== slot.kind) {
      throw new Error(strings.runnerWrongMediaKind(slot.kind));
    }
    const asset = await assetRepo.put(file, file.name, workflowId);
    await workflowRepo.patchNodeData(
      workflowId,
      slot.nodeId,
      localAssetPatch(file, asset.id, kind),
    );
  });
}

export async function pickFlowAsset(
  workflowId: string,
  slot: RunnerAssetSlot,
  item: FlowAssetPickResult,
  wf: Workflow,
): Promise<void> {
  if (!selectCanEdit(wf)) return;
  await withUserError(async () => {
    if (slot.kind === 'audio') {
      throw new Error(strings.runnerFlowAudioUnsupported);
    }
    if (item.kind !== slot.kind) {
      throw new Error(strings.runnerWrongMediaKind(slot.kind));
    }
    await workflowRepo.patchNodeData(workflowId, slot.nodeId, {
      source: 'flow',
      flowMediaId: item.mediaId,
      flowPreviewUrl: item.previewUrl,
      originalName: item.originalName,
      kind: item.kind,
      missing: false,
      assetId: undefined,
      mime: undefined,
    });
  });
}

export async function moveClip(
  workflowId: string,
  merge: RunnerMergeInfo,
  nodeId: string,
  dir: -1 | 1,
  wf: Workflow,
): Promise<void> {
  if (!selectCanEdit(wf)) return;
  await withUserError(async () => {
    const index = merge.clipNodeIds.indexOf(nodeId);
    if (index < 0) return;
    const nextOrder = moveInOrder(merge.clipNodeIds, index, dir);
    if (nextOrder === merge.clipNodeIds || nextOrder.every((id, i) => id === merge.clipNodeIds[i])) {
      return;
    }
    await workflowRepo.patchNodeData(workflowId, merge.nodeId, { order: nextOrder });
  });
}

export async function runAll(workflowId: string): Promise<void> {
  await withUserError(async () => {
    const res = await sendToSw<{ runId: string }>({
      type: 'workflow.run',
      workflowId,
      mode: 'full',
    });
    if (!res.ok) throw new Error(res.error);
    useRunnerStore.getState().trackRun(res.data.runId);
  });
}

export async function stopAll(workflowId: string): Promise<void> {
  await withUserError(async () => {
    const res = await sendToSw({ type: 'workflow.cancel', workflowId });
    if (!res.ok) throw new Error(res.error);
  });
}

export async function regenerate(workflowId: string, nodeId: string): Promise<void> {
  await withUserError(async () => {
    const res = await sendToSw<{ runId: string }>({
      type: 'workflow.regenerate',
      workflowId,
      nodeId,
    });
    if (!res.ok) throw new Error(res.error);
    useRunnerStore.getState().trackRun(res.data.runId);
  });
}

/** Chỉ chạy node mergeVideo (mode `only`), dùng lại clip đã có. */
export async function mergeNow(workflowId: string, mergeNodeId: string): Promise<void> {
  await withUserError(async () => {
    const res = await sendToSw<{ runId: string }>({
      type: 'workflow.run',
      workflowId,
      mode: 'only',
      fromNodeId: mergeNodeId,
    });
    if (!res.ok) throw new Error(res.error);
    useRunnerStore.getState().trackRun(res.data.runId);
  });
}

export async function openEditor(workflowId: string): Promise<void> {
  await withUserError(async () => {
    const res = await sendToSw({ type: 'editor.open', workflowId });
    if (!res.ok) throw new Error(res.error);
  });
}
