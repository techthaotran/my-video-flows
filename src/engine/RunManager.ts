import { workflowRepo } from '@/storage/repos/workflowRepo';
import { runRepo } from '@/storage/repos/runRepo';
import { assetRepo } from '@/storage/repos/assetRepo';
import { getSettings } from '@/storage/repos/settingsRepo';
import { topoSort, collectDownstream, collectUpstream } from '@/engine/scheduler';
import { buildSlugIndex } from '@/engine/resolver';
import { computeInputHash } from '@/engine/cache';
import { executors, hasGeneratePrompt } from '@/engine/executors';
import { extractLastFrame } from '@/providers/flow/rpc/frame';
import { composeVideoInOffscreen } from '@/media/composeClient';
import { NON_RETRYABLE, type NodeOutputValue } from '@/engine/types';
import type { ProviderRouter, EventBroadcaster } from '@/providers/TabPool';
import type { SwToUiEvent } from '@/shared/messaging';
import type { Workflow, WorkflowNode } from '@/shared/schema';
import { nanoid } from '@/shared/utils';
import { createLogger } from '@/shared/log';
import { strings } from '@/shared/strings';

const log = createLogger('run');

interface ActiveRun {
  runId: string;
  abort: AbortController;
  workflowId: string;
}

/** Loại media mà node này xuất ra — dùng khi output không tự khai `kind`. */
function previewKindOf(nodeType: WorkflowNode['type']): 'image' | 'video' {
  return nodeType === 'generateImage' ? 'image' : 'video';
}

/** Asset/text/custom-prompt chỉ lấy data — không hiện Running trên canvas. */
function shouldShowRunStatus(node: WorkflowNode): boolean {
  if (
    node.type === 'generateImage' ||
    node.type === 'generateVideo' ||
    node.type === 'mergeVideo' ||
    node.type === 'autoDownload'
  ) {
    return true;
  }
  if (node.type === 'prompt') {
    const preset = (node.data as { preset?: string }).preset ?? 'custom';
    return preset !== 'custom';
  }
  return false;
}

export class RunManager {
  private active = new Map<string, ActiveRun>();
  private globalQueue: Array<() => Promise<void>> = [];
  private globalRunning = 0;
  private cache = new Map<string, NodeOutputValue[]>(); // inputHash -> outputs

  constructor(
    private router: ProviderRouter,
    private broadcast: EventBroadcaster,
  ) {}

  getQueueCounts() {
    return { running: this.globalRunning, waiting: this.globalQueue.length };
  }

  private emitQueue() {
    const { running, waiting } = this.getQueueCounts();
    this.broadcast({ type: 'queue.update', running, waiting });
  }

  async runWorkflow(
    workflowId: string,
    opts?: { fromNodeId?: string; mode?: 'full' | 'node' | 'only' | 'from'; nodeId?: string },
  ): Promise<string> {
    const workflow = await workflowRepo.get(workflowId);
    if (!workflow) throw new Error('Workflow không tồn tại');

    const run = await runRepo.create({
      workflowId,
      mode: opts?.mode ?? 'full',
      fromNodeId: opts?.fromNodeId ?? opts?.nodeId,
    });

    const job = () => this.executeRun(run.id, workflow, opts);
    this.enqueue(job);
    return run.id;
  }

  async runAll(workspaceId: string): Promise<string[]> {
    const list = await workflowRepo.list(workspaceId);
    const enabled = list.filter((w) => w.enabled);
    const ids: string[] = [];
    for (const w of enabled) {
      ids.push(await this.runWorkflow(w.id, { mode: 'full' }));
    }
    return ids;
  }

  cancel(runId: string) {
    const a = this.active.get(runId);
    if (a) a.abort.abort();
  }

  cancelByWorkflow(workflowId: string) {
    for (const a of this.active.values()) {
      if (a.workflowId === workflowId) a.abort.abort();
    }
  }

  private enqueue(job: () => Promise<void>) {
    this.globalQueue.push(job);
    this.emitQueue();
    void this.pump();
  }

