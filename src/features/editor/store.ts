import { create } from 'zustand';
import { temporal } from 'zundo';
import type {
  Node,
  Edge,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  Connection,
  Viewport,
} from '@xyflow/react';
import { applyNodeChanges, applyEdgeChanges, addEdge } from '@xyflow/react';
import type { Workflow, WorkflowNode, NodeType } from '@/shared/schema';
import { getNodeDef, getNodePorts } from '@/nodes/registry';
import { isValidConnection, PORT_COLORS, sourceAllowed } from '@/nodes/ports';
import { nanoid } from '@/shared/utils';
import { makeSlug } from '@/engine/resolver';
import { writeLog, type LogLevel } from '@/shared/log';

export type FlowNode = Node<{
  nodeType: NodeType;
  label?: string;
  slug?: string;
  data: Record<string, unknown>;
  status?: string;
  progress?: number;
  statusMessage?: string;
  error?: string;
  locked?: boolean;
}>;

export type FlowEdge = Edge;

interface EditorState {
  workflowId: string | null;
  name: string;
  enabled: boolean;
  locked: boolean;
  dirty: boolean;
  /** Node ids whose data the editor has edited since last save. */
  dirtyNodeIds: Set<string>;
  /** True if the user edited the workflow name since last save. */
  nameDirty: boolean;
  /** Last workflow.updatedAt applied from DB (load / external sync / save). */
  lastSyncedAt: number;
  settings: Workflow['settings'];
  nodes: FlowNode[];
  edges: FlowEdge[];
  viewport: Viewport;
  selectedNodeId: string | null;
  pickerOpen: boolean;
  pickerPosition: { x: number; y: number } | null;
  pendingConnection: Connection | null;
  activeRunId: string | null;
  isRunning: boolean;

  loadWorkflow: (wf: Workflow) => void;
  applyExternalWorkflow: (wf: Workflow) => void;
  setName: (name: string) => void;
  setEnabled: (v: boolean) => void;
  setLocked: (v: boolean) => void;
  markSaved: () => void;
  markDirty: () => void;
  onNodesChange: OnNodesChange<FlowNode>;
  onEdgesChange: OnEdgesChange<FlowEdge>;
  onConnect: OnConnect;
  isValidConn: (c: Connection | Edge) => boolean;
  addNode: (type: NodeType, position: { x: number; y: number }, connectFrom?: Connection | null) => void;
  updateNodeData: (id: string, data: Record<string, unknown>) => void;
  /** Runtime-only node data (preview, etc.) — does not mark the workflow dirty. */
  setNodePreview: (id: string, outputId: string) => void;
  /** Runtime SW `node.data` patch — no dirty / dirtyNodeIds. */
  applyRuntimeNodeData: (id: string, data: Record<string, unknown>) => void;
  removeEdgeToSource: (targetId: string, sourceId: string, edgeId?: string) => void;
  removeEdge: (edgeId: string) => void;
  setViewport: (v: Viewport) => void;
  setSelectedNodeId: (id: string | null) => void;
  setPickerOpen: (open: boolean, pos?: { x: number; y: number } | null, conn?: Connection | null) => void;
  toWorkflow: () => Workflow | null;
  /** Writes to the shared debug console (scope `ui`). */
  pushLog: (message: string, nodeId?: string, level?: LogLevel) => void;
  setNodeStatus: (nodeId: string, status: string, progress?: number, error?: string, message?: string) => void;
  setEdgeRunState: (activeNodeIds: Set<string> | 'clear') => void;
  setActiveRun: (runId: string | null, running?: boolean) => void;
}

function wfNodeToFlow(n: WorkflowNode, locked?: boolean): FlowNode {
  return {
    id: n.id,
    type: n.type === 'note' ? 'note' : 'workflow',
    position: n.position,
    data: {
      nodeType: n.type,
      label: n.label,
      slug: n.slug ?? (n.data as { slug?: string }).slug,
      data: n.data as Record<string, unknown>,
      locked,
    },
    style: n.size ? { width: n.size.w, height: n.size.h } : undefined,
  };
}

function flowToWfNode(n: FlowNode): WorkflowNode {
  return {
    id: n.id,
    type: n.data.nodeType,
    slug: n.data.slug,
    label: n.data.label,
    position: n.position,
    size: n.style?.width
      ? { w: Number(n.style.width), h: Number(n.style.height ?? 0) }
      : undefined,
    data: n.data.data,
    disabled: undefined,
  };
}

