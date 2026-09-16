import { memo, useEffect, useMemo, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { FlowNode } from '@/features/editor/store';
import { getNodePorts } from '@/nodes/registry';
import { PORT_COLORS, PORT_ICONS } from '@/nodes/ports';
import { strings } from '@/shared/strings';
import { cn } from '@/shared/utils';
import { useEditorStore } from '@/features/editor/store';
import {
  ASSET_LABELS,
  AUDIO_ASSET_LABEL,
  defaultKindForLabel,
  type AssetLabel,
} from '@/shared/schema';
import { assetRepo } from '@/storage/repos/assetRepo';
import { MEDIA_ACCEPT, mediaKindOf } from '@/shared/media';
import { workflowRepo } from '@/storage/repos/workflowRepo';
import { ImagePlus, Clapperboard, Square } from 'lucide-react';
import { FlowAssetPicker } from '@/features/editor/FlowAssetPicker';
import { Button } from '@/components/ui/button';
import {
  computePromptPreview,
  resolveIncomingItems,
  summarizeIncoming,
  type IncomingItem,
} from '@/features/editor/incomingInputs';
import { ReferencedAssetsStrip } from '@/features/editor/IncomingAssets';
import { sendToSw } from '@/shared/messaging';
import { GenerateMediaStage, NodeVideoPlayer } from '@/features/editor/nodes/MediaPreview';
import { MergeVideoBody } from '@/features/editor/nodes/MergeVideoBody';
import { useMediaDuration, useNodeOutputUrl } from '@/features/editor/nodes/useMediaUrl';

const STATUS_BORDER: Record<string, string> = {
  queued: 'border-muted-foreground',
  running: 'border-amber-400 animate-pulse',
  success: 'border-primary',
  error: 'border-destructive',
  skipped: 'border-muted',
  cancelled: 'border-muted',
};

/** Shared size for all prompt/text textareas inside canvas nodes. */
const NODE_TEXTAREA_CLASS =
  'h-[200px] w-[500px] max-w-full resize-y rounded border border-border bg-background p-2 text-xs leading-relaxed';

function useIncomingItems(nodeId: string): IncomingItem[] {
  const edges = useEditorStore((s) => s.edges);
  const nodes = useEditorStore((s) => s.nodes);
  return useMemo(() => resolveIncomingItems(nodeId, nodes, edges), [edges, nodes, nodeId]);
}

async function runWorkflowNode(nodeId: string, mode: 'node' | 'only' | 'full' = 'node') {
  const state = useEditorStore.getState();
  const wfId = state.workflowId;
  if (!wfId) return;

  // Persist before SW loads workflow — otherwise edges/prompt text are missing
  if (state.dirty) {
    const partial = state.toWorkflow();
    if (partial) {
      const existing = await workflowRepo.get(wfId);
      await workflowRepo.save({
        ...partial,
        workspaceId: existing?.workspaceId ?? partial.workspaceId,
        createdAt: existing?.createdAt ?? partial.createdAt,
      });
      state.markSaved();
    }
  }

  if (mode === 'full') {
    state.setEdgeRunState(new Set(state.nodes.map((n) => n.id)));
  } else {
    state.setEdgeRunState(new Set([nodeId]));
  }

  state.setActiveRun(null, true);
  const res = await sendToSw<{ runId: string }>({
    type: 'workflow.run',
    workflowId: wfId,
    mode,
    fromNodeId: mode === 'full' ? undefined : nodeId,
  });
  if (res.ok && res.data?.runId) state.setActiveRun(res.data.runId, true);
}

async function stopWorkflow() {
  const state = useEditorStore.getState();
  const wfId = state.workflowId;
  if (!wfId) return;
  if (state.activeRunId) {
    await sendToSw({ type: 'run.cancel', runId: state.activeRunId });
  } else {
    await sendToSw({ type: 'workflow.cancel', workflowId: wfId });
  }
  state.setActiveRun(null, false);
  state.setEdgeRunState('clear');
  state.pushLog('Đã dừng');
}

export const WorkflowNodeView = memo(function WorkflowNodeView({
  id,
  data,
  selected,
}: NodeProps<FlowNode>) {
  const ports = getNodePorts(data.nodeType, data.data);
  const updateNodeData = useEditorStore((s) => s.updateNodeData);
  const outputs = ports.outputs;
  const incoming = useIncomingItems(id);
  const summary = summarizeIncoming(incoming);
  const hasInputs = summary.hasAny;

  const isPrompt = data.nodeType === 'prompt';
  const isGenerate = data.nodeType === 'generateImage' || data.nodeType === 'generateVideo';
  const isText = data.nodeType === 'text';
  const isMerge = data.nodeType === 'mergeVideo';
  const wideBody = isPrompt || isGenerate || isText || isMerge;

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border-2 bg-card shadow-md',
        wideBody ? 'min-w-[520px] w-[540px] max-w-[560px]' : 'min-w-[240px] max-w-[320px]',
        selected ? 'border-primary' : 'border-border',
        data.status && STATUS_BORDER[data.status],
      )}
    >
      <div className="flex items-center justify-between border-b border-border px-2.5 py-1.5">
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold">{data.label ?? data.nodeType}</div>
          {data.slug && <div className="font-mono text-[10px] text-amber-300">@{data.slug}</div>}
          {data.nodeType === 'asset' && data.data.assetLabel != null && (
            <div className="text-[10px] text-sky-300">{String(data.data.assetLabel)}</div>
          )}
        </div>
      </div>

      <div className={cn('relative px-2.5 py-2 text-xs', isPrompt && 'min-h-[160px]')}>
        {ports.inputs.map((p, i) => (
          <Handle
            key={p.id}
            id={p.id}
            type="target"
            position={Position.Left}
            style={{
              top: 36 + i * 18,
              background: PORT_COLORS[p.type],
              width: 12,
              height: 12,
              border: '2px solid #0f172a',
            }}
            title={`${PORT_ICONS[p.type]} ${p.label ?? p.type}`}
          />
        ))}

        {data.nodeType === 'asset' && (
          <AssetBody data={data.data} onChange={(d) => updateNodeData(id, d)} />
        )}
        {data.nodeType === 'text' && (
          <textarea
            className={NODE_TEXTAREA_CLASS}
            value={(data.data.content as string) ?? ''}
            onChange={(e) => updateNodeData(id, { content: e.target.value })}
            placeholder="Nội dung… hỗ trợ [Character], @slug"
          />
        )}
        {data.nodeType === 'prompt' && (
          <PromptBody
            nodeId={id}
            instruction={(data.data.instruction as string) ?? ''}
            onChange={(instruction) => updateNodeData(id, { instruction })}
            items={incoming}
            hasInputs={hasInputs}
          />
        )}
        {data.nodeType === 'generateImage' && (
          <GeneratePreview
            nodeId={id}
            kind="image"
            data={data.data}
            status={data.status}
            progress={data.progress}
            statusMessage={data.statusMessage}
            items={incoming}
            hasInputs={hasInputs}
            onPromptChange={(prompt) => updateNodeData(id, { prompt })}
            onGenerate={() => void runWorkflowNode(id, 'node')}
            onStop={() => void stopWorkflow()}
          />
        )}
        {data.nodeType === 'generateVideo' && (
          <GeneratePreview
            nodeId={id}
            kind="video"
            data={data.data}
            status={data.status}
            progress={data.progress}
            statusMessage={data.statusMessage}
            items={incoming}
            hasInputs={hasInputs}
            onPromptChange={(prompt) => updateNodeData(id, { prompt })}
            onGenerate={() => void runWorkflowNode(id, 'node')}
            onGenerateOnly={() => void runWorkflowNode(id, 'only')}
            onStop={() => void stopWorkflow()}
          />
        )}
        {data.nodeType === 'mergeVideo' && (
          <MergeVideoNode
            nodeId={id}
            data={data.data}
            items={incoming}
            status={data.status}
            progress={data.progress}
            statusMessage={data.statusMessage}
            onChange={(patch) => updateNodeData(id, patch)}
          />
        )}
        {data.nodeType === 'autoDownload' && (
          <div className="space-y-1.5">
            {hasInputs ? (
              <InputSummary items={incoming} />
            ) : (
              <div className="text-muted-foreground">Tự tải kết quả upstream</div>
            )}
          </div>
        )}
        {data.nodeType === 'unknown' && (
          <div className="text-muted-foreground">Node không hỗ trợ</div>
        )}

        {data.status === 'error' && data.error && (
          <div className="mt-2 max-h-24 overflow-auto rounded border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-[10px] leading-snug text-destructive">
            {data.error}
          </div>
        )}

        {outputs.map((p, i) => (
          <Handle
            key={p.id}
            id={p.id}
            type="source"
            position={Position.Right}
            style={{
              top: 36 + i * 18,
              background: PORT_COLORS[p.type],
              width: 12,
              height: 12,
              border: '2px solid #0f172a',
            }}
            title={`${PORT_ICONS[p.type]} ${p.label ?? p.type}`}
          />
        ))}
      </div>

      <div className="min-w-0 truncate border-t border-border px-2.5 py-1 text-[10px] text-muted-foreground">
        {data.nodeType === 'generateImage' && (
          <span className="truncate">
            {(data.data.model as string) || 'image'} · {(data.data.aspectRatio as string) || '9:16'} ·{' '}
            {String(data.data.resolution ?? 720)}p
          </span>
        )}
        {data.nodeType === 'generateVideo' && (
          <span className="truncate">
            {(data.data.model as string) || 'video'} · {(data.data.aspectRatio as string) || '9:16'} ·{' '}
            {String(data.data.durationSec ?? 4)}s
          </span>
        )}
        {data.nodeType === 'mergeVideo' && (
          <span className="truncate">
            mp4 · {String(data.data.fps ?? 30)}fps · {String(data.data.bitrateMbps ?? 8)}Mbps
          </span>
        )}
        {data.nodeType === 'prompt' && (
          <span className="truncate">
            Output · {((data.data.formattedOutput as string) ?? (data.data.instruction as string) ?? '').length}{' '}
            ký tự
          </span>
        )}
        {data.status && <span className="ml-2 shrink-0">{data.status}</span>}
      </div>
    </div>
  );
});

