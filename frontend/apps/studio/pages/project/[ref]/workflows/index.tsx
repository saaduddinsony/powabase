import { useParams } from "common";
import { useEffect, useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useRouter } from "next/router";
import { Search, Plus, ChevronRight, Trash2, GitBranch, Sparkles, ArrowRight, Layers, Bot, Zap, X, Check } from "lucide-react";

import { useSessionAccessTokenQuery } from "@/data/auth/session-access-token-query";
import { hasAiAuth } from "@/lib/ai-api";
import { workflowsApi, type WorkflowListItem } from "@/lib/ai-api/workflows-api";
import ConfirmationModal from "ui-patterns/Dialogs/ConfirmationModal";
import {
  useCreateWorkflowMutation,
  useDeleteWorkflowMutation,
} from "@/data/ai-workflows";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { HorizontalCard } from "@/components/interfaces/AI/Shared/HorizontalCard";
import type { HorizontalCardBadgeSpec } from "@/components/interfaces/AI/Shared/HorizontalCard";
import {
  Button_Shadcn_ as Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "ui";
import { cn } from "@/lib/utils";
import { ONBOARDING_ANCHORS } from "@/components/interfaces/AI/GuideBubbles/onboarding-anchors";
import DefaultLayout from "@/components/layouts/DefaultLayout";
import AILayout from "@/components/layouts/AILayout/AILayout";
import type { NextPageWithLayout } from "@/types";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}

const SORT_OPTIONS: Array<{
  label: string;
  value: "created_at" | "name" | "updated_at" | "last_execution_at";
  order: "asc" | "desc";
}> = [
  { label: "Sort by created at", value: "created_at", order: "desc" },
  { label: "Sort by name", value: "name", order: "asc" },
  { label: "Sort by updated at", value: "updated_at", order: "desc" },
  { label: "Sort by last run", value: "last_execution_at", order: "desc" },
];

function buildBadges(w: WorkflowListItem): HorizontalCardBadgeSpec[] {
  const out: HorizontalCardBadgeSpec[] = [];
  const stateTone: HorizontalCardBadgeSpec["tone"] =
    w.state === "deployed" ? "success" : "default";
  out.push({ label: "state", value: w.state || "internal", tone: stateTone });
  if (w.version && w.version > 1) {
    out.push({ label: "version", value: `v${w.version}` });
  }
  if (w.execution_count > 0) {
    out.push({ label: "runs", value: w.execution_count });
  }
  const hasSchedule =
    w.schedule_config &&
    typeof w.schedule_config === "object" &&
    Object.keys(w.schedule_config).length > 0;
  if (hasSchedule) {
    out.push({ label: "schedule", value: "on schedule", tone: "info" });
  }
  return out;
}

export interface WorkflowBlueprint {
  id: "blank" | "rag" | "webhook" | "multi_agent";
  title: string;
  badge: string;
  subtitle: string;
  defaultName: string;
  defaultDescription: string;
  icon: typeof Sparkles;
  iconColor: string;
  bgColor: string;
  borderColor: string;
  graph?: {
    blocks: Array<{
      id: string;
      type: string;
      name: string;
      position: { x: number; y: number };
      config: Record<string, unknown>;
      enabled: boolean;
    }>;
    edges: Array<{
      source: string;
      target: string;
      sourceHandle?: string | null;
      targetHandle?: string | null;
      condition?: string | null;
    }>;
  };
}