  private async pump() {
    const settings = await getSettings();
    const limit = settings.maxSpeed ? settings.defaultConcurrency : 1;
    while (this.globalRunning < limit && this.globalQueue.length) {
      const job = this.globalQueue.shift()!;
      this.globalRunning++;
      this.emitQueue();
      job()
        .catch(() => undefined)
        .finally(() => {
          this.globalRunning--;
          this.emitQueue();
          void this.pump();
        });
    }
  }

  /**
   * Gửi lại trạng thái của các node đang chạy cho một UI vừa nối (lại) port.
   *
   * Port `run-events` chết theo service worker; nối lại xong UI không biết gì
   * về run đang dở cho tới sự kiện kế tiếp. Sau khi service worker khởi động
   * lại thì `active` rỗng và `recover()` đã đánh dấu run cũ là lỗi, nên hàm này
   * chỉ phát tín hiệu cho trường hợp port chết mà service worker còn sống.
   */
  async replayActiveStatuses(send: (ev: SwToUiEvent) => void): Promise<void> {
    for (const { runId } of this.active.values()) {
      for (const nr of await runRepo.listNodeRuns(runId)) {
        if (nr.status !== 'running' && nr.status !== 'queued') continue;
        send({
          type: 'node.status',
          runId,
          nodeId: nr.nodeId,
          status: nr.status,
          progress: nr.progress,
          message: nr.message,
        });
      }
    }
  }