function InputSummary({
  items,
  nodeId,
  removable,
  hideText,
}: {
  items: IncomingItem[];
  nodeId?: string;
  removable?: boolean;
  /** When true, skip the clamped text preview (e.g. generate nodes use a textarea). */
  hideText?: boolean;
}) {
  const safeItems = items ?? [];
  const summary = summarizeIncoming(safeItems);
  const chips: string[] = [];
  if (summary.texts.length) chips.push(`${summary.texts.length} text`);
  if (summary.imageCount) chips.push(`${summary.imageCount} ảnh`);
  if (summary.videoCount) chips.push(`${summary.videoCount} video`);
  if (summary.audioCount) chips.push(`${summary.audioCount} audio`);
  if (!chips.length && !safeItems.length) return null;
  return (
    <div className="min-w-0 space-y-1.5 overflow-hidden">
      <div className="flex flex-wrap gap-1">
        {chips.map((c) => (
          <span
            key={c}
            className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
          >
            {c}
          </span>
        ))}
      </div>
      <ReferencedAssetsStrip
        items={safeItems}
        removable={removable}
        onRemove={
          removable && nodeId
            ? (item) => {
                if (item.origin === 'cache') {
                  useEditorStore.getState().updateNodeData(nodeId, { continueFrameAssetId: undefined });
                  return;
                }
                const edgeId = item.id.startsWith('edge:') ? item.id.slice(5) : undefined;
                useEditorStore
                  .getState()
                  .removeEdgeToSource(nodeId, item.sourceNodeId, edgeId);
              }
            : undefined
        }
      />
      {!hideText && summary.texts[0] && (
        <div className="line-clamp-3 whitespace-pre-wrap break-words rounded border border-border/60 bg-muted/40 px-1.5 py-1 text-[11px] text-foreground/90">
          {summary.texts[0]}
          {summary.texts.length > 1 ? ` (+${summary.texts.length - 1})` : ''}
        </div>
      )}
    </div>
  );
}

