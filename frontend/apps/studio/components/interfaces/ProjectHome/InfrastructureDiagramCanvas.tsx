import React, { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import {
  Database,
  ArrowUpRight,
  Copy,
  Check,
  RotateCcw,
  Plus,
  Server,
  Layers,
  Activity,
  Globe,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge, Button, Tooltip, TooltipContent, TooltipTrigger, cn } from 'ui'

interface ServerNodeData {
  id: string
  name: string
  role: 'primary' | 'replica' | 'edge'
  regionName: string
  regionCode: string
  flagSvg: string
  computeSize: string
  cpuUsage: number
  diskUsage: number
  ramUsage: number
  connections: string
  status: 'healthy' | 'warning' | 'degraded'
}

interface InfrastructureDiagramCanvasProps {
  projectRef: string
  serverResources?: {
    cpu?: { usagePercent: number; cores: number; model: string }
    memory?: { usedPercent: number; totalFormatted: string }
    disk?: { usedPercent: number; totalFormatted: string }
    database?: { activeConnections: number; maxConnections: number }
    host?: { region?: string; regionCode?: string; country?: string }
  }
}

export function InfrastructureDiagramCanvas({
  projectRef,
  serverResources,
}: InfrastructureDiagramCanvasProps) {
  const router = useRouter()
  const canvasRef = useRef<HTMLDivElement>(null)

  // Primary node config with dynamic real-time stats fallback
  const primaryRegion = serverResources?.host?.regionCode || 'ap-south-1'
  const primaryRegionName = serverResources?.host?.region || 'South Asia (Mumbai)'
  const primaryCompute = serverResources?.cpu?.cores
    ? `${serverResources.cpu.cores} Cores · ${serverResources.memory?.totalFormatted || 'RAM'}`
    : 'Nano'

  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [showReplica, setShowReplica] = useState(false)

  // Positions for nodes (relative to canvas center)
  const [positions, setPositions] = useState<{ [key: string]: { x: number; y: number } }>({
    primary: { x: 0, y: 0 },
    replica: { x: 60, y: 120 },
  })

  // Dragging state
  const dragRef = useRef<{
    activeId: string | null
    startX: number
    startY: number
    initialX: number
    initialY: number
    hasMoved: boolean
  }>({
    activeId: null,
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
    hasMoved: false,
  })

  const [activeDragId, setActiveDragId] = useState<string | null>(null)

  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    // Only drag with left mouse button
    if (e.button !== 0) return
    const currentPos = positions[id] || { x: 0, y: 0 }
    dragRef.current = {
      activeId: id,
      startX: e.clientX,
      startY: e.clientY,
      initialX: currentPos.x,
      initialY: currentPos.y,
      hasMoved: false,
    }
    setActiveDragId(id)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.activeId) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY

    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      dragRef.current.hasMoved = true
    }

    const id = dragRef.current.activeId
    setPositions((prev) => ({
      ...prev,
      [id]: {
        x: dragRef.current.initialX + dx,
        y: dragRef.current.initialY + dy,
      },
    }))
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragRef.current.activeId) {
      try {
        ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
      } catch {
        // noop
      }
      dragRef.current.activeId = null
      setActiveDragId(null)
    }
  }

  const handleCopyLocation = (e: React.MouseEvent, id: string, text: string) => {
    e.stopPropagation()
    e.preventDefault()
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    toast.success(`Copied "${text}" to clipboard`)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const resetPositions = () => {
    setPositions({
      primary: { x: 0, y: 0 },
      replica: { x: 60, y: 120 },
    })
    toast.info('Diagram node positions reset')
  }

  const primaryNode: ServerNodeData = {
    id: 'primary',
    name: 'Primary Database',
    role: 'primary',
    regionName: primaryRegionName,
    regionCode: primaryRegion,
    flagSvg: `/img/regions/${primaryRegion}.svg`,
    computeSize: primaryCompute,
    cpuUsage: serverResources?.cpu?.usagePercent ?? 2,
    diskUsage: serverResources?.disk?.usedPercent ?? 3,
    ramUsage: serverResources?.memory?.usedPercent ?? 46,
    connections: serverResources?.database
      ? `${serverResources.database.activeConnections}/${serverResources.database.maxConnections}`
      : '8/60',
    status: 'healthy',
  }

  const replicaNode: ServerNodeData = {
    id: 'replica',
    name: 'Read Replica (EU Central)',
    role: 'replica',
    regionName: 'Europe (Frankfurt)',
    regionCode: 'eu-central-1',
    flagSvg: '/img/regions/eu-central-1.svg',
    computeSize: 'Micro',
    cpuUsage: 1,
    diskUsage: 3,
    ramUsage: 32,
    connections: '2/60',
    status: 'healthy',
  }

  const nodes = showReplica ? [primaryNode, replicaNode] : [primaryNode]

  return (
    <div
      ref={canvasRef}
      className="relative w-full h-full min-h-[320px] overflow-hidden select-none"
      style={{
        backgroundImage: 'radial-gradient(rgba(128, 128, 128, 0.25) 1.5px, transparent 1.5px)',
        backgroundSize: '20px 20px',
        backgroundColor: 'transparent',
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Canvas Top Bar Controls */}
      <div className="absolute top-3 left-3 z-30 flex items-center gap-1.5 bg-surface-100/90 backdrop-blur-md rounded-lg border border-default p-1 shadow-xs">
        <Button
          type="text"
          size="tiny"
          icon={<RotateCcw size={12} />}
          onClick={resetPositions}
          title="Reset node positions"
          className="text-foreground-light hover:text-foreground h-6 px-1.5 text-[11px]"
        >
          Reset View
        </Button>
        <span className="h-3 w-px bg-border" />
        <Button
          type="text"
          size="tiny"
          icon={showReplica ? <Layers size={12} /> : <Plus size={12} />}
          onClick={() => setShowReplica(!showReplica)}
          title={showReplica ? 'Hide Replica' : 'Add Read Replica'}
          className={cn(
            'h-6 px-2 text-[11px]',
            showReplica ? 'text-brand-500 font-medium' : 'text-foreground-light hover:text-foreground'
          )}
        >
          {showReplica ? 'Replica Visible' : '+ Add Location'}
        </Button>
      </div>

      {/* SVG Connector Lines if multiple nodes are visible */}
      {showReplica && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
          <defs>
            <linearGradient id="connectorGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.8" />
            </linearGradient>
          </defs>
          {(() => {
            const pX = (canvasRef.current?.clientWidth || 500) / 2 + (positions.primary?.x || 0)
            const pY = (canvasRef.current?.clientHeight || 300) / 2 + (positions.primary?.y || 0)
            const rX = (canvasRef.current?.clientWidth || 500) / 2 + (positions.replica?.x || 60)
            const rY = (canvasRef.current?.clientHeight || 300) / 2 + (positions.replica?.y || 120)
            const midY = (pY + rY) / 2
            return (
              <path
                d={`M ${pX} ${pY} C ${pX} ${midY}, ${rX} ${midY}, ${rX} ${rY}`}
                fill="none"
                stroke="url(#connectorGradient)"
                strokeWidth="2"
                strokeDasharray="4 4"
                className="animate-pulse"
              />
            )
          })()}
        </svg>
      )}

      {/* Nodes Container */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {nodes.map((node) => {
          const pos = positions[node.id] || { x: 0, y: 0 }
          const isDragging = activeDragId === node.id

          return (
            <div
              key={node.id}
              style={{
                transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
                touchAction: 'none',
              }}
              onPointerDown={(e) => handlePointerDown(e, node.id)}
              className={cn(
                'absolute pointer-events-auto transition-shadow duration-150',
                isDragging ? 'cursor-grabbing z-30 scale-[1.02]' : 'cursor-grab z-10'
              )}
            >
              <div
                className={cn(
                  'group relative w-[340px] rounded-xl border border-default bg-surface-100/95 backdrop-blur-md p-4 shadow-md transition-all duration-200',
                  'hover:border-foreground-muted hover:shadow-xl hover:bg-surface-100',
                  isDragging && 'shadow-2xl border-brand-500/80 ring-2 ring-brand-500/20'
                )}
              >
                {/* Drag Handle Top Indicator */}
                <div className="flex justify-center mb-1 -mt-1 opacity-20 group-hover:opacity-60 transition-opacity">
                  <div className="w-8 h-1 rounded-full bg-foreground" />
                </div>

                {/* Top Row: Icon, Title, Location, and Flag */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-lg border shrink-0 mt-0.5 shadow-2xs',
                        node.role === 'primary'
                          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/25'
                          : 'bg-blue-500/10 text-blue-500 border-blue-500/25'
                      )}
                    >
                      {node.role === 'primary' ? <Database size={18} /> : <Server size={18} />}
                    </div>

                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground tracking-tight flex items-center gap-1.5">
                        <span className="truncate">{node.name}</span>
                        {node.role === 'primary' && (
                          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        )}
                      </div>
                      <div className="text-xs text-foreground-light mt-0.5 truncate">
                        {node.regionName}
                      </div>

                      {/* Region & Compute Specs + Copy Button */}
                      <div className="text-[11px] text-foreground-lighter font-mono mt-1 flex items-center gap-1.5">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={(e) => handleCopyLocation(e, node.id, node.regionCode)}
                              className="hover:text-foreground hover:underline inline-flex items-center gap-1 bg-surface-200/60 px-1 py-0.5 rounded transition-colors"
                            >
                              <span>{node.regionCode}</span>
                              {copiedId === node.id ? (
                                <Check size={10} className="text-emerald-500" />
                              ) : (
                                <Copy size={10} className="opacity-70" />
                              )}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            {copiedId === node.id ? 'Copied!' : 'Click to copy region'}
                          </TooltipContent>
                        </Tooltip>
                        <span>·</span>
                        <span className="truncate">{node.computeSize}</span>
                      </div>
                    </div>
                  </div>

                  {/* Flag Image */}
                  <div className="shrink-0">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <img
                          src={node.flagSvg}
                          alt={node.regionName}
                          onError={(e) => {
                            // Fallback to generic globe if specific region flag missing
                            e.currentTarget.style.display = 'none'
                          }}
                          className="w-7 h-5 rounded-[3px] border border-default shadow-xs object-cover mt-1"
                        />
                      </TooltipTrigger>
                      <TooltipContent side="left">
                        Location: {node.regionName} ({node.regionCode})
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>

                {/* Resource Metrics Strip */}
                <div className="mt-3.5 pt-2.5 border-t border-default/70 flex items-center justify-between text-[11px] font-mono text-foreground-light">
                  <div className="flex items-center gap-1">
                    <span className="text-foreground-lighter">CPU</span>
                    <strong className="text-foreground font-semibold">{node.cpuUsage}%</strong>
                  </div>
                  <span className="text-foreground-lighter">·</span>
                  <div className="flex items-center gap-1">
                    <span className="text-foreground-lighter">Disk</span>
                    <strong className="text-foreground font-semibold">{node.diskUsage}%</strong>
                  </div>
                  <span className="text-foreground-lighter">·</span>
                  <div className="flex items-center gap-1">
                    <span className="text-foreground-lighter">RAM</span>
                    <strong className="text-foreground font-semibold">{node.ramUsage}%</strong>
                  </div>
                  <span className="text-foreground-lighter">·</span>
                  <div className="flex items-center gap-1">
                    <strong className="text-foreground font-semibold">{node.connections}</strong>
                    <span className="text-foreground-lighter">conns</span>
                  </div>
                </div>

                {/* "Go to database report" Hover Bar */}
                <div className="mt-2.5 pt-2 border-t border-dashed border-default/60 flex items-center justify-between">
                  <Link
                    href={`/project/${projectRef}/observability/database`}
                    onClick={(e) => {
                      if (dragRef.current.hasMoved) {
                        e.preventDefault()
                      }
                    }}
                    className="w-full inline-flex items-center justify-center gap-1.5 py-1 text-xs font-medium text-brand-500 hover:text-brand-600 transition-colors group/link"
                  >
                    <span>Go to database report</span>
                    <ArrowUpRight
                      size={13}
                      className="group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform"
                    />
                  </Link>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
