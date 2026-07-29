import type { WorkflowDefinition, WorkflowEdge } from "../types/definition";

export function activityKeys(def: WorkflowDefinition): Set<string> {
  return new Set(def.activities.map((a) => a.key));
}

export function outgoing(def: WorkflowDefinition, from: string): WorkflowEdge[] {
  return def.edges.filter((e) => e.from === from);
}

export function incoming(def: WorkflowDefinition, to: string): WorkflowEdge[] {
  return def.edges.filter((e) => e.to === to);
}

/** Activities with no incoming edges = start candidates */
export function startNodes(def: WorkflowDefinition): string[] {
  const targets = new Set(def.edges.map((e) => e.to));
  return def.activities.map((a) => a.key).filter((k) => !targets.has(k));
}

/** Activities with no outgoing edges = terminal candidates */
export function endNodes(def: WorkflowDefinition): string[] {
  const sources = new Set(def.edges.map((e) => e.from));
  return def.activities.map((a) => a.key).filter((k) => !sources.has(k));
}

export function hasCycle(def: WorkflowDefinition): boolean {
  const keys = activityKeys(def);
  const adj = new Map<string, string[]>();
  for (const k of keys) adj.set(k, []);
  for (const e of def.edges) {
    if (!keys.has(e.from) || !keys.has(e.to)) continue;
    adj.get(e.from)!.push(e.to);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();

  function dfs(node: string): boolean {
    if (visiting.has(node)) return true;
    if (visited.has(node)) return false;
    visiting.add(node);
    for (const next of adj.get(node) ?? []) {
      if (dfs(next)) return true;
    }
    visiting.delete(node);
    visited.add(node);
    return false;
  }

  for (const k of keys) {
    if (dfs(k)) return true;
  }
  return false;
}

/** BFS from start nodes; returns reachable activity keys */
export function reachableFromStarts(def: WorkflowDefinition): Set<string> {
  const starts = startNodes(def);
  const seen = new Set<string>();
  const queue = [...starts];
  while (queue.length) {
    const cur = queue.shift()!;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const e of outgoing(def, cur)) {
      if (!seen.has(e.to)) queue.push(e.to);
    }
  }
  return seen;
}

export function topologicalOrder(def: WorkflowDefinition): string[] | null {
  if (hasCycle(def)) return null;
  const keys = [...activityKeys(def)];
  const indeg = new Map<string, number>();
  for (const k of keys) indeg.set(k, 0);
  for (const e of def.edges) {
    if (!indeg.has(e.to) || !indeg.has(e.from)) continue;
    indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
  }
  const q = keys.filter((k) => (indeg.get(k) ?? 0) === 0);
  const order: string[] = [];
  while (q.length) {
    const n = q.shift()!;
    order.push(n);
    for (const e of outgoing(def, n)) {
      const d = (indeg.get(e.to) ?? 0) - 1;
      indeg.set(e.to, d);
      if (d === 0) q.push(e.to);
    }
  }
  return order.length === keys.length ? order : null;
}
