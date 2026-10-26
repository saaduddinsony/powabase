import { useState, useMemo } from "react";
import {
  Play,
  Split,
  Layers,
  Webhook,
  Network,
  HelpCircle,
  X,
  Search,
  Plus,
  Sparkles,
  GitBranch,
} from "lucide-react";
import {
  PaperPlaneIcon,
  CodeBranchIcon,
  RobotIcon,
  CodeIcon,
  GlobeIcon,
} from "./BlockIcons";
import { blockRegistry, getDefaultConfig } from "@/data/ai-workflows/block-registry";

export const SINGLETON_TYPES = new Set(["starter", "webhook", "response"]);

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
  emerald: "text-emerald-500 dark:text-emerald-300",
  violet: "text-violet-500 dark:text-[#c4b5fd]",
  amber: "text-amber-500 dark:text-[#fcd34d]",
  orange: "text-orange-500 dark:text-[#fdba74]",
  blue: "text-blue-500 dark:text-[#93c5fd]",
  teal: "text-teal-500 dark:text-teal-300",
  cyan: "text-cyan-500 dark:text-cyan-300",
  sky: "text-sky-500 dark:text-sky-300",
  indigo: "text-indigo-500 dark:text-[#a5b4fc]",
  rose: "text-rose-500 dark:text-rose-300",
  slate: "text-slate-500 dark:text-slate-200",
};

const tileBgMap: Record<string, string> = {
  emerald: "bg-emerald-500/10 border-emerald-500/25 shadow-emerald-500/10",
  violet: "bg-violet-500/10 border-violet-500/25 shadow-violet-500/10",
  amber: "bg-amber-500/10 border-amber-500/25 shadow-amber-500/10",
  orange: "bg-orange-500/10 border-orange-500/25 shadow-orange-500/10",
  blue: "bg-blue-500/10 border-blue-500/25 shadow-blue-500/10",
  teal: "bg-teal-500/10 border-teal-500/25 shadow-teal-500/10",
  cyan: "bg-cyan-500/10 border-cyan-500/25 shadow-cyan-500/10",
  sky: "bg-sky-500/10 border-sky-500/25 shadow-sky-500/10",
  indigo: "bg-indigo-500/10 border-indigo-500/25 shadow-indigo-500/10",
  rose: "bg-rose-500/10 border-rose-500/25 shadow-rose-500/10",
  slate: "bg-slate-500/10 border-slate-500/25 shadow-slate-500/10",
};

type BlockCategory = "all" | "triggers" | "agents" | "logic" | "tools";

function getBlockCategory(blockType: string): BlockCategory {
  switch (blockType) {
    case "starter":
    case "webhook":
      return "triggers";
    case "agent":
    case "llm":
      return "agents";
    case "condition":
    case "split":
    case "response":
      return "logic";
    case "code":
    case "tool":
    case "kb":
    case "general_api":
    case "platform_api":
    default:
      return "tools";
  }
}

