import React, { useState, useRef } from 'react'
import Link from 'next/link'
import {
  Database,
  ArrowUpRight,
  Check,
} from 'lucide-react'
import { toast } from 'sonner'
import { Skeleton, Tooltip, TooltipContent, TooltipTrigger, cn } from 'ui'

interface ServerResources {
  cpu?: { usagePercent: number; cores: number; model: string }
  memory?: { usedPercent: number; totalFormatted: string }
  disk?: { usedPercent: number; totalFormatted: string }
  database?: { activeConnections: number; maxConnections: number }
  host?: { region?: string; regionCode?: string; country?: string }
}

interface InfrastructureDiagramCanvasProps {
  projectRef: string
  serverResources?: ServerResources
  isLoading?: boolean
}

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

  const [copied, setCopied] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)

  // Dragging state
  const dragRef = useRef<{
    startX: number
    startY: number
    initialX: number
    initialY: number
    hasMoved: boolean
  }>({
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
    hasMoved: false,
  })

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: position.x,
      initialY: position.y,
      hasMoved: false,
    }
    setIsDragging(true)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY

    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      dragRef.current.hasMoved = true
    }

    setPosition({
      x: dragRef.current.initialX + dx,
      y: dragRef.current.initialY + dy,
    })
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      try {
        ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
      } catch {
        // noop
      }
      setIsDragging(false)
    }
  }

  const handleCopy = (e: React.MouseEvent) => {
    if (dragRef.current.hasMoved) return
    navigator.clipboard.writeText(primaryRegion)
    setCopied(true)
    toast.success(`Copied "${primaryRegion}" to clipboard`)
    setTimeout(() => setCopied(false), 2000)
  }

  // Live real data: only format if present, otherwise clean dash
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
      {/* Draggable Card Node (Adaptive width, generous breathing room, zero overflow) */}
      <div
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
          touchAction: 'none',
        }}
        onPointerDown={handlePointerDown}
        className={cn(
          'transition-shadow duration-150',
          isDragging ? 'cursor-grabbing z-30 scale-[1.01]' : 'cursor-grab z-10'
        )}
      >
        {isLoading ? (
          /* Sleek Skeleton Animation State */
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
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                onClick={handleCopy}
                className={cn(
                  'group relative w-[310px] rounded-lg border border-default bg-surface-100/95 backdrop-blur-xs px-4 py-3.5 shadow-xs transition-all duration-150',
                  'hover:border-foreground-muted hover:shadow-md hover:bg-surface-100',
                  isDragging && 'shadow-lg border-brand-500/60 ring-1 ring-brand-500/20'
                )}
              >
                {/* Top Row: Icon, Title & Region, Country Flag */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    {/* Database Green Icon */}
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shrink-0 mt-0.5">
                      <Database size={15} />
                    </div>

                    {/* Node Metadata (Adaptive, no broken wraps) */}
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-foreground tracking-tight truncate flex items-center gap-1.5">
                        <span>Primary Database</span>
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0 inline-block" />
                      </div>

                      <div className="text-[11px] text-foreground-light truncate mt-0.5">
                        {primaryRegionName}
                      </div>

                      <div className="text-[10px] text-foreground-lighter font-mono mt-0.5 whitespace-nowrap truncate">
                        <span>{primaryRegion}</span>
                        <span className="mx-1">·</span>
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

                {/* Resource Metrics Strip: Fitted with comfortable spacing, never overflows */}
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
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-surface-100/95 backdrop-blur-xs border border-default shadow-xs text-[10px] font-medium text-foreground-light hover:text-foreground hover:border-foreground-muted transition-all"
                  >
                    <span>Go to database report</span>
                    <ArrowUpRight size={10} className="text-foreground-lighter" />
                  </Link>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {copied ? 'Copied to clipboard!' : 'Click to copy'}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  )
}