function PromptBody({
  nodeId,
  instruction,
  onChange,
  items,
  hasInputs,
}: {
  nodeId: string;
  instruction: string;
  onChange: (v: string) => void;
  items: IncomingItem[];
  hasInputs: boolean;
}) {
  const nodes = useEditorStore((s) => s.nodes);
  const edges = useEditorStore((s) => s.edges);
  const output = useMemo(() => computePromptPreview(nodeId, nodes, edges).text, [nodeId, nodes, edges]);
  const upstream = items.filter((i) => i.origin === 'edge' && i.role === 'prompt');
  const unresolved = items.filter((i) => i.origin === 'label');

  return (
    <div className="min-w-0 space-y-2 overflow-hidden">
      {hasInputs && <InputSummary items={items} nodeId={nodeId} removable hideText />}
      {upstream.map((u) => (
        <div
          key={u.id}
          className="line-clamp-3 whitespace-pre-wrap break-words rounded border border-border/60 bg-muted/40 px-1.5 py-1 text-[11px] text-foreground/90"
          title={u.text}
        >
          <span className="mr-1 font-medium text-violet-300">{u.title}:</span>
          {u.text || '(trống)'}
        </div>
      ))}
      <textarea
        className={NODE_TEXTAREA_CLASS}
        value={instruction}
        onChange={(e) => onChange(e.target.value)}
        placeholder="vd: [Character] mặc [Outfit] đi bộ… - giữ [Label], mô tả ở khối tham chiếu"
      />
      {unresolved.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {unresolved.map((u) => (
            <span
              key={u.id}
              title={u.subtitle}
              className={cn(
                'rounded px-1.5 py-0.5 text-[10px]',
                u.missing ? 'bg-amber-500/15 text-amber-300' : 'bg-muted text-muted-foreground',
              )}
            >
              {u.title} · {u.missing ? 'chưa nối' : 'upload khi chạy'}
            </span>
          ))}
        </div>
      )}
      <div className="space-y-1">
        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Output</div>
        <textarea
          readOnly
          className={cn(NODE_TEXTAREA_CLASS, 'border-primary/25 bg-primary/5 font-mono text-[11px]')}
          value={output}
          placeholder="Instruction + prompt phía trước; [Label] + mô tả · mediaId {uuid}"
        />
      </div>
    </div>
  );
}