function getCategoryPill(category: BlockCategory) {
  switch (category) {
    case "triggers":
      return { label: "Trigger", class: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25" };
    case "agents":
      return { label: "Agent", class: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25" };
    case "logic":
      return { label: "Logic", class: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/25" };
    case "tools":
    default:
      return { label: "Tool", class: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25" };
  }
}

interface BlockPaletteProps {
  onAddBlock: (blockType: string, config: Record<string, unknown>) => void;
  existingBlockTypes: Set<string>;
  onClose?: () => void;
}

export function BlockPalette({ onAddBlock, existingBlockTypes, onClose }: BlockPaletteProps) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<BlockCategory>("all");

  const categories: Array<{ id: BlockCategory; label: string; icon: string }> = [
    { id: "all", label: "All", icon: "✨" },
    { id: "triggers", label: "Triggers", icon: "⚡" },
    { id: "agents", label: "Agents", icon: "🤖" },
    { id: "logic", label: "Logic", icon: "🔀" },
    { id: "tools", label: "Tools", icon: "🛠" },
  ];

  const filteredBlocks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return Object.values(blockRegistry).filter((b) => {
      const category = getBlockCategory(b.type);
      const matchesCategory = selectedCategory === "all" || category === selectedCategory;
      const matchesQuery =
        !q ||
        b.name.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q) ||
        b.type.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [search, selectedCategory]);

  return (
    <div className="w-[300px] bg-white/95 dark:bg-[#141517]/95 backdrop-blur-xl border border-neutral-200/90 dark:border-neutral-800 rounded-[22px] flex flex-col h-full shadow-[0_12px_40px_rgba(0,0,0,0.18)] overflow-hidden select-none">
      {/* Top Header */}
      <div className="p-3.5 border-b border-default/50 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-brand-500/10 border border-brand-500/20 text-brand-500 flex items-center justify-center">
              <Sparkles size={13} />
            </div>
            <span className="text-xs font-bold text-foreground tracking-tight">Workflow Blocks</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-surface-200 text-foreground-lighter font-semibold">
              {filteredBlocks.length}
            </span>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-foreground-lighter hover:text-foreground hover:bg-surface-200 transition"
              title="Close Palette"
              aria-label="Close Palette"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Opal / n8n Category Filter Tabs */}
        <div className="flex items-center gap-1 p-0.5 rounded-xl bg-surface-200/70 border border-default/40 overflow-x-auto no-scrollbar">
          {categories.map((cat) => {
            const active = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all shrink-0 ${
                  active
                    ? "bg-white dark:bg-[#1f2023] text-foreground shadow-xs border border-default/30"
                    : "text-foreground-lighter hover:text-foreground hover:bg-surface-300/40"
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground-lighter" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search blocks..."
            className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl bg-surface-200/70 border border-default/60 text-foreground placeholder:text-foreground-lighter/70 focus:outline-none focus:ring-1 focus:ring-brand-500 transition"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground-lighter hover:text-foreground"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Block List (Elevated Bencho / Opal Draggable Cards) */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
        {filteredBlocks.length === 0 ? (
          <div className="text-center py-10 space-y-1 text-xs text-foreground-muted">
            <p className="font-semibold">No blocks found</p>
            <p className="text-[11px] text-foreground-lighter">Try another search or category</p>
          </div>
        ) : (
          filteredBlocks.map((blockType) => {
            const Icon = iconMap[blockType.icon] ?? HelpCircle;
            const disabled = SINGLETON_TYPES.has(blockType.type) && existingBlockTypes.has(blockType.type);
            const cat = getBlockCategory(blockType.type);
            const pill = getCategoryPill(cat);

            return (
              <div
                key={blockType.type}
                className={`relative group rounded-2xl border transition-all duration-200 p-2.5 flex items-start gap-3 ${
                  disabled
                    ? "opacity-40 cursor-not-allowed bg-surface-100/40 border-dashed border-default/50"
                    : "bg-surface-100/60 dark:bg-surface-100/30 border-default/60 hover:border-brand-500/40 hover:bg-surface-200/90 cursor-grab active:cursor-grabbing hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99]"
                }`}
                onClick={() => {
                  if (!disabled) {
                    onAddBlock(blockType.type, getDefaultConfig(blockType.type));
                  }
                }}
                draggable={!disabled}
                onDragStart={(e) => {
                  if (disabled) {
                    e.preventDefault();
                    return;
                  }
                  e.dataTransfer.setData("blockType", blockType.type);
                  e.dataTransfer.effectAllowed = "move";
                }}
              >
                {/* Left: Squircle Icon Tile */}
                <div
                  className={`shrink-0 flex items-center justify-center h-10 w-10 rounded-2xl border transition-transform group-hover:scale-105 shadow-2xs ${
                    tileBgMap[blockType.color] ?? "bg-slate-500/10 border-slate-500/25"
                  }`}
                >
                  <Icon className={`h-5 w-5 ${iconColorMap[blockType.color] ?? "text-slate-200"}`} />
                </div>

                {/* Middle: Name, Category Pill, Description */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold text-foreground truncate group-hover:text-brand-500 transition-colors">
                      {blockType.name}
                    </span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-semibold border ${pill.class}`}>
                      {pill.label}
                    </span>
                  </div>

                  <p className="text-[11px] text-foreground-muted line-clamp-2 mt-1 leading-snug">
                    {blockType.description}
                  </p>
                </div>

                {/* Right: Quick Add Button or On-Canvas Indicator */}
                <div className="shrink-0 self-center">
                  {disabled ? (
                    <span className="text-[9px] font-semibold text-foreground-lighter px-1.5 py-0.5 rounded bg-surface-200/80 border border-default/40">
                      On canvas
                    </span>
                  ) : (
                    <button
                      type="button"
                      title="Add to canvas"
                      aria-label={`Add ${blockType.name} to canvas`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddBlock(blockType.type, getDefaultConfig(blockType.type));
                      }}
                      className="h-6 w-6 rounded-lg bg-surface-200 hover:bg-brand-500 text-foreground-lighter hover:text-white flex items-center justify-center transition-all shadow-2xs group-hover:scale-105"
                    >
                      <Plus size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bencho / Opal Footer with tactile cues */}
      <div className="p-2.5 border-t border-default/40 bg-surface-100/50 flex items-center justify-between">
        <div className="flex items-center -space-x-1">
          <div className="w-3 h-3 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 border border-white dark:border-[#151619] shadow-2xs" />
          <div className="w-3 h-3 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 border border-white dark:border-[#151619] shadow-2xs" />
          <div className="w-3 h-3 rounded-full bg-gradient-to-tr from-amber-400 to-orange-500 border border-white dark:border-[#151619] shadow-2xs" />
        </div>
        <span className="text-[10px] text-foreground-lighter font-medium">
          Drag to canvas or click + to add
        </span>
      </div>
    </div>
  );
}
