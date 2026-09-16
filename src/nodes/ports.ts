import type { PortType, NodeType } from '@/shared/schema';
import type { Connection, Edge } from '@xyflow/react';

export interface PortSpec {
  id: string;
  type: PortType;
  label?: string;
  maxConnections?: number;
  required?: boolean;
}

export const PORT_COLORS: Record<PortType, string> = {
  text: '#a78bfa',
  image: '#60a5fa',
  video: '#4ade80',
  audio: '#f472b6',
  any: '#9ca3af',
};

export const PORT_ICONS: Record<PortType, string> = {
  text: 'T',
  image: '🖼',
  video: '🎥',
  audio: '🔊',
  any: '⬇',
};

export function portsCompatible(sourceType: PortType, targetType: PortType): boolean {
  if (targetType === 'any' || sourceType === 'any') return true;
  return sourceType === targetType;
}

export function wouldCreateCycle(
  edges: { source: string; target: string }[],
  source: string,
  target: string,
): boolean {
  if (source === target) return true;
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    const list = adj.get(e.source) ?? [];
    list.push(e.target);
    adj.set(e.source, list);
  }
  const list = adj.get(source) ?? [];
  list.push(target);
  adj.set(source, list);

  const visited = new Set<string>();
  const stack = [target];
  while (stack.length) {
    const n = stack.pop()!;
    if (n === source) return true;
    if (visited.has(n)) continue;
    visited.add(n);
    for (const next of adj.get(n) ?? []) stack.push(next);
  }
  return false;
}

export function countConnections(
  edges: Edge[],
  nodeId: string,
  handle: string,
  direction: 'in' | 'out',
): number {
  return edges.filter((e) =>
    direction === 'in'
      ? e.target === nodeId && e.targetHandle === handle
      : e.source === nodeId && e.sourceHandle === handle,
  ).length;
}

/**
 * Which node types may feed which. Asset → Prompt/Generate; Prompt → Prompt
 * (concatenate) / Generate; Generate Video → Prompt (next scene); clip/asset →
 * Merge Video; generated media → Auto Download.
 */
export const ALLOWED_SOURCES: Partial<Record<NodeType, readonly NodeType[]>> = {
  prompt: ['asset', 'prompt', 'generateImage', 'generateVideo'],
  generateImage: ['asset', 'prompt'],
  generateVideo: ['asset', 'prompt'],
  mergeVideo: ['asset', 'generateImage', 'generateVideo', 'mergeVideo'],
  autoDownload: ['generateImage', 'generateVideo', 'mergeVideo'],
};

export function sourceAllowed(sourceType: NodeType | undefined, targetType: NodeType | undefined): boolean {
  if (!sourceType || !targetType) return true;
  const allowed = ALLOWED_SOURCES[targetType];
  return !allowed || allowed.includes(sourceType);
}

export function isValidConnection(
  connection: Connection | Edge,
  edges: Edge[],
  getPorts: (nodeId: string) => { inputs: PortSpec[]; outputs: PortSpec[] } | undefined,
  getNodeType?: (nodeId: string) => NodeType | undefined,
): boolean {
  const source = connection.source;
  const target = connection.target;
  const sourceHandle = connection.sourceHandle;
  const targetHandle = connection.targetHandle;
  if (!source || !target || !sourceHandle || !targetHandle) return false;
  if (source === target) return false;
  if (getNodeType && !sourceAllowed(getNodeType(source), getNodeType(target))) return false;

  const srcPorts = getPorts(source);
  const tgtPorts = getPorts(target);
  if (!srcPorts || !tgtPorts) return false;

  const outPort = srcPorts.outputs.find((p) => p.id === sourceHandle);
  const inPort = tgtPorts.inputs.find((p) => p.id === targetHandle);
  if (!outPort || !inPort) return false;
  if (!portsCompatible(outPort.type, inPort.type)) return false;

  if (inPort.maxConnections != null) {
    const count = countConnections(edges as Edge[], target, targetHandle, 'in');
    const already = edges.some(
      (e) =>
        e.source === source &&
        e.target === target &&
        e.sourceHandle === sourceHandle &&
        e.targetHandle === targetHandle,
    );
    if (!already && count >= inPort.maxConnections) return false;
  }

  if (wouldCreateCycle(edges, source, target)) return false;
  return true;
}

/** Prefer exact type match, then `any`, then first compatible with free capacity. */
export function pickCompatiblePort(
  ports: PortSpec[],
  peerType: PortType,
  edges: Edge[],
  nodeId: string,
  direction: 'in' | 'out',
): PortSpec | undefined {
  const compatible = ports.filter((p) =>
    direction === 'in' ? portsCompatible(peerType, p.type) : portsCompatible(p.type, peerType),
  );
  const withCapacity = compatible.filter((p) => {
    if (p.maxConnections == null) return true;
    return countConnections(edges, nodeId, p.id, direction) < p.maxConnections;
  });
  if (!withCapacity.length) return undefined;
  return (
    withCapacity.find((p) => p.type === peerType) ??
    withCapacity.find((p) => p.type === 'any') ??
    withCapacity[0]
  );
}

