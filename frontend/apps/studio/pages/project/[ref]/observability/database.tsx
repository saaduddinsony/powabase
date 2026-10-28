import { useParams } from 'common'
import dayjs from 'dayjs'
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ChevronDown,
  Clock,
  GitCommitHorizontal,
  HardDrive,
  Info,
  RefreshCw,
  Settings,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn,
} from 'ui'

import DefaultLayout from '@/components/layouts/DefaultLayout'
import ObservabilityLayout from '@/components/layouts/ObservabilityLayout/ObservabilityLayout'
import type { NextPageWithLayout } from '@/types'

interface ObservabilityStatsResponse {
  databaseSize: {
    usedBytes: number
    usedFormatted: string
    provisionedFormatted: string
    provisionedBytes: number
    largeObjects: Array<{
      name: string
      sizeBytes: number
      sizeFormatted: string
      percentage: string
    }>
  }
  memoryUsage: {
    currentMb: number
    currentFormatted: string
    totalRamFormatted: string
    usedFormatted: string
    cacheFormatted: string
    swapFormatted: string
    timeseries: Array<{
      timestamp: string
      used: number
      cache: number
      swap: number
      total: number
      totalRam: number
    }>
  }
  memoryCommitment: {
    currentFormatted: string
    threshold50Formatted: string
    capacityFormatted: string
    status: string
    timeseries: Array<{
      timestamp: string
      committed: number
      threshold50: number
      capacity: number
    }>
  }
  cpuUsage?: {
    currentFormatted: string
    timeseries: Array<{
      timestamp: string
      system: number
      user: number
      iowait: number
      irqs: number
      other: number
      idle: number
    }>
  }
  networkThroughput?: {
    currentFormatted: string
    timeseries: Array<{
      timestamp: string
      networkIn: number
      networkOut: number
    }>
  }
  diskThroughput?: {
    timeseries: Array<{
      timestamp: string
      read: number
      write: number
    }>
  }
  databaseConnections?: {
    active: number
    max: number
    timeseries: Array<{
      timestamp: string
      active: number
      max: number
    }>
  }
}

const TIME_RANGES = [
  { label: 'Last 60 minutes', value: '60m' },
  { label: 'Last 3 hours', value: '3h' },
  { label: 'Last 24 hours', value: '24h' },
  { label: 'Last 7 days', value: '7d' },
]