export const BLUEPRINTS: WorkflowBlueprint[] = [
  {
    id: "blank",
    title: "Blank Canvas",
    badge: "Infinite",
    subtitle: "Start clean with an empty node graph and a starter trigger",
    defaultName: "Untitled Workflow",
    defaultDescription: "Visual AI node graph",
    icon: Sparkles,
    iconColor: "text-brand-500",
    bgColor: "bg-brand-500/10",
    borderColor: "border-brand-500/20",
    graph: {
      blocks: [
        {
          id: "starter_1",
          type: "starter",
          name: "Starter",
          position: { x: 180, y: 180 },
          config: { input: { query: "string" } },
          enabled: true,
        },
      ],
      edges: [],
    },
  },
  {
    id: "rag",
    title: "AI Knowledge Assistant",
    badge: "RAG & LLM",
    subtitle: "Starter → Vector Knowledge Search → LLM Generation → Response",
    defaultName: "AI Knowledge Base Assistant",
    defaultDescription: "Grounded Q&A assistant retrieving context from knowledge collections",
    icon: Bot,
    iconColor: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/20",
    graph: {
      blocks: [
        {
          id: "starter_1",
          type: "starter",
          name: "User Query",
          position: { x: 140, y: 180 },
          config: { input: { query: "How do I optimize database performance?" } },
          enabled: true,
        },
        {
          id: "knowledge_1",
          type: "knowledge",
          name: "Knowledge Search",
          position: { x: 500, y: 180 },
          config: { query: "<starter_1.output.query>", top_k: 4 },
          enabled: true,
        },
        {
          id: "agent_1",
          type: "agent",
          name: "Reasoning LLM",
          position: { x: 860, y: 180 },
          config: {
            input: "Answer the question with the retrieved knowledge:\n\nQuestion: <starter_1.output.query>\n\nContext:\n<knowledge_1.output>",
          },
          enabled: true,
        },
        {
          id: "response_1",
          type: "response",
          name: "Final Answer",
          position: { x: 1220, y: 180 },
          config: { output: "<agent_1.output>" },
          enabled: true,
        },
      ],
      edges: [
        { source: "starter_1", target: "knowledge_1", sourceHandle: null, targetHandle: null, condition: null },
        { source: "knowledge_1", target: "agent_1", sourceHandle: null, targetHandle: null, condition: null },
        { source: "agent_1", target: "response_1", sourceHandle: null, targetHandle: null, condition: null },
      ],
    },
  },
  {
    id: "webhook",
    title: "Database Webhook Trigger",
    badge: "Event-Driven",
    subtitle: "Webhook → Branch Filter → Notification / SQL Execution",
    defaultName: "Postgres Webhook Dispatcher",
    defaultDescription: "Listen to external HTTP triggers or database changes and automate responses",
    icon: Zap,
    iconColor: "text-amber-500",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
    graph: {
      blocks: [
        {
          id: "webhook_1",
          type: "webhook",
          name: "Webhook Inbound",
          position: { x: 140, y: 180 },
          config: {},
          enabled: true,
        },
        {
          id: "condition_1",
          type: "condition",
          name: "Event Filter",
          position: { x: 500, y: 180 },
          config: {
            expression: "<webhook_1.output.event> == 'INSERT'",
            branches: [{ expression: "<webhook_1.output.event> == 'INSERT'" }],
          },
          enabled: true,
        },
        {
          id: "agent_1",
          type: "agent",
          name: "Event Handler Agent",
          position: { x: 860, y: 180 },
          config: {
            input: "Summarize and log the incoming event data: <webhook_1.output.record>",
          },
          enabled: true,
        },
        {
          id: "response_1",
          type: "response",
          name: "Webhook Ack",
          position: { x: 1220, y: 180 },
          config: { output: { status: "processed", details: "<agent_1.output>" } },
          enabled: true,
        },
      ],
      edges: [
        { source: "webhook_1", target: "condition_1", sourceHandle: null, targetHandle: null, condition: null },
        { source: "condition_1", target: "agent_1", sourceHandle: null, targetHandle: null, condition: null },
        { source: "agent_1", target: "response_1", sourceHandle: null, targetHandle: null, condition: null },
      ],
    },
  },
  {
    id: "multi_agent",
    title: "Multi-Agent Router",
    badge: "Orchestration",
    subtitle: "Classifier → Specialized Agent Tool Pipeline",
    defaultName: "Multi-Agent Intent Router",
    defaultDescription: "Classify incoming user queries and delegate to targeted downstream agents",
    icon: Layers,
    iconColor: "text-violet-500",
    bgColor: "bg-violet-500/10",
    borderColor: "border-violet-500/20",
    graph: {
      blocks: [
        {
          id: "starter_1",
          type: "starter",
          name: "User Intent Input",
          position: { x: 140, y: 200 },
          config: { input: { message: "I want to track an active freight shipment" } },
          enabled: true,
        },
        {
          id: "agent_router",
          type: "agent",
          name: "Intent Classifier",
          position: { x: 500, y: 200 },
          config: {
            input: "Classify into SUPPORT, BILLING, or TRACKING:\n<starter_1.output.message>",
          },
          enabled: true,
        },
        {
          id: "agent_support",
          type: "agent",
          name: "Specialized Handler",
          position: { x: 860, y: 200 },
          config: {
            input: "Provide resolution based on classified intent (<agent_router.output>): <starter_1.output.message>",
          },
          enabled: true,
        },
        {
          id: "response_1",
          type: "response",
          name: "Final Dispatch",
          position: { x: 1220, y: 200 },
          config: { output: "<agent_support.output>" },
          enabled: true,
        },
      ],
      edges: [
        { source: "starter_1", target: "agent_router", sourceHandle: null, targetHandle: null, condition: null },
        { source: "agent_router", target: "agent_support", sourceHandle: null, targetHandle: null, condition: null },
        { source: "agent_support", target: "response_1", sourceHandle: null, targetHandle: null, condition: null },
      ],
    },
  },
];

