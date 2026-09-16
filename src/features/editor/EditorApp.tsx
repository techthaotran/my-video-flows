import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  MiniMap,
  Controls,
  BackgroundVariant,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
} from '@xyflow/react';
import dagre from 'dagre';
import {
  Lock,
  Unlock,
  Save,
  Play,
  Square,
  RotateCcw,
  X,
  Hand,
  MousePointer2,
  Undo2,
  Redo2,
  LayoutGrid,
  Download,
  ZoomIn,
  ZoomOut,
  TerminalSquare,
} from 'lucide-react';
import { useEditorStore, type FlowNode } from '@/features/editor/store';
import { WorkflowNodeView, NoteNodeView } from '@/features/editor/nodes/WorkflowNodeView';
import { WorkflowEdge } from '@/features/editor/edges/WorkflowEdge';
import { NodePicker } from '@/features/editor/NodePicker';
import { listToolbarNodes, getNodePorts } from '@/nodes/registry';
import { resolveDropConnection } from '@/nodes/ports';
import { workflowRepo } from '@/storage/repos/workflowRepo';
import { exportWorkflows, parseImportFile, remapInsertNodes } from '@/storage/transfer';
import { chromeDownload, debounce, cn } from '@/shared/utils';
import { strings } from '@/shared/strings';
import { connectRunEvents, sendToSw } from '@/shared/messaging';
import { ingestLog, clearLogs, getLogs, subscribeLogs } from '@/shared/log';
import { DebugConsole } from '@/features/editor/DebugConsole';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { NodeType } from '@/shared/schema';
import {
  ASSET_LABELS,
  ASPECT_RATIOS,
  IMAGE_MODELS,
  VIDEO_MODELS,
  VIDEO_DURATIONS,
  DEFAULT_IMAGE_MODEL,
  DEFAULT_VIDEO_MODEL,
  normalizeModelLabel,
  RESOLUTIONS,
  defaultKindForLabel,
} from '@/shared/schema';
import {
  computePromptPreview,
  resolveIncomingItems,
  isMediaCapableNode,
} from '@/features/editor/incomingInputs';
import { IncomingInputsDetail } from '@/features/editor/IncomingAssets';

const nodeTypes = {
  workflow: WorkflowNodeView,
  note: NoteNodeView,
};

const edgeTypes = {
  workflow: WorkflowEdge,
};