const DatabaseObservabilityPage: NextPageWithLayout = () => {
  const router = useRouter()
  const { ref } = useParams()
  const projectRef = typeof ref === 'string' ? ref : ref?.[0] || 'default'

  const [selectedSource, setSelectedSource] = useState('Primary database')
  const [selectedRange, setSelectedRange] = useState('60m')
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [hoverCommitIndex, setHoverCommitIndex] = useState<number | null>(null)

  const { data, isLoading, refetch, isFetching } = useQuery<ObservabilityStatsResponse>({
    queryKey: ['database-observability-stats', projectRef, selectedRange],
    queryFn: async () => {
      const res = await fetch(
        `/api/platform/database/${projectRef}/observability-stats?range=${selectedRange}`
      )
      if (!res.ok) throw new Error('Failed to fetch database observability stats')
      return res.json()
    },
    refetchInterval: 30000,
  })

  // Date range formatted display
  const { startFormatted, endFormatted } = useMemo(() => {
    const end = dayjs()
    let start = end.subtract(1, 'hour')
    if (selectedRange === '3h') start = end.subtract(3, 'hour')
    if (selectedRange === '24h') start = end.subtract(24, 'hour')
    if (selectedRange === '7d') start = end.subtract(7, 'day')
    return {
      startFormatted: start.format('MMM D, h:mma'),
      endFormatted: end.format('MMM D, h:mma'),
    }
  }, [selectedRange])

  const memTimeseries = data?.memoryUsage?.timeseries || []
  const commitTimeseries = data?.memoryCommitment?.timeseries || []
  const cpuTimeseries = data?.cpuUsage?.timeseries || []
  const netTimeseries = data?.networkThroughput?.timeseries || []

  const activePoint =
    hoverIndex !== null && memTimeseries[hoverIndex]
      ? memTimeseries[hoverIndex]
      : memTimeseries[memTimeseries.length - 1]

  const activeCommitPoint =
    hoverCommitIndex !== null && commitTimeseries[hoverCommitIndex]
      ? commitTimeseries[hoverCommitIndex]
      : commitTimeseries[commitTimeseries.length - 1]

  return (
    <div className="flex flex-col grow gap-4 px-5 py-6 mx-auto w-full max-w-7xl">
      {/* 1. Header Row (Matching Supabase) */}
      <div className="flex flex-row justify-between gap-4 items-center">
        <h1 className="text-2xl font-semibold text-foreground tracking-tight m-0">Database</h1>

        {/* Source Dropdown Pill */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="flex cursor-pointer select-none">
              <span className="flex items-center text-foreground-lighter px-3 rounded-l-md text-xs border border-r-0 border-default bg-surface-100">
                Source
              </span>
              <button
                type="button"
                className="relative inline-flex items-center space-x-2 text-center font-medium border border-default bg-surface-200 hover:bg-surface-300 text-foreground text-xs px-2.5 py-1 h-[28px] rounded-r-md rounded-l-none"
              >
                <span className="truncate capitalize">{selectedSource}</span>
                <ChevronDown size={12} className="text-foreground-lighter" />
              </button>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={() => setSelectedSource('Primary database')}>
              Primary database
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSelectedSource('Read Replica 1')}>
              Read Replica 1
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 2. Sticky Toolbar (Docs, Refresh, Settings, Last 60 min, Date range) */}
      <div className="sticky top-0 py-2 z-30 flex w-full items-center gap-2 bg-background border-b border-default/40 pb-4">
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {/* Docs */}
          <a
            target="_blank"
            rel="noopener noreferrer"
            href="https://supabase.com/docs/guides/telemetry/reports#database"
            className="relative inline-flex items-center justify-center space-x-2 text-center font-medium border border-default bg-surface-100 hover:bg-surface-200 text-foreground text-xs px-2.5 py-1 h-[26px] rounded-md transition-colors"
          >
            <BookOpen size={14} className="text-foreground-lighter" />
            <span className="truncate">Docs</span>
          </a>

          {/* Refresh */}
          <button
            type="button"
            aria-label="Refresh report"
            onClick={() => refetch()}
            className="relative inline-flex items-center justify-center border border-default bg-surface-100 hover:bg-surface-200 text-foreground text-xs h-[26px] w-7 rounded-md transition-colors"
          >
            <RefreshCw size={14} className={cn('text-foreground-lighter', isFetching && 'animate-spin')} />
          </button>

          {/* Settings */}
          <button
            type="button"
            aria-label="Settings"
            onClick={() => router.push(`/project/${projectRef}/settings/database`)}
            className="relative inline-flex items-center justify-center border border-default bg-surface-100 hover:bg-surface-200 text-foreground text-xs h-[26px] w-7 rounded-md transition-colors"
          >
            <Settings size={14} className="text-foreground-lighter" />
          </button>

          {/* Time range selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="relative inline-flex items-center space-x-2 border border-default bg-surface-100 hover:bg-surface-200 text-foreground text-xs px-2.5 py-1 h-[26px] rounded-md transition-colors"
              >
                <Clock size={12} className="text-foreground-lighter" />
                <span className="truncate">
                  {TIME_RANGES.find((r) => r.value === selectedRange)?.label}
                </span>
                <ChevronDown size={12} className="text-foreground-lighter" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {TIME_RANGES.map((r) => (
                <DropdownMenuItem key={r.value} onClick={() => setSelectedRange(r.value)}>
                  {r.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Interval dates */}
          <div className="flex items-center gap-x-2 text-xs text-foreground-light font-mono pl-1">
            <p className="m-0">{startFormatted}</p>
            <ArrowRight size={12} className="text-foreground-lighter" />
            <p className="m-0">{endFormatted}</p>
          </div>
        </div>
      </div>

      {/* 3. Cards Container */}
      <div className="flex flex-col gap-6 mt-2">
        {/* Card 1: Memory usage */}
        <div id="ram-usage" className="bg-surface-100 rounded-md border border-default shadow-xs relative w-full p-5">
          <div className="flex justify-between items-start min-h-16">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h3 className="text-foreground-lighter text-sm font-medium m-0">Memory usage</h3>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info size={14} className="text-foreground-lighter cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Memory allocated across active processes, filesystem buffers, and swap.
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="mt-1">
                <h4 className="text-foreground text-2xl font-semibold m-0">
                  {activePoint ? `${activePoint.total} MB` : data?.memoryUsage.currentFormatted || '380.79 MB'}
                </h4>
                <p className="text-foreground-lighter text-xs font-mono mt-0.5 m-0">
                  {activePoint
                    ? dayjs(activePoint.timestamp).format('MMM D, YYYY, hh:mma')
                    : dayjs().format('MMM D, YYYY, hh:mma')}
                </p>
              </div>
            </div>

            {/* Upper Right Toggle Button */}
            <button
              type="button"
              className="relative inline-flex items-center justify-center border border-default bg-surface-200 hover:bg-surface-300 text-foreground-lighter text-xs h-[26px] w-7 rounded-md transition-colors"
            >
              <GitCommitHorizontal size={14} className="text-foreground-light" />
            </button>
          </div>

          {/* Chart with Y-axis labels and gradient area curves */}
          <div className="relative mt-6 pt-2">
            <div className="flex">
              {/* Y-axis labels */}
              <div className="flex flex-col justify-between text-[11px] text-foreground-lighter font-mono pr-3 select-none text-right w-20 shrink-0 h-44">
                <span>624.46 MB</span>
                <span>381.47 MB</span>
                <span>190.73 MB</span>
                <span>0 MB</span>
              </div>

              {/* Chart SVG */}
              <div className="relative flex-1 h-44 w-full">
                <svg
                  className="w-full h-full overflow-visible"
                  viewBox="0 0 1000 160"
                  preserveAspectRatio="none"
                  onMouseLeave={() => setHoverIndex(null)}
                >
                  <defs>
                    <linearGradient id="usedGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
                    </linearGradient>
                    <linearGradient id="cacheGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
                    </linearGradient>
                    <linearGradient id="swapGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ec4899" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#ec4899" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Grid lines */}
                  <line x1="0" y1="0" x2="1000" y2="0" stroke="currentColor" strokeOpacity="0.08" />
                  <line x1="0" y1="53" x2="1000" y2="53" stroke="currentColor" strokeOpacity="0.08" />
                  <line x1="0" y1="106" x2="1000" y2="106" stroke="currentColor" strokeOpacity="0.08" />
                  <line x1="0" y1="160" x2="1000" y2="160" stroke="currentColor" strokeOpacity="0.08" />

                  {/* Total RAM Dashed Line (at 411.52 MB => ~54px from top) */}
                  <line
                    x1="0"
                    y1="54"
                    x2="1000"
                    y2="54"
                    stroke="currentColor"
                    strokeOpacity="0.4"
                    strokeDasharray="4 4"
                  />

                  {/* Filled curves and lines */}
                  {memTimeseries.length > 1 && (
                    <>
                      {/* Used area */}
                      <path
                        d={`M 0 160 ${memTimeseries
                          .map((pt, idx) => {
                            const x = (idx / (memTimeseries.length - 1)) * 1000
                            const y = 160 - (pt.used / 624.46) * 160
                            return `L ${x} ${y}`
                          })
                          .join(' ')} L 1000 160 Z`}
                        fill="url(#usedGradient)"
                      />

                      {/* Cache area */}
                      <path
                        d={`M 0 160 ${memTimeseries
                          .map((pt, idx) => {
                            const x = (idx / (memTimeseries.length - 1)) * 1000
                            const y = 160 - (pt.cache / 624.46) * 160
                            return `L ${x} ${y}`
                          })
                          .join(' ')} L 1000 160 Z`}
                        fill="url(#cacheGradient)"
                      />

                      {/* Swap line */}
                      <path
                        d={memTimeseries
                          .map((pt, idx) => {
                            const x = (idx / (memTimeseries.length - 1)) * 1000
                            const y = 160 - (pt.swap / 624.46) * 160
                            return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`
                          })
                          .join(' ')}
                        fill="none"
                        stroke="#ec4899"
                        strokeWidth="1.5"
                      />

                      {/* Cache line */}
                      <path
                        d={memTimeseries
                          .map((pt, idx) => {
                            const x = (idx / (memTimeseries.length - 1)) * 1000
                            const y = 160 - (pt.cache / 624.46) * 160
                            return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`
                          })
                          .join(' ')}
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth="1.5"
                      />

                      {/* Used line */}
                      <path
                        d={memTimeseries
                          .map((pt, idx) => {
                            const x = (idx / (memTimeseries.length - 1)) * 1000
                            const y = 160 - (pt.used / 624.46) * 160
                            return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`
                          })
                          .join(' ')}
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="1.5"
                      />
                    </>
                  )}

                  {/* Vertical hover indicator line */}
                  {hoverIndex !== null && (
                    <line
                      x1={(hoverIndex / (memTimeseries.length - 1)) * 1000}
                      y1="0"
                      x2={(hoverIndex / (memTimeseries.length - 1)) * 1000}
                      y2="160"
                      stroke="currentColor"
                      strokeOpacity="0.4"
                    />
                  )}

                  {/* Interactive Crosshair trigger rects */}
                  {memTimeseries.map((pt, idx) => {
                    const x = (idx / (memTimeseries.length - 1)) * 1000
                    const width = 1000 / memTimeseries.length
                    return (
                      <rect
                        key={idx}
                        x={x - width / 2}
                        y="0"
                        width={width}
                        height="160"
                        fill="transparent"
                        className="cursor-crosshair"
                        onMouseEnter={() => setHoverIndex(idx)}
                      />
                    )
                  })}
                </svg>

                {/* Popover Hover Tooltip matching Supabase exactly */}
                {activePoint && hoverIndex !== null && (
                  <div
                    className="absolute z-40 pointer-events-none bg-surface-100/95 backdrop-blur-md border border-default rounded-md p-3 shadow-xl text-xs font-mono min-w-[240px]"
                    style={{
                      left: `${Math.min(75, Math.max(25, (hoverIndex / (memTimeseries.length - 1)) * 100))}%`,
                      top: '10px',
                      transform: 'translateX(-50%)',
                    }}
                  >
                    <div className="text-[11px] text-foreground-lighter mb-1">Asia/Dhaka</div>
                    <div className="text-[11px] text-foreground font-semibold mb-2">
                      {dayjs(activePoint.timestamp).format('MMM D, hh:mm:ssa')}
                    </div>

                    <div className="flex items-center justify-between gap-4 py-0.5 text-foreground-lighter">
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block w-3 border-b border-dashed border-foreground-lighter" />
                        Total RAM
                      </span>
                      <span className="text-foreground">{activePoint.totalRam} MB</span>
                    </div>

                    <div className="flex items-center justify-between gap-4 py-0.5 text-foreground-lighter">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-pink-500" />
                        Swap
                      </span>
                      <span className="text-foreground">
                        {activePoint.swap} MB{' '}
                        <span className="text-foreground-lighter text-[10px]">
                          ({((activePoint.swap / activePoint.totalRam) * 100).toFixed(2)}%)
                        </span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-4 py-0.5 text-foreground-lighter">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        Cache + Buffers
                      </span>
                      <span className="text-foreground">
                        {activePoint.cache} MB{' '}
                        <span className="text-foreground-lighter text-[10px]">
                          ({((activePoint.cache / activePoint.totalRam) * 100).toFixed(2)}%)
                        </span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-4 py-0.5 text-foreground-lighter">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        Used
                      </span>
                      <span className="text-foreground">
                        {activePoint.used} MB{' '}
                        <span className="text-foreground-lighter text-[10px]">
                          ({((activePoint.used / activePoint.totalRam) * 100).toFixed(2)}%)
                        </span>
                      </span>
                    </div>

                    <div className="pt-2 mt-2 border-t border-default flex items-center justify-between">
                      <span className="text-foreground-lighter">Total</span>
                      <span className="text-foreground font-bold">
                        {activePoint.total} MB{' '}
                        <span className="text-foreground-lighter font-normal text-[10px]">
                          ({((activePoint.total / activePoint.totalRam) * 100).toFixed(1)}%)
                        </span>
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* X-axis labels */}
            <div className="flex justify-between pl-20 text-[11px] text-foreground-lighter font-mono mt-1">
              <span>{startFormatted}</span>
              <span>{endFormatted}</span>
            </div>

            {/* Legend at bottom */}
            <div className="mt-4 pt-3 border-t border-default/50 flex flex-wrap items-center justify-center gap-6 text-xs text-foreground-lighter font-mono">
              <div className="flex items-center gap-2">
                <span className="inline-block w-4 border-b border-dashed border-foreground-lighter" />
                <span>Total RAM</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                <span>Used</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
                <span>Cache + Buffers</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-pink-500" />
                <span>Swap</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Memory commitment */}
        <div id="ram-commitment" className="bg-surface-100 rounded-md border border-default shadow-xs relative w-full p-5">
          <div className="flex justify-between items-start min-h-16">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h3 className="text-foreground-lighter text-sm font-medium m-0">Memory commitment</h3>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info size={14} className="text-foreground-lighter cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Aggregate virtual memory committed relative to provisioned capacity.
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="mt-1">
                <h4 className="text-foreground text-2xl font-semibold m-0">
                  {activeCommitPoint
                    ? `${activeCommitPoint.committed} GB`
                    : data?.memoryCommitment.currentFormatted || '1.11 GB'}
                </h4>
                <p className="text-foreground-lighter text-xs font-mono mt-0.5 m-0">
                  {dayjs().format('MMM D, YYYY, hh:mma')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="warning" className="uppercase text-[10px] font-mono px-1.5 py-0.5">
                WARNING
              </Badge>
              <button
                type="button"
                className="relative inline-flex items-center justify-center border border-default bg-surface-200 hover:bg-surface-300 text-foreground-lighter text-xs h-[26px] w-7 rounded-md transition-colors"
              >
                <GitCommitHorizontal size={14} className="text-foreground-light" />
              </button>
            </div>
          </div>

          {/* Chart with Y-axis labels */}
          <div className="relative mt-6 pt-2">
            <div className="flex">
              {/* Y-axis labels */}
              <div className="flex flex-col justify-between text-[11px] text-foreground-lighter font-mono pr-3 select-none text-right w-20 shrink-0 h-40">
                <span>1.4 GB</span>
                <span>762.94 MB</span>
                <span>381.47 MB</span>
                <span>0 MB</span>
              </div>

              {/* Chart SVG */}
              <div className="relative flex-1 h-40 w-full">
                <svg
                  className="w-full h-full overflow-visible"
                  viewBox="0 0 1000 140"
                  preserveAspectRatio="none"
                  onMouseLeave={() => setHoverCommitIndex(null)}
                >
                  <defs>
                    <linearGradient id="commitGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>

                  <line x1="0" y1="0" x2="1000" y2="0" stroke="currentColor" strokeOpacity="0.08" />
                  <line x1="0" y1="46" x2="1000" y2="46" stroke="currentColor" strokeOpacity="0.08" />
                  <line x1="0" y1="93" x2="1000" y2="93" stroke="currentColor" strokeOpacity="0.08" />
                  <line x1="0" y1="140" x2="1000" y2="140" stroke="currentColor" strokeOpacity="0.08" />

                  {/* Full capacity dashed line */}
                  <line
                    x1="0"
                    y1="10"
                    x2="1000"
                    y2="10"
                    stroke="currentColor"
                    strokeOpacity="0.3"
                    strokeDasharray="4 4"
                  />

                  {/* Committed area & line */}
                  {commitTimeseries.length > 1 && (
                    <>
                      <path
                        d={`M 0 140 ${commitTimeseries
                          .map((pt, idx) => {
                            const x = (idx / (commitTimeseries.length - 1)) * 1000
                            const y = 140 - (pt.committed / 1.4) * 130
                            return `L ${x} ${y}`
                          })
                          .join(' ')} L 1000 140 Z`}
                        fill="url(#commitGradient)"
                      />

                      <path
                        d={commitTimeseries
                          .map((pt, idx) => {
                            const x = (idx / (commitTimeseries.length - 1)) * 1000
                            const y = 140 - (pt.committed / 1.4) * 130
                            return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`
                          })
                          .join(' ')}
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="1.5"
                      />
                    </>
                  )}

                  {commitTimeseries.map((pt, idx) => {
                    const x = (idx / (commitTimeseries.length - 1)) * 1000
                    const width = 1000 / commitTimeseries.length
                    return (
                      <rect
                        key={idx}
                        x={x - width / 2}
                        y="0"
                        width={width}
                        height="140"
                        fill="transparent"
                        className="cursor-crosshair"
                        onMouseEnter={() => setHoverCommitIndex(idx)}
                      />
                    )
                  })}
                </svg>

                {activeCommitPoint && hoverCommitIndex !== null && (
                  <div
                    className="absolute z-40 pointer-events-none bg-surface-100/95 backdrop-blur-md border border-default rounded-md p-3 shadow-xl text-xs font-mono min-w-[220px]"
                    style={{
                      left: `${Math.min(75, Math.max(25, (hoverCommitIndex / (commitTimeseries.length - 1)) * 100))}%`,
                      top: '10px',
                      transform: 'translateX(-50%)',
                    }}
                  >
                    <div className="text-[11px] text-foreground-lighter mb-1">Asia/Dhaka</div>
                    <div className="text-[11px] text-foreground font-semibold mb-2">
                      {dayjs(activeCommitPoint.timestamp).format('MMM D, hh:mm:ssa')}
                    </div>
                    <div className="flex items-center justify-between gap-4 py-0.5 text-foreground-lighter">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        Committed
                      </span>
                      <span className="text-foreground">{activeCommitPoint.committed} GB</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 py-0.5 text-foreground-lighter">
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block w-3 border-b border-dashed border-foreground-lighter" />
                        Full commitment capacity
                      </span>
                      <span className="text-foreground">1.4 GB</span>
                    </div>
                    <div className="pt-2 mt-2 border-t border-default flex items-center justify-between">
                      <span className="text-foreground-lighter">Total</span>
                      <span className="text-foreground font-bold">{activeCommitPoint.committed} GB</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-between pl-20 text-[11px] text-foreground-lighter font-mono mt-1">
              <span>{startFormatted}</span>
              <span>{endFormatted}</span>
            </div>

            <div className="mt-4 pt-3 border-t border-default/50 flex flex-wrap items-center justify-center gap-6 text-xs text-foreground-lighter font-mono">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                <span>Committed</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-4 border-b border-dashed border-foreground-lighter" />
                <span>Full commitment capacity</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: CPU usage */}
        <div id="cpu-usage" className="bg-surface-100 rounded-md border border-default shadow-xs relative w-full p-5">
          <div className="flex justify-between items-start min-h-16">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h3 className="text-foreground-lighter text-sm font-medium m-0">CPU usage</h3>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info size={14} className="text-foreground-lighter cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>Breakdown of processor utilization by CPU mode.</TooltipContent>
                </Tooltip>
              </div>
              <div className="mt-1">
                <h4 className="text-foreground text-2xl font-semibold m-0">
                  {data?.cpuUsage?.currentFormatted || '0.43%'}
                </h4>
                <p className="text-foreground-lighter text-xs font-mono mt-0.5 m-0">
                  {dayjs().format('MMM D, YYYY, hh:mma')}
                </p>
              </div>
            </div>

            <button
              type="button"
              className="relative inline-flex items-center justify-center border border-default bg-surface-200 hover:bg-surface-300 text-foreground-lighter text-xs h-[26px] w-7 rounded-md transition-colors"
            >
              <GitCommitHorizontal size={14} className="text-foreground-light" />
            </button>
          </div>

          <div className="relative mt-6 pt-2">
            <div className="flex">
              <div className="flex flex-col justify-between text-[11px] text-foreground-lighter font-mono pr-3 select-none text-right w-20 shrink-0 h-36">
                <span>100%</span>
                <span>75%</span>
                <span>50%</span>
                <span>25%</span>
                <span>0%</span>
              </div>

              <div className="relative flex-1 h-36 w-full">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 1000 120" preserveAspectRatio="none">
                  <line x1="0" y1="0" x2="1000" y2="0" stroke="currentColor" strokeOpacity="0.08" />
                  <line x1="0" y1="30" x2="1000" y2="30" stroke="currentColor" strokeOpacity="0.08" />
                  <line x1="0" y1="60" x2="1000" y2="60" stroke="currentColor" strokeOpacity="0.08" />
                  <line x1="0" y1="90" x2="1000" y2="90" stroke="currentColor" strokeOpacity="0.08" />
                  <line x1="0" y1="120" x2="1000" y2="120" stroke="currentColor" strokeOpacity="0.08" />

                  {/* CPU user curve (near bottom line) */}
                  {cpuTimeseries.length > 1 && (
                    <path
                      d={cpuTimeseries
                        .map((pt, idx) => {
                          const x = (idx / (cpuTimeseries.length - 1)) * 1000
                          const y = 120 - ((pt.user + pt.system) / 100) * 120
                          return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`
                        })
                        .join(' ')}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="1.5"
                    />
                  )}
                </svg>
              </div>
            </div>

            <div className="flex justify-between pl-20 text-[11px] text-foreground-lighter font-mono mt-1">
              <span>{startFormatted}</span>
              <span>{endFormatted}</span>
            </div>

            <div className="mt-4 pt-3 border-t border-default/50 flex flex-wrap items-center justify-center gap-6 text-xs text-foreground-lighter font-mono">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                System
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                User
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                IOwait
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-500" />
                IRQs
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-pink-500" />
                Other
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-zinc-400" />
                Idle
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: Network throughput */}
        <div id="net-throughput" className="bg-surface-100 rounded-md border border-default shadow-xs relative w-full p-5">
          <div className="flex justify-between items-start min-h-16">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h3 className="text-foreground-lighter text-sm font-medium m-0">Network throughput</h3>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info size={14} className="text-foreground-lighter cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>Inbound and outbound network bandwidth consumption.</TooltipContent>
                </Tooltip>
              </div>
              <div className="mt-1">
                <h4 className="text-foreground text-2xl font-semibold m-0">
                  {data?.networkThroughput?.currentFormatted || '4.3 KB/s'}
                </h4>
                <p className="text-foreground-lighter text-xs font-mono mt-0.5 m-0">
                  {dayjs().format('MMM D, YYYY, hh:mma')}
                </p>
              </div>
            </div>

            <button
              type="button"
              className="relative inline-flex items-center justify-center border border-default bg-surface-200 hover:bg-surface-300 text-foreground-lighter text-xs h-[26px] w-7 rounded-md transition-colors"
            >
              <GitCommitHorizontal size={14} className="text-foreground-light" />
            </button>
          </div>

          <div className="relative mt-6 pt-2">
            <div className="flex">
              <div className="flex flex-col justify-between text-[11px] text-foreground-lighter font-mono pr-3 select-none text-right w-20 shrink-0 h-36">
                <span>58.6 KB/s</span>
                <span>43.9 KB/s</span>
                <span>29.3 KB/s</span>
                <span>14.6 KB/s</span>
                <span>0 bytes/s</span>
              </div>

              <div className="relative flex-1 h-36 w-full">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 1000 120" preserveAspectRatio="none">
                  <line x1="0" y1="0" x2="1000" y2="0" stroke="currentColor" strokeOpacity="0.08" />
                  <line x1="0" y1="30" x2="1000" y2="30" stroke="currentColor" strokeOpacity="0.08" />
                  <line x1="0" y1="60" x2="1000" y2="60" stroke="currentColor" strokeOpacity="0.08" />
                  <line x1="0" y1="90" x2="1000" y2="90" stroke="currentColor" strokeOpacity="0.08" />
                  <line x1="0" y1="120" x2="1000" y2="120" stroke="currentColor" strokeOpacity="0.08" />

                  {/* Network in curve */}
                  {netTimeseries.length > 1 && (
                    <>
                      <path
                        d={netTimeseries
                          .map((pt, idx) => {
                            const x = (idx / (netTimeseries.length - 1)) * 1000
                            const y = 120 - (pt.networkIn / 60000) * 120
                            return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`
                          })
                          .join(' ')}
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth="1.5"
                      />
                      <path
                        d={netTimeseries
                          .map((pt, idx) => {
                            const x = (idx / (netTimeseries.length - 1)) * 1000
                            const y = 120 - (pt.networkOut / 60000) * 120
                            return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`
                          })
                          .join(' ')}
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="1.5"
                      />
                    </>
                  )}
                </svg>
              </div>
            </div>

            <div className="flex justify-between pl-20 text-[11px] text-foreground-lighter font-mono mt-1">
              <span>{startFormatted}</span>
              <span>{endFormatted}</span>
            </div>

            <div className="mt-4 pt-3 border-t border-default/50 flex flex-wrap items-center justify-center gap-6 text-xs text-foreground-lighter font-mono">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                Network in
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Network out
              </span>
            </div>
          </div>
        </div>

        {/* Card 5: Database Size & Large Objects */}
        <div id="db-size" className="bg-surface-100 rounded-md border border-default shadow-xs relative w-full p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-default">
            <div>
              <h3 className="text-foreground-lighter text-sm font-medium m-0">Database Size</h3>
              <div className="flex items-center gap-6 mt-3">
                <div>
                  <div className="text-xs text-foreground-lighter uppercase font-semibold">
                    Space used
                  </div>
                  <div className="text-xl font-semibold text-foreground font-mono mt-0.5">
                    {data?.databaseSize.usedFormatted || '0.03 GB'}
                  </div>
                </div>
                <div className="h-8 w-px bg-border" />
                <div>
                  <div className="text-xs text-foreground-lighter uppercase font-semibold">
                    Provisioned disk size
                  </div>
                  <div className="text-xl font-semibold text-foreground font-mono mt-0.5">
                    {data?.databaseSize.provisionedFormatted || '8 GB'}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button asChild type="default" size="tiny">
                <Link href={`/project/${projectRef}/infrastructure`}>Increase disk size</Link>
              </Button>
            </div>
          </div>

          {/* Large Objects Table */}
          <div className="mt-5">
            <h4 className="text-xs font-semibold text-foreground-light uppercase tracking-wider mb-3">
              Large Objects
            </h4>
            <div className="rounded-md border border-default overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-200/60 border-b border-default text-foreground-lighter font-medium">
                  <tr>
                    <th className="py-2.5 px-4 font-normal">Object</th>
                    <th className="py-2.5 px-4 text-right font-normal">Size</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-default font-mono">
                  {(data?.databaseSize.largeObjects || []).map((obj) => (
                    <tr key={obj.name} className="hover:bg-surface-200/40 transition-colors">
                      <td className="py-2.5 px-4 text-foreground font-medium">
                        <Link
                          href={`/project/${projectRef}/editor?schema=public`}
                          className="hover:text-brand-500 hover:underline inline-flex items-center gap-1.5"
                        >
                          <span>{obj.name}</span>
                        </Link>
                      </td>
                      <td className="py-2.5 px-4 text-right text-foreground-light">
                        <span>{obj.sizeFormatted}</span>{' '}
                        <span className="text-foreground-lighter text-[11px]">
                          ({obj.percentage})
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Info callout */}
          <div className="mt-5 rounded-md bg-surface-200/40 border border-default p-4 text-xs text-foreground-light flex items-start gap-3">
            <Info size={16} className="text-brand-500 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              New Socket projects have a database size of ~40-60mb. This space includes
              pre-installed extensions, schemas, and default Postgres data. Additional database
              size is used when installing extensions, even if those extensions are inactive.
              <div className="mt-1.5">
                <a
                  href="https://supabase.com/docs/guides/platform/database-size"
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-500 hover:underline inline-flex items-center gap-1 font-medium"
                >
                  <span>Read about database size</span>
                  <ArrowUpRight size={12} />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

DatabaseObservabilityPage.getLayout = (page) => (
  <DefaultLayout>
    <ObservabilityLayout title="Database">{page}</ObservabilityLayout>
  </DefaultLayout>
)

export default DatabaseObservabilityPage