function AssetBody({
  data,
  onChange,
}: {
  data: Record<string, unknown>;
  onChange: (d: Record<string, unknown>) => void;
}) {
  const label = (data.assetLabel as AssetLabel) || 'Character';
  const kind = (data.kind as 'image' | 'video' | 'audio') || defaultKindForLabel(label);
  const flowMediaId = data.flowMediaId as string | undefined;
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [previewBroken, setPreviewBroken] = useState(false);
  const [flowOpen, setFlowOpen] = useState(false);

  useEffect(() => {
    let revoked: string | null = null;
    void (async () => {
      const assetId = data.assetId as string | undefined;
      if (flowMediaId || !assetId || data.missing) {
        setLocalUrl(null);
        return;
      }
      const asset = await assetRepo.get(assetId);
      if (!asset) return;
      const url = URL.createObjectURL(asset.blob);
      revoked = url;
      setLocalUrl(url);
    })();
    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [data.assetId, data.missing, flowMediaId]);

  useEffect(() => setPreviewBroken(false), [data.flowPreviewUrl]);

  const previewUrl = flowMediaId
    ? previewBroken
      ? null
      : ((data.flowPreviewUrl as string | undefined) ?? null)
    : localUrl;
  const flowWithoutId = !flowMediaId && data.source === 'flow';
  const hasAsset = !!flowMediaId || (!flowWithoutId && !!data.assetId && !data.missing);

  const applyLocalFile = async (file: File) => {
    // `file.type` rỗng hoặc lạ (hay gặp với .mp3) thì đuôi file quyết định —
    // đoán bừa thành ảnh sẽ làm node xuất sai cổng.
    const nextKind = mediaKindOf(file) ?? kind;
    const asset = await assetRepo.put(
      file,
      file.name,
      useEditorStore.getState().workflowId ?? undefined,
    );
    onChange({
      assetId: asset.id,
      kind: nextKind,
      // Đúng một label dành cho audio, nên đổi được mà không mơ hồ. Ảnh/video
      // có nhiều label nên giữ nguyên lựa chọn của người dùng.
      ...(nextKind === 'audio' && defaultKindForLabel(label) !== 'audio'
        ? { assetLabel: AUDIO_ASSET_LABEL }
        : {}),
      mime: file.type,
      originalName: file.name,
      missing: false,
      source: 'local',
      flowMediaId: undefined,
      flowPreviewUrl: undefined,
    });
  };

  const localPicker = (className: string, text: string) => (
    <label className={className}>
      <span className="inline-flex h-7 w-full cursor-pointer items-center justify-center rounded-md border border-border px-2 text-xs hover:bg-muted">
        {text}
      </span>
      <input
        type="file"
        accept={MEDIA_ACCEPT}
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          await applyLocalFile(file);
        }}
      />
    </label>
  );

  return (
    <div className="space-y-1.5">
      <select
        className="w-full rounded border border-border bg-background px-1.5 py-1 text-[11px]"
        value={label}
        onChange={(e) => {
          const next = e.target.value as AssetLabel;
          onChange({ assetLabel: next, kind: defaultKindForLabel(next) });
        }}
      >
        {ASSET_LABELS.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </select>

      {previewUrl && kind === 'image' && (
        <img
          src={previewUrl}
          alt=""
          className="max-h-28 w-full rounded object-contain bg-muted"
          onError={() => setPreviewBroken(true)}
        />
      )}
      {previewUrl && kind === 'video' && (
        <div className="aspect-video w-full overflow-hidden rounded-md ring-1 ring-border">
          <NodeVideoPlayer src={previewUrl} onError={() => setPreviewBroken(true)} />
        </div>
      )}
      {previewUrl && kind === 'audio' && <audio src={previewUrl} className="w-full" controls />}

      {hasAsset && flowMediaId && (
        <div className="truncate text-[11px] text-muted-foreground" title={flowMediaId}>
          {`Google Flow · ${flowMediaId.slice(0, 8)}${previewBroken ? ' · preview hết hạn' : ''}`}
        </div>
      )}
      {hasAsset && !flowMediaId && (
        <LocalAssetInfo
          name={(data.originalName as string) ?? kind}
          kind={kind}
          url={localUrl}
        />
      )}
      {!hasAsset && (
        <div className="rounded border border-dashed border-border py-2 text-center text-[11px] text-muted-foreground">
          {flowWithoutId
            ? 'Asset Google Flow mất media id — chọn lại từ Flow (không upload lại)'
            : data.missing
              ? strings.missingFile
              : kind === 'audio'
                ? strings.dropOrPickAudio
                : strings.pickFlowAssetHint}
        </div>
      )}

      <div className="flex gap-1">
        {kind !== 'audio' && (
          <Button
            type="button"
            variant={hasAsset ? 'outline' : 'default'}
            size="sm"
            className="flex-1"
            onClick={(e) => {
              e.stopPropagation();
              setFlowOpen(true);
            }}
          >
            {strings.pickFromFlow}
          </Button>
        )}
        {localPicker('flex-1', strings.pickFromLocal)}
      </div>

      <FlowAssetPicker
        open={flowOpen}
        onOpenChange={setFlowOpen}
        kind={kind}
        onPicked={(picked) => {
          onChange({
            flowMediaId: picked.mediaId,
            flowPreviewUrl: picked.previewUrl,
            kind: picked.kind,
            originalName: picked.originalName,
            source: 'flow',
            missing: false,
            assetId: undefined,
            mime: undefined,
          });
        }}
      />
    </div>
  );
}

