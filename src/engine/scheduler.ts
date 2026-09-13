import type { Workflow, WorkflowNode } from '@/shared/schema';

export interface SchedulePlan {
  order: string[];
  /** nodeId -> upstream nodeIds */
  deps: Map<string, string[]>;
}

/** Kahn topological sort; throws on cycle */
export function topoSort(workflow: Workflow, nodeIds?: Set<string>): SchedulePlan {
  const nodes = workflow.nodes.filter(
    (n) => n.type !== 'note' && !n.disabled && (!nodeIds || nodeIds.has(n.id)),
  );
  const idSet = new Set(nodes.map((n) => n.id));
  const edges = workflow.edges.filter((e) => idSet.has(e.source) && idSet.has(e.target));

  const indeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  const deps = new Map<string, string[]>();

  for (const n of nodes) {
    indeg.set(n.id, 0);
    adj.set(n.id, []);
    deps.set(n.id, []);
  }
  for (const e of edges) {
    adj.get(e.source)!.push(e.target);
    indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
    deps.get(e.target)!.push(e.source);
  }

  const queue = [...indeg.entries()].filter(([, d]) => d === 0).map(([id]) => id);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const next of adj.get(id) ?? []) {
      const d = (indeg.get(next) ?? 0) - 1;
      indeg.set(next, d);
      if (d === 0) queue.push(next);
    }
  }
  if (order.length !== nodes.length) {
    throw new Error('Workflow có vòng (cycle), không thể chạy');
  }
  return { order, deps };
}

/** Collect node + all downstream */
export function collectDownstream(workflow: Workflow, fromNodeId: string): Set<string> {
  const adj = new Map<string, string[]>();
  for (const e of workflow.edges) {
    const list = adj.get(e.source) ?? [];
    list.push(e.target);
    adj.set(e.source, list);
  }
  const out = new Set<string>();
  const stack = [fromNodeId];
  while (stack.length) {
    const id = stack.pop()!;
    if (out.has(id)) continue;
    out.add(id);
    for (const n of adj.get(id) ?? []) stack.push(n);
  }
  return out;
}

/** Collect node + all upstream ancestors (so inputs are available when running a single node) */
export function collectUpstream(workflow: Workflow, toNodeId: string): Set<string> {
  const parents = new Map<string, string[]>();
  for (const e of workflow.edges) {
    const list = parents.get(e.target) ?? [];
    list.push(e.source);
    parents.set(e.target, list);
  }
  const out = new Set<string>();
  const stack = [toNodeId];
  while (stack.length) {
    const id = stack.pop()!;
    if (out.has(id)) continue;
    out.add(id);
    for (const n of parents.get(id) ?? []) stack.push(n);
  }
  return out;
}

export function getExecutableNodes(workflow: Workflow): WorkflowNode[] {
  return workflow.nodes.filter((n) => n.type !== 'note' && !n.disabled);
}