export const useEditorStore = create<EditorState>()(
  temporal(
    (set, get) => ({
      workflowId: null,
      name: '',
      enabled: false,
      locked: false,
      dirty: false,
      dirtyNodeIds: new Set<string>(),
      nameDirty: false,
      lastSyncedAt: 0,
      settings: { concurrency: 1, retry: 2, stopOnError: true },
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 0.8 },
      selectedNodeId: null,
      pickerOpen: false,
      pickerPosition: null,
      pendingConnection: null,
      activeRunId: null,
      isRunning: false,

      loadWorkflow: (wf) => {
        set({
          workflowId: wf.id,
          name: wf.name,
          enabled: wf.enabled,
          locked: wf.locked,
          dirty: false,
          dirtyNodeIds: new Set(),
          nameDirty: false,
          lastSyncedAt: wf.updatedAt,
          settings: wf.settings,
          nodes: wf.nodes.map((n) => wfNodeToFlow(n, wf.locked)),
          edges: wf.edges.map((e) => ({
            id: e.id,
            type: 'workflow',
            source: e.source,
            target: e.target,
            sourceHandle: e.sourceHandle,
            targetHandle: e.targetHandle,
            style: { stroke: PORT_COLORS[e.type] },
            data: { portType: e.type },
          })),
          viewport: wf.viewport,
          activeRunId: null,
          isRunning: false,
        });
      },

      applyExternalWorkflow: (wf) => {
        const s = get();
        if (wf.updatedAt <= s.lastSyncedAt) return;

        const temporalApi = useEditorStore.temporal.getState();
        temporalApi.pause();
        try {
          const byId = new Map(wf.nodes.map((n) => [n.id, n]));
          const nodes = s.nodes.map((n) => {
            const lockedData = { ...n.data, locked: wf.locked };
            if (s.dirtyNodeIds.has(n.id)) {
              return { ...n, data: lockedData };
            }
            const ext = byId.get(n.id);
            if (!ext) {
              return { ...n, data: lockedData };
            }
            return {
              ...n,
              data: {
                ...lockedData,
                label: ext.label,
                slug: ext.slug ?? n.data.slug,
                data: ext.data as Record<string, unknown>,
              },
            };
          });
          set({
            nodes,
            name: s.nameDirty ? s.name : wf.name,
            locked: wf.locked,
            lastSyncedAt: wf.updatedAt,
          });
        } finally {
          temporalApi.resume();
        }
      },

      setName: (name) => set({ name, dirty: true, nameDirty: true }),
      setEnabled: (enabled) => set({ enabled, dirty: true }),
      setLocked: (locked) =>
        set({
          locked,
          dirty: true,
          nodes: get().nodes.map((n) => ({ ...n, data: { ...n.data, locked } })),
        }),
      markSaved: () => set({ dirty: false, dirtyNodeIds: new Set(), nameDirty: false }),
      markDirty: () => set({ dirty: true }),

      onNodesChange: (changes) => {
        if (get().locked) {
          const allowed = changes.filter((c) => c.type === 'select' || c.type === 'dimensions');
          if (!allowed.length) return;
          set({ nodes: applyNodeChanges(allowed, get().nodes) });
          return;
        }
        set({ nodes: applyNodeChanges(changes, get().nodes), dirty: true });
      },

      onEdgesChange: (changes) => {
        if (get().locked) return;
        const next = applyEdgeChanges(changes, get().edges);
        const removesSelectionOnly = changes.every((c) => c.type === 'select');
        set({ edges: next, dirty: removesSelectionOnly ? get().dirty : true });
      },

      onConnect: (connection) => {
        if (get().locked) return;
        if (!get().isValidConn(connection)) return;
        const src = get().nodes.find((n) => n.id === connection.source);
        const ports = src ? getNodePorts(src.data.nodeType, src.data.data) : null;
        const out = ports?.outputs.find((p) => p.id === connection.sourceHandle);
        const portType = out?.type ?? 'any';
        set({
          edges: addEdge(
            {
              ...connection,
              id: nanoid(),
              type: 'workflow',
              style: { stroke: PORT_COLORS[portType] },
              data: { portType },
            },
            get().edges,
          ),
          dirty: true,
        });
      },

      isValidConn: (c) => {
        return isValidConnection(
          c,
          get().edges,
          (nodeId) => {
            const n = get().nodes.find((x) => x.id === nodeId);
            if (!n) return undefined;
            return getNodePorts(n.data.nodeType, n.data.data);
          },
          (nodeId) => get().nodes.find((x) => x.id === nodeId)?.data.nodeType,
        );
      },

      addNode: (type, position, connectFrom) => {
        if (get().locked) return;
        const def = getNodeDef(type);
        const id = nanoid();
        const existingSlugs = new Set(
          get()
            .nodes.map((n) => n.data.slug)
            .filter(Boolean) as string[],
        );
        let slug: string | undefined;
        if (type === 'asset') {
          slug = makeSlug('asset', existingSlugs);
        }
        const data = { ...def.defaultData(), ...(slug ? { slug } : {}) } as Record<string, unknown>;
        const node: FlowNode = {
          id,
          type: type === 'note' ? 'note' : 'workflow',
          position,
          data: {
            nodeType: type,
            label: def.title,
            slug,
            data,
          },
        };
        let edges = get().edges;
        const typeOf = (nodeId: string) => get().nodes.find((n) => n.id === nodeId)?.data.nodeType;
        if (
          connectFrom?.source &&
          connectFrom.sourceHandle &&
          sourceAllowed(typeOf(connectFrom.source), type)
        ) {
          const ports = getNodePorts(type, data);
          const targetHandle =
            ports.inputs.find((p) => {
              const srcNode = get().nodes.find((n) => n.id === connectFrom.source);
              if (!srcNode) return false;
              const srcPorts = getNodePorts(srcNode.data.nodeType, srcNode.data.data);
              const out = srcPorts.outputs.find((o) => o.id === connectFrom.sourceHandle);
              return out && (p.type === out.type || p.type === 'any');
            })?.id ?? ports.inputs[0]?.id;
          if (targetHandle) {
            const srcNode = get().nodes.find((n) => n.id === connectFrom.source);
            const srcPorts = srcNode
              ? getNodePorts(srcNode.data.nodeType, srcNode.data.data)
              : null;
            const out = srcPorts?.outputs.find((o) => o.id === connectFrom.sourceHandle);
            const portType = out?.type ?? 'any';
            edges = addEdge(
              {
                id: nanoid(),
                type: 'workflow',
                source: connectFrom.source,
                sourceHandle: connectFrom.sourceHandle,
                target: id,
                targetHandle,
                style: { stroke: PORT_COLORS[portType] },
                data: { portType },
              },
              edges,
            );
          }
        } else if (
          connectFrom?.target &&
          connectFrom.targetHandle &&
          sourceAllowed(type, typeOf(connectFrom.target))
        ) {
          const ports = getNodePorts(type, data);
          const tgtNode = get().nodes.find((n) => n.id === connectFrom.target);
          const tgtPorts = tgtNode
            ? getNodePorts(tgtNode.data.nodeType, tgtNode.data.data)
            : null;
          const inPort = tgtPorts?.inputs.find((p) => p.id === connectFrom.targetHandle);
          const sourceHandle =
            ports.outputs.find(
              (p) => inPort && (p.type === inPort.type || inPort.type === 'any' || p.type === 'any'),
            )?.id ?? ports.outputs[0]?.id;
          if (sourceHandle && inPort) {
            const out = ports.outputs.find((o) => o.id === sourceHandle);
            const portType = out?.type ?? 'any';
            edges = addEdge(
              {
                id: nanoid(),
                type: 'workflow',
                source: id,
                sourceHandle,
                target: connectFrom.target,
                targetHandle: connectFrom.targetHandle,
                style: { stroke: PORT_COLORS[portType] },
                data: { portType },
              },
              edges,
            );
          }
        }
        set({
          nodes: [...get().nodes, node],
          edges,
          dirty: true,
          pickerOpen: false,
          pendingConnection: null,
          selectedNodeId: id,
        });
      },

      updateNodeData: (id, data) => {
        const dirtyNodeIds = new Set(get().dirtyNodeIds);
        dirtyNodeIds.add(id);
        set({
          nodes: get().nodes.map((n) =>
            n.id === id
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    data: { ...n.data.data, ...data },
                    slug: (data.slug as string | undefined) ?? n.data.slug,
                    label: (data.label as string | undefined) ?? n.data.label,
                  },
                }
              : n,
          ),
          dirty: true,
          dirtyNodeIds,
        });
      },

      setNodePreview: (id, outputId) => {
        set({
          nodes: get().nodes.map((n) =>
            n.id === id
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    data: {
                      ...n.data.data,
                      previewOutputId: outputId,
                      previewRev: Date.now(),
                    },
                  },
                }
              : n,
          ),
        });
      },

      applyRuntimeNodeData: (id, data) => {
        set({
          nodes: get().nodes.map((n) =>
            n.id === id
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    data: { ...n.data.data, ...data },
                  },
                }
              : n,
          ),
        });
      },

      removeEdgeToSource: (targetId, sourceId, edgeId) => {
        set({
          edges: get().edges.filter((e) => {
            if (edgeId) return e.id !== edgeId;
            return !(e.target === targetId && e.source === sourceId);
          }),
          dirty: true,
        });
      },

      removeEdge: (edgeId) => {
        if (get().locked) return;
        set({
          edges: get().edges.filter((e) => e.id !== edgeId),
          dirty: true,
        });
      },

      setViewport: (viewport) => set({ viewport, dirty: true }),
      setSelectedNodeId: (selectedNodeId) => set({ selectedNodeId }),
      setPickerOpen: (pickerOpen, pickerPosition = null, pendingConnection = null) =>
        set({ pickerOpen, pickerPosition, pendingConnection }),

      toWorkflow: () => {
        const s = get();
        if (!s.workflowId) return null;
        return {
          id: s.workflowId,
          schemaVersion: 1,
          workspaceId: '', // filled by caller
          name: s.name,
          enabled: s.enabled,
          locked: s.locked,
          nodes: s.nodes.map(flowToWfNode),
          edges: s.edges.map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            sourceHandle: e.sourceHandle ?? '',
            targetHandle: e.targetHandle ?? '',
            type: (e.data as { portType?: string })?.portType as never ?? 'any',
          })),
          viewport: {
            x: s.viewport.x,
            y: s.viewport.y,
            zoom: s.viewport.zoom,
          },
          settings: s.settings,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
      },

      pushLog: (message, nodeId, level = 'info') =>
        void writeLog(level, 'ui', message, undefined, { nodeId, runId: get().activeRunId ?? undefined }),

      setNodeStatus: (nodeId, status, progress, error, message) =>
        set({
          nodes: get().nodes.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    status,
                    progress,
                    statusMessage:
                      status === 'running'
                        ? (message ?? n.data.statusMessage)
                        : status === '' || status === 'queued'
                          ? undefined
                          : n.data.statusMessage,
                    error:
                      status === 'error'
                        ? (error ?? n.data.error)
                        : status === '' || status === 'queued' || status === 'running'
                          ? undefined
                          : n.data.error,
                  },
                }
              : n,
          ),
        }),

      setActiveRun: (runId, running) =>
        set({
          activeRunId: runId,
          isRunning: running ?? !!runId,
        }),

      setEdgeRunState: (activeNodeIds) => {
        if (activeNodeIds === 'clear') {
          set({
            edges: get().edges.map((e) => ({
              ...e,
              animated: false,
              className: undefined,
              style: {
                ...e.style,
                stroke: PORT_COLORS[(e.data as { portType?: string })?.portType as keyof typeof PORT_COLORS] ?? e.style?.stroke,
                strokeWidth: 2,
              },
            })),
          });
          return;
        }
        set({
          edges: get().edges.map((e) => {
            const active = activeNodeIds.has(e.target) || activeNodeIds.has(e.source);
            const portType = (e.data as { portType?: string })?.portType as keyof typeof PORT_COLORS | undefined;
            const stroke = PORT_COLORS[portType ?? 'any'] ?? '#9ca3af';
            return {
              ...e,
              animated: active,
              className: active ? 'edge-running' : undefined,
              style: {
                ...e.style,
                stroke,
                strokeWidth: active ? 3 : 2,
              },
            };
          }),
        });
      },
    }),
    {
      limit: 50,
      partialize: (state) => {
        const { dirtyNodeIds: _d, lastSyncedAt: _l, nameDirty: _n, ...rest } = state;
        return rest;
      },
    },
  ),
);
