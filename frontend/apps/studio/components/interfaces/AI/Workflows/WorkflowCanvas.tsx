

import { useCallback, useEffect, useImperativeHandle, useMemo, useState, useRef } from "react";
import ReactFlow, {
  addEdge,
  useNodesState,
  useEdgesState,
  useUpdateNodeInternals,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  MiniMap,
  type Connection,
  type Edge,
  type Node,
  type ReactFlowInstance,
} from "reactflow";
import "reactflow/dist/style.css";
import { flushSync } from "react-dom";

import { BlockNode } from "./BlockNode";
import { BlockPalette, SINGLETON_TYPES } from "./BlockPalette";
import { BlockConfigPanel } from "./BlockConfigPanel";
import { getDefaultConfig, blockRegistry, type InputMapping } from "@/data/ai-workflows/block-registry";
import { evaluateCondition } from "./condition-utils";
import { WorkflowContext } from "./WorkflowContext";
import { useWorkflowHistory } from "./useWorkflowHistory";
import { InteractiveCopilotAvatar } from "@/components/interfaces/AI/ProjectCopilot/InteractiveCopilotAvatar";
import {
  Undo2,
  Redo2,
  Plus,
  Minus,
  Maximize2,
  Map,
  Grid,
  Hand,
  MousePointer,
  Layers,
  Sparkles,
} from "lucide-react";

const nodeTypes = { block: BlockNode };

/** Sub-block types that accept text references */
const TEXT_INPUT_TYPES = new Set(["short-input", "long-input", "code"]);

/**
 * Get eligible text-input field IDs for a block type,
 * respecting condition visibility based on the node's current config.
 */
function getEligibleFields(blockType: string, nodeConfig: Record<string, unknown>): string[] {
  const config = blockRegistry[blockType];
  if (!config) return [];
  return config.subBlocks
    .filter((sb) => TEXT_INPUT_TYPES.has(sb.type) && !sb.noAutoMap && evaluateCondition(sb.condition, nodeConfig))
    .map((sb) => sb.id);
}

/** Get output field names for a source node */
function getSourceOutputFields(sourceNode: Node): string[] {
  const srcType = sourceNode.data?.blockType as string;
  if (!srcType) return ["output"];
  if (srcType === "starter") {
    const inputConfig = sourceNode.data?.config?.input;
    if (inputConfig && typeof inputConfig === "object" && !Array.isArray(inputConfig)) {
      const keys = Object.keys(inputConfig as Record<string, unknown>);
      return keys.length > 0 ? keys : [];
    }
    if (typeof inputConfig === "string" && inputConfig.trim()) {
      try {
        const parsed = JSON.parse(inputConfig);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return Object.keys(parsed);
        }
      } catch { /* not valid JSON */ }
    }
    return [];
  }
  const srcConfig = blockRegistry[srcType];
  if (!srcConfig) return ["output"];
  const outputKeys = Object.keys(srcConfig.outputs);
  return outputKeys.length > 0 ? outputKeys : ["output"];
}

export interface WorkflowCanvasHandle {
  getNodes: () => Node[];
  getEdges: () => Edge[];
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  pushSnapshot: () => void;
}

interface WorkflowCanvasProps {
  /** Initial nodes from saved graph */
  initialNodes?: Node[];
  /** Initial edges from saved graph */
  initialEdges?: Edge[];
  /** Called when graph changes (for save) */
  onGraphChange?: (nodes: Node[], edges: Edge[]) => void;
  /** Auth props for API calls */
  token?: string;
  projectRef?: string;
  /**
   * Imperative handle exposing getNodes/getEdges/setNodes/setEdges/pushSnapshot.
   * Passed as a named prop (not React's forwardRef `ref`) because next/dynamic
   * in Pages Router intercepts `ref` to attach its own retry method and does not
   * forward it to the inner component. Using a named prop sidesteps that.
   */
  canvasHandleRef?: React.Ref<WorkflowCanvasHandle>;
  /** Toggle copilot assistant drawer */
  onToggleCopilot?: () => void;
  isCopilotOpen?: boolean;
  /** Save status for bottom-left indicator */
  saveStatus?: "saved" | "saving" | "idle";
}