const WorkflowsListPage: NextPageWithLayout = () => {
  const { ref } = useParams();
  const router = useRouter();
  const { data: token } = useSessionAccessTokenQuery();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery.trim(), 300);
  const [sortIdx, setSortIdx] = useState(0);
  const sort = SORT_OPTIONS[sortIdx];

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedBlueprint, setSelectedBlueprint] = useState<WorkflowBlueprint["id"]>("blank");
  const [createName, setCreateName] = useState("Untitled Workflow");
  const [createDescription, setCreateDescription] = useState("Visual AI node graph");
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [workflowToDelete, setWorkflowToDelete] = useState<WorkflowListItem | null>(null);

  const createMutation = useCreateWorkflowMutation();
  const deleteMutation = useDeleteWorkflowMutation();

  const {
    items,
    total,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    error: queryError,
  } = usePaginatedList<WorkflowListItem>({
    enabled: Boolean(hasAiAuth(token) && ref),
    queryKey: ["workflows", ref, debouncedSearch, sort.value, sort.order] as const,
    fetchPage: ({ limit, offset, signal }) =>
      workflowsApi.list(
        token!,
        ref as string,
        {
          limit,
          offset,
          q: debouncedSearch || undefined,
          sort: sort.value,
          order: sort.order,
        },
        signal,
      ),
  });

  useEffect(() => {
    if (queryError) setError(queryError.message);
  }, [queryError]);

  const handleSelectBlueprint = (bpId: WorkflowBlueprint["id"]) => {
    setSelectedBlueprint(bpId);
    const bp = BLUEPRINTS.find((b) => b.id === bpId);
    if (bp) {
      setCreateName(bp.defaultName);
      setCreateDescription(bp.defaultDescription);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim()) return;
    try {
      const result = await createMutation.mutateAsync({
        name: createName.trim(),
        description: createDescription.trim() || undefined,
      });

      // If blueprint has pre-configured nodes/edges, pre-seed the graph
      const bp = BLUEPRINTS.find((b) => b.id === selectedBlueprint);
      if (bp?.graph && token && ref) {
        try {
          await workflowsApi.saveGraph(token, ref as string, result.id, bp.graph);
        } catch (saveErr) {
          console.error("Failed to seed blueprint graph:", saveErr);
        }
      }

      setCreateName("");
      setCreateDescription("");
      setShowCreateModal(false);
      router.push(`/project/${ref}/workflows/${result.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    }
  };

  const confirmDelete = async () => {
    if (!workflowToDelete) return;
    setDeletingId(workflowToDelete.id);
    try {
      await deleteMutation.mutateAsync(workflowToDelete.id);
      queryClient.invalidateQueries({ queryKey: ["workflows", ref] });
      setWorkflowToDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  const scrollRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 96,
    overscan: 8,
    measureElement:
      typeof window !== "undefined" && navigator.userAgent.indexOf("Firefox") === -1
        ? (el) => el?.getBoundingClientRect().height
        : undefined,
  });
  const virtualItems = rowVirtualizer.getVirtualItems();

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (remaining < 200 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="px-6 py-6 border-b border-default shrink-0">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-semibold text-foreground mb-2">Workflows</h1>
          <p className="text-foreground-light text-sm">
            {total} total{items.length < total ? ` · ${items.length} loaded` : ""}
          </p>
        </div>
      </div>

      {error && (
        <div className="max-w-5xl mx-auto px-6 mt-4">
          <div className="p-4 bg-destructive-200 border border-destructive-300 rounded-lg text-destructive-600 flex items-center justify-between">
            {error}
            <button onClick={() => setError(null)} className="underline ml-4">
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="px-6 py-4 shrink-0">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name..."
                aria-label="Search workflows"
                className={cn(
                  "w-full h-8 pl-9 pr-3 text-sm rounded-md",
                  "bg-surface-200 border border-default text-foreground",
                  "focus:outline-none focus:ring-1 focus:ring-brand-400",
                )}
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm" className="gap-1.5">
                  {sort.label}
                  <ChevronRight size={14} className="rotate-90" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {SORT_OPTIONS.map((opt, i) => (
                  <DropdownMenuItem
                    key={opt.value}
                    onClick={() => setSortIdx(i)}
                    className={cn(sortIdx === i && "text-brand-600")}
                  >
                    {opt.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <button
            type="button"
            onClick={() => {
              handleSelectBlueprint("blank");
              setShowCreateModal(true);
            }}
            data-onboarding-id={ONBOARDING_ANCHORS.workflows.createButton}
            className="px-4 py-2 bg-[#17181A] text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-neutral-200 disabled:opacity-50 text-sm font-medium rounded-full shadow-none whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground-muted focus-visible:ring-offset-2 flex items-center gap-1.5"
          >
            <Plus size={14} />
            Create workflow
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        data-testid="workflows-list-scroll"
        className="flex-1 overflow-auto px-6 pb-6"
      >
        <div className="max-w-5xl mx-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin h-8 w-8 border-2 border-brand-400 border-t-transparent rounded-full" />
            </div>
          ) : items.length === 0 ? (
            debouncedSearch ? (
              <div className="text-center py-16">
                <p className="text-foreground-lighter text-sm">
                  No matches for "{debouncedSearch}"
                </p>
              </div>
            ) : (
              <div className="py-6">
                <div className="rounded-2xl border border-default bg-surface-100/60 backdrop-blur-sm p-8 shadow-sm">
                  <div className="max-w-2xl mx-auto text-center">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-400/10 border border-brand-400/30 text-brand-600 dark:text-brand-400 text-xs font-medium mb-4">
                      <Sparkles size={13} />
                      <span>Infinite Canvas Workflow Engine</span>
                    </div>
                    <h2 className="text-2xl font-semibold text-foreground tracking-tight mb-2">
                      Build Visual AI Workflows
                    </h2>
                    <p className="text-sm text-foreground-light leading-relaxed mb-6">
                      Drag, drop, and connect triggers, LLM agents, knowledge retrieval, and database queries across an unbounded interactive canvas with live execution tracing.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        handleSelectBlueprint("blank");
                        setShowCreateModal(true);
                      }}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#17181A] text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-neutral-200 text-sm font-medium rounded-full shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <Plus size={16} />
                      <span>Create Workflow Canvas</span>
                    </button>
                  </div>

                  {/* Template Quickstarts */}
                  <div className="mt-10 pt-8 border-t border-default/70">
                    <div className="text-xs font-medium text-foreground-lighter uppercase tracking-wider mb-4 text-center">
                      Or Start with a Workflow Blueprint
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <button
                        type="button"
                        onClick={() => {
                          handleSelectBlueprint("rag");
                          setShowCreateModal(true);
                        }}
                        className="p-4 rounded-xl border border-default bg-surface-200/40 hover:bg-surface-200 hover:border-foreground-muted transition-all text-left group flex flex-col justify-between"
                      >
                        <div>
                          <div className="h-9 w-9 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center mb-3">
                            <Bot size={18} />
                          </div>
                          <div className="font-medium text-sm text-foreground group-hover:text-brand transition-colors">
                            AI RAG Assistant
                          </div>
                          <div className="text-xs text-foreground-lighter mt-1 leading-relaxed">
                            Retrieve knowledge vectors and generate grounded responses with LLMs.
                          </div>
                        </div>
                        <div className="mt-4 flex items-center gap-1 text-xs text-brand font-medium">
                          <span>Use blueprint</span>
                          <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          handleSelectBlueprint("webhook");
                          setShowCreateModal(true);
                        }}
                        className="p-4 rounded-xl border border-default bg-surface-200/40 hover:bg-surface-200 hover:border-foreground-muted transition-all text-left group flex flex-col justify-between"
                      >
                        <div>
                          <div className="h-9 w-9 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center mb-3">
                            <Zap size={18} />
                          </div>
                          <div className="font-medium text-sm text-foreground group-hover:text-brand transition-colors">
                            Database Webhook Trigger
                          </div>
                          <div className="text-xs text-foreground-lighter mt-1 leading-relaxed">
                            Listen to database events, filter changes, and trigger external webhooks.
                          </div>
                        </div>
                        <div className="mt-4 flex items-center gap-1 text-xs text-brand font-medium">
                          <span>Use blueprint</span>
                          <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          handleSelectBlueprint("multi_agent");
                          setShowCreateModal(true);
                        }}
                        className="p-4 rounded-xl border border-default bg-surface-200/40 hover:bg-surface-200 hover:border-foreground-muted transition-all text-left group flex flex-col justify-between"
                      >
                        <div>
                          <div className="h-9 w-9 rounded-lg bg-violet-500/10 text-violet-500 border border-violet-500/20 flex items-center justify-center mb-3">
                            <Layers size={18} />
                          </div>
                          <div className="font-medium text-sm text-foreground group-hover:text-brand transition-colors">
                            Multi-Agent Router
                          </div>
                          <div className="text-xs text-foreground-lighter mt-1 leading-relaxed">
                            Classify user inquiries and route to specialized agent tools and pipelines.
                          </div>
                        </div>
                        <div className="mt-4 flex items-center gap-1 text-xs text-brand font-medium">
                          <span>Use blueprint</span>
                          <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          ) : (
            <>
              <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" }}>
                {virtualItems.map((virtualRow) => {
                const w = items[virtualRow.index];
                const meta = w.last_execution_at
                  ? `Last run ${timeAgo(w.last_execution_at)}`
                  : w.created_at
                    ? `Created ${timeAgo(w.created_at)}`
                    : "";
                return (
                  <div
                    key={w.id}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    className="pb-2"
                  >
                    <HorizontalCard
                      href={`/project/${ref}/workflows/${w.id}`}
                      icon={<GitBranch className="text-emerald-300" size={20} strokeWidth={1.5} />}
                      name={w.name}
                      description={w.description || "No description"}
                      badges={buildBadges(w)}
                      rightMeta={meta || null}
                      actions={
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setWorkflowToDelete(w);
                          }}
                          disabled={deletingId === w.id}
                          className="text-foreground-lighter hover:text-destructive-600 transition p-1"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      }
                    />
                  </div>
                );
                })}
              </div>
              {isFetchingNextPage && (
                <div className="flex justify-center py-4">
                  <div className="animate-spin h-5 w-5 border-2 border-brand-400 border-t-transparent rounded-full" />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Redesigned Bencho Workflow Creation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-surface-100 border border-default/80 rounded-[24px] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 p-6 pb-4 border-b border-default/60 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-500/20 via-emerald-500/10 to-transparent border border-brand-500/20 flex items-center justify-center text-brand">
                  <GitBranch size={20} />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-semibold text-foreground tracking-tight">
                    Create New Workflow
                  </h3>
                  <p className="text-xs sm:text-sm text-foreground-lighter mt-0.5">
                    Start fresh or jumpstart your canvas with a pre-configured architecture.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-full text-foreground-lighter hover:text-foreground hover:bg-surface-200 transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="flex-1 flex flex-col min-h-0">
              {/* Scrollable Body */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5 always-show-scrollbar">
                {/* Blueprint Selection */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-foreground-lighter mb-2.5">
                    Choose Blueprint Architecture
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {BLUEPRINTS.map((bp) => {
                      const Icon = bp.icon;
                      const isSelected = selectedBlueprint === bp.id;
                      return (
                        <button
                          key={bp.id}
                          type="button"
                          onClick={() => handleSelectBlueprint(bp.id)}
                          className={cn(
                            "relative p-3 rounded-2xl border text-left transition-all flex flex-col justify-between group",
                            isSelected
                              ? "border-brand-500 bg-brand-500/[0.06] ring-2 ring-brand-500/20 shadow-sm"
                              : "border-default bg-surface-200/40 hover:bg-surface-200/80 hover:border-default/80"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className={cn("w-7 h-7 rounded-xl flex items-center justify-center border", bp.bgColor, bp.borderColor, bp.iconColor)}>
                              <Icon size={14} />
                            </div>
                            <span className={cn(
                              "text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full border",
                              isSelected
                                ? "bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/20"
                                : "bg-surface-300 text-foreground-lighter border-default"
                            )}>
                              {bp.badge}
                            </span>
                          </div>
                          <div>
                            <div className={cn(
                              "text-sm font-medium transition-colors",
                              isSelected ? "text-brand-600 dark:text-brand-400" : "text-foreground group-hover:text-foreground"
                            )}>
                              {bp.title}
                            </div>
                            <div className="text-xs text-foreground-lighter mt-0.5 line-clamp-2 leading-relaxed">
                              {bp.subtitle}
                            </div>
                          </div>
                          {isSelected && (
                            <div className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-brand flex items-center justify-center text-white dark:text-black">
                              <Check size={10} strokeWidth={3} />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Workflow Details */}
                <div className="space-y-3.5 pt-3 border-t border-default/60">
                  <div>
                    <label
                      htmlFor="create-workflow-name"
                      className="block text-xs font-semibold uppercase tracking-wider text-foreground-lighter mb-1.5"
                    >
                      Workflow Name
                    </label>
                    <input
                      id="create-workflow-name"
                      type="text"
                      value={createName}
                      onChange={(e) => setCreateName(e.target.value)}
                      placeholder="e.g. Lead Qualification Engine"
                      className="w-full px-3.5 py-2.5 bg-surface-200/60 border border-default rounded-xl text-foreground text-sm placeholder-foreground-muted focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400 transition"
                      required
                      autoFocus
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="create-workflow-desc"
                      className="block text-xs font-semibold uppercase tracking-wider text-foreground-lighter mb-1.5"
                    >
                      Description <span className="text-foreground-muted font-normal lowercase">(optional)</span>
                    </label>
                    <textarea
                      id="create-workflow-desc"
                      value={createDescription}
                      onChange={(e) => setCreateDescription(e.target.value)}
                      placeholder="Describe what this workflow does..."
                      rows={2}
                      className="w-full px-3.5 py-2 bg-surface-200/60 border border-default rounded-xl text-foreground text-sm placeholder-foreground-muted focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400 transition resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons (Pinned Footer) */}
              <div className="p-4 px-6 border-t border-default/60 flex items-center justify-end gap-3 bg-surface-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm text-foreground-lighter hover:text-foreground transition rounded-full"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || !createName.trim()}
                  className="px-6 py-2.5 bg-[#17181A] text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-neutral-200 disabled:opacity-50 text-sm font-medium rounded-full shadow-md whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground-muted flex items-center gap-2 hover:scale-[1.01] active:scale-[0.99]"
                >
                  {createMutation.isPending ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      <span>Creating Canvas...</span>
                    </>
                  ) : (
                    <>
                      <Plus size={15} />
                      <span>Create Workflow</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        variant="destructive"
        size="medium"
        loading={deleteMutation.isPending}
        visible={Boolean(workflowToDelete)}
        title={workflowToDelete ? `Delete workflow "${workflowToDelete.name}"` : "Delete workflow"}
        confirmLabel="Delete"
        confirmLabelLoading="Deleting..."
        onCancel={() => setWorkflowToDelete(null)}
        onConfirm={confirmDelete}
      >
        <p className="text-sm text-foreground-light">
          Are you sure you want to delete this workflow? All associated blocks, connections, and execution logs will be permanently deleted. This action cannot be undone.
        </p>
      </ConfirmationModal>
    </div>
  );
};

WorkflowsListPage.getLayout = (page) => (
  <DefaultLayout>
    <AILayout title="Workflows">{page}</AILayout>
  </DefaultLayout>
);

export default WorkflowsListPage;
