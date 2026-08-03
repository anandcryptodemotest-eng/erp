"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  MarkerType,
  Handle,
  Position,
  SelectionMode,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./workflow-designer.css";
import {
  SO_TASK_TYPES,
  validateWorkflowDefinition,
  defaultConditionRegistry,
  type ActivityDefinition,
  type WorkflowDefinition,
  type DefinitionValidationResult,
  type AssetRef,
} from "@erp/workflow";

export type WorkflowDesignerApi = (
  path: string,
  options?: RequestInit
) => Promise<{ data?: unknown; error?: string; [k: string]: unknown }>;

export type WorkflowDesignerProps = {
  templateId: string;
  api: WorkflowDesignerApi;
  /** Tenant id for roles lookup; omit to skip */
  tenantId?: string | null;
  workflowsHref: string;
  /** Base path for form designer links, e.g. `/configuration/forms` or `/process/forms` */
  formsHref: string;
  LinkComponent: (props: { href: string; children: ReactNode; className?: string }) => ReactNode;
  /** After clone, host navigates (e.g. router.push) */
  onOpenTemplate?: (id: string) => void;
};

/** Roles assignable to workflow tasks (who can claim/complete) */
const OMS_TASK_ROLES = [
  "SALES_EXECUTIVE",
  "PRICING_EXECUTIVE",
  "DISPATCH_EXECUTIVE",
  "DELIVERY_EXECUTIVE",
  "ACCOUNTANT",
  "PROCUREMENT_OFFICER",
  "MANAGER",
  "ADMIN",
] as const;

type TemplateRow = {
  id: string;
  tenantId: string;
  templateCode: string;
  version: number;
  lifecycle: string;
  name: string | null;
  definition: WorkflowDefinition;
};

function ActivityNode({ data }: { data: { label: string; type: string; kind: string; optional?: boolean } }) {
  return (
    <div
      className={`relative min-w-[160px] rounded-lg border-2 bg-white px-3 py-2 shadow-sm ${
        data.kind === "SYSTEM" ? "border-slate-400" : data.optional ? "border-amber-400" : "border-emerald-600"
      }`}
    >
      {/* Incoming — drag TO this handle */}
      <Handle
        type="target"
        position={Position.Top}
        id="in"
        style={{
          width: 12,
          height: 12,
          background: "#94a3b8",
          border: "2px solid #fff",
          top: -6,
        }}
      />
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-soft)]">{data.type}</p>
      <p className="text-sm font-semibold text-[var(--ink)]">{data.label}</p>
      <p className="text-[10px] text-[var(--ink-soft)]">
        {data.kind}
        {data.optional ? " · optional" : ""}
      </p>
      {/* Outgoing — drag FROM this handle to the next task’s top */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="out"
        style={{
          width: 12,
          height: 12,
          background: "#059669",
          border: "2px solid #fff",
          bottom: -6,
        }}
      />
    </div>
  );
}

const nodeTypes = { activity: ActivityNode };

function defToFlow(def: WorkflowDefinition): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = def.activities.map((a, i) => ({
    id: a.key,
    type: "activity",
    position: def.layout?.[a.key] ?? { x: (i % 3) * 220, y: Math.floor(i / 3) * 120 },
    data: {
      label: a.label ?? a.key,
      type: a.type,
      kind: a.kind,
      optional: a.optional,
    },
  }));
  const edges: Edge[] = def.edges.map((e, i) => ({
    id: `e-${e.from}-${e.to}-${i}`,
    source: e.from,
    target: e.to,
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: "#64748b" },
  }));
  return { nodes, edges };
}

function applyValidation(def: WorkflowDefinition): DefinitionValidationResult {
  const custom = (def.customTaskTypes ?? []).map((t) => t.type);
  return validateWorkflowDefinition(def, {
    registeredTaskTypes: [...SO_TASK_TYPES.map((t) => t.type), ...custom],
    registeredConditions: defaultConditionRegistry.keys(),
  });
}