  private async executeRun(
    runId: string,
    workflow: Workflow,
    opts?: { fromNodeId?: string; mode?: 'full' | 'node' | 'only' | 'from'; nodeId?: string },
  ) {
    const abort = new AbortController();
    this.active.set(runId, { runId, abort, workflowId: workflow.id });
    await runRepo.update(runId, { status: 'running' });

    const outputsByNode = new Map<string, NodeOutputValue[]>();
    const slugIndex = buildSlugIndex(workflow);
    const runLog = log.child({ runId });
    const startedAt = Date.now();
    let failure: unknown;

    try {
      let nodeIds: Set<string> | undefined;
      // `only`: upstream still runs for prompt/assets, but upstream generators reuse their last result.
      const onlyNodeId =
        opts?.mode === 'only' ? (opts.nodeId ?? opts.fromNodeId) : undefined;
      if ((opts?.mode === 'node' || opts?.mode === 'only') && (opts.nodeId || opts.fromNodeId)) {
        // Include upstream so Generate Image/Video receives prompt/text/assets
        nodeIds = collectUpstream(workflow, opts.nodeId ?? opts.fromNodeId!);
      } else if ((opts?.mode === 'from' || opts?.fromNodeId) && (opts.fromNodeId || opts.nodeId)) {
        nodeIds = collectDownstream(workflow, opts.fromNodeId ?? opts.nodeId!);
      }

      const plan = topoSort(workflow, nodeIds);
      const concurrency = workflow.settings.concurrency ?? 1;
      const settings = await getSettings();
      const maxConcurrent = settings.maxSpeed ? Math.max(concurrency, settings.defaultConcurrency) : 1;
      runLog.info(`Bắt đầu "${workflow.name}" — ${plan.order.length} node`, {
        mode: opts?.mode ?? 'full',
        fromNodeId: opts?.fromNodeId ?? opts?.nodeId,
        order: plan.order,
        maxConcurrent,
      });

      const done = new Set<string>();
      const queue = [...plan.order];
      // stopOnError aborts the run on a node error; that is a failure, not a user cancel.
      const inFlight = new Set<Promise<void>>();

      const canRun = (id: string) => (plan.deps.get(id) ?? []).every((d) => done.has(d));

      while (queue.length || inFlight.size) {
        if (abort.signal.aborted) {
          throw failure ?? Object.assign(new Error('Đã huỷ'), { code: 'UNKNOWN' });
        }

        while (inFlight.size < maxConcurrent) {
          const idx = queue.findIndex(canRun);
          if (idx < 0) break;
          const nodeId = queue.splice(idx, 1)[0]!;
          const p = this.runNode(runId, workflow, nodeId, outputsByNode, slugIndex, abort.signal, onlyNodeId)
            .then(() => {
              done.add(nodeId);
            })
            .catch((err) => {
              done.add(nodeId);
              if (workflow.settings.stopOnError !== false) {
                // A node rejecting after the user cancelled is still a cancel.
                if (!abort.signal.aborted) failure ??= err;
                abort.abort();
                throw err;
              }
            })
            .finally(() => {
              inFlight.delete(p);
            });
          inFlight.add(p);
        }

        if (inFlight.size === 0 && queue.length && !queue.some(canRun)) {
          throw new Error('Không có node sẵn sàng — có thể phụ thuộc lỗi');
        }
        if (inFlight.size) {
          await Promise.race(inFlight);
        }
      }

      await runRepo.update(runId, { status: 'success', finishedAt: Date.now() });
      runLog.info(`Xong sau ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
      this.broadcast({ type: 'run.done', runId, status: 'success' });
      this.notify('Workflow xong', workflow.name, 'success');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const status = abort.signal.aborted && failure === undefined ? 'cancelled' : 'error';
      await runRepo.update(runId, { status, finishedAt: Date.now(), error: msg });
      if (status === 'cancelled') runLog.warn(`Đã huỷ: ${msg}`);
      else runLog.error(`Lỗi: ${msg}`, e);
      this.broadcast({ type: 'run.done', runId, status, error: msg });
      this.notify(status === 'cancelled' ? 'Đã huỷ' : 'Workflow lỗi', msg, 'error');
    } finally {
      this.active.delete(runId);
    }
  }

  private async runNode(
    runId: string,
    workflow: Workflow,
    nodeId: string,
    outputsByNode: Map<string, NodeOutputValue[]>,
    slugIndex: Map<string, string>,
    signal: AbortSignal,
    onlyNodeId?: string,
  ) {
    const node = workflow.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const nodeLog = createLogger(`node:${node.type}`, { runId, nodeId });

    const executor = executors[node.type];
    if (!executor) {
      await runRepo.setNodeStatus(runId, nodeId, 'skipped', { message: 'Không có executor' });
      return;
    }

    const inputs = gatherInputs(workflow, nodeId, outputsByNode);

    const inputHash = await computeInputHash(node.data, Object.fromEntries(
      Object.entries(inputs).map(([k, vs]) => [
        k,
        vs.map((v) => ({
          kind: v.kind,
          role: v.role,
          text: v.text,
          outputId: v.outputId,
          flowMediaId: v.flowMediaId,
          size: v.blob?.size,
        })),
      ]),
    ));

    const showStatus = shouldShowRunStatus(node);

    // `only` run: an upstream generator hands on its last result instead of generating again.
    // Otherwise a Generate Video without prompt that still feeds later nodes hands on its clip.
    const reuseForOnly = !!onlyNodeId && nodeId !== onlyNodeId && isGeneratorNode(node);
    const previous = reuseForOnly
      ? await previousGenerateOutput(node)
      : await previousClipToPassOn(workflow, node, inputs);
    if (reuseForOnly && !previous) {
      const msg = strings.generateOnlyMissingUpstream(node.label ?? node.slug ?? node.type);
      await runRepo.setNodeStatus(runId, nodeId, 'error', { error: msg });
      this.broadcast({ type: 'node.status', runId, nodeId, status: 'error', message: msg });
      throw Object.assign(new Error(msg), { code: 'UNKNOWN' });
    }
    if (previous) {
      const message = reuseForOnly ? strings.generateReusedForOnly : strings.generateReusedPreviousClip;
      outputsByNode.set(nodeId, [previous]);
      nodeLog.info(message, { outputId: previous.outputId });
      await runRepo.setNodeStatus(runId, nodeId, 'success', {
        progress: 100,
        message,
        inputHash,
        outputIds: [previous.outputId!],
      });
      this.broadcast({ type: 'node.status', runId, nodeId, status: 'success', progress: 100, message });
      return;
    }

    const cached = this.cache.get(inputHash);
    if (cached && (workflow.settings as { useCache?: boolean }).useCache !== false) {
      // only reuse for run-node mode typically — always allow cache hit
      outputsByNode.set(nodeId, cached);
      nodeLog.info('Dùng cache', { inputHash, outputs: cached.length });
      const cachedOutputId = cached.map((r) => r.outputId).find(Boolean);
      await runRepo.setNodeStatus(runId, nodeId, 'success', {
        message: 'Dùng cache',
        inputHash,
        outputIds: cachedOutputId ? [cachedOutputId] : [],
      });
      if (
        cachedOutputId &&
        (node.type === 'generateImage' ||
          node.type === 'generateVideo' ||
          node.type === 'mergeVideo')
      ) {
        this.broadcast({
          type: 'node.output',
          runId,
          nodeId,
          outputId: cachedOutputId,
          kind: cached[0]?.kind ?? previewKindOf(node.type),
        });
      }
      if (showStatus) {
        this.broadcast({ type: 'node.status', runId, nodeId, status: 'success', message: 'Cache' });
      }
      return;
    }

    // Generate Image/Video calls a real (quota/credit-consuming) API — a failed
    // attempt already spent that cost. Merge Video burns minutes of CPU on a
    // deterministic job, so a blind retry only reproduces the same failure.
    // Neither resubmits unless the node opts in via its own `retry`.
    const noBlindRetry =
      node.type === 'generateImage' ||
      node.type === 'generateVideo' ||
      node.type === 'mergeVideo';
    const explicitRetry = (node.data as { retry?: number }).retry;
    const retries = explicitRetry ?? (noBlindRetry ? 0 : (workflow.settings.retry ?? 2));
    let lastErr: unknown;
    nodeLog.debug('Inputs', Object.fromEntries(
      Object.entries(inputs).map(([k, vs]) => [
        k,
        vs.map((v) => ({ kind: v.kind, role: v.role, name: v.name, flowMediaId: v.flowMediaId, fromFlow: v.fromFlow, text: v.text, blob: v.blob })),
      ]),
    ));

    for (let attempt = 0; attempt <= retries; attempt++) {
      if (signal.aborted) throw new Error('Đã huỷ');
      await runRepo.setNodeStatus(runId, nodeId, 'running', {
        message: attempt ? `Thử lại ${attempt}` : undefined,
        inputHash,
        logs: [{ ts: Date.now(), message: `Bắt đầu (attempt ${attempt + 1})` }],
      });
      if (showStatus) {
        this.broadcast({ type: 'node.status', runId, nodeId, status: 'running' });
      }
      const attemptStart = Date.now();
      let lastProgressMessage: string | undefined;
      nodeLog.info(attempt ? `Thử lại lần ${attempt}` : 'Bắt đầu');

      try {
        const results = await executor({
          runId,
          workflow,
          node,
          inputs,
          signal,
          onProgress: (progress, message) => {
            if (message && message !== lastProgressMessage) {
              lastProgressMessage = message;
              nodeLog.debug(`${progress}% ${message}`);
            }
            if (!showStatus) return;
            void runRepo.setNodeStatus(runId, nodeId, 'running', { progress, message });
            this.broadcast({ type: 'node.progress', runId, nodeId, progress, message });
          },
          resolveSlug: (slug) => {
            const id = slugIndex.get(slug);
            if (!id) return undefined;
            return outputsByNode.get(id)?.[0];
          },
          getAsset: async (assetId) => {
            const a = await assetRepo.get(assetId);
            return a?.blob;
          },
          putAsset: async (blob, name) => (await assetRepo.put(blob, name, workflow.id)).id,
          patchNodeData: async (patch) => {
            const wf = await workflowRepo.get(workflow.id);
            if (wf) {
              wf.nodes = wf.nodes.map((n) =>
                n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n,
              );
              await workflowRepo.save(wf);
            }
            this.broadcast({ type: 'node.data', runId, nodeId, data: patch });
          },
          extractLastFrame: async (video) => {
            const dataBase64 = await extractLastFrame({
              mime: video.type || 'video/mp4',
              dataBase64: await blobToBase64(video),
            });
            return new Blob([base64ToBytes(dataBase64)], { type: 'image/jpeg' });
          },
          composeVideo: (job) => composeVideoInOffscreen({ ...job, workflowId: workflow.id }),
          saveOutput: async (value) => {
            const nr = await runRepo.getNodeRun(runId, nodeId);
            const out = await runRepo.saveOutput({
              nodeRunId: nr?.id ?? nanoid(),
              kind: value.kind,
              mime: value.mime,
              text: value.text,
              blob: value.blob,
            });
            this.broadcast({
              type: 'node.output',
              runId,
              nodeId,
              outputId: out.id,
              kind: value.kind,
            });
            return out.id;
          },
          callDriver: (provider, action) =>
            this.router.execute(provider, action, signal, (p, m) => {
              if (m && m !== lastProgressMessage) {
                lastProgressMessage = m;
                nodeLog.debug(`${p}% ${m}`);
              }
              if (!showStatus) return;
              this.broadcast({ type: 'node.progress', runId, nodeId, progress: p, message: m });
            }),
        });

        for (const r of results) {
          if (r.blob || r.text) {
            const nr = await runRepo.getNodeRun(runId, nodeId);
            const out = await runRepo.saveOutput({
              nodeRunId: nr!.id,
              kind: r.kind,
              mime: r.mime,
              text: r.text,
              blob: r.blob,
              flowMediaId: r.flowMediaId,
            });
            r.outputId = out.id;
          }
        }

        outputsByNode.set(nodeId, results);
        this.cache.set(inputHash, results);
        nodeLog.info(`Thành công sau ${((Date.now() - attemptStart) / 1000).toFixed(1)}s — ${results.length} output`, results.map((r) => ({
          kind: r.kind, mime: r.mime, outputId: r.outputId, flowMediaId: r.flowMediaId, blob: r.blob,
        })));
        const outputIds = results.map((r) => r.outputId!).filter(Boolean);
        await runRepo.setNodeStatus(runId, nodeId, 'success', {
          progress: 100,
          outputIds,
        });
        // Gắn preview / formatted output vào node data + báo UI cập nhật ngay
        if (
          node.type === 'generateImage' ||
          node.type === 'generateVideo' ||
          node.type === 'mergeVideo'
        ) {
          if (outputIds[0]) {
            const wf = await workflowRepo.get(workflow.id);
            if (wf) {
              wf.nodes = wf.nodes.map((n) =>
                n.id === nodeId
                  ? { ...n, data: { ...n.data, previewOutputId: outputIds[0] } }
                  : n,
              );
              await workflowRepo.save(wf);
            }
            this.broadcast({
              type: 'node.output',
              runId,
              nodeId,
              outputId: outputIds[0],
              kind: results[0]?.kind ?? previewKindOf(node.type),
            });
          }
        } else if (node.type === 'prompt') {
          const text = results.find((r) => r.kind === 'text')?.text;
          if (text) {
            const wf = await workflowRepo.get(workflow.id);
            if (wf) {
              wf.nodes = wf.nodes.map((n) =>
                n.id === nodeId ? { ...n, data: { ...n.data, formattedOutput: text } } : n,
              );
              await workflowRepo.save(wf);
            }
            this.broadcast({
              type: 'node.data',
              runId,
              nodeId,
              data: { formattedOutput: text },
            });
          }
        }
        if (showStatus) {
          this.broadcast({ type: 'node.status', runId, nodeId, status: 'success', progress: 100 });
        }
        return;
      } catch (e) {
        lastErr = e;
        const code = (e as { code?: string }).code ?? 'UNKNOWN';
        if (signal.aborted) break;
        if (NON_RETRYABLE.has(code)) {
          nodeLog.error(`Lỗi ${code} (không retry): ${e instanceof Error ? e.message : String(e)}`, e);
          break;
        }
        const backoff = Math.min(30_000, 1000 * 2 ** attempt) * (0.5 + Math.random());
        nodeLog.warn(
          `Lần ${attempt + 1} lỗi ${code}: ${e instanceof Error ? e.message : String(e)}` +
            (attempt < retries ? ` — thử lại sau ${(backoff / 1000).toFixed(1)}s` : ''),
          e,
        );
        await sleep(backoff);
      }
    }

    const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
    const code = (lastErr as { code?: string })?.code;
    await runRepo.setNodeStatus(runId, nodeId, 'error', { error: msg, errorCode: code });
    this.broadcast({ type: 'node.status', runId, nodeId, status: 'error', message: msg });
    throw lastErr;
  }

  private notify(title: string, body: string, level: 'info' | 'success' | 'error') {
    this.broadcast({ type: 'notification', title, body, level });
    try {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('public/icons/icon128.png'),
        title,
        message: body,
      });
    } catch {
      /* icon may be missing in mid-dev */
    }
  }

  async recover() {
    const running = await runRepo.listRunning();
    for (const run of running) {
      await runRepo.update(run.id, {
        status: 'error',
        error: 'Service worker khởi động lại — run bị gián đoạn, hãy chạy lại',
        finishedAt: Date.now(),
      });
    }
  }
}

/**
 * Generate Video with no prompt whose output still feeds another node: pass on the clip
 * it produced last time instead of failing the run. Without a stored clip it runs (and
 * fails with the missing-prompt error) as before.
 */
export async function previousClipToPassOn(
  workflow: Workflow,
  node: WorkflowNode,
  inputs: Record<string, NodeOutputValue[]>,
): Promise<NodeOutputValue | undefined> {
  if (node.type !== 'generateVideo') return undefined;
  const data = node.data as { prompt?: string; previewOutputId?: string };
  if (hasGeneratePrompt(data.prompt, inputs)) return undefined;
  if (!workflow.edges.some((e) => e.source === node.id)) return undefined;
  return previousGenerateOutput(node);
}

function isGeneratorNode(node: WorkflowNode): boolean {
  return node.type === 'generateImage' || node.type === 'generateVideo';
}

/** The result a Generate node showed last (`previewOutputId`), as a value later nodes can consume. */
export async function previousGenerateOutput(node: WorkflowNode): Promise<NodeOutputValue | undefined> {
  if (!isGeneratorNode(node)) return undefined;
  const outputId = (node.data as { previewOutputId?: string }).previewOutputId;
  if (!outputId) return undefined;
  const out = await runRepo.getOutput(outputId);
  if (!out?.blob) return undefined;
  const kind = node.type === 'generateVideo' ? 'video' : 'image';
  return {
    kind,
    blob: out.blob,
    mime: out.mime ?? (out.blob.type || (kind === 'video' ? 'video/mp4' : 'image/png')),
    outputId,
    flowMediaId: out.flowMediaId,
    fromFlow: true,
  };
}

/**
 * Role of a value arriving straight from its producing node. A Prompt forwards
 * values that already carry a role, so those keep it.
 */
function directRole(sourceType: WorkflowNode['type'] | undefined): NodeOutputValue['role'] {
  if (sourceType === 'prompt') return 'prompt';
  if (sourceType === 'generateVideo') return 'continuation';
  return 'ref';
}

/** Values flowing into `nodeId`, by target handle, tagged with name / label / role. */
export function gatherInputs(
  workflow: Workflow,
  nodeId: string,
  outputsByNode: Map<string, NodeOutputValue[]>,
): Record<string, NodeOutputValue[]> {
  const inputs: Record<string, NodeOutputValue[]> = {};
  const push = (handle: string, vals: NodeOutputValue[]) => {
    if (!vals.length) return;
    inputs[handle] = [...(inputs[handle] ?? []), ...vals];
  };

  for (const e of workflow.edges.filter((ed) => ed.target === nodeId)) {
    const srcNode = workflow.nodes.find((n) => n.id === e.source);
    const srcName =
      (srcNode?.data as { assetLabel?: string } | undefined)?.assetLabel ??
      srcNode?.label ??
      srcNode?.slug ??
      srcNode?.type ??
      e.source;
    const role = directRole(srcNode?.type);
    const tagged = (outputsByNode.get(e.source) ?? []).map((v) => ({
      ...v,
      name: v.name ?? String(srcName),
      role: v.role ?? role,
      sourceNodeId: v.sourceNodeId ?? e.source,
    }));

    if (srcNode?.type === 'prompt') {
      // A Prompt's single text edge also carries the refs and previous clip it forwards.
      for (const v of tagged) push(`in:${v.kind}`, [v]);
      continue;
    }
    const matching = tagged.filter((v) => e.type === 'any' || v.kind === e.type || v.kind === 'any');
    push(e.targetHandle, matching.length ? matching : tagged);
  }
  return inputs;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
