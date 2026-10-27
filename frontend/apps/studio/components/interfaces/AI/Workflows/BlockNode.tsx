import React, { useState, useEffect, useLayoutEffect, Fragment, useRef, type ComponentType, type MouseEvent } from "react";
import { Handle, Position, type NodeProps, useReactFlow, useUpdateNodeInternals, type Edge } from "reactflow";
import {
  Play,
  Split,
  Layers,
  Webhook,
  Network,
  HelpCircle,
  Plus,
  Minus,
  Settings,
  Copy,
  Trash2,
  ChevronDown,
  ChevronUp,
  Check,
  Sparkles,
} from "lucide-react";
import {
  PaperPlaneIcon,
  CodeBranchIcon,
  RobotIcon,
  CodeIcon,
  GlobeIcon,
} from "./BlockIcons";
import { blockRegistry, type SubBlockConfig, type InputMapping } from "@/data/ai-workflows/block-registry";
import { evaluateCondition } from "./condition-utils";
import { useWorkflowState } from "./WorkflowContext";
import { useProjectSupabaseClient } from "@/hooks/ai/useProjectSupabaseClient";
import { agentsApi, hasAiAuth, knowledgeBasesApi } from "@/lib/ai-api";

// Backend page size ceiling (list endpoints clamp limit to [1, 100]).
const MAX_KBS_FOR_PICKER = 100;

const iconMap: Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  Play,
  Bot: RobotIcon,
  Code: CodeIcon,
  GitBranch: CodeBranchIcon,
  Split,
  Globe: GlobeIcon,
  Layers,
  MessageSquare: PaperPlaneIcon,
  Webhook,
  Network,
};

const iconColorMap: Record<string, string> = {
  emerald: "text-emerald-600 dark:text-emerald-400",
  violet: "text-violet-600 dark:text-violet-400",
  amber: "text-amber-600 dark:text-amber-400",
  orange: "text-orange-600 dark:text-orange-400",
  blue: "text-blue-600 dark:text-blue-400",
  teal: "text-teal-600 dark:text-teal-400",
  cyan: "text-cyan-600 dark:text-cyan-400",
  sky: "text-sky-600 dark:text-sky-400",
  indigo: "text-indigo-600 dark:text-indigo-400",
  rose: "text-rose-600 dark:text-rose-400",
  slate: "text-slate-600 dark:text-slate-400",
};

const tileBgMap: Record<string, string> = {
  emerald: "bg-emerald-500/10 border-emerald-500/20",
  violet: "bg-violet-500/10 border-violet-500/20",
  amber: "bg-amber-500/10 border-amber-500/20",
  orange: "bg-orange-500/10 border-orange-500/20",
  blue: "bg-blue-500/10 border-blue-500/20",
  teal: "bg-teal-500/10 border-teal-500/20",
  cyan: "bg-cyan-500/10 border-cyan-500/20",
  sky: "bg-sky-500/10 border-sky-500/20",
  indigo: "bg-indigo-500/10 border-indigo-500/20",
  rose: "bg-rose-500/10 border-rose-500/20",
  slate: "bg-slate-500/10 border-slate-500/20",
};

function formatConfigValue(value: unknown, sb: SubBlockConfig): string {
  if (value == null || value === "") return "\u2014";

  switch (sb.type) {
    case "dropdown":
    case "combobox":
      return sb.options?.find((o) => o.value === value)?.label ?? String(value);
    case "slider":
      return typeof value === "number" ? value.toFixed(1) : "\u2014";
    case "switch":
      return value ? "On" : "Off";
    case "agent-select":
      return value ? "Selected" : "None";
    case "kb-select":
      return Array.isArray(value) && value.length > 0
        ? `${value.length} selected`
        : "None";
    case "table": {
      const rows = Array.isArray(value)
        ? value.filter((r) =>
            Object.values((r as Record<string, Record<string, string>>)?.cells ?? {}).some((v) => v)
          )
        : [];
      return rows.length > 0
        ? `${rows.length} row${rows.length > 1 ? "s" : ""}`
        : "\u2014";
    }
    case "json-kv": {
      let obj = value;
      if (typeof obj === "string") {
        try { obj = JSON.parse(obj); } catch { return "\u2014"; }
      }
      if (typeof obj === "object" && obj !== null && !Array.isArray(obj)) {
        const keys = Object.keys(obj as Record<string, unknown>);
        if (keys.length === 0) return "\u2014";
        const joined = keys.join(", ");
        return joined.length > 22 ? joined.slice(0, 20) + "\u2026" : joined;
      }
      return "\u2014";
    }
    case "checkbox-group":
      return Array.isArray(value) && value.length > 0
        ? `${value.length} selected`
        : "None";
    case "code":
      return value ? "\u2714 defined" : "\u2014";
    default: {
      if (typeof value === "object") {
        const j = JSON.stringify(value);
        return j.length > 20 ? j.slice(0, 20) + "\u2026" : j;
      }
      const s = String(value);
      return s.length > 22 ? s.slice(0, 20) + "\u2026" : s;
    }
  }
}