export function WorkflowCanvas(props: WorkflowCanvasProps) {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function WorkflowCanvasInner({
  initialNodes = [],
  initialEdges = [],
  onGraphChange,
  token,
  projectRef,
  canvasHandleRef,
  onToggleCopilot,
  isCopilotOpen = false,
  saveStatus = "idle",
}: WorkflowCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const selectedNode = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) ?? null : null;
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
  const updateNodeInternals = useUpdateNodeInternals();
  const blockCountRef = useRef(initialNodes.length);
  const [currentZoom, setCurrentZoom] = useState(100);
  const [showMiniMap, setShowMiniMap] = useState(true);
  const [gridVariant, setGridVariant] = useState<BackgroundVariant>(BackgroundVariant.Dots);
  const [panMode, setPanMode] = useState<boolean>(true);
  const [isPaletteOpen, setIsPaletteOpen] = useState<boolean>(true);

  const { pushSnapshot, undo, redo, canUndo, canRedo, isUndoRedoRef } =
    useWorkflowHistory(initialNodes, initialEdges, setNodes, setEdges);

  // Expose imperative handle for copilot panel
  useImperativeHandle(canvasHandleRef, () => ({
    getNodes: () => reactFlowInstance.current?.getNodes() ?? nodes,
    getEdges: () => reactFlowInstance.current?.getEdges() ?? edges,
    setNodes,
    setEdges,
    pushSnapshot: () => {
      const currentNodes = reactFlowInstance.current?.getNodes() ?? [];
      const currentEdges = reactFlowInstance.current?.getEdges() ?? [];
      pushSnapshot(currentNodes, currentEdges);
    },
  }), [nodes, edges, setNodes, setEdges, pushSnapshot]);

  const pendingSnapshotRef = useRef<number | null>(null);

  const takeSnapshot = useCallback(() => {
    if (pendingSnapshotRef.current !== null) {
      cancelAnimationFrame(pendingSnapshotRef.current);
    }
    pendingSnapshotRef.current = requestAnimationFrame(() => {
      pendingSnapshotRef.current = null;
      const currentNodes = reactFlowInstance.current?.getNodes() ?? [];
      const currentEdges = reactFlowInstance.current?.getEdges() ?? [];
      pushSnapshot(currentNodes, currentEdges);
    });
  }, [pushSnapshot]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if (mod && (e.key === "y" || (e.key === "Z" && e.shiftKey))) { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo]);

  // Notify parent whenever nodes or edges change
  const isInitialRender = useRef(true);
  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }
    onGraphChange?.(nodes, edges);
  }, [nodes, edges]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup stale edges for both condition and split blocks
  const cleanupStaleEdges = useCallback((updatedNodes: Node[]) => {
    const dynamicNodes = updatedNodes.filter(
      (n) => n.data.blockType === "condition" || n.data.blockType === "split"
    );
    if (dynamicNodes.length === 0) return;

    setEdges((eds) => {
      const filtered = eds.filter((edge) => {
        if (!edge.sourceHandle) return true;
        const sourceNode = dynamicNodes.find((n) => n.id === edge.source);
        if (!sourceNode) return true; // not a dynamic-handle block, keep

        const blockType = sourceNode.data.blockType;

        if (blockType === "split") {
          const branches = (sourceNode.data.config?.branches as number) || 2;
          const validHandles = Array.from({ length: branches }, (_, i) => String(i + 1));
          return validHandles.includes(edge.sourceHandle);
        }

        if (blockType === "condition") {
          const branches = (sourceNode.data.config?.branches as Array<{ expression: string }>) ?? [];
          const validHandles = [
            ...branches.map((_: { expression: string }, i: number) => (i === 0 ? "if" : `elif_${i}`)),
            "else",
          ];
          return validHandles.includes(edge.sourceHandle);
        }

        return true;
      });
      return filtered.length === eds.length ? eds : filtered;
    });
  }, [setEdges]);

  const refreshNodeLayout = useCallback((nodeId: string) => {
    const rerenderEdges = () => {
      setEdges((eds) =>
        eds.map((e) =>
          e.source === nodeId || e.target === nodeId ? { ...e } : e
        )
      );
    };

    updateNodeInternals(nodeId);
    rerenderEdges();

    requestAnimationFrame(() => {
      updateNodeInternals(nodeId);
      rerenderEdges();

      requestAnimationFrame(() => {
        updateNodeInternals(nodeId);
        rerenderEdges();
      });
    });
  }, [setEdges, updateNodeInternals]);

  const isValidConnection = useCallback(
    (connection: Connection) => connection.source !== connection.target,
    [],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => {
        const newEdges = addEdge(connection, eds);
        if (connection.sourceHandle) {
          // Split blocks use numeric handle IDs ("1", "2", …) — don't tag those as conditions.
          // All other named handles (condition true/false, switch case labels) get a condition.
          const sourceNode = reactFlowInstance.current?.getNodes().find((n) => n.id === connection.source);
          const isSplitHandle =
            sourceNode?.data?.blockType === "split" && /^\d+$/.test(connection.sourceHandle);
          if (!isSplitHandle) {
            const lastIdx = newEdges.length - 1;
            newEdges[lastIdx] = {
              ...newEdges[lastIdx],
              data: { ...newEdges[lastIdx].data, condition: connection.sourceHandle },
            };
          }
        }
        return newEdges;
      });

      // Auto-map: create _inputMappings entries if exactly one eligible field
      if (connection.source && connection.target) {
        const sourceId = connection.source;
        const targetId = connection.target;

        setNodes((nds) => {
          const targetNode = nds.find((n) => n.id === targetId);
          const sourceNode = nds.find((n) => n.id === sourceId);
          if (!targetNode || !sourceNode) return nds;

          const blockType = targetNode.data.blockType;
          const eligible = getEligibleFields(blockType, targetNode.data.config ?? {});
          if (eligible.length !== 1) return nds;

          const targetField = eligible[0];
          const outputFields = getSourceOutputFields(sourceNode);
          const fields = outputFields.length > 0 ? outputFields : ["output"];
          if (fields.length !== 1) return nds;

          const existingMappings: InputMapping[] = [
            ...((targetNode.data.config?._inputMappings as InputMapping[]) ?? []),
          ];

          let changed = false;
          for (const outputField of fields) {
            const exists = existingMappings.some(
              (m) => m.sourceId === sourceId && m.outputField === outputField
            );
            if (!exists) {
              existingMappings.push({ sourceId, outputField, targetField });
              changed = true;
            }
          }

          if (!changed) return nds;

          const updatedConfig = { ...targetNode.data.config, _inputMappings: existingMappings };

          return nds.map((n) =>
            n.id === targetId
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    config: updatedConfig,
                  },
                }
              : n
          );
        });
      }

      // Snapshot after connect
      takeSnapshot();
    },
    [setEdges, setNodes, takeSnapshot],
  );

  // Clean up _inputMappings when edges are deleted
  const onEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      const sourcesByTarget = new Map<string, Set<string>>();
      for (const edge of deletedEdges) {
        const set = sourcesByTarget.get(edge.target) ?? new Set();
        set.add(edge.source);
        sourcesByTarget.set(edge.target, set);
      }

      setNodes((nds) =>
        nds.map((n) => {
          const removedSources = sourcesByTarget.get(n.id);
          if (!removedSources) return n;
          const mappings = (n.data.config?._inputMappings as InputMapping[]) ?? [];
          const filtered = mappings.filter((m) => !removedSources.has(m.sourceId));
          if (filtered.length === mappings.length) return n;
          return {
            ...n,
            data: {
              ...n.data,
              config: { ...n.data.config, _inputMappings: filtered },
            },
          };
        })
      );

      takeSnapshot();
    },
    [setNodes, takeSnapshot],
  );

  const existingBlockTypes = useMemo(
    () => new Set(nodes.map((n) => n.data.blockType as string)),
    [nodes],
  );

  // Add block from palette
  const handleAddBlock = useCallback(
    (blockType: string, config: Record<string, unknown>) => {
      if (SINGLETON_TYPES.has(blockType) && existingBlockTypes.has(blockType)) return;
      blockCountRef.current += 1;
      const id = crypto.randomUUID();
      const label = `${blockRegistry[blockType]?.name ?? blockType} ${blockCountRef.current}`;

      // Auto-generate webhook_id and secret for webhook blocks
      const finalConfig = blockType === "webhook"
        ? {
            ...config,
            webhook_id: crypto.randomUUID(),
            webhook_secret: crypto.randomUUID(),
          }
        : config;

      const newNode: Node = {
        id,
        type: "block",
        position: {
          x: 250 + Math.random() * 100,
          y: 100 + blockCountRef.current * 80,
        },
        data: {
          blockType,
          label,
          config: finalConfig,
        },
      };
      setNodes((nds) => [...nds, newNode]);
      takeSnapshot();
    },
    [setNodes, existingBlockTypes, takeSnapshot],
  );

  // Handle drop from palette drag
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const blockType = event.dataTransfer.getData("blockType");
      if (!blockType || !reactFlowInstance.current) return;
      if (SINGLETON_TYPES.has(blockType) && existingBlockTypes.has(blockType)) return;

      const position = reactFlowInstance.current.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      blockCountRef.current += 1;
      const id = crypto.randomUUID();
      const label = `${blockRegistry[blockType]?.name ?? blockType} ${blockCountRef.current}`;
      const defaultConfig = getDefaultConfig(blockType);
      const finalConfig = blockType === "webhook"
        ? {
            ...defaultConfig,
            webhook_id: crypto.randomUUID(),
            webhook_secret: crypto.randomUUID(),
          }
        : defaultConfig;
      const newNode: Node = {
        id,
        type: "block",
        position,
        data: {
          blockType,
          label,
          config: finalConfig,
        },
      };
      setNodes((nds) => [...nds, newNode]);
      takeSnapshot();
    },
    [setNodes, existingBlockTypes, takeSnapshot],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  // Update node config from panel
  const handleUpdateConfig = useCallback(
    (nodeId: string, config: Record<string, unknown>) => {
      let updatedNodes: Node[] = [];

      flushSync(() => {
        setNodes((nds) => {
          updatedNodes = nds.map((n) =>
            n.id === nodeId ? { ...n, data: { ...n.data, config } } : n
          );
          return updatedNodes;
        });
      });

      cleanupStaleEdges(updatedNodes);
      refreshNodeLayout(nodeId);
      takeSnapshot();
    },
    [setNodes, cleanupStaleEdges, refreshNodeLayout, takeSnapshot],
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNodeId(node.id);
    },
    [],
  );

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const updateNodeConfigAndRefresh = useCallback(
    (nodeId: string, updater: (prevConfig: Record<string, unknown>) => Record<string, unknown>) => {
      let updatedNodes: Node[] = [];

      flushSync(() => {
        setNodes((nds) => {
          updatedNodes = nds.map((n) => {
            if (n.id !== nodeId) return n;
            const prevConfig = (n.data.config ?? {}) as Record<string, unknown>;
            const nextConfig = updater(prevConfig);
            return {
              ...n,
              data: {
                ...n.data,
                config: nextConfig,
              },
            };
          });
          return updatedNodes;
        });
      });

      cleanupStaleEdges(updatedNodes);
      refreshNodeLayout(nodeId);
    },
    [setNodes, cleanupStaleEdges, refreshNodeLayout],
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      pushSnapshot();
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      if (selectedNodeId === nodeId) {
        setSelectedNodeId(null);
      }
    },
    [pushSnapshot, selectedNodeId, setNodes, setEdges],
  );

  const duplicateNode = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;
      pushSnapshot();
      const newId = `${node.data.blockType}-${Date.now().toString(36)}`;
      const newNode: Node = {
        ...node,
        id: newId,
        position: {
          x: node.position.x + 30,
          y: node.position.y + 30,
        },
        data: {
          ...node.data,
          label: node.data.label ? `${node.data.label} (Copy)` : undefined,
        },
        selected: true,
      };
      setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), newNode]);
      setSelectedNodeId(newId);
    },
    [nodes, pushSnapshot, setNodes],
  );

  const openConfig = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
  }, []);

  const handleZoomIn = useCallback(() => {
    if (!reactFlowInstance.current) return;
    const current = reactFlowInstance.current.getZoom();
    const next = Math.min(2.0, Math.round((current + 0.15) * 100) / 100);
    reactFlowInstance.current.zoomTo(next, { duration: 120 });
    setCurrentZoom(Math.round(next * 100));
  }, []);

  const handleZoomOut = useCallback(() => {
    if (!reactFlowInstance.current) return;
    const current = reactFlowInstance.current.getZoom();
    const next = Math.max(0.2, Math.round((current - 0.15) * 100) / 100);
    reactFlowInstance.current.zoomTo(next, { duration: 120 });
    setCurrentZoom(Math.round(next * 100));
  }, []);

  const handleZoomReset = useCallback(() => {
    if (!reactFlowInstance.current) return;
    reactFlowInstance.current.zoomTo(1, { duration: 120 });
    setCurrentZoom(100);
  }, []);

  const workflowCtx = useMemo(
    () => ({
      setNodes,
      setEdges,
      updateNodeConfigAndRefresh,
      deleteNode,
      duplicateNode,
      openConfig,
    }),
    [setNodes, setEdges, updateNodeConfigAndRefresh, deleteNode, duplicateNode, openConfig],
  );

  return (
    <WorkflowContext.Provider value={workflowCtx}>
    <div className="flex h-full w-full relative overflow-hidden select-none bg-[#fafafa] dark:bg-[#0c0d0e]">
      {/* Floating Block Palette Drawer (Unbounded canvas) */}
      {isPaletteOpen && (
        <div className="absolute top-4 left-4 bottom-24 z-20 pointer-events-auto transition-all animate-in fade-in duration-200">
          <BlockPalette
            onAddBlock={handleAddBlock}
            existingBlockTypes={existingBlockTypes}
            onClose={() => setIsPaletteOpen(false)}
          />
        </div>
      )}

      <div className="flex-1 relative h-full w-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgesDelete={onEdgesDelete}
          isValidConnection={isValidConnection}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onNodeDragStop={() => takeSnapshot()}
          onNodesDelete={() => takeSnapshot()}
          onMove={(_event, viewport) => {
            setCurrentZoom(Math.round(viewport.zoom * 100));
          }}
          onMoveEnd={(_event, viewport) => {
            setCurrentZoom(Math.round(viewport.zoom * 100));
          }}
          onInit={(instance) => {
            reactFlowInstance.current = instance;
            // Never zoom above 100% on initial load
            const allNodes = instance.getNodes();
            if (allNodes.length > 3) {
              instance.fitView({ maxZoom: 1, padding: 0.35, duration: 0 });
            } else {
              instance.zoomTo(1, { duration: 0 });
            }
            setCurrentZoom(Math.round(instance.getZoom() * 100));

            requestAnimationFrame(() => {
              const allNodeIds = allNodes.map((n) => n.id);
              allNodeIds.forEach((nid) => updateNodeInternals(nid));
            });
          }}
          nodeTypes={nodeTypes}
          defaultViewport={{ x: 100, y: 80, zoom: 1 }}
          defaultEdgeOptions={{
            type: 'smoothstep',
            style: {
              stroke: 'hsl(var(--border-strong))',
              strokeWidth: 2,
            },
          }}
          minZoom={0.2}
          maxZoom={2.0}
          panOnScroll={true}
          zoomOnPinch={true}
          panOnDrag={panMode ? [0, 1, 2] : [1, 2]}
          selectionOnDrag={!panMode}
          snapToGrid={true}
          snapGrid={[16, 16]}
          deleteKeyCode={["Backspace", "Delete"]}
          proOptions={{ hideAttribution: true }}
          className="bg-[#fafafa] dark:bg-[#0c0d0e]"
        >
          {/* Bottom-left: Real-time auto-saved indicator (StackAI style) */}
          <div className="absolute bottom-6 left-6 z-20 pointer-events-none flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/90 dark:bg-[#141517]/90 backdrop-blur-md border border-neutral-200/80 dark:border-neutral-800 shadow-sm text-xs text-foreground-lighter">
            {saveStatus === "saving" ? (
              <>
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                <span>Saving draft...</span>
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Auto-saved draft just now</span>
              </>
            )}
          </div>

          {/* Centered Floating HUD Dock (StackAI style) */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 pointer-events-auto flex items-center bg-white/95 dark:bg-[#141517]/95 backdrop-blur-md border border-neutral-200/80 dark:border-neutral-800 rounded-2xl px-2.5 py-1.5 shadow-[0_8px_30px_rgb(0_0_0/0.12)] gap-1.5">
            {/* ✨ Ask AI (Opens default Project Copilot from side panel) */}
            {onToggleCopilot && (
              <button
                type="button"
                onClick={onToggleCopilot}
                title="Open Project Copilot"
                className={`h-8 px-3 rounded-xl flex items-center gap-2 text-xs font-medium transition active:scale-95 ${
                  isCopilotOpen
                    ? "bg-foreground text-background shadow-xs"
                    : "text-foreground-light hover:text-foreground hover:bg-surface-200"
                }`}
              >
                <InteractiveCopilotAvatar size="tiny" isAwake={isCopilotOpen} />
                <span>Ask AI</span>
              </button>
            )}

            {/* + Add Block (StackAI style) */}
            <button
              type="button"
              onClick={() => setIsPaletteOpen((v) => !v)}
              title="Add Block to Canvas"
              className={`h-8 px-3.5 rounded-xl flex items-center gap-1.5 text-xs font-medium transition active:scale-95 shadow-xs ${
                isPaletteOpen
                  ? "bg-brand-500 text-white"
                  : "bg-[#17181A] text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-neutral-200"
              }`}
            >
              <Plus size={13} strokeWidth={2.5} />
              <span>Add</span>
            </button>

            <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-800 mx-0.5" />

            {/* History: Undo / Redo */}
            <button
              type="button"
              onClick={undo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              aria-label="Undo"
              className="h-8 w-8 rounded-xl flex items-center justify-center text-foreground-light hover:text-foreground hover:bg-surface-200 disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              <Undo2 size={14} />
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={!canRedo}
              title="Redo (Ctrl+Y)"
              aria-label="Redo"
              className="h-8 w-8 rounded-xl flex items-center justify-center text-foreground-light hover:text-foreground hover:bg-surface-200 disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              <Redo2 size={14} />
            </button>

            <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-800 mx-0.5" />

            {/* Zoom Controls with real-time percentage updates */}
            <button
              type="button"
              onClick={handleZoomOut}
              title="Zoom Out (-15%)"
              aria-label="Zoom Out"
              className="h-8 w-8 rounded-xl flex items-center justify-center text-foreground-light hover:text-foreground hover:bg-surface-200 transition active:scale-95"
            >
              <Minus size={14} />
            </button>

            <button
              type="button"
              onClick={handleZoomReset}
              title="Reset Zoom to 100%"
              aria-label="Reset Zoom to 100%"
              className="h-8 px-2 rounded-xl flex items-center justify-center text-[11px] font-mono font-medium text-foreground hover:bg-surface-200 transition active:scale-95"
            >
              {currentZoom}%
            </button>

            <button
              type="button"
              onClick={handleZoomIn}
              title="Zoom In (+15%)"
              aria-label="Zoom In"
              className="h-8 w-8 rounded-xl flex items-center justify-center text-foreground-light hover:text-foreground hover:bg-surface-200 transition active:scale-95"
            >
              <Plus size={14} />
            </button>

            <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-800 mx-0.5" />

            {/* Fit View (capped at 100%) */}
            <button
              type="button"
              onClick={() => reactFlowInstance.current?.fitView({ maxZoom: 1, padding: 0.25, duration: 250 })}
              title="Fit View to Screen (Max 100%)"
              aria-label="Fit View to Screen"
              className="h-8 w-8 rounded-xl flex items-center justify-center text-foreground-light hover:text-foreground hover:bg-surface-200 transition active:scale-95"
            >
              <Maximize2 size={14} />
            </button>

            {/* Pan vs Selection Mode */}
            <button
              type="button"
              onClick={() => setPanMode((p) => !p)}
              title={panMode ? "Pan Mode Active (Click for Box Selection)" : "Box Selection Active (Click for Pan Mode)"}
              aria-label="Toggle Pan/Select Mode"
              className={`h-8 w-8 rounded-xl flex items-center justify-center transition ${
                panMode ? "bg-surface-200 text-foreground" : "text-foreground-lighter hover:text-foreground hover:bg-surface-200/50"
              }`}
            >
              {panMode ? <Hand size={14} /> : <MousePointer size={14} />}
            </button>

            {/* Toggle MiniMap */}
            <button
              type="button"
              onClick={() => setShowMiniMap((v) => !v)}
              title={showMiniMap ? "Hide MiniMap" : "Show MiniMap"}
              aria-label="Toggle MiniMap"
              className={`h-8 w-8 rounded-xl flex items-center justify-center transition ${
                showMiniMap ? "bg-surface-200 text-brand" : "text-foreground-lighter hover:text-foreground hover:bg-surface-200/50"
              }`}
            >
              <Map size={14} />
            </button>

            {/* Toggle Grid Variant */}
            <button
              type="button"
              onClick={() =>
                setGridVariant((prev) =>
                  prev === BackgroundVariant.Dots ? BackgroundVariant.Lines : BackgroundVariant.Dots
                )
              }
              title="Toggle Grid Style (Dots / Lines)"
              aria-label="Toggle Grid Style"
              className="h-8 w-8 rounded-xl flex items-center justify-center text-foreground-lighter hover:text-foreground hover:bg-surface-200 transition"
            >
              <Grid size={14} />
            </button>
          </div>

          <Background
            variant={gridVariant}
            gap={24}
            size={gridVariant === BackgroundVariant.Lines ? 1 : 1.1}
            color="rgba(148, 163, 184, 0.35)"
          />

          {showMiniMap && (
            <div className="absolute bottom-6 right-6 z-10 pointer-events-auto">
              <MiniMap
                style={{
                  position: 'relative',
                  backgroundColor: 'hsl(var(--background-surface-100))',
                  border: '1px solid hsl(var(--border-default))',
                  borderRadius: 16,
                  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)',
                  margin: 0,
                }}
                nodeColor={(node) => {
                  const color = blockRegistry[node.data?.blockType]?.color;
                  const hex: Record<string, string> = {
                    emerald: '#34d399', violet: '#8b5cf6', amber: '#f59e0b',
                    orange: '#f97316', blue: '#3b82f6', teal: '#14b8a6', cyan: '#06b6d4', slate: '#94a3b8',
                  };
                  return hex[color] || '#71717a';
                }}
                maskColor="rgb(9 9 11 / 0.65)"
                pannable
                zoomable
              />
            </div>
          )}
        </ReactFlow>
      </div>

      {selectedNode && (
        <BlockConfigPanel
          node={selectedNode}
          onUpdate={handleUpdateConfig}
          onClose={() => setSelectedNodeId(null)}
          edges={edges}
          nodes={nodes}
          token={token}
          projectRef={projectRef}
        />
      )}
    </div>
    </WorkflowContext.Provider>
  );
}