export function WorkflowDesigner({ templateId: id, api, tenantId: tenantIdProp, workflowsHref, formsHref, LinkComponent, onOpenTemplate }: WorkflowDesignerProps) {

  const [row, setRow] = useState<TemplateRow | null>(null);
  const [definition, setDefinition] = useState<WorkflowDefinition | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [validation, setValidation] = useState<DefinitionValidationResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [simShortage, setSimShortage] = useState(false);
  const [simLog, setSimLog] = useState<string[]>([]);
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTaskLabel, setNewTaskLabel] = useState("");
  const [newTaskType, setNewTaskType] = useState("");
  const [newTaskKind, setNewTaskKind] = useState<"HUMAN" | "SYSTEM">("HUMAN");
  const [newTaskRole, setNewTaskRole] = useState("SALES_EXECUTIVE");
  const [tenantRoles, setTenantRoles] = useState<string[]>([...OMS_TASK_ROLES]);
  const [publishedForms, setPublishedForms] = useState<
    { formId: string; version: number; name: string | null; recordId: string }[]
  >([]);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const [canvasSized, setCanvasSized] = useState(false);

  const readOnly = row?.lifecycle !== "DRAFT";
  const tenantId = tenantIdProp ?? "";

  useLayoutEffect(() => {
    const el = canvasHostRef.current;
    if (!el) return;
    const update = () => {
      setCanvasSized(el.clientWidth > 0 && el.clientHeight > 0);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [row?.id]);

  const libraryTypes = useMemo(() => {
    const custom = (definition?.customTaskTypes ?? []).map((t) => ({
      type: t.type,
      label: t.label,
      kind: t.kind,
    }));
    const builtIn = SO_TASK_TYPES.map((t) => ({ type: t.type, label: t.label, kind: t.kind }));
    const seen = new Set<string>();
    const out: { type: string; label: string; kind: "HUMAN" | "SYSTEM" }[] = [];
    for (const t of [...custom, ...builtIn]) {
      if (seen.has(t.type)) continue;
      seen.add(t.type);
      out.push(t);
    }
    return out;
  }, [definition?.customTaskTypes]);

  useEffect(() => {
    if (!tenantId) return;
    void api(`/api/tenants/${tenantId}/roles`)
      .then((r) => {
        if (Array.isArray(r.data) && r.data.length) setTenantRoles(r.data as string[]);
      })
      .catch(() => {
        /* keep OMS_TASK_ROLES defaults when roles API unavailable */
      });
  }, [api, tenantId]);

  useEffect(() => {
    void api("/api/workflow-forms?lifecycle=PUBLISHED")
      .then((r) => {
        const rows = (r.data ?? []) as {
          id: string;
          formId: string;
          version: number;
          name: string | null;
        }[];
        // latest published per formId
        const best = new Map<string, (typeof rows)[0]>();
        for (const row of rows) {
          const cur = best.get(row.formId);
          if (!cur || row.version > cur.version) best.set(row.formId, row);
        }
        setPublishedForms(
          [...best.values()].map((row) => ({
            formId: row.formId,
            version: row.version,
            name: row.name,
            recordId: row.id,
          }))
        );
      })
      .catch(() => setPublishedForms([]));
  }, []);

  const selected = useMemo(
    () => definition?.activities.find((a) => a.key === selectedKey) ?? null,
    [definition, selectedKey]
  );

  const load = useCallback(async () => {
    const r = await api(`/api/workflow-templates/${id}`);
    const data = r.data as TemplateRow;
    setRow(data);
    setDefinition(data.definition);
    const flow = defToFlow(data.definition);
    setNodes(flow.nodes);
    setEdges(flow.edges);
    setValidation(applyValidation(data.definition));
    setSelectedKey(null);
    setSelectedEdgeId(null);
  }, [id, setNodes, setEdges]);

  useEffect(() => {
    void load().catch((e: unknown) => setMessage(e instanceof Error ? e.message : "Load failed"));
  }, [load]);

  const commitGraph = useCallback(
    (nextNodes: Node[], nextEdges: Edge[], nextActivities?: ActivityDefinition[], nextForms?: WorkflowDefinition["forms"]) => {
      if (!definition) return;
      const keys = new Set(nextNodes.map((n) => n.id));
      const activities = (nextActivities ?? definition.activities).filter((a) => keys.has(a.key));
      const layout: WorkflowDefinition["layout"] = {};
      for (const n of nextNodes) {
        layout[n.id] = { x: n.position.x, y: n.position.y };
      }
      const next: WorkflowDefinition = {
        ...definition,
        activities,
        forms: nextForms ?? definition.forms,
        edges: nextEdges.map((e) => ({ from: e.source, to: e.target })),
        layout,
      };
      setDefinition(next);
      setValidation(applyValidation(next));
    },
    [definition]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (readOnly) {
        setMessage("Published templates are locked. Click “Clone to draft” before linking tasks.");
        return;
      }
      if (!connection.source || !connection.target) return;
      if (connection.source === connection.target) return;
      setEdges((eds) => {
        const exists = eds.some(
          (e) => e.source === connection.source && e.target === connection.target
        );
        if (exists) return eds;
        const next = addEdge(
          {
            ...connection,
            id: `e-${connection.source}-${connection.target}-${eds.length}`,
            markerEnd: { type: MarkerType.ArrowClosed },
            style: { stroke: "#64748b", strokeWidth: 2 },
          },
          eds
        );
        commitGraph(nodes, next);
        setMessage(`Linked ${connection.source} → ${connection.target}. Remember to Save draft.`);
        return next;
      });
    },
    [readOnly, setEdges, nodes, commitGraph]
  );

  function onNodeDragStop() {
    if (readOnly || !definition) return;
    commitGraph(nodes, edges);
  }

  function updateSelected(patch: Partial<ActivityDefinition>) {
    if (readOnly || !selectedKey || !definition) return;
    const nextActs = definition.activities.map((a) =>
      a.key === selectedKey ? { ...a, ...patch } : a
    );
    const next = { ...definition, activities: nextActs };
    setDefinition(next);
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedKey
          ? {
              ...n,
              data: {
                ...n.data,
                label: patch.label ?? (n.data as { label: string }).label,
                type: patch.type ?? (n.data as { type: string }).type,
                kind: patch.kind ?? (n.data as { kind: string }).kind,
                optional: patch.optional ?? (n.data as { optional?: boolean }).optional,
              },
            }
          : n
      )
    );
    setValidation(applyValidation(next));
  }

  const onNodesDelete = useCallback(
    (deleted: Node[]) => {
      if (readOnly || !definition) return;
      const removed = new Set(deleted.map((n) => n.id));
      const nextNodes = nodes.filter((n) => !removed.has(n.id));
      const nextEdges = edges.filter((e) => !removed.has(e.source) && !removed.has(e.target));
      const nextActs = definition.activities.filter((a) => !removed.has(a.key));
      const removedFormKeys = new Set(
        definition.activities
          .filter((a) => removed.has(a.key))
          .map((a) => a.formKey)
          .filter(Boolean) as string[]
      );
      const nextForms = (definition.forms ?? []).filter((f) => !removedFormKeys.has(f.key));
      setSelectedKey(null);
      commitGraph(nextNodes, nextEdges, nextActs, nextForms);
      setMessage(deleted.length === 1 ? `Removed task “${deleted[0]!.id}”` : `Removed ${deleted.length} tasks`);
    },
    [readOnly, definition, nodes, edges, commitGraph]
  );

  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      if (readOnly) return;
      const removed = new Set(deleted.map((e) => e.id));
      const nextEdges = edges.filter((e) => !removed.has(e.id));
      setSelectedEdgeId(null);
      commitGraph(nodes, nextEdges);
      setMessage(deleted.length ? "Connection removed" : "");
    },
    [readOnly, nodes, edges, commitGraph]
  );

  function deleteSelected() {
    if (readOnly || !definition) return;

    if (selectedEdgeId) {
      const nextEdges = edges.filter((e) => e.id !== selectedEdgeId);
      setEdges(nextEdges);
      setSelectedEdgeId(null);
      commitGraph(nodes, nextEdges);
      setMessage("Connection removed");
      return;
    }

    if (!selectedKey) {
      setMessage("Select a task or connection first, then press Delete");
      return;
    }

    const removedKey = selectedKey;
    const nextNodes = nodes.filter((n) => n.id !== removedKey);
    const nextEdges = edges.filter((e) => e.source !== removedKey && e.target !== removedKey);
    const nextActs = definition.activities.filter((a) => a.key !== removedKey);
    const removedFormKey = definition.activities.find((a) => a.key === removedKey)?.formKey;
    const nextForms = (definition.forms ?? []).filter((f) => f.key !== removedFormKey);
    setNodes(nextNodes);
    setEdges(nextEdges);
    setSelectedKey(null);
    commitGraph(nextNodes, nextEdges, nextActs, nextForms);
    setMessage(`Removed task “${removedKey}”`);
  }

  // Keyboard Delete / Backspace (canvas or page focus; skipped when typing in inputs)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (readOnly) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      if (!selectedKey && !selectedEdgeId) return;
      e.preventDefault();
      e.stopPropagation();
      deleteSelected();
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly, selectedKey, selectedEdgeId, nodes, edges, definition]);

  function addFromLibrary(type: string, label: string, kind: "HUMAN" | "SYSTEM") {
    if (readOnly) {
      setMessage("Published templates are locked. Click “Clone to draft” to edit.");
      return;
    }
    if (!definition) return;

    const key = `${type.toLowerCase()}_${Date.now().toString(36)}`;
    const activity: ActivityDefinition = {
      key,
      type,
      kind,
      label,
      roleHint: kind === "HUMAN" ? "SALES_EXECUTIVE" : undefined,
      permissions:
        kind === "HUMAN"
          ? { claim: ["SALES_EXECUTIVE"], complete: ["SALES_EXECUTIVE"] }
          : undefined,
      autoComplete: kind === "SYSTEM",
    };

    const next: WorkflowDefinition = {
      ...definition,
      activities: [...definition.activities, activity],
      layout: {
        ...(definition.layout ?? {}),
        [key]: { x: 120 + (definition.activities.length % 4) * 40, y: 80 + definition.activities.length * 36 },
      },
    };
    setDefinition(next);
    const flow = defToFlow(next);
    setNodes(flow.nodes);
    setEdges(flow.edges);
    setSelectedKey(key);
    setSelectedEdgeId(null);
    setValidation(applyValidation(next));
    setMessage(`Added “${label}” — connect it with arrows, then Save draft`);
  }

  function createNewTaskType() {
    if (readOnly || !definition) {
      setMessage("Clone to draft first to create tasks");
      return;
    }
    const label = newTaskLabel.trim();
    let type = newTaskType.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
    if (!label) {
      setMessage("Enter a task name");
      return;
    }
    if (!type) {
      type = label
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_|_$/g, "");
    }
    if (!type) {
      setMessage("Enter a valid task type code");
      return;
    }
    if (libraryTypes.some((t) => t.type === type)) {
      setMessage(`Task type ${type} already exists — use it from the list below`);
      return;
    }

    const customTaskTypes = [...(definition.customTaskTypes ?? []), { type, label, kind: newTaskKind }];
    const withType: WorkflowDefinition = { ...definition, customTaskTypes };
    setDefinition(withType);
    // Place on canvas immediately
    const key = `${type.toLowerCase()}_${Date.now().toString(36)}`;
    const activity: ActivityDefinition = {
      key,
      type,
      kind: newTaskKind,
      label,
      roleHint: newTaskKind === "HUMAN" ? newTaskRole : undefined,
      permissions:
        newTaskKind === "HUMAN"
          ? { claim: [newTaskRole], complete: [newTaskRole] }
          : undefined,
      autoComplete: newTaskKind === "SYSTEM",
    };
    const next: WorkflowDefinition = {
      ...withType,
      activities: [...withType.activities, activity],
      layout: {
        ...(withType.layout ?? {}),
        [key]: { x: 140, y: 60 + withType.activities.length * 40 },
      },
    };
    setDefinition(next);
    const flow = defToFlow(next);
    setNodes(flow.nodes);
    setEdges(flow.edges);
    setSelectedKey(key);
    setValidation(applyValidation(next));
    setShowNewTask(false);
    setNewTaskLabel("");
    setNewTaskType("");
    setMessage(`Created task type ${type} and added to canvas — Save draft when ready`);
  }

  async function cloneToDraft() {
    setBusy(true);
    setMessage(null);
    try {
      const r = await api("/api/workflow-templates", {
        method: "POST",
        body: JSON.stringify({ action: "clone", sourceId: id }),
      });
      const newId = (r.data as { id?: string } | undefined)?.id;
      if (newId) {
        onOpenTemplate?.(newId);
      }
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Clone failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft() {
    if (!definition || readOnly) return;
    setBusy(true);
    setMessage(null);
    try {
      // Persist latest node positions before save
      commitGraph(nodes, edges);
      const layout: WorkflowDefinition["layout"] = {};
      for (const n of nodes) layout[n.id] = { x: n.position.x, y: n.position.y };
      const toSave: WorkflowDefinition = {
        ...definition,
        layout,
        edges: edges.map((e) => ({ from: e.source, to: e.target })),
        activities: definition.activities.filter((a) => nodes.some((n) => n.id === a.key)),
      };
      const r = await api(`/api/workflow-templates/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ definition: toSave }),
      });
      setValidation(r.validation);
      setMessage("Draft saved");
      await load();
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (readOnly) return;
    setBusy(true);
    setMessage(null);
    try {
      const layout: WorkflowDefinition["layout"] = {};
      for (const n of nodes) layout[n.id] = { x: n.position.x, y: n.position.y };
      const toSave: WorkflowDefinition = {
        ...definition!,
        layout,
        edges: edges.map((e) => ({ from: e.source, to: e.target })),
        activities: definition!.activities.filter((a) => nodes.some((n) => n.id === a.key)),
      };
      await api(`/api/workflow-templates/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ definition: toSave }),
      });
      const r = await api(`/api/workflow-templates/${id}/publish`, { method: "POST", body: "{}" });
      setValidation(r.validation);
      setMessage("Published — this tenant’s new orders use this version; open orders keep their snapshot");
      await load();
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setBusy(false);
    }
  }

  async function runSimulation() {
    const { simulateWorkflow } = await import("@erp/workflow");
    if (!definition) return;
    const gen = simulateWorkflow(definition, defaultConditionRegistry, { shortage: simShortage });
    const log: string[] = [`Simulation start (shortage=${simShortage})`];
    let step = gen.next();
    let guard = 0;
    while (!step.done && guard++ < 40) {
      log.push(
        `READY: [${step.value.readyKeys.join(", ") || "—"}]  WAITING: [${step.value.waitingKeys.join(", ") || "—"}]  SKIP: [${step.value.skippedKeys.join(", ") || "—"}]`
      );
      const nextKey = step.value.readyKeys[0];
      if (!nextKey) break;
      step = gen.next({ completeKey: nextKey });
      if (step.value.completedKey) log.push(`Completed: ${step.value.completedKey}`);
    }
    log.push("Simulation finished");
    setSimLog(log);
  }

  if (!row || !definition) {
    return <div className="p-8 text-[var(--ink-soft)]">Loading designer…</div>;
  }

  return (
    <div className="wf-designer">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <LinkComponent href={workflowsHref} className="text-xs text-emerald-700 hover:underline">
            ← Templates
          </LinkComponent>
          <h1 className="text-lg font-semibold text-[var(--ink)]">
            {row.name ?? row.templateCode}{" "}
            <span className="font-mono text-sm text-[var(--ink-soft)]">v{row.version}</span>
            <span
              className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                readOnly ? "bg-slate-200 text-[var(--ink-soft)]" : "bg-amber-100 text-amber-900"
              }`}
            >
              {row.lifecycle}
            </span>
          </h1>
          <p className="text-xs text-[var(--ink-soft)]">
            Tenant <span className="font-mono">{row.tenantId || tenantId || "—"}</span>
            {" · "}Templates are stored per tenant (your login tenant). Config-driven mapping can come later.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {readOnly ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void cloneToDraft()}
              className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              Clone to draft (edit)
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={busy || (!selectedKey && !selectedEdgeId)}
                onClick={deleteSelected}
                className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-40"
              >
                Delete selected
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveDraft()}
                className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium disabled:opacity-50"
              >
                Save draft
              </button>
              <button
                type="button"
                disabled={busy || !validation?.ok}
                onClick={() => void publish()}
                className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                title={!validation?.ok ? "Fix validation errors first" : "Publish"}
              >
                Publish
              </button>
            </>
          )}
        </div>
      </div>

      {readOnly && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <strong>Published versions are locked</strong> — you cannot add or link tasks here. Click{" "}
          <button type="button" className="font-semibold underline" onClick={() => void cloneToDraft()}>
            Clone to draft
          </button>{" "}
          first, then connect tasks and Publish a new version.
        </div>
      )}

      {!readOnly && (
        <div className="rounded-lg border border-[var(--line)] bg-[var(--mist)] px-3 py-2 text-sm text-[var(--ink-soft)]">
          <strong className="text-[var(--ink)]">How to link:</strong> Add tasks from the left → drag from the{" "}
          <span
            style={{
              display: "inline-block",
              width: 10,
              height: 10,
              borderRadius: 999,
              background: "#059669",
              verticalAlign: "middle",
            }}
          />{" "}
          green bottom handle onto the{" "}
          <span
            style={{
              display: "inline-block",
              width: 10,
              height: 10,
              borderRadius: 999,
              background: "#94a3b8",
              verticalAlign: "middle",
            }}
          />{" "}
          grey top handle of the next task → <strong>Save draft</strong>.
        </div>
      )}

      {message && (
        <div className="rounded-lg border border-[var(--line)] bg-[var(--mist)] px-3 py-2 text-sm text-[var(--ink-soft)]">{message}</div>
      )}

      <div className="wf-designer__grid">
        <aside className="wf-designer__library rounded-xl border border-[var(--line)] bg-white p-3">
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--ink-soft)]">Tasks</h2>
          <p className="mb-2 text-[11px] text-[var(--ink-soft)]">
            {readOnly
              ? "Clone to draft to add tasks and draw arrows between them."
              : "Add a task, then drag green (bottom) → grey (top) to connect. Save draft when done."}
          </p>

          <button
            type="button"
            onClick={() => {
              if (readOnly) {
                setMessage("Clone to draft first to create tasks");
                return;
              }
              setShowNewTask((v) => !v);
            }}
            className="mb-2 w-full rounded-lg bg-emerald-700 px-2 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
          >
            + New task
          </button>

          {showNewTask && !readOnly && (
            <div className="mb-3 space-y-2 rounded-lg border border-emerald-200 bg-emerald-50/50 p-2">
              <input
                className="w-full rounded border border-[var(--line)] px-2 py-1.5 text-xs"
                placeholder="Task name (e.g. Credit check)"
                value={newTaskLabel}
                onChange={(e) => {
                  setNewTaskLabel(e.target.value);
                  if (!newTaskType) {
                    /* auto-suggest type from label on blur via create */
                  }
                }}
              />
              <input
                className="w-full rounded border border-[var(--line)] px-2 py-1.5 font-mono text-xs"
                placeholder="TYPE_CODE (optional)"
                value={newTaskType}
                onChange={(e) => setNewTaskType(e.target.value)}
              />
              <select
                className="w-full rounded border border-[var(--line)] px-2 py-1.5 text-xs"
                value={newTaskKind}
                onChange={(e) => setNewTaskKind(e.target.value as "HUMAN" | "SYSTEM")}
              >
                <option value="HUMAN">Human task</option>
                <option value="SYSTEM">System task</option>
              </select>
              {newTaskKind === "HUMAN" && (
                <select
                  className="w-full rounded border border-[var(--line)] px-2 py-1.5 text-xs"
                  value={newTaskRole}
                  onChange={(e) => setNewTaskRole(e.target.value)}
                >
                  {tenantRoles.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                onClick={createNewTaskType}
                className="w-full rounded-md bg-[var(--ink)] px-2 py-1.5 text-xs font-medium text-white"
              >
                Create & add to canvas
              </button>
            </div>
          )}

          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-soft)]">Library</p>
          <ul className="space-y-1">
            {libraryTypes.map((t) => (
              <li key={t.type}>
                <button
                  type="button"
                  onClick={() => addFromLibrary(t.type, t.label, t.kind)}
                  className={`w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-emerald-50 ${
                    readOnly ? "opacity-50" : ""
                  }`}
                >
                  <span className="font-medium text-[var(--ink)]">+ {t.label}</span>
                  <span className="block text-[10px] text-[var(--ink-soft)]">{t.type}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div ref={canvasHostRef} className="wf-designer__canvas">
          <div className="wf-designer__canvas-inner">
            {canvasSized ? (
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={readOnly ? undefined : onNodesChange}
                onEdgesChange={readOnly ? undefined : onEdgesChange}
                onConnect={onConnect}
                onNodesDelete={readOnly ? undefined : onNodesDelete}
                onEdgesDelete={readOnly ? undefined : onEdgesDelete}
                onNodeDragStop={onNodeDragStop}
                onNodeClick={(_, n) => {
                  setSelectedKey(n.id);
                  setSelectedEdgeId(null);
                }}
                onEdgeClick={(_, e) => {
                  setSelectedEdgeId(e.id);
                  setSelectedKey(null);
                }}
                onPaneClick={() => {
                  setSelectedKey(null);
                  setSelectedEdgeId(null);
                }}
                nodeTypes={nodeTypes}
                fitView
                nodesDraggable={!readOnly}
                nodesConnectable={!readOnly}
                elementsSelectable
                selectionMode={SelectionMode.Partial}
              selectionMode={SelectionMode.Partial}
              deleteKeyCode={null}
              defaultEdgeOptions={{
                markerEnd: { type: MarkerType.ArrowClosed },
                style: { stroke: "#64748b", strokeWidth: 2 },
              }}
              connectionLineStyle={{ stroke: "#059669", strokeWidth: 2 }}
              style={{ width: "100%", height: "100%" }}
              >
                <Background />
                <Controls />
                <MiniMap />
              </ReactFlow>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-[var(--ink-soft)]">
                Preparing canvas…
              </div>
            )}
          </div>
        </div>

        <aside className="wf-designer__props">
          <div className="rounded-xl border border-[var(--line)] bg-white p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-soft)]">Properties</h2>
              {!readOnly && (selectedKey || selectedEdgeId) && (
                <button
                  type="button"
                  onClick={deleteSelected}
                  className="text-[11px] font-medium text-red-600 hover:underline"
                >
                  Delete
                </button>
              )}
            </div>
            {selectedEdgeId && !selected ? (
              <p className="text-xs text-[var(--ink-soft)]">
                Connection selected. Press <kbd className="rounded bg-[var(--mist)] px-1">Delete</kbd> or click Delete
                above.
              </p>
            ) : !selected ? (
              <p className="text-xs text-[var(--ink-soft)]">
                Select a task on the canvas to edit role, condition, SLA.
                {!readOnly && (
                  <>
                    {" "}
                    Or pick <strong>+ Task</strong> from the left library.
                  </>
                )}
              </p>
            ) : (
              <>
                {readOnly && (
                  <p className="rounded bg-[var(--mist)] px-2 py-1 text-[11px] text-[var(--ink-soft)]">
                    View only — clone to draft to change these fields.
                  </p>
                )}
                <label className="block text-xs text-[var(--ink-soft)]">
                  Label
                  <input
                    className="mt-0.5 w-full rounded border border-[var(--line)] px-2 py-1.5 text-sm disabled:bg-[var(--mist)]"
                    disabled={readOnly}
                    value={selected.label ?? ""}
                    onChange={(e) => updateSelected({ label: e.target.value })}
                  />
                </label>
                <label className="block text-xs text-[var(--ink-soft)]">
                  Task type
                  <select
                    className="mt-0.5 w-full rounded border border-[var(--line)] px-2 py-1.5 text-sm disabled:bg-[var(--mist)]"
                    disabled={readOnly}
                    value={selected.type}
                    onChange={(e) => updateSelected({ type: e.target.value })}
                  >
                    {libraryTypes.map((t) => (
                      <option key={t.type} value={t.type}>
                        {t.type}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs text-[var(--ink-soft)]">
                  Condition
                  <select
                    className="mt-0.5 w-full rounded border border-[var(--line)] px-2 py-1.5 text-sm disabled:bg-[var(--mist)]"
                    disabled={readOnly}
                    value={selected.condition ?? ""}
                    onChange={(e) =>
                      updateSelected({
                        condition: e.target.value || undefined,
                        optional: Boolean(e.target.value) || selected.optional,
                      })
                    }
                  >
                    <option value="">— none —</option>
                    {defaultConditionRegistry.keys().map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2 text-xs text-[var(--ink-soft)]">
                  <input
                    type="checkbox"
                    disabled={readOnly}
                    checked={Boolean(selected.optional)}
                    onChange={(e) => updateSelected({ optional: e.target.checked })}
                  />
                  Optional
                </label>
                <label className="block text-xs text-[var(--ink-soft)]">
                  Role (who works this task)
                  <select
                    className="mt-0.5 w-full rounded border border-[var(--line)] px-2 py-1.5 text-sm disabled:bg-[var(--mist)]"
                    disabled={readOnly}
                    value={selected.roleHint ?? ""}
                    onChange={(e) =>
                      updateSelected({
                        roleHint: e.target.value || undefined,
                        permissions: {
                          claim: e.target.value ? [e.target.value] : [],
                          complete: e.target.value ? [e.target.value] : [],
                        },
                      })
                    }
                  >
                    <option value="">— select role —</option>
                    {tenantRoles.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="text-[10px] text-[var(--ink-soft)]">
                  Users with this role see the task in OMS. Add roles under Admin → Users.
                </p>
                {selected.kind === "HUMAN" && (
                  <div className="space-y-1 border-t border-[var(--line)] pt-2">
                    <label className="block text-xs text-[var(--ink-soft)]">
                      Form (AssetRef)
                      <select
                        className="mt-0.5 w-full rounded border border-[var(--line)] px-2 py-1.5 text-sm disabled:bg-[var(--mist)]"
                        disabled={readOnly}
                        value={
                          selected.assetRef
                            ? `${selected.assetRef.id}@${selected.assetRef.version}`
                            : ""
                        }
                        onChange={(e) => {
                          const v = e.target.value;
                          if (!v) {
                            updateSelected({ assetRef: undefined });
                            return;
                          }
                          const [fid, ver] = v.split("@");
                          const ref: AssetRef = {
                            type: "FORM",
                            id: fid,
                            version: Number(ver),
                          };
                          updateSelected({
                            assetRef: ref,
                          });
                        }}
                      >
                        <option value="">— select published form —</option>
                        {publishedForms.map((f) => (
                          <option key={`${f.formId}@${f.version}`} value={`${f.formId}@${f.version}`}>
                            {f.name ?? f.formId} (v{f.version})
                          </option>
                        ))}
                      </select>
                    </label>
                    {selected.assetRef &&
                      publishedForms.find(
                        (f) =>
                          f.formId === selected.assetRef!.id &&
                          f.version === selected.assetRef!.version
                      ) && (
                      <LinkComponent
                        href={`${formsHref}/${
                          publishedForms.find(
                            (f) =>
                              f.formId === selected.assetRef!.id &&
                              f.version === selected.assetRef!.version
                          )!.recordId
                        }`}
                        className="text-[11px] font-medium text-emerald-700 hover:underline"
                      >
                        Edit form in Form Designer →
                      </LinkComponent>
                    )}
                    <LinkComponent
                      href={formsHref}
                      className="block text-[11px] text-[var(--ink-soft)] hover:underline"
                    >
                      Open Form catalog
                    </LinkComponent>
                  </div>
                )}
                <label className="block text-xs text-[var(--ink-soft)]">
                  SLA hours
                  <input
                    type="number"
                    className="mt-0.5 w-full rounded border border-[var(--line)] px-2 py-1.5 text-sm disabled:bg-[var(--mist)]"
                    disabled={readOnly}
                    value={selected.slaHours ?? ""}
                    onChange={(e) =>
                      updateSelected({
                        slaHours: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                  />
                </label>
              </>
            )}
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-white p-3 space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-soft)]">Validation</h2>
            {validation?.ok ? (
              <p className="text-sm text-emerald-700">Ready to publish</p>
            ) : (
              <ul className="space-y-1 text-xs text-red-700">
                {(validation?.errors ?? []).map((e, i) => (
                  <li key={i}>
                    [{e.code}] {e.message}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-white p-3 space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-soft)]">Simulation</h2>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={simShortage} onChange={(e) => setSimShortage(e.target.checked)} />
              shortage = true
            </label>
            <button
              type="button"
              onClick={() => void runSimulation()}
              className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--mist)]"
            >
              Run simulation
            </button>
            {simLog.length > 0 && (
              <pre className="max-h-40 overflow-auto rounded bg-[var(--ink)] p-2 text-[10px] text-emerald-300">
                {simLog.join("\n")}
              </pre>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