function MergeVideoNode({
  nodeId,
  data,
  items,
  status,
  progress,
  statusMessage,
  onChange,
}: {
  nodeId: string;
  data: Record<string, unknown>;
  items: IncomingItem[];
  status?: string;
  progress?: number;
  statusMessage?: string;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const previewUrl = useNodeOutputUrl(nodeId);
  // Chạy ở mode `only`: node generate phía trước dùng lại kết quả gần nhất thay
  // vì tạo lại — bấm Ghép video không được âm thầm đốt quota Flow.
  return (
    <MergeVideoBody
      nodeId={nodeId}
      data={data}
      items={items}
      status={status}
      progress={progress}
      statusMessage={statusMessage}
      previewUrl={previewUrl}
      onChange={onChange}
      onRun={() => void runWorkflowNode(nodeId, 'only')}
      onStop={() => void stopWorkflow()}
    />
  );
}

/**
 * Dòng mô tả file local của Asset node. Audio/video hiện thêm độ dài — node Ghép
 * video cắt audio theo giây nên người dùng cần biết file dài bao nhiêu.
 */
function LocalAssetInfo({
  name,
  kind,
  url,
}: {
  name: string;
  kind: 'image' | 'video' | 'audio';
  url: string | null;
}) {
  const duration = useMediaDuration(
    kind === 'audio' || kind === 'video' ? url : null,
    kind === 'audio' ? 'audio' : 'video',
  );
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span className="min-w-0 flex-1 truncate" title={name}>
        {name}
      </span>
      {duration != null && (
        <span className="shrink-0 tabular-nums">{duration.toFixed(1)}s</span>
      )}
      <span className="shrink-0">{kind === 'audio' ? strings.assetLocalAudio : strings.assetLocal}</span>
    </div>
  );
}