function AgentNameLabel({ agentId }: { agentId: string }) {
  const { token, ref } = useProjectSupabaseClient();
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (!agentId || !hasAiAuth(token)) { setName(null); return; }
    let cancelled = false;
    agentsApi.get(token, ref, agentId)
      .then((data) => {
        if (cancelled) return;
        setName(data.name);
      })
      .catch(() => {
        if (!cancelled) setName(null);
      });
    return () => { cancelled = true; };
  }, [agentId, token, ref]);

  if (!agentId) return <>None</>;
  return <>{name ?? "…"}</>;
}

function KBNamesLabel({ value }: { value: unknown }) {
  const { token, ref } = useProjectSupabaseClient();
  const [names, setNames] = useState<string[] | null>(null);

  const ids = Array.isArray(value) ? value.map((v: { id: string }) => v.id) : [];

  useEffect(() => {
    if (ids.length === 0 || !hasAiAuth(token)) { setNames(null); return; }
    let cancelled = false;
    knowledgeBasesApi.list(token, ref, { limit: MAX_KBS_FOR_PICKER })
      .then((res) => {
        if (cancelled) return;
        const kbMap = new Map(res.items.map((kb) => [kb.id, kb.name]));
        setNames(ids.map((id) => kbMap.get(id) ?? id));
      })
      .catch(() => {
        if (!cancelled) setNames(null);
      });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(ids), token, ref]);

  if (ids.length === 0) return <>None</>;
  if (!names) return <>…</>;
  const joined = names.join(", ");
  return <>{joined.length > 22 ? joined.slice(0, 20) + "…" : joined}</>;
}

function MappedInputLabel({ mapping }: { mapping: InputMapping }) {
  const { getNodes } = useReactFlow();
  const nodes = getNodes();
  const sourceNode = nodes.find((n: any) => n.id === mapping.sourceId);
  const sourceName = sourceNode?.data?.label || mapping.sourceId;
  const label = `← ${sourceName}.${mapping.outputField}`;
  return <>{label.length > 22 ? label.slice(0, 20) + "…" : label}</>;
}

function ConfigValue({
  value,
  subBlock,
  config,
}: {
  value: unknown;
  subBlock: SubBlockConfig;
  config: Record<string, unknown>;
}) {
  if (subBlock.type === "agent-select") {
    return <AgentNameLabel agentId={value as string} />;
  }

  if (subBlock.type === "kb-select") {
    return <KBNamesLabel value={value} />;
  }

  if (subBlock.type === "long-input" || subBlock.type === "short-input") {
    const mappings = config?._inputMappings as InputMapping[] | undefined;
    const mapping = mappings?.find((m) => m.targetField === subBlock.id);
    if (mapping) {
      return <MappedInputLabel mapping={mapping} />;
    }
  }

  return <>{formatConfigValue(value, subBlock)}</>;
}

interface BlockNodeData {
  blockType: string;
  label: string;
  config: Record<string, unknown>;
}

function getCategoryBadge(blockType: string) {
  switch (blockType) {
    case "starter":
    case "webhook":
      return {
        label: "Trigger",
        icon: "⚡",
        badgeClass: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
      };
    case "agent":
    case "llm":
      return {
        label: "AI Agent",
        icon: "🤖",
        badgeClass: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
      };
    case "condition":
    case "split":
      return {
        label: "Logic",
        icon: "🔀",
        badgeClass: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20",
      };
    case "response":
      return {
        label: "Response",
        icon: "📨",
        badgeClass: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20",
      };
    case "code":
    case "tool":
    case "kb":
    default:
      return {
        label: "Tool",
        icon: "🛠",
        badgeClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
      };
  }
}

