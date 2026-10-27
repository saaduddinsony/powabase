import React, { useState, useRef } from 'react'
import Link from 'next/link'
import {
  Database,
  ArrowUpRight,
  Check,
  Copy,
} from 'lucide-react'
import { toast } from 'sonner'
import { Tooltip, TooltipContent, TooltipTrigger, cn } from 'ui'

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
}

export function InfrastructureDiagramCanvas({
  projectRef,
  serverResources,
}: InfrastructureDiagramCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null)

  // Primary node config with dynamic real-time stats fallback
  const primaryRegion = serverResources?.host?.regionCode || 'ap-south-1'
  const primaryRegionName = serverResources?.host?.region || 'South Asia (Mumbai)'
  const primaryCompute = serverResources?.cpu?.cores
    ? `${serverResources.cpu.cores} Cores`
    : 'Nano'

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

  const cpuPercent = serverResources?.cpu?.usagePercent ?? 2
  const diskPercent = serverResources?.disk?.usedPercent ?? 3
  const ramPercent = serverResources?.memory?.usedPercent ?? 46
  const conns = serverResources?.database
    ? `${serverResources.database.activeConnections}/${serverResources.database.maxConnections}`
    : '8/60'

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
      {/* Draggable Card Node (Matching Supabase's exact compact proportions) */}
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
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              onClick={handleCopy}
              className={cn(
                'group relative w-[270px] rounded-lg border border-default bg-surface-100/95 backdrop-blur-xs p-3 shadow-xs transition-all duration-150',
                'hover:border-foreground-muted hover:shadow-md hover:bg-surface-100',
                isDragging && 'shadow-lg border-brand-500/60 ring-1 ring-brand-500/20'
              )}
            >
              {/* Top Row: Icon, Title & Region, Country Flag */}
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex items-start gap-2.5 min-w-0">
                  {/* Database Green Icon */}
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shrink-0 mt-0.5">
                    <Database size={15} />
                  </div>

                  {/* Node Metadata (Clean, no broken wraps) */}
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-foreground tracking-tight truncate flex items-center gap-1.5">
                      <span>Primary Database</span>
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

              {/* Resource Metrics Strip: One clean horizontal line */}
              <div className="mt-2.5 pt-2 border-t border-default/60 flex items-center justify-between text-[10px] font-mono text-foreground-lighter">
                <span className="whitespace-nowrap">
                  CPU <strong className="text-foreground font-semibold">{cpuPercent}%</strong>
                </span>
                <span>·</span>
                <span className="whitespace-nowrap">
                  Disk <strong className="text-foreground font-semibold">{diskPercent}%</strong>
                </span>
                <span>·</span>
                <span className="whitespace-nowrap">
                  RAM <strong className="text-foreground font-semibold">{ramPercent}%</strong>
                </span>
                <span>·</span>
                <span className="whitespace-nowrap">
                  <strong className="text-foreground font-semibold">{conns}</strong> conns
                </span>
              </div>

              {/* Hover Footer: Discrete "Go to database report" */}
              <div className="mt-2 pt-1.5 border-t border-dashed border-default/50 opacity-0 group-hover:opacity-100 transition-opacity">
                <Link
                  href={`/project/${projectRef}/observability/database`}
                  onClick={(e) => {
                    if (dragRef.current.hasMoved) {
                      e.preventDefault()
                    }
                    e.stopPropagation()
                  }}
                  className="w-full flex items-center justify-center gap-1 text-[11px] font-medium text-brand-500 hover:text-brand-600 transition-colors"
                >
                  <span>Go to database report</span>
                  <ArrowUpRight size={11} />
                </Link>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {copied ? 'Copied to clipboard!' : 'Click to copy'}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