function GeneratePreview({
  nodeId,
  kind,
  data,
  status,
  progress,
  statusMessage,
  items,
  hasInputs,
  onPromptChange,
  onGenerate,
  onGenerateOnly,
  onStop,
}: {
  nodeId: string;
  kind: 'image' | 'video';
  data: Record<string, unknown>;
  status?: string;
  progress?: number;
  statusMessage?: string;
  items: IncomingItem[];
  hasInputs: boolean;
  onPromptChange: (prompt: string) => void;
  onGenerate: () => void;
  /** Generate this node only; upstream generators reuse their last result. */
  onGenerateOnly?: () => void;
  onStop: () => void;
}) {
  const Icon = kind === 'image' ? ImagePlus : Clapperboard;
  const label = kind === 'image' ? 'Generate Image' : 'Generate Video';
  const previewUrl = useNodeOutputUrl(nodeId);
  const running = status === 'running';
  const summary = summarizeIncoming(items);
  const storedPrompt = String(data.prompt ?? '');
  const incomingPrompt = summary.texts.join('\n\n');
  const promptValue = storedPrompt || incomingPrompt;


  return (
    <div className="min-w-0 space-y-1.5 overflow-hidden">
      {hasInputs ? (
        <InputSummary items={items} hideText />
      ) : (
        <div className="text-[10px] text-muted-foreground">
          Nhập prompt bên dưới — hoặc nối text/ảnh vào node
        </div>
      )}
      <textarea
        className={NODE_TEXTAREA_CLASS}
        value={promptValue}
        onChange={(e) => onPromptChange(e.target.value)}
        placeholder="Prompt để generate…"
      />
      <GenerateMediaStage
        kind={kind}
        url={previewUrl}
        aspectRatio={(data.aspectRatio as string | undefined) ?? '9:16'}
        running={running}
        progress={progress}
        statusMessage={statusMessage}
        ready={hasInputs || !!promptValue.trim()}
      />
      <div className="truncate text-[10px] text-muted-foreground">
        {(data.aspectRatio as string) ?? '9:16'} · {String(data.count ?? 1)} ·{' '}
        {String(data.resolution ?? 720)}p
        {kind === 'video' ? ` · ${String(data.durationSec ?? 4)}s` : ''}
      </div>
      <div className="flex gap-1.5">
        <Button
          type="button"
          size="sm"
          className="min-w-0 flex-1 gap-1.5"
          disabled={running}
          onClick={(e) => {
            e.stopPropagation();
            void onGenerate();
          }}
        >
          <Icon className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{running ? `${progress ?? 0}%` : label}</span>
        </Button>
        {onGenerateOnly && !running && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="shrink-0 gap-1.5"
            title={strings.generateOnlyThisNodeHint}
            onClick={(e) => {
              e.stopPropagation();
              onGenerateOnly();
            }}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{strings.generateOnlyThisNode}</span>
          </Button>
        )}
        {running && (
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="shrink-0 gap-1 px-2"
            title={strings.stop}
            onClick={(e) => {
              e.stopPropagation();
              void onStop();
            }}
          >
            <Square className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

export const NoteNodeView = memo(function NoteNodeView({ id, data, selected }: NodeProps<FlowNode>) {
  const updateNodeData = useEditorStore((s) => s.updateNodeData);
  return (
    <div
      className={cn(
        'min-w-[520px] max-w-[560px] rounded-md border p-2 shadow',
        selected ? 'border-primary' : 'border-transparent',
      )}
      style={{ background: (data.data.color as string) ?? '#1e3a5f' }}
    >
      <textarea
        className={cn(NODE_TEXTAREA_CLASS, 'border-transparent bg-transparent text-sky-100 outline-none')}
        value={(data.data.content as string) ?? ''}
        onChange={(e) => updateNodeData(id, { content: e.target.value })}
        placeholder="Ghi chú…"
      />
    </div>
  );
});