function BlockNodeComponent({ id, data, selected }: NodeProps<BlockNodeData>) {
  const { setEdges, updateNodeConfigAndRefresh, deleteNode, duplicateNode, openConfig } = useWorkflowState();

  const typeConfig = blockRegistry[data.blockType];
  const iconName = typeConfig?.icon ?? "HelpCircle";
  const color = typeConfig?.color ?? "slate";
  const Icon = iconMap[iconName] ?? HelpCircle;
  const hasInput = typeConfig?.hasInput ?? true;
  const hasOutput = typeConfig?.hasOutput ?? true;
  const categoryBadge = getCategoryBadge(data.blockType);

  // Expand / Collapse state inspired by Bencho sound card
  const [isExpanded, setIsExpanded] = useState<boolean>(() => Boolean(data.config?._isExpanded ?? false));
  const [copied, setCopied] = useState(false);

  const toggleExpand = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsExpanded((prev: boolean) => {
      const next = !prev;
      updateNodeConfigAndRefresh(id, (c: Record<string, unknown>) => ({ ...c, _isExpanded: next }));
      return next;
    });
  };

  // Dynamic output handles for split and condition blocks; static for others
  const outputHandles = (() => {
    if (data.blockType === "split") {
      return Array.from(
        { length: (data.config?.branches as number) || 2 },
        (_, i) => String(i + 1)
      );
    }
    if (data.blockType === "condition") {
      const branches = (data.config?.branches as Array<{ expression: string }>) ?? [];
      const handles = branches.map((_, i) => (i === 0 ? "if" : `elif_${i}`));
      return [...handles, "else"];
    }
    return typeConfig?.outputHandles;
  })();

  const outputHandlesKey = outputHandles?.join(",") ?? "";

  const updateNodeInternals = useUpdateNodeInternals();
  const nodeRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!nodeRef.current) return;

    const el = nodeRef.current;

    const run = () => {
      updateNodeInternals(id);
      setEdges((edges: any[]) =>
        edges.map((e: any) =>
          e.source === id || e.target === id ? { ...e } : e
        )
      );
    };

    const ro = new ResizeObserver(() => {
      run();
    });

    ro.observe(el);

    run();
    const raf1 = requestAnimationFrame(run);
    const raf2 = requestAnimationFrame(() => requestAnimationFrame(run));

    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [id, data.blockType, outputHandlesKey, selected, isExpanded, updateNodeInternals, setEdges]);

  const visibleSubBlocks = typeConfig?.subBlocks.filter(
    (sb) =>
      sb.mode !== "advanced" &&
      evaluateCondition(sb.condition, data.config ?? {})
  );

  // Dynamic subtitle preview for collapsed Bencho capsule
  const collapsedSubtitle = (() => {
    if (data.blockType === "agent" || data.blockType === "llm") {
      const model = (data.config?.model as string) || "gpt-4o";
      const temp = data.config?.temperature != null ? `${data.config.temperature}` : "0.7";
      return `${model} · ${temp} temp`;
    }
    if (data.blockType === "webhook") {
      return "POST · Webhook Trigger";
    }
    if (data.blockType === "condition") {
      const branchCount = ((data.config?.branches as any[]) ?? []).length;
      return `${branchCount} branches + else`;
    }
    if (data.blockType === "split") {
      const branchCount = (data.config?.branches as number) || 2;
      return `${branchCount} parallel branches`;
    }
    if (data.blockType === "starter") {
      return "Manual workflow trigger";
    }
    if (data.blockType === "response") {
      return "Workflow end response";
    }
    return typeConfig?.description || "Ready";
  })();

  const handleCopyWebhook = (e: React.MouseEvent) => {
    e.stopPropagation();
    const webhookUrl = `${window.location.origin}/api/ai/workflows/webhook/${data.config?.webhook_id || id}`;
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      key={`${id}:${(data as any).layoutVersion ?? outputHandlesKey}`}
      ref={nodeRef}
      className={`
        relative group transition-all duration-200 select-none
        border bg-white dark:bg-[#18191c]
        ${
          isExpanded
            ? "w-[350px] rounded-2xl"
            : "w-[290px] rounded-2xl cursor-pointer"
        }
        ${
          selected
            ? "border-brand-500 ring-2 ring-brand-500/25 shadow-md"
            : "border-neutral-200/90 dark:border-neutral-800 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:shadow-md hover:border-neutral-300 dark:hover:border-neutral-700"
        }
      `}
      onClick={!isExpanded ? () => toggleExpand() : undefined}
    >
      {/* Input handle */}
      {hasInput && (
        <Handle
          type="target"
          position={Position.Top}
          className="!w-2.5 !h-2.5 !rounded-full !bg-white dark:!bg-[#18191c] !border-2 !border-neutral-400 dark:!border-neutral-500 hover:!border-brand-500 hover:!scale-125 !transition-all shadow-xs"
        />
      )}

      {/* ======================================================== */}
      {/* A) COLLAPSED CAPSULE VIEW (StackAI-style)                */}
      {/* ======================================================== */}
      {!isExpanded ? (
        <div className="px-3.5 py-2.5 flex items-center justify-between gap-2.5 h-[62px]">
          {/* Left: Squircle Icon Tile */}
          <div
            className={`h-9 w-9 rounded-xl border flex items-center justify-center shrink-0 shadow-2xs transition-transform group-hover:scale-102 ${
              tileBgMap[color] ?? "bg-slate-500/10 border-slate-500/20"
            }`}
          >
            <Icon className={`h-4.5 w-4.5 ${iconColorMap[color] ?? "text-slate-400"}`} />
          </div>

          {/* Center: Title + Dynamic Subtitle Preview */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-foreground tracking-tight truncate">
                {data.label || typeConfig?.name || data.blockType}
              </span>
            </div>
            <div className="text-[11px] text-foreground-lighter truncate mt-0.5 font-normal">
              {collapsedSubtitle}
            </div>
          </div>

          {/* Right: Category Badge + Expand Toggle Button */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div
              className={`px-2 py-0.5 rounded-md text-[10px] font-medium border flex items-center gap-1 ${categoryBadge.badgeClass}`}
            >
              <span>{categoryBadge.icon}</span>
              <span className="hidden sm:inline">{categoryBadge.label}</span>
            </div>

            <button
              type="button"
              title="Expand Node"
              aria-label="Expand Node"
              onClick={toggleExpand}
              className="h-7 w-7 rounded-lg bg-surface-100 hover:bg-surface-200 text-foreground-lighter hover:text-foreground flex items-center justify-center transition border border-default/30 active:scale-95"
            >
              <ChevronDown size={14} className="transition-transform group-hover:translate-y-0.5" />
            </button>
          </div>
        </div>
      ) : (
        /* ======================================================== */
        /* B) EXPANDED STUDIO CARD VIEW (StackAI-style)             */
        /* ======================================================== */
        <div className="p-3.5 space-y-3">
          {/* Top Bar: Category badge on left, studio controls on right */}
          <div className="flex items-center justify-between gap-2">
            <div
              className={`px-2 py-0.5 rounded-md text-[10px] font-medium tracking-wide border flex items-center gap-1.5 ${categoryBadge.badgeClass}`}
            >
              <span>{categoryBadge.icon}</span>
              <span>{categoryBadge.label}</span>
            </div>

            {/* Studio Action Controls */}
            <div className="flex items-center gap-0.5 text-foreground-lighter">
              <button
                type="button"
                title="Configure Node Drawer"
                aria-label="Configure Node Drawer"
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  openConfig?.(id);
                }}
                className="h-6 w-6 rounded-md hover:bg-surface-200 hover:text-foreground flex items-center justify-center transition"
              >
                <Settings size={12} />
              </button>
              <button
                type="button"
                title="Duplicate Node"
                aria-label="Duplicate Node"
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  duplicateNode?.(id);
                }}
                className="h-6 w-6 rounded-md hover:bg-surface-200 hover:text-foreground flex items-center justify-center transition"
              >
                <Copy size={12} />
              </button>
              <button
                type="button"
                title="Delete Node"
                aria-label="Delete Node"
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  deleteNode?.(id);
                }}
                className="h-6 w-6 rounded-md hover:bg-destructive-500/10 hover:text-destructive-500 flex items-center justify-center transition"
              >
                <Trash2 size={12} />
              </button>
              <button
                type="button"
                title="Collapse Node"
                aria-label="Collapse Node"
                onClick={toggleExpand}
                className="h-6 w-6 rounded-md hover:bg-surface-200 hover:text-foreground flex items-center justify-center transition"
              >
                <ChevronUp size={13} />
              </button>
            </div>
          </div>

          {/* Header Identity: squircle icon + title + description */}
          <div className="flex items-start gap-2.5 pt-0.5">
            <div
              className={`h-9 w-9 rounded-xl border flex items-center justify-center shrink-0 shadow-2xs ${
                tileBgMap[color] ?? "bg-slate-500/10 border-slate-500/20"
              }`}
            >
              <Icon className={`h-4.5 w-4.5 ${iconColorMap[color] ?? "text-slate-400"}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-foreground tracking-tight truncate">
                {data.label || typeConfig?.name || data.blockType}
              </div>
              <div className="text-[11px] text-foreground-lighter line-clamp-2 mt-0.5 leading-relaxed font-normal">
                {typeConfig?.description || data.blockType}
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* INTERACTIVE INLINE PARAMETER PEEK (Opal / n8n inspiration)*/}
          {/* ======================================================== */}

          {/* 1. AGENT / LLM INLINE PEEK */}
          {(data.blockType === "agent" || data.blockType === "llm") && (
            <div className="p-2.5 rounded-xl bg-surface-100/70 dark:bg-surface-100/40 border border-default/50 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[11px] font-medium text-foreground-muted flex items-center gap-1">
                  <Sparkles size={11} className="text-brand-500" /> Model:
                </span>
                <span className="px-2 py-0.5 rounded-md bg-surface-200 text-foreground font-semibold text-[11px] border border-default/40">
                  {(data.config?.model as string) || "gpt-4o"}
                </span>
              </div>
              {data.config?.prompt ? (
                <div className="p-2 rounded-lg bg-black/5 dark:bg-black/30 border border-default/30 font-mono text-[10px] text-foreground-muted line-clamp-2 leading-relaxed">
                  {String(data.config.prompt)}
                </div>
              ) : null}
            </div>
          )}

          {/* 2. WEBHOOK INLINE TRIGGER PEEK */}
          {data.blockType === "webhook" && (
            <div className="p-2.5 rounded-xl bg-surface-100/70 dark:bg-surface-100/40 border border-default/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/30">
                  POST
                </span>
                <span className="text-[10px] text-foreground-lighter">
                  ID: {String(data.config?.webhook_id || id).slice(0, 8)}…
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyWebhook}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-surface-200/80 hover:bg-surface-300 text-foreground text-[11px] font-medium transition border border-default/50"
              >
                <span className="truncate max-w-[200px]">Copy Webhook Endpoint</span>
                {copied ? <Check size={12} className="text-emerald-500 shrink-0" /> : <Copy size={12} className="text-foreground-lighter shrink-0" />}
              </button>
            </div>
          )}

          {/* 3. CONDITION BRANCH EXPRESSIONS & INLINE +/- CONTROLS */}
          {data.blockType === "condition" && (
            <div className="p-2.5 rounded-xl bg-surface-100/70 dark:bg-surface-100/40 border border-default/50 space-y-2">
              <div className="space-y-1">
                {((data.config?.branches as Array<{ expression: string }>) ?? []).map((b, i) => {
                  const label = i === 0 ? "if" : `elif ${i}`;
                  const expr = b.expression || "(default check)";
                  const truncated = expr.length > 24 ? expr.slice(0, 22) + "…" : expr;
                  return (
                    <div key={i} className="flex items-center justify-between text-[11px] px-2 py-1 rounded-md bg-surface-200/60 border border-default/30">
                      <span className="font-bold text-violet-500 shrink-0">{label}:</span>
                      <span className="text-foreground-muted font-mono text-[10px] truncate max-w-[170px]">{truncated}</span>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between text-[11px] px-2 py-1 rounded-md bg-surface-200/60 border border-default/30">
                  <span className="font-bold text-violet-500">else:</span>
                  <span className="text-foreground-lighter font-mono text-[10px]">fallback path</span>
                </div>
              </div>

              {/* Inline +/- branch controls */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-foreground-muted font-medium">Branch count</span>
                <div className="flex items-center gap-1.5 bg-surface-200/80 rounded-lg p-0.5 border border-default/40">
                  <button
                    type="button"
                    title="Remove Branch"
                    aria-label="Remove Branch"
                    className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-surface-300 text-foreground transition"
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      const branches = (data.config?.branches as Array<{ expression: string }>) ?? [];
                      if (branches.length <= 1) return;
                      const next = branches.slice(0, -1);
                      updateNodeConfigAndRefresh(id, (prev: any) => ({ ...prev, branches: next }));
                    }}
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="text-[11px] font-semibold text-foreground px-1">
                    {((data.config?.branches as Array<{ expression: string }>) ?? []).length}
                  </span>
                  <button
                    type="button"
                    title="Add Branch"
                    aria-label="Add Branch"
                    className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-surface-300 text-foreground transition"
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      const branches = (data.config?.branches as Array<{ expression: string }>) ?? [];
                      if (branches.length >= 8) return;
                      const next = [...branches, { expression: "" }];
                      updateNodeConfigAndRefresh(id, (prev: any) => ({ ...prev, branches: next }));
                    }}
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 4. SPLIT PARALLEL BRANCH CONTROLS */}
          {data.blockType === "split" && (
            <div className="p-2.5 rounded-xl bg-surface-100/70 dark:bg-surface-100/40 border border-default/50 flex items-center justify-between">
              <span className="text-[11px] font-medium text-foreground-muted">Parallel branches:</span>
              <div className="flex items-center gap-1.5 bg-surface-200/80 rounded-lg p-0.5 border border-default/40">
                <button
                  type="button"
                  title="Decrease branches"
                  aria-label="Decrease branches"
                  className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-surface-300 text-foreground transition"
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    const current = (data.config?.branches as number) || 2;
                    if (current <= 2) return;
                    updateNodeConfigAndRefresh(id, (prev: any) => ({ ...prev, branches: current - 1 }));
                  }}
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="text-[11px] font-semibold text-foreground px-1.5">
                  {(data.config?.branches as number) || 2}
                </span>
                <button
                  type="button"
                  title="Increase branches"
                  aria-label="Increase branches"
                  className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-surface-300 text-foreground transition"
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    const current = (data.config?.branches as number) || 2;
                    if (current >= 8) return;
                    updateNodeConfigAndRefresh(id, (prev: any) => ({ ...prev, branches: current + 1 }));
                  }}
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* 5. GENERAL CONFIG FIELDS (Non-advanced) */}
          {visibleSubBlocks && visibleSubBlocks.length > 0 && data.blockType !== "condition" && data.blockType !== "split" && (
            <div className="p-2 rounded-xl bg-surface-100/60 dark:bg-surface-100/30 border border-default/40 divide-y divide-default/30">
              {visibleSubBlocks.map((sb) => (
                <div
                  key={sb.id}
                  className="flex items-center justify-between gap-2 py-1 first:pt-0 last:pb-0"
                >
                  <span className="text-[11px] text-foreground-muted truncate">
                    {sb.title}
                  </span>
                  <span className="text-[11px] text-foreground truncate max-w-[150px] text-right font-medium">
                    <ConfigValue value={data.config?.[sb.id]} subBlock={sb} config={data.config ?? {}} />
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* StackAI-style Clean Footer */}
          <div className="pt-2.5 border-t border-neutral-200/60 dark:border-neutral-800/60 flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-1.5 text-foreground-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="font-medium text-[10px]">Ready</span>
            </div>

            <button
              type="button"
              onClick={toggleExpand}
              className="text-[10px] font-medium text-foreground-lighter hover:text-foreground px-2 py-0.5 rounded-md hover:bg-surface-200 transition flex items-center gap-1"
            >
              <span>Collapse</span>
              <ChevronUp size={11} />
            </button>
          </div>
        </div>
      )}

      {/* Output handles */}
      {hasOutput && !outputHandles && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-2.5 !h-2.5 !rounded-full !bg-white dark:!bg-[#18191c] !border-2 !border-neutral-400 dark:!border-neutral-500 hover:!border-brand-500 hover:!scale-125 !transition-all shadow-xs"
        />
      )}

      {/* Named output handles (e.g. condition if/elif/else or split 1, 2) */}
      {outputHandles &&
        outputHandles.map((handle, i) => {
          const leftPct = `${((i + 1) / (outputHandles.length + 1)) * 100}%`;
          return (
            <Fragment key={handle}>
              <Handle
                type="source"
                position={Position.Bottom}
                id={handle}
                style={{ left: leftPct }}
                className="!w-2.5 !h-2.5 !rounded-full !bg-white dark:!bg-[#18191c] !border-2 !border-neutral-400 dark:!border-neutral-500 hover:!border-brand-500 hover:!scale-125 !transition-all shadow-xs"
              />
              <div
                className="pointer-events-none absolute text-[10px] text-foreground-muted whitespace-nowrap font-medium"
                style={{
                  left: leftPct,
                  bottom: -22,
                  transform: "translateX(-50%)",
                }}
              >
                {handle.replace("_", " ")}
              </div>
            </Fragment>
          );
        })}
    </div>
  );
}

export const BlockNode = BlockNodeComponent;