function EditorInner() {
  const params = new URLSearchParams(location.search);
  const workflowId = params.get('id');
  const rf = useReactFlow();

  const store = useEditorStore();
  const temporal = useEditorStore.temporal;

  const [closeOpen, setCloseOpen] = useState(false);
  const [draftOpen, setDraftOpen] = useState(false);
  const [tool, setTool] = useState<'select' | 'pan'>('select');
  const [consoleOpen, setConsoleOpen] = useState(() => {
    try {
      return localStorage.getItem('debugConsole.open') === '1';
    } catch {
      return false;
    }
  });
  const [unseenErrors, setUnseenErrors] = useState(0);
  const toggleConsole = useCallback((next?: boolean) => {
    setConsoleOpen((prev) => {
      const value = next ?? !prev;
      try {
        localStorage.setItem('debugConsole.open', value ? '1' : '0');
      } catch {
        /* storage blocked */
      }
      return value;
    });
  }, []);
  const [dropChoice, setDropChoice] = useState<{
    file: File;
    position: { x: number; y: number };
  } | null>(null);
  const workspaceIdRef = useRef('');
  const createdAtRef = useRef(Date.now());

  const saveDraft = useMemo(
    () =>
      debounce(() => {
        const wf = store.toWorkflow();
        if (!wf || !store.dirty) return;
        wf.workspaceId = workspaceIdRef.current;
        wf.createdAt = createdAtRef.current;
        void workflowRepo.saveDraft(wf);
      }, 800),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store.dirty, store.nodes, store.edges, store.name],
  );

  useEffect(() => {
    if (!workflowId) return;
    void (async () => {
      const wf = await workflowRepo.get(workflowId);
      if (!wf) return;
      workspaceIdRef.current = wf.workspaceId;
      createdAtRef.current = wf.createdAt;
      const draft = await workflowRepo.getDraft(workflowId);
      if (draft && draft.updatedAt > wf.updatedAt) {
        setDraftOpen(true);
        store.loadWorkflow(wf);
        // keep draft aside via closure
        (window as unknown as { __draft?: typeof draft }).__draft = draft;
      } else {
        store.loadWorkflow(wf);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowId]);

  useEffect(() => {
    if (store.dirty) saveDraft();
  }, [store.nodes, store.edges, store.name, store.enabled, store.locked, store.viewport, store.dirty, saveDraft]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden' && store.dirty) {
        const wf = store.toWorkflow();
        if (wf) {
          wf.workspaceId = workspaceIdRef.current;
          wf.createdAt = createdAtRef.current;
          void workflowRepo.saveDraft(wf);
        }
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  });

  useEffect(() => {
    const syncEdgeAnimation = () => {
      const active = new Set(
        useEditorStore
          .getState()
          .nodes.filter((n) => n.data.status === 'running' || n.data.status === 'queued')
          .map((n) => n.id),
      );
      if (active.size === 0) {
        store.setEdgeRunState('clear');
      } else {
        store.setEdgeRunState(active);
      }
    };

    const channel = connectRunEvents((ev) => {
      if (ev.type === 'log') {
        ingestLog(ev.entry);
        return;
      }
      if (ev.type === 'log.snapshot') {
        // SW buffer is the source of truth for SW entries; keep this page's own.
        const own = getLogs().filter((e) => e.origin === 'ui');
        clearLogs();
        for (const e of [...ev.entries, ...own].sort((a, b) => a.ts - b.ts)) ingestLog(e);
        return;
      }
      if (ev.type === 'node.status') {
        store.setNodeStatus(
          ev.nodeId,
          ev.status,
          ev.progress,
          ev.status === 'error' ? ev.message : undefined,
          ev.message,
        );
        syncEdgeAnimation();
      }
      if (ev.type === 'node.output') {
        store.setNodePreview(ev.nodeId, ev.outputId);
      }
      if (ev.type === 'node.data') {
        store.updateNodeData(ev.nodeId, ev.data);
      }
      if (ev.type === 'node.progress') {
        store.setNodeStatus(ev.nodeId, 'running', ev.progress, undefined, ev.message);
        syncEdgeAnimation();
      }
      if (ev.type === 'run.done') {
        store.setActiveRun(null, false);
        // Keep error borders; clear edge animation after a short beat
        window.setTimeout(() => store.setEdgeRunState('clear'), 400);
      }
    });
    return () => channel.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (e.ctrlKey && e.code === 'Backquote') {
        e.preventDefault();
        toggleConsole();
        return;
      }
      if (meta && e.key === 's') {
        e.preventDefault();
        void handleSave();
      }
      if (meta && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        temporal.getState().undo();
      }
      if (meta && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        temporal.getState().redo();
      }
      if (e.key === 'Tab' || e.key === '/') {
        if ((e.target as HTMLElement).tagName === 'TEXTAREA' || (e.target as HTMLElement).tagName === 'INPUT')
          return;
        e.preventDefault();
        const center = rf.screenToFlowPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        });
        store.setPickerOpen(true, center);
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        // React Flow deletes selected nodes/edges via deleteKeyCode
      }
      if (e.code === 'Space') {
        if (tagIsEditable(e.target)) return;
        setTool('pan');
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setTool('select');
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = useCallback(async () => {
    const partial = store.toWorkflow();
    if (!partial || !workflowId) return;
    const existing = await workflowRepo.get(workflowId);
    const wf = {
      ...partial,
      workspaceId: existing?.workspaceId ?? workspaceIdRef.current,
      createdAt: existing?.createdAt ?? createdAtRef.current,
    };
    await workflowRepo.save(wf);
    store.markSaved();
    store.pushLog(strings.saved);
  }, [store, workflowId]);

  const handleRun = async () => {
    if (store.dirty) await handleSave();
    if (!workflowId) return;
    // Optimistic: pulse all edges until node.status events refine the set
    const ids = new Set(useEditorStore.getState().nodes.map((n) => n.id));
    store.setEdgeRunState(ids);
    store.setActiveRun(null, true);
    const res = await sendToSw<{ runId: string }>({ type: 'workflow.run', workflowId });
    if (res.ok && res.data?.runId) store.setActiveRun(res.data.runId, true);
  };

  const handleStop = async () => {
    if (!workflowId) return;
    const runId = useEditorStore.getState().activeRunId;
    if (runId) {
      await sendToSw({ type: 'run.cancel', runId });
    } else {
      await sendToSw({ type: 'workflow.cancel', workflowId });
    }
    store.setActiveRun(null, false);
    store.setEdgeRunState('clear');
    store.pushLog('Đã dừng');
  };

  const handleAutoLayout = () => {
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: 'LR', nodesep: 60, ranksep: 80 });
    for (const n of store.nodes) {
      const wide =
        n.data.nodeType === 'prompt' ||
        n.data.nodeType === 'generateImage' ||
        n.data.nodeType === 'generateVideo' ||
        n.data.nodeType === 'text' ||
        n.data.nodeType === 'note';
      g.setNode(n.id, {
        width: wide ? 540 : 240,
        height: wide ? 520 : 140,
      });
    }
    for (const e of store.edges) {
      g.setEdge(e.source, e.target);
    }
    dagre.layout(g);
    const layouted: FlowNode[] = store.nodes.map((n) => {
      const pos = g.node(n.id);
      const wide =
        n.data.nodeType === 'prompt' ||
        n.data.nodeType === 'generateImage' ||
        n.data.nodeType === 'generateVideo' ||
        n.data.nodeType === 'text' ||
        n.data.nodeType === 'note';
      const w = wide ? 540 : 240;
      const h = wide ? 520 : 140;
      return { ...n, position: { x: pos.x - w / 2, y: pos.y - h / 2 } };
    });
    useEditorStore.setState({ nodes: layouted, dirty: true });
  };

  const handleExport = async () => {
    if (!workflowId) return;
    if (store.dirty) {
      const choice = confirm('Lưu rồi export? OK = Lưu, Cancel = Export bản đã lưu');
      if (choice) await handleSave();
    }
    const result = await exportWorkflows({
      workflowIds: [workflowId],
      includeAssets: true,
      format: 'zip',
    });
    await chromeDownload(result.blob, result.filename, true);
  };

  const onConnectEnd = useCallback(
    (
      event: MouseEvent | TouchEvent,
      connectionState: {
        isValid: boolean | null;
        fromNode?: { id: string } | null;
        fromHandle?: { id?: string | null; type?: string | null } | null;
        toNode?: { id: string } | null;
      },
    ) => {
      const state = useEditorStore.getState();
      if (connectionState.isValid || state.locked) return;
      if (!connectionState.fromNode) return;

      const { clientX, clientY } =
        'changedTouches' in event ? event.changedTouches[0]! : (event as MouseEvent);
      const flowPos = rf.screenToFlowPosition({ x: clientX, y: clientY });

      const hit = rf.getNodes().find((n) => {
        if (n.id === connectionState.fromNode!.id) return false;
        const w = n.measured?.width ?? (typeof n.width === 'number' ? n.width : 280);
        const h = n.measured?.height ?? (typeof n.height === 'number' ? n.height : 160);
        return (
          flowPos.x >= n.position.x &&
          flowPos.x <= n.position.x + w &&
          flowPos.y >= n.position.y &&
          flowPos.y <= n.position.y + h
        );
      });
      const dropNodeId = hit?.id ?? connectionState.toNode?.id ?? null;

      if (dropNodeId && dropNodeId !== connectionState.fromNode.id) {
        const fromHandle = connectionState.fromHandle;
        const partial =
          fromHandle?.type === 'target'
            ? {
                target: connectionState.fromNode.id,
                targetHandle: fromHandle?.id ?? null,
                source: null,
                sourceHandle: null,
              }
            : {
                source: connectionState.fromNode.id,
                sourceHandle: fromHandle?.id ?? null,
                target: null,
                targetHandle: null,
              };

        const resolved = resolveDropConnection(
          partial,
          dropNodeId,
          state.edges,
          (nodeId) => {
            const n = state.nodes.find((x) => x.id === nodeId);
            if (!n) return undefined;
            return getNodePorts(n.data.nodeType, n.data.data);
          },
          (nodeId) => state.nodes.find((x) => x.id === nodeId)?.data.nodeType,
        );

        if (resolved) {
          state.onConnect(resolved);
          return;
        }
      }

      const fromHandle = connectionState.fromHandle;
      if (fromHandle?.type === 'target') {
        state.setPickerOpen(true, flowPos, {
          source: '',
          sourceHandle: null,
          target: connectionState.fromNode.id,
          targetHandle: fromHandle?.id ?? null,
        } as Connection);
      } else {
        state.setPickerOpen(true, flowPos, {
          source: connectionState.fromNode.id,
          sourceHandle: fromHandle?.id ?? null,
          target: '',
          targetHandle: null,
        } as Connection);
      }
    },
    [rf],
  );

  const selected = store.nodes.find((n) => n.id === store.selectedNodeId);

  useEffect(() => {
    if (consoleOpen) {
      setUnseenErrors(0);
      return;
    }
    return subscribeLogs((entry) => {
      if (entry.level === 'error') setUnseenErrors((n) => n + 1);
    });
  }, [consoleOpen]);

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-3">
          <input
            className="bg-transparent text-sm font-semibold outline-none focus:ring-1 focus:ring-ring rounded px-1"
            value={store.name}
            disabled={store.locked}
            onChange={(e) => store.setName(e.target.value)}
          />
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Switch checked={store.enabled} onCheckedChange={store.setEnabled} disabled={store.locked} />
            Bật
          </label>
          {store.dirty && <span className="text-xs text-amber-400">{strings.dirty}</span>}
        </div>
        <div className="flex items-center gap-1.5">
          <label className="mr-2 flex items-center gap-1.5 text-xs">
            <Switch
              checked={false}
              onCheckedChange={async (v) => {
                await sendToSw({ type: 'settings.set', settings: { maxSpeed: v } });
              }}
            />
            {strings.maxSpeed}
          </label>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (confirm(strings.resetConfirm)) {
                store.nodes.forEach((n) => store.setNodeStatus(n.id, ''));
                store.setEdgeRunState('clear');
              }
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {strings.reset}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title={store.locked ? strings.unlock : strings.lock}
            onClick={() => store.setLocked(!store.locked)}
          >
            {store.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
          </Button>
          <Button
            size="sm"
            variant={store.dirty ? 'default' : 'secondary'}
            onClick={() => void handleSave()}
          >
            <Save className="h-3.5 w-3.5" />
            {strings.save}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => (store.dirty ? setCloseOpen(true) : window.close())}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="relative flex min-h-0 flex-1">
        {/* Left toolbar — toàn bộ node + công cụ */}
        <aside className="flex w-12 flex-col items-center gap-0.5 overflow-y-auto border-r border-border py-2">
          {listToolbarNodes().map((def) => {
            const Icon = def.icon;
            return (
              <ToolBtn
                key={def.type}
                title={def.title}
                onClick={() => {
                  const pos = rf.screenToFlowPosition({
                    x: window.innerWidth / 2,
                    y: window.innerHeight / 2,
                  });
                  store.addNode(def.type, pos);
                }}
              >
                {Icon ? <Icon className="h-4 w-4" /> : <span className="text-[10px]">{def.type[0]}</span>}
              </ToolBtn>
            );
          })}
          <div className="my-1 h-px w-7 bg-border" />
          <ToolBtn title={strings.selectTool} active={tool === 'select'} onClick={() => setTool('select')}>
            <MousePointer2 className="h-4 w-4" />
          </ToolBtn>
          <ToolBtn title={strings.panTool} active={tool === 'pan'} onClick={() => setTool('pan')}>
            <Hand className="h-4 w-4" />
          </ToolBtn>
          <div className="my-1 h-px w-7 bg-border" />
          <ToolBtn title={strings.run} onClick={() => void handleRun()}>
            <Play className="h-4 w-4 text-primary" />
          </ToolBtn>
          <ToolBtn
            title={strings.stopRun}
            onClick={() => void handleStop()}
            active={store.isRunning}
          >
            <Square className={cn('h-4 w-4', store.isRunning ? 'text-destructive' : 'text-muted-foreground')} />
          </ToolBtn>
          <ToolBtn title={strings.undo} onClick={() => temporal.getState().undo()}>
            <Undo2 className="h-4 w-4" />
          </ToolBtn>
          <ToolBtn title={strings.redo} onClick={() => temporal.getState().redo()}>
            <Redo2 className="h-4 w-4" />
          </ToolBtn>
          <ToolBtn title={strings.autoLayout} onClick={handleAutoLayout}>
            <LayoutGrid className="h-4 w-4" />
          </ToolBtn>
        </aside>

        {/* Canvas */}
        <div
          className="relative min-w-0 flex-1"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (!file) return;
            if (file.name.endsWith('.json') || file.name.includes('xflow')) {
              setDropChoice({
                file,
                position: rf.screenToFlowPosition({ x: e.clientX, y: e.clientY }),
              });
            }
          }}
        >
          <ReactFlow
            nodes={store.nodes}
            edges={store.edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultEdgeOptions={{ type: 'workflow', interactionWidth: 24 }}
            onNodesChange={store.onNodesChange}
            onEdgesChange={store.onEdgesChange}
            onConnect={store.onConnect}
            isValidConnection={(c) => store.isValidConn(c as Connection)}
            onConnectEnd={onConnectEnd as never}
            connectionRadius={40}
            onNodeClick={(_, n) => store.setSelectedNodeId(n.id)}
            onEdgeClick={(_, edge) => {
              if (store.locked) return;
              store.removeEdge(edge.id);
            }}
            onEdgeDoubleClick={(_, edge) => {
              if (store.locked) return;
              store.removeEdge(edge.id);
            }}
            onPaneClick={() => {
              store.setSelectedNodeId(null);
              store.setPickerOpen(false);
            }}
            onMoveEnd={(_, v) => store.setViewport(v)}
            fitView
            panOnDrag={tool === 'pan' ? true : [1, 2]}
            selectionOnDrag={tool === 'select'}
            selectNodesOnDrag={false}
            nodesDraggable={!store.locked}
            nodesConnectable={!store.locked}
            elementsSelectable={!store.locked}
            edgesFocusable={!store.locked}
            edgesReconnectable={false}
            elevateEdgesOnSelect
            deleteKeyCode={store.locked ? null : ['Backspace', 'Delete']}
            className="dot-grid"
          >
            <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="#334155" />
            <MiniMap
              className="!bg-card !border-border"
              maskColor="rgb(15 23 42 / 0.7)"
              nodeColor="#84cc16"
            />
            <Controls className="!bg-card !border-border !shadow-none" showInteractive={false} />
          </ReactFlow>

          <NodePicker
            open={store.pickerOpen}
            style={{
              left: 60,
              top: 60,
            }}
            onClose={() => store.setPickerOpen(false)}
            onSelect={(type: NodeType) => {
              const pos = store.pickerPosition ?? { x: 200, y: 200 };
              store.addNode(type, pos, store.pendingConnection);
            }}
          />

          {/* Bottom bar */}
          <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-end justify-between">
            <div className="pointer-events-auto flex items-center gap-1 rounded-md border border-border bg-card/95 p-1 shadow">
              <Button variant="ghost" size="icon" onClick={() => rf.zoomIn()}>
                <ZoomIn className="h-4 w-4" />
              </Button>
              <span className="w-12 text-center text-xs">{Math.round(store.viewport.zoom * 100)}%</span>
              <Button variant="ghost" size="icon" onClick={() => rf.zoomOut()}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => rf.fitView({ padding: 0.2 })}>
                {strings.fitView}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => void handleExport()}>
                <Download className="h-3.5 w-3.5" />
                {strings.export}
              </Button>
              <div className="mx-0.5 h-5 w-px bg-border" />
              <Button
                variant={consoleOpen ? 'secondary' : 'ghost'}
                size="sm"
                className="relative"
                title="Console debug (Ctrl+`)"
                onClick={() => toggleConsole()}
              >
                <TerminalSquare className="h-3.5 w-3.5" />
                Console
                {!consoleOpen && unseenErrors > 0 && (
                  <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-destructive px-1 text-[9px] font-semibold leading-4 text-destructive-foreground">
                    {unseenErrors > 99 ? '99+' : unseenErrors}
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Inspector — chỉ hiện khi chọn node */}
        {selected && (
          <aside className="flex w-72 flex-col border-l border-border">
            <div className="border-b border-border px-3 py-2 text-xs font-semibold">
              {strings.inspectorTitle}
            </div>
            <div className="flex-1 overflow-auto p-3 text-xs">
              <Inspector node={selected} />
            </div>
          </aside>
        )}
      </div>
      <DebugConsole open={consoleOpen} onClose={() => toggleConsole(false)} />
      </div>

      {/* Close dirty */}
      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{strings.closeDirtyTitle}</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2">
            <Button
              onClick={async () => {
                await handleSave();
                window.close();
              }}
            >
              {strings.closeDirtySave}
            </Button>
            <Button variant="secondary" onClick={() => window.close()}>
              {strings.closeDirtyDiscard}
            </Button>
            <Button variant="ghost" onClick={() => setCloseOpen(false)}>
              {strings.closeDirtyCancel}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Restore draft */}
      <Dialog open={draftOpen} onOpenChange={setDraftOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{strings.restoreDraftTitle}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{strings.restoreDraftBody}</p>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                const draft = (window as unknown as { __draft?: { workflow: import('@/shared/schema').Workflow } })
                  .__draft;
                if (draft) store.loadWorkflow(draft.workflow);
                setDraftOpen(false);
              }}
            >
              {strings.restoreDraftYes}
            </Button>
            <Button variant="secondary" onClick={() => setDraftOpen(false)}>
              {strings.restoreDraftNo}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Drop xflow on canvas */}
      <Dialog open={!!dropChoice} onOpenChange={(o) => !o && setDropChoice(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{strings.importDropCanvas}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button
              onClick={async () => {
                if (!dropChoice) return;
                const preview = await parseImportFile(dropChoice.file);
                const item = preview.items[0];
                if (!item || !workspaceIdRef.current) return;
                const { commitImport } = await import('@/storage/transfer');
                const created = await commitImport({
                  preview,
                  targetWorkspaceId: workspaceIdRef.current,
                  dupStrategy: 'copy',
                });
                if (created[0]) {
                  chrome.runtime.sendMessage({ type: 'editor.open', workflowId: created[0].id });
                }
                setDropChoice(null);
              }}
            >
              {strings.importOpenNew}
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                if (!dropChoice) return;
                const preview = await parseImportFile(dropChoice.file);
                const item = preview.items[0];
                if (!item) return;
                const existingSlugs = new Set(
                  store.nodes.map((n) => n.data.slug).filter(Boolean) as string[],
                );
                const { nodes, edges } = remapInsertNodes(item.workflow, existingSlugs);
                const offset = dropChoice.position;
                for (const n of nodes) {
                  useEditorStore.setState((s) => ({
                    nodes: [
                      ...s.nodes,
                      {
                        id: n.id,
                        type: n.type === 'note' ? 'note' : 'workflow',
                        position: { x: n.position.x + offset.x, y: n.position.y + offset.y },
                        data: {
                          nodeType: n.type,
                          label: n.label,
                          slug: n.slug,
                          data: n.data as Record<string, unknown>,
                        },
                      },
                    ],
                    dirty: true,
                  }));
                }
                useEditorStore.setState((s) => ({
                  edges: [
                    ...s.edges,
                    ...edges.map((e) => ({
                      id: e.id,
                      type: 'workflow' as const,
                      source: e.source,
                      target: e.target,
                      sourceHandle: e.sourceHandle,
                      targetHandle: e.targetHandle,
                    })),
                  ],
                  dirty: true,
                }));
                setDropChoice(null);
              }}
            >
              {strings.importInsert}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Inspector({ node }: { node: FlowNode }) {
  const update = useEditorStore((s) => s.updateNodeData);
  const nodes = useEditorStore((s) => s.nodes);
  const edges = useEditorStore((s) => s.edges);
  const d = node.data.data;
  const incoming = useMemo(
    () => resolveIncomingItems(node.id, nodes, edges),
    [node, nodes, edges],
  );
  const showInputs =
    isMediaCapableNode(node.data.nodeType) ||
    node.data.nodeType === 'autoDownload' ||
    incoming.length > 0;

  const promptOutput = useMemo(
    () => (node.data.nodeType === 'prompt' ? computePromptPreview(node.id, nodes, edges).text : ''),
    [node.id, node.data.nodeType, nodes, edges],
  );

  return (
    <div className="space-y-3">
      <div className="font-medium">{node.data.label ?? node.data.nodeType}</div>

      {showInputs && (
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Inputs & references
          </div>
          <IncomingInputsDetail items={incoming} />
        </div>
      )}

      {(node.data.slug != null || node.data.nodeType === 'asset') && (
        <label className="block space-y-1">
          <span className="text-muted-foreground">Slug</span>
          <input
            className="w-full rounded border border-input bg-background px-2 py-1"
            value={node.data.slug ?? ''}
            onChange={(e) => {
              const slug = e.target.value.replace(/^@/, '');
              useEditorStore.setState((s) => ({
                nodes: s.nodes.map((n) =>
                  n.id === node.id ? { ...n, data: { ...n.data, slug } } : n,
                ),
                dirty: true,
              }));
              update(node.id, { slug });
            }}
          />
        </label>
      )}

      {node.data.nodeType === 'asset' && (
        <>
          <SelectField
            label={strings.assetLabel}
            value={(d.assetLabel as string) ?? 'Character'}
            options={[...ASSET_LABELS]}
            onChange={(v) =>
              update(node.id, {
                assetLabel: v,
                kind: defaultKindForLabel(v as import('@/shared/schema').AssetLabel),
              })
            }
          />
          <SelectField
            label="Kind"
            value={(d.kind as string) ?? 'image'}
            options={['image', 'video', 'audio']}
            onChange={(v) => update(node.id, { kind: v })}
          />
        </>
      )}

      {node.data.nodeType === 'prompt' && (
        <>
          <SelectField
            label="Preset"
            value={(d.preset as string) ?? 'custom'}
            options={[
              'custom',
              'enhance',
              'analyzeImage',
              'script',
              'summarize',
              'translate',
              'brainstorm',
            ]}
            onChange={(v) => update(node.id, { preset: v })}
          />
          <label className="block space-y-1">
            <span className="text-muted-foreground">Instruction</span>
            <textarea
              className="h-[200px] w-full max-w-[500px] resize-y rounded border border-input bg-background px-2 py-1 text-sm"
              value={(d.instruction as string) ?? ''}
              onChange={(e) => update(node.id, { instruction: e.target.value })}
              placeholder="nhân vật [Character] đang mặc một [Outfit]"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-muted-foreground">Output</span>
            <textarea
              readOnly
              className="h-[200px] w-full max-w-[500px] resize-y rounded border border-input bg-muted/40 px-2 py-1 font-mono text-xs leading-relaxed"
              value={promptOutput}
              placeholder="Instruction + prompt nối từ các node Prompt phía trước; [Label] giữ nguyên, chú thích URL ở cuối"
            />
          </label>
        </>
      )}

      {node.data.nodeType === 'generateImage' && (
        <>
          <label className="block space-y-1">
            <span className="text-muted-foreground">Prompt</span>
            <textarea
              className="h-[200px] w-full max-w-[500px] resize-y rounded border border-input bg-background px-2 py-1 text-sm"
              value={(d.prompt as string) ?? ''}
              onChange={(e) => update(node.id, { prompt: e.target.value })}
              placeholder="Prompt để generate…"
            />
          </label>
          <SelectField
            label={strings.model}
            value={normalizeModelLabel(d.model as string | undefined, DEFAULT_IMAGE_MODEL)}
            options={[...IMAGE_MODELS]}
            onChange={(v) => update(node.id, { model: v })}
          />
          <SelectField
            label={strings.aspectRatio}
            value={(d.aspectRatio as string) ?? '9:16'}
            options={[...ASPECT_RATIOS]}
            onChange={(v) => update(node.id, { aspectRatio: v })}
          />
          <SelectField
            label={strings.outputCount}
            value={String(d.count ?? 1)}
            options={['1', '2', '3', '4']}
            onChange={(v) => update(node.id, { count: Number(v) })}
          />
          <SelectField
            label={strings.resolution}
            value={String(d.resolution ?? 720)}
            options={RESOLUTIONS.map(String)}
            onChange={(v) => update(node.id, { resolution: Number(v) })}
          />
        </>
      )}

      {node.data.nodeType === 'generateVideo' && (
        <>
          <label className="block space-y-1">
            <span className="text-muted-foreground">Prompt</span>
            <textarea
              className="h-[200px] w-full max-w-[500px] resize-y rounded border border-input bg-background px-2 py-1 text-sm"
              value={(d.prompt as string) ?? ''}
              onChange={(e) => update(node.id, { prompt: e.target.value })}
              placeholder="Prompt để generate…"
            />
          </label>
          <SelectField
            label={strings.model}
            value={normalizeModelLabel(d.model as string | undefined, DEFAULT_VIDEO_MODEL)}
            options={[...VIDEO_MODELS]}
            onChange={(v) => update(node.id, { model: v })}
          />
          <SelectField
            label={strings.aspectRatio}
            value={(d.aspectRatio as string) ?? '9:16'}
            options={[...ASPECT_RATIOS]}
            onChange={(v) => update(node.id, { aspectRatio: v })}
          />
          <SelectField
            label={strings.outputCount}
            value={String(d.count ?? 1)}
            options={['1', '2', '3', '4']}
            onChange={(v) => update(node.id, { count: Number(v) })}
          />
          <SelectField
            label={strings.resolution}
            value={String(d.resolution ?? 720)}
            options={RESOLUTIONS.map(String)}
            onChange={(v) => update(node.id, { resolution: Number(v) })}
          />
          <SelectField
            label={strings.durationSec}
            value={String(d.durationSec ?? 4)}
            options={VIDEO_DURATIONS.map(String)}
            onChange={(v) => update(node.id, { durationSec: Number(v) })}
          />
        </>
      )}

      {node.data.nodeType === 'autoDownload' && (
        <>
          <label className="block space-y-1">
            <span className="text-muted-foreground">Folder</span>
            <input
              className="w-full rounded border border-input bg-background px-2 py-1"
              value={(d.folderTemplate as string) ?? ''}
              onChange={(e) => update(node.id, { folderTemplate: e.target.value })}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-muted-foreground">Filename</span>
            <input
              className="w-full rounded border border-input bg-background px-2 py-1"
              value={(d.filenameTemplate as string) ?? ''}
              onChange={(e) => update(node.id, { filenameTemplate: e.target.value })}
            />
          </label>
        </>
      )}
    </div>
  );
}

function SelectField(props: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-muted-foreground">{props.label}</span>
      <select
        className="w-full rounded border border-input bg-background px-2 py-1"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      >
        {props.options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToolBtn(props: {
  children: React.ReactNode;
  title: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      title={props.title}
      onClick={props.onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-md ${
        props.active ? 'bg-muted text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      {props.children}
    </button>
  );
}

function tagIsEditable(target: EventTarget | null) {
  const tag = (target as HTMLElement | null)?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || (target as HTMLElement)?.isContentEditable;
}

export function EditorApp() {
  return (
    <ReactFlowProvider>
      <EditorInner />
    </ReactFlowProvider>
  );
}