/**
 * When the user drops a connection on a node body (not a handle),
 * resolve source/target handles by port type.
 */
export function resolveDropConnection(
  partial: {
    source?: string | null;
    target?: string | null;
    sourceHandle?: string | null;
    targetHandle?: string | null;
  },
  dropNodeId: string,
  edges: Edge[],
  getPorts: (nodeId: string) => { inputs: PortSpec[]; outputs: PortSpec[] } | undefined,
  getNodeType?: (nodeId: string) => NodeType | undefined,
): Connection | null {
  const fromId = partial.source ?? null;
  const fromHandle = partial.sourceHandle ?? null;
  // Dragging from a source handle → drop on target node
  if (fromId && fromHandle && !partial.target) {
    if (fromId === dropNodeId) return null;
    const srcPorts = getPorts(fromId);
    const tgtPorts = getPorts(dropNodeId);
    if (!srcPorts || !tgtPorts) return null;
    const outPort = srcPorts.outputs.find((p) => p.id === fromHandle);
    if (!outPort) return null;
    const inPort = pickCompatiblePort(tgtPorts.inputs, outPort.type, edges, dropNodeId, 'in');
    if (!inPort) return null;
    const conn: Connection = {
      source: fromId,
      sourceHandle: fromHandle,
      target: dropNodeId,
      targetHandle: inPort.id,
    };
    return isValidConnection(conn, edges, getPorts, getNodeType) ? conn : null;
  }

  // Dragging from a target handle → drop on source node
  const toId = partial.target ?? null;
  const toHandle = partial.targetHandle ?? null;
  if (toId && toHandle && !partial.source) {
    if (toId === dropNodeId) return null;
    const srcPorts = getPorts(dropNodeId);
    const tgtPorts = getPorts(toId);
    if (!srcPorts || !tgtPorts) return null;
    const inPort = tgtPorts.inputs.find((p) => p.id === toHandle);
    if (!inPort) return null;
    const outPort = pickCompatiblePort(srcPorts.outputs, inPort.type, edges, dropNodeId, 'out');
    if (!outPort) return null;
    const conn: Connection = {
      source: dropNodeId,
      sourceHandle: outPort.id,
      target: toId,
      targetHandle: toHandle,
    };
    return isValidConnection(conn, edges, getPorts, getNodeType) ? conn : null;
  }

  return null;
}

export const DEFAULT_PORTS: Record<NodeType, { inputs: PortSpec[]; outputs: PortSpec[] }> = {
  asset: {
    inputs: [],
    outputs: [
      { id: 'out:image', type: 'image' },
      { id: 'out:video', type: 'video' },
      { id: 'out:audio', type: 'audio' },
    ],
  },
  text: {
    inputs: [],
    outputs: [{ id: 'out:text', type: 'text' }],
  },
  prompt: {
    inputs: [
      { id: 'in:text', type: 'text', label: 'Prompt', maxConnections: 16 },
      { id: 'in:image', type: 'image', label: 'Asset ảnh', maxConnections: 16 },
      { id: 'in:video', type: 'video', label: 'Asset video / cảnh trước', maxConnections: 8 },
      { id: 'in:audio', type: 'audio', label: 'Asset audio', maxConnections: 8 },
    ],
    outputs: [{ id: 'out:text', type: 'text', label: 'Prompt + refs' }],
  },
  generateImage: {
    inputs: [
      { id: 'in:text', type: 'text', label: 'Prompt', maxConnections: 4 },
      { id: 'in:image', type: 'image', label: 'Asset ảnh', maxConnections: 8 },
    ],
    outputs: [{ id: 'out:image', type: 'image' }],
  },
  generateVideo: {
    inputs: [
      { id: 'in:text', type: 'text', label: 'Prompt', maxConnections: 4 },
      { id: 'in:image', type: 'image', label: 'Asset ảnh', maxConnections: 8 },
      { id: 'in:video', type: 'video', label: 'Asset video', maxConnections: 2 },
      { id: 'in:audio', type: 'audio', label: 'Asset audio', maxConnections: 2 },
    ],
    outputs: [{ id: 'out:video', type: 'video' }],
  },
  mergeVideo: {
    inputs: [
      { id: 'in:video', type: 'video', label: 'Video ghép (theo thứ tự)', maxConnections: 32 },
      { id: 'in:audio', type: 'audio', label: 'Audio nền', maxConnections: 1 },
      { id: 'in:image', type: 'image', label: 'Logo overlay', maxConnections: 1 },
    ],
    outputs: [{ id: 'out:video', type: 'video' }],
  },
  autoDownload: {
    inputs: [{ id: 'in:any', type: 'any', maxConnections: 16 }],
    outputs: [],
  },
  note: { inputs: [], outputs: [] },
  unknown: { inputs: [], outputs: [] },
};

export function assetOutputPorts(kind?: 'image' | 'video' | 'audio'): PortSpec[] {
  if (kind === 'image') return [{ id: 'out:image', type: 'image' }];
  if (kind === 'video') return [{ id: 'out:video', type: 'video' }];
  if (kind === 'audio') return [{ id: 'out:audio', type: 'audio' }];
  return DEFAULT_PORTS.asset.outputs;
}
