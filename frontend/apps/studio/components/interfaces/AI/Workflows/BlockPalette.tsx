

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
  emerald: "text-emerald-400 dark:text-emerald-300",
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
  emerald: "bg-emerald-500/10 border-emerald-500/25",
  violet: "bg-violet-500/10 border-violet-500/25",
  amber: "bg-amber-500/10 border-amber-500/25",
  orange: "bg-orange-500/10 border-orange-500/25",
  blue: "bg-blue-500/10 border-blue-500/25",
  teal: "bg-teal-500/10 border-teal-500/25",
  cyan: "bg-cyan-500/10 border-cyan-500/25",
  sky: "bg-sky-500/10 border-sky-500/25",
  indigo: "bg-indigo-500/10 border-indigo-500/25",
  rose: "bg-rose-500/10 border-rose-500/25",
  slate: "bg-slate-500/10 border-slate-500/25",
};

interface BlockPaletteProps {
  onAddBlock: (blockType: string, config: Record<string, unknown>) => void;
  existingBlockTypes: Set<string>;
  onClose?: () => void;
}

export function BlockPalette({ onAddBlock, existingBlockTypes, onClose }: BlockPaletteProps) {
  const [search, setSearch] = useState("");

  const filteredBlocks = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return Object.values(blockRegistry);
    return Object.values(blockRegistry).filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q) ||
        b.type.toLowerCase().includes(q)
    );
  }, [search]);

  return (
    <div className="w-64 bg-white/95 dark:bg-[#141517]/95 backdrop-blur-md border border-neutral-200/80 dark:border-neutral-800 rounded-2xl flex flex-col h-full shadow-[0_8px_30px_rgb(0_0_0/0.12)] overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-default/50 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-foreground tracking-tight">Block Palette</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-surface-200 text-foreground-lighter font-medium">
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

        {/* Search */}
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground-lighter" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search blocks..."
            className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-xl bg-surface-200/70 border border-default/60 text-foreground placeholder:text-foreground-lighter/70 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>

      {/* Block List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {filteredBlocks.length === 0 ? (
          <div className="text-center py-8 text-xs text-foreground-muted">
            No matching blocks found
          </div>
        ) : (
          filteredBlocks.map((blockType) => {
            const Icon = iconMap[blockType.icon] ?? HelpCircle;
            const disabled = SINGLETON_TYPES.has(blockType.type) && existingBlockTypes.has(blockType.type);
            return (
              <button
                key={blockType.type}
                className={`w-full flex items-center gap-2.5 p-2 rounded-xl text-foreground transition-all text-left group ${
                  disabled
                    ? "opacity-35 cursor-not-allowed"
                    : "hover:bg-surface-200/80 active:scale-[0.98] cursor-grab active:cursor-grabbing hover:shadow-2xs"
                }`}
                onClick={() =>
                  !disabled && onAddBlock(blockType.type, getDefaultConfig(blockType.type))
                }
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
                <div
                  className={`shrink-0 flex items-center justify-center h-8 w-8 rounded-xl border transition-transform group-hover:scale-105 shadow-2xs ${
                    tileBgMap[blockType.color] ?? "bg-slate-500/10 border-slate-500/25"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${iconColorMap[blockType.color] ?? "text-slate-200"}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold truncate group-hover:text-brand-500 transition-colors">
                    {blockType.name}
                  </div>
                  <div className="text-[10px] text-foreground-muted truncate">
                    {blockType.description}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Helper Footer */}
      <div className="p-2 border-t border-default/40 bg-surface-100/50 text-[10px] text-foreground-lighter text-center">
        Click to insert or drag onto canvas
      </div>
    </div>
  );
}
