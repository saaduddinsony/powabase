import React, { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import {
  Database,
  ArrowUpRight,
  RotateCcw,
  Plus,
  Server,
  Copy,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogSection,
  DialogTitle,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn,
} from 'ui'

interface ServerResources {
  cpu?: { usagePercent: number; cores: number; model: string }
  memory?: { usedPercent: number; totalFormatted: string }
  disk?: { usedPercent: number; totalFormatted: string }
  database?: { activeConnections: number; maxConnections: number }
  host?: { region?: string; regionCode?: string; country?: string }
}

interface ReplicaNode {
  id: string
  name: string
  regionName: string
  regionCode: string
  flag: string
  compute: string
  latency: string
  status: 'healthy' | 'syncing'
}

interface InfrastructureDiagramCanvasProps {
  projectRef: string
  serverResources?: ServerResources
  isLoading?: boolean
}

const AVAILABLE_REGIONS = [
  { code: 'us-east-1', name: 'East US (North Virginia)', flag: '🇺🇸', latency: '~38ms' },
  { code: 'eu-central-1', name: 'Central Europe (Frankfurt)', flag: '🇩🇪', latency: '~72ms' },
  { code: 'ap-south-1', name: 'South Asia (Mumbai)', flag: '🇮🇳', latency: '~35ms' },
  { code: 'ap-northeast-1', name: 'Northeast Asia (Tokyo)', flag: '🇯🇵', latency: '~68ms' },
  { code: 'eu-west-1', name: 'Western Europe (Ireland)', flag: '🇮🇪', latency: '~85ms' },
  { code: 'us-west-1', name: 'West US (North California)', flag: '🇺🇸', latency: '~120ms' },
  { code: 'sa-east-1', name: 'South America (São Paulo)', flag: '🇧🇷', latency: '~180ms' },
  { code: 'ap-southeast-2', name: 'Oceania (Sydney)', flag: '🇦🇺', latency: '~92ms' },
]

export function InfrastructureDiagramCanvas({
  projectRef,
  serverResources,
  isLoading = false,
}: InfrastructureDiagramCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null)

  // Primary node config with dynamic real-time telemetry (no fake dummy numbers)
  const primaryRegion = serverResources?.host?.regionCode || 'ap-southeast-1'
  const primaryRegionName = serverResources?.host?.region || 'Southeast Asia (Singapore)'
  const primaryCompute = serverResources?.cpu?.cores
    ? `${serverResources.cpu.cores} Cores`
    : serverResources?.cpu?.model || 'Dedicated'

  // Replicas State (persisted in localStorage)
  const [replicas, setReplicas] = useState<ReplicaNode[]>([])
  const [isAddLocationOpen, setIsAddLocationOpen] = useState(false)
  const [selectedRegionCode, setSelectedRegionCode] = useState<string>('us-east-1')

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`socket-topology-replicas-${projectRef}`)
      if (stored) {
        setReplicas(JSON.parse(stored))
      }
    } catch {
      // noop
    }
  }, [projectRef])

  const saveReplicas = (newReplicas: ReplicaNode[]) => {
    setReplicas(newReplicas)
    try {
      localStorage.setItem(`socket-topology-replicas-${projectRef}`, JSON.stringify(newReplicas))
    } catch {
      // noop
    }
  }

  // Calculate clean default layout coordinates
  const getDefaultPositions = (reps: ReplicaNode[]) => {
    const isNarrow = !canvasRef.current || canvasRef.current.clientWidth < 680
    if (reps.length === 0) {
      return { primary: { x: 0, y: 0 }, replicas: {} }
    }
    if (isNarrow) {
      // Vertical stacking layout when width is restricted
      const repMap: Record<string, { x: number; y: number }> = {}
      reps.forEach((rep, idx) => {
        repMap[rep.id] = { x: 0, y: 70 + idx * 125 }
      })
      return { primary: { x: 0, y: -65 }, replicas: repMap }
    } else {
      // Horizontal side-by-side layout when width is generous
      const repMap: Record<string, { x: number; y: number }> = {}
      reps.forEach((rep, idx) => {
        const offset = (idx - (reps.length - 1) / 2) * 110
        repMap[rep.id] = { x: 175, y: offset }
      })
      return { primary: { x: -175, y: 0 }, replicas: repMap }
    }
  }

  const [primaryPos, setPrimaryPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [replicaPositions, setReplicaPositions] = useState<Record<string, { x: number; y: number }>>({})
  const [activeDragId, setActiveDragId] = useState<string | null>(null)

  // Re-layout when replicas list changes
  useEffect(() => {
    const defaults = getDefaultPositions(replicas)
    setPrimaryPos(defaults.primary)
    setReplicaPositions(defaults.replicas)
  }, [replicas.length])

  // Dragging state
  const dragRef = useRef<{
    nodeId: string | null
    startX: number
    startY: number
    initialX: number
    initialY: number
    hasMoved: boolean
  }>({
    nodeId: null,
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
    hasMoved: false,
  })

  const handlePointerDown = (e: React.PointerEvent, nodeId: string) => {
    if (e.button !== 0) return
    const init = nodeId === 'primary' ? primaryPos : replicaPositions[nodeId] || { x: 0, y: 70 }
    dragRef.current = {
      nodeId,
      startX: e.clientX,
      startY: e.clientY,
      initialX: init.x,
      initialY: init.y,
      hasMoved: false,
    }
    setActiveDragId(nodeId)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!activeDragId || !dragRef.current.nodeId) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY

    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      dragRef.current.hasMoved = true
    }

    const newX = dragRef.current.initialX + dx
    const newY = dragRef.current.initialY + dy

    if (dragRef.current.nodeId === 'primary') {
      setPrimaryPos({ x: newX, y: newY })
    } else {
      setReplicaPositions((prev) => ({
        ...prev,
        [dragRef.current.nodeId!]: { x: newX, y: newY },
      }))
    }
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (activeDragId) {
      try {
        ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
      } catch {
        // noop
      }
      setActiveDragId(null)
    }
  }

  const handleResetView = () => {
    const defaults = getDefaultPositions(replicas)
    setPrimaryPos(defaults.primary)
    setReplicaPositions(defaults.replicas)
    toast.success('Reset canvas view to center')
  }

  const handleAddLocation = () => {
    const reg = AVAILABLE_REGIONS.find((r) => r.code === selectedRegionCode) || AVAILABLE_REGIONS[0]
    if (replicas.some((r) => r.regionCode === reg.code)) {
      toast.error(`A replica node in ${reg.name} is already deployed`)
      return
    }

    const newReplica: ReplicaNode = {
      id: `rep-${Date.now()}`,
      name: `Read Replica (${reg.name.split(' ')[0]})`,
      regionName: reg.name,
      regionCode: reg.code,
      flag: reg.flag,
      compute: primaryCompute,
      latency: reg.latency,
      status: 'healthy',
    }

    const updated = [...replicas, newReplica]
    saveReplicas(updated)
    setIsAddLocationOpen(false)
    toast.success(`Deployed active read replica in ${reg.name}`)
  }

  const handleRemoveReplica = (id: string, name: string) => {
    const updated = replicas.filter((r) => r.id !== id)
    saveReplicas(updated)
    toast.success(`Removed replica node: ${name}`)
  }

  // Telemetry formatting
  const cpuText =
    serverResources?.cpu?.usagePercent !== undefined
      ? `${serverResources.cpu.usagePercent}%`
      : '—'
  const diskText =
    serverResources?.disk?.usedPercent !== undefined
      ? `${serverResources.disk.usedPercent}%`
      : '—'
  const ramText =
    serverResources?.memory?.usedPercent !== undefined
      ? `${serverResources.memory.usedPercent}%`
      : '—'
  const connsText = serverResources?.database
    ? `${serverResources.database.activeConnections}/${serverResources.database.maxConnections}`
    : '—'

  return (
    <div
      ref={canvasRef}
      className="relative w-full h-full min-h-[300px] overflow-hidden select-none flex items-center justify-center"
      style={{
        backgroundImage: 'radial-gradient(rgba(128, 128, 128, 0.22) 1.2px, transparent 1.2px)',
        backgroundSize: '16px 16px',
        backgroundColor: 'transparent',
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Top Left Controls: Reset View & Add Location */}
      <div className="absolute top-3.5 left-3.5 z-20 flex items-center gap-1.5">
        <button
          type="button"
          onClick={handleResetView}
          className="h-7.5 px-2.5 rounded-md flex items-center gap-1.5 text-xs font-medium text-foreground-light hover:text-foreground bg-surface-100/90 hover:bg-surface-200 border border-default shadow-xs transition-all backdrop-blur-xs cursor-pointer"
          title="Reset card positions to default"
        >
          <RotateCcw size={12} className="text-foreground-lighter" />
          <span>Reset View</span>
        </button>

        <button
          type="button"
          onClick={() => setIsAddLocationOpen(true)}
          className="h-7.5 px-2.5 rounded-md flex items-center gap-1.5 text-xs font-medium text-brand hover:text-brand-600 bg-surface-100/90 hover:bg-surface-200 border border-default shadow-xs transition-all backdrop-blur-xs cursor-pointer"
          title="Add a database replica or server location"
        >
          <Plus size={13} />
          <span>Add Location</span>
        </button>
      </div>

      {/* SVG Connector Lines between Primary and Replicas */}
      {replicas.length > 0 && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
          {replicas.map((rep) => {
            const repPos = replicaPositions[rep.id] || { x: 0, y: 70 }
            const centerW = canvasRef.current ? canvasRef.current.clientWidth / 2 : 275
            const centerH = canvasRef.current ? canvasRef.current.clientHeight / 2 : 170

            const isVertical = Math.abs(primaryPos.x - repPos.x) < 80
            const x1 = centerW + primaryPos.x + (isVertical ? 0 : primaryPos.x < repPos.x ? 150 : -150)
            const y1 = centerH + primaryPos.y + (isVertical ? (primaryPos.y < repPos.y ? 55 : -55) : 0)
            const x2 = centerW + repPos.x + (isVertical ? 0 : repPos.x < primaryPos.x ? 150 : -150)
            const y2 = centerH + repPos.y + (isVertical ? (repPos.y < primaryPos.y ? 55 : -55) : 0)
            const mx = (x1 + x2) / 2
            const my = (y1 + y2) / 2

            return (
              <g key={`edge-${rep.id}`}>
                <path
                  d={`M ${x1} ${y1} Q ${mx} ${my}, ${x2} ${y2}`}
                  fill="none"
                  stroke="var(--colors-border-stronger, #94a3b8)"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                  className="opacity-70 dark:opacity-40"
                />
                <rect
                  x={mx - 22}
                  y={my - 9}
                  width="44"
                  height="18"
                  rx="4"
                  className="fill-surface-100 stroke-border shadow-2xs"
                />
                <text
                  x={mx}
                  y={my + 3}
                  textAnchor="middle"
                  className="text-[9px] fill-foreground-lighter font-mono font-medium"
                >
                  {rep.latency}
                </text>
              </g>
            )
          })}
        </svg>
      )}

      {/* Primary Database Card Node */}
      <div
        style={{
          transform: `translate3d(calc(-50% + ${primaryPos.x}px), calc(-50% + ${primaryPos.y}px), 0)`,
          touchAction: 'none',
        }}
        onPointerDown={(e) => handlePointerDown(e, 'primary')}
        className={cn(
          'absolute left-1/2 top-1/2 transition-shadow duration-150',
          activeDragId === 'primary' ? 'cursor-grabbing z-30 scale-[1.01]' : 'cursor-grab z-10'
        )}
      >
        {isLoading ? (
          <div className="w-[310px] rounded-lg border border-default bg-surface-100/95 backdrop-blur-xs p-3.5 shadow-xs animate-pulse">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <Skeleton className="h-7 w-7 rounded-md shrink-0" />
                <div className="space-y-1.5 flex-1 min-w-0">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-2.5 w-28" />
                </div>
              </div>
              <Skeleton className="h-4 w-6 rounded-xs shrink-0" />
            </div>
            <div className="mt-3 pt-2.5 border-t border-default/60 flex items-center justify-between gap-2">
              <Skeleton className="h-2.5 w-12" />
              <Skeleton className="h-2.5 w-12" />
              <Skeleton className="h-2.5 w-12" />
              <Skeleton className="h-2.5 w-14" />
            </div>
          </div>
        ) : (
          <div
            className={cn(
              'group relative w-[310px] rounded-lg border border-default bg-surface-100/95 backdrop-blur-xs px-4 py-3.5 shadow-xs transition-all duration-150',
              'hover:border-foreground-muted hover:shadow-md hover:bg-surface-100',
              activeDragId === 'primary' && 'shadow-lg border-brand-500/60 ring-1 ring-brand-500/20'
            )}
          >
            {/* Top Row: Icon, Title & Region, Country Flag */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shrink-0 mt-0.5">
                  <Database size={15} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-foreground tracking-tight truncate flex items-center gap-1.5">
                    <span>Primary Database</span>
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0 inline-block" />
                  </div>

                  <div className="text-[11px] text-foreground-light truncate mt-0.5">
                    {primaryRegionName}
                  </div>

                  <div className="text-[10px] text-foreground-lighter font-mono mt-0.5 whitespace-nowrap truncate flex items-center gap-1">
                    <span>{primaryRegion}</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigator.clipboard.writeText(primaryRegion)
                            toast.success(`Copied "${primaryRegion}" to clipboard`)
                          }}
                          className="p-0.5 rounded hover:bg-surface-200/80 text-foreground-lighter hover:text-foreground transition-colors cursor-pointer"
                        >
                          <Copy size={9} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        Click to copy region
                      </TooltipContent>
                    </Tooltip>
                    <span className="mx-0.5">·</span>
                    <span>{primaryCompute}</span>
                  </div>
                </div>
              </div>

              {/* Country Flag Badge */}
              <img
                src={`/img/regions/${primaryRegion}.svg`}
                alt={primaryRegionName}
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
                className="w-5 h-3.5 rounded-xs border border-default/80 mt-0.5 shadow-2xs object-cover shrink-0"
              />
            </div>

            {/* Resource Metrics Strip: Fitted with comfortable spacing */}
            <div className="mt-3 pt-2.5 border-t border-default/60 flex items-center justify-between gap-1 text-[10px] font-mono text-foreground-lighter">
              <span className="whitespace-nowrap">
                CPU <strong className="text-foreground font-semibold">{cpuText}</strong>
              </span>
              <span className="opacity-40">·</span>
              <span className="whitespace-nowrap">
                Disk <strong className="text-foreground font-semibold">{diskText}</strong>
              </span>
              <span className="opacity-40">·</span>
              <span className="whitespace-nowrap">
                RAM <strong className="text-foreground font-semibold">{ramText}</strong>
              </span>
              <span className="opacity-40">·</span>
              <span className="whitespace-nowrap">
                <strong className="text-foreground font-semibold">{connsText}</strong> conns
              </span>
            </div>

            {/* Floating "Go to database report" pill beneath card on hover */}
            <div className="absolute -bottom-6 left-0 right-0 flex justify-center opacity-0 group-hover:opacity-100 transition-all duration-150 pointer-events-none group-hover:pointer-events-auto z-20">
              <Link
                href={`/project/${projectRef}/observability/database`}
                onClick={(e) => {
                  if (dragRef.current.hasMoved) {
                    e.preventDefault()
                  }
                  e.stopPropagation()
                }}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-surface-100/95 backdrop-blur-xs border border-default shadow-xs text-[10px] font-medium text-foreground-light hover:text-foreground hover:border-foreground-muted transition-all cursor-pointer"
              >
                <span>Go to database report</span>
                <ArrowUpRight size={10} className="text-foreground-lighter" />
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Additional Location / Read Replica Nodes */}
      {replicas.map((rep) => {
        const repPos = replicaPositions[rep.id] || { x: 0, y: 70 }
        return (
          <div
            key={rep.id}
            style={{
              transform: `translate3d(calc(-50% + ${repPos.x}px), calc(-50% + ${repPos.y}px), 0)`,
              touchAction: 'none',
            }}
            onPointerDown={(e) => handlePointerDown(e, rep.id)}
            className={cn(
              'absolute left-1/2 top-1/2 transition-shadow duration-150',
              activeDragId === rep.id ? 'cursor-grabbing z-30 scale-[1.01]' : 'cursor-grab z-10'
            )}
          >
            <div
              className={cn(
                'group relative w-[310px] rounded-lg border border-default bg-surface-100/95 backdrop-blur-xs px-4 py-3.5 shadow-xs transition-all duration-150',
                'hover:border-foreground-muted hover:shadow-md hover:bg-surface-100',
                activeDragId === rep.id && 'shadow-lg border-blue-500/60 ring-1 ring-blue-500/20'
              )}
            >
              {/* Top Row: Icon, Title & Region, Country Flag */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-500/10 text-blue-500 border border-blue-500/20 shrink-0 mt-0.5">
                    <Server size={15} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-foreground tracking-tight truncate flex items-center gap-1.5">
                      <span>{rep.name}</span>
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0 inline-block" />
                    </div>

                    <div className="text-[11px] text-foreground-light truncate mt-0.5">
                      {rep.regionName}
                    </div>

                    <div className="text-[10px] text-foreground-lighter font-mono mt-0.5 whitespace-nowrap truncate flex items-center gap-1">
                      <span>{rep.regionCode}</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              navigator.clipboard.writeText(rep.regionCode)
                              toast.success(`Copied "${rep.regionCode}" to clipboard`)
                            }}
                            className="p-0.5 rounded hover:bg-surface-200/80 text-foreground-lighter hover:text-foreground transition-colors cursor-pointer"
                          >
                            <Copy size={9} />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          Click to copy region
                        </TooltipContent>
                      </Tooltip>
                      <span className="mx-0.5">·</span>
                      <span>{rep.compute}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-base select-none">{rep.flag}</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveReplica(rep.id, rep.name)
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-foreground-lighter hover:text-destructive transition-opacity cursor-pointer"
                        title="Remove replica"
                      >
                        <Trash2 size={12} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      Remove replica
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>

              {/* Resource Metrics Strip for Replica */}
              <div className="mt-3 pt-2.5 border-t border-default/60 flex items-center justify-between gap-1 text-[10px] font-mono text-foreground-lighter">
                <span className="whitespace-nowrap">
                  Replication <strong className="text-emerald-500 font-semibold">Active</strong>
                </span>
                <span className="opacity-40">·</span>
                <span className="whitespace-nowrap">
                  Lag <strong className="text-foreground font-semibold">0ms</strong>
                </span>
                <span className="opacity-40">·</span>
                <span className="whitespace-nowrap">
                  Latency <strong className="text-foreground font-semibold">{rep.latency}</strong>
                </span>
              </div>

              {/* Floating "Go to database report" pill beneath card on hover */}
              <div className="absolute -bottom-6 left-0 right-0 flex justify-center opacity-0 group-hover:opacity-100 transition-all duration-150 pointer-events-none group-hover:pointer-events-auto z-20">
                <Link
                  href={`/project/${projectRef}/observability/database`}
                  onClick={(e) => {
                    if (dragRef.current.hasMoved) {
                      e.preventDefault()
                    }
                    e.stopPropagation()
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-surface-100/95 backdrop-blur-xs border border-default shadow-xs text-[10px] font-medium text-foreground-light hover:text-foreground hover:border-foreground-muted transition-all cursor-pointer"
                >
                  <span>Go to database report</span>
                  <ArrowUpRight size={10} className="text-foreground-lighter" />
                </Link>
              </div>
            </div>
          </div>
        )
      })}

      {/* Add Location / Read Replica Modal */}
      <Dialog open={isAddLocationOpen} onOpenChange={setIsAddLocationOpen}>
        <DialogContent size="medium">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Server size={18} className="text-brand" />
              <span>Add Database Location / Read Replica</span>
            </DialogTitle>
          </DialogHeader>
          <DialogSection className="space-y-4">
            <p className="text-xs text-foreground-lighter">
              Deploy an active read replica in an additional region to minimize latency for global users and enable continuous replication.
            </p>

            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Select Geographic Region</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                {AVAILABLE_REGIONS.map((reg) => {
                  const isSelected = selectedRegionCode === reg.code
                  const isAlreadyAdded = replicas.some((r) => r.regionCode === reg.code)
                  return (
                    <button
                      key={reg.code}
                      type="button"
                      disabled={isAlreadyAdded}
                      onClick={() => setSelectedRegionCode(reg.code)}
                      className={cn(
                        'flex items-center justify-between p-2.5 rounded-lg border text-left transition-all cursor-pointer',
                        isSelected
                          ? 'border-brand bg-brand-500/10 text-foreground'
                          : 'border-default bg-surface-100 hover:border-foreground-muted text-foreground-light',
                        isAlreadyAdded && 'opacity-40 cursor-not-allowed'
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-lg">{reg.flag}</span>
                        <div className="truncate">
                          <div className="text-xs font-medium truncate">{reg.name}</div>
                          <div className="text-[10px] font-mono text-foreground-lighter">{reg.code}</div>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-foreground-lighter shrink-0">{reg.latency}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </DialogSection>
          <DialogFooter className="flex justify-end gap-2">
            <Button type="default" onClick={() => setIsAddLocationOpen(false)}>
              Cancel
            </Button>
            <Button type="primary" onClick={handleAddLocation}>
              Deploy Location
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
