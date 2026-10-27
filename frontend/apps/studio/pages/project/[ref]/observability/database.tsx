import { useParams } from 'common'
import dayjs from 'dayjs'
import {
  Activity,
  ArrowUpRight,
  BookOpen,
  Calendar,
  Clock,
  Database,
  ExternalLink,
  HardDrive,
  Info,
  Layers,
  RefreshCw,
  Server,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Badge, Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Tooltip, TooltipContent, TooltipTrigger, cn } from 'ui'

import DefaultLayout from '@/components/layouts/DefaultLayout'
import ObservabilityLayout from '@/components/layouts/ObservabilityLayout/ObservabilityLayout'
import { ScaffoldContainer, ScaffoldHeader, ScaffoldSection } from '@/components/layouts/Scaffold'
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
  diskThroughput: {
    timeseries: Array<{
      timestamp: string
      read: number
      write: number
    }>
  }
  databaseConnections: {
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

  const [selectedSource, setSelectedSource] = useState('Primary Database')
  const [selectedRange, setSelectedRange] = useState('60m')
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

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
  const dateIntervalText = useMemo(() => {
    const end = dayjs()
    let start = end.subtract(1, 'hour')
    if (selectedRange === '3h') start = end.subtract(3, 'hour')
    if (selectedRange === '24h') start = end.subtract(24, 'hour')
    if (selectedRange === '7d') start = end.subtract(7, 'day')
    return `${start.format('MMM D, h:mma')} → ${end.format('MMM D, h:mma')}`
  }, [selectedRange])

  const memTimeseries = data?.memoryUsage?.timeseries || []
  const commitTimeseries = data?.memoryCommitment?.timeseries || []
  const throughputTimeseries = data?.diskThroughput?.timeseries || []
  const connTimeseries = data?.databaseConnections?.timeseries || []

  const activePoint =
    hoverIndex !== null && memTimeseries[hoverIndex]
      ? memTimeseries[hoverIndex]
      : memTimeseries[memTimeseries.length - 1]

  const activeCommitPoint =
    hoverIndex !== null && commitTimeseries[hoverIndex]
      ? commitTimeseries[hoverIndex]
      : commitTimeseries[commitTimeseries.length - 1]

  return (
    <ScaffoldContainer size="large" className="pb-24">
      {/* Top Header Bar */}
      <ScaffoldSection isFullWidth className="pt-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-default">
          <div>
            <h1 className="text-2xl font-semibold text-foreground tracking-tight m-0">Database</h1>
            <p className="text-sm text-foreground-lighter mt-1 m-0">
              Real-time resource utilization, query disk usage, and memory performance
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Source Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="default" size="small" icon={<Database size={14} className="text-emerald-500" />}>
                  Source: <span className="font-medium text-foreground ml-1">{selectedSource}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => setSelectedSource('Primary Database')}>
                  Primary Database (ap-south-1)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedSource('Read Replica 1')}>
                  Read Replica 1 (eu-central-1)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Docs link */}
            <Button
              asChild
              type="default"
              size="small"
              icon={<BookOpen size={14} className="text-foreground-lighter" />}
            >
              <a
                href="https://supabase.com/docs/guides/platform/metrics"
                target="_blank"
                rel="noreferrer"
              >
                Docs
              </a>
            </Button>

            {/* Refresh */}
            <Button
              type="default"
              size="small"
              icon={<RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />}
              onClick={() => refetch()}
              title="Refresh metrics"
            />

            {/* Time range selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="default" size="small" icon={<Clock size={14} />}>
                  {TIME_RANGES.find((r) => r.value === selectedRange)?.label}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {TIME_RANGES.map((r) => (
                  <DropdownMenuItem key={r.value} onClick={() => setSelectedRange(r.value)}>
                    {r.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Interval text */}
            <span className="text-xs text-foreground-lighter font-mono hidden xl:inline-block ml-2">
              {dateIntervalText}
            </span>
          </div>
        </div>
      </ScaffoldSection>

      <div className="flex flex-col gap-8 mt-6">
        {/* 1. Memory Usage Chart Card */}
        <div className="rounded-xl border border-default bg-surface-100 p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-foreground m-0">Memory usage</h2>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info size={14} className="text-foreground-lighter cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  Shows memory allocated across active processes, filesystem buffers, and swap.
                </TooltipContent>
              </Tooltip>
            </div>
            {activePoint && (
              <span className="text-xs text-foreground-lighter font-mono">
                {dayjs(activePoint.timestamp).format('MMM D, hh:mma')}
              </span>
            )}
          </div>

          <div className="mb-4">
            <div className="text-3xl font-semibold text-foreground font-mono">
              {activePoint ? `${activePoint.total} MB` : data?.memoryUsage.currentFormatted || '—'}
            </div>
          </div>

          {/* Time Series Area Chart */}
          <div className="relative h-48 w-full">
            <svg
              className="w-full h-full overflow-visible"
              viewBox="0 0 1000 180"
              preserveAspectRatio="none"
              onMouseLeave={() => setHoverIndex(null)}
            >
              <defs>
                <linearGradient id="usedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.05" />
                </linearGradient>
                <linearGradient id="cacheGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05" />
                </linearGradient>
                <linearGradient id="swapGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ec4899" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#ec4899" stopOpacity="0.05" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1="0" y1="40" x2="1000" y2="40" stroke="currentColor" strokeOpacity="0.08" />
              <line x1="0" y1="90" x2="1000" y2="90" stroke="currentColor" strokeOpacity="0.08" />
              <line x1="0" y1="140" x2="1000" y2="140" stroke="currentColor" strokeOpacity="0.08" />

              {/* Total RAM Dotted Line */}
              <line
                x1="0"
                y1="30"
                x2="1000"
                y2="30"
                stroke="currentColor"
                strokeOpacity="0.35"
                strokeDasharray="4 4"
              />

              {/* Data curves */}
              {memTimeseries.length > 1 && (
                <>
                  {/* Total line curve */}
                  <path
                    d={memTimeseries
                      .map((pt, idx) => {
                        const x = (idx / (memTimeseries.length - 1)) * 1000
                        const y = 160 - (pt.total / (pt.totalRam || 500)) * 130
                        return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`
                      })
                      .join(' ')}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2"
                  />

                  {/* Cache line curve */}
                  <path
                    d={memTimeseries
                      .map((pt, idx) => {
                        const x = (idx / (memTimeseries.length - 1)) * 1000
                        const y = 160 - (pt.cache / (pt.totalRam || 500)) * 130
                        return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`
                      })
                      .join(' ')}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="1.5"
                  />

                  {/* Swap line curve */}
                  <path
                    d={memTimeseries
                      .map((pt, idx) => {
                        const x = (idx / (memTimeseries.length - 1)) * 1000
                        const y = 160 - (pt.swap / (pt.totalRam || 500)) * 130
                        return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`
                      })
                      .join(' ')}
                    fill="none"
                    stroke="#ec4899"
                    strokeWidth="1.5"
                  />
                </>
              )}

              {/* Interactive Hover columns */}
              {memTimeseries.map((pt, idx) => {
                const x = (idx / (memTimeseries.length - 1)) * 1000
                const width = 1000 / memTimeseries.length
                return (
                  <rect
                    key={idx}
                    x={x - width / 2}
                    y="0"
                    width={width}
                    height="180"
                    fill="transparent"
                    className="cursor-crosshair"
                    onMouseEnter={() => setHoverIndex(idx)}
                  />
                )
              })}
            </svg>

            {/* Hover Tooltip Popup */}
            {activePoint && hoverIndex !== null && (
              <div
                className="absolute z-20 pointer-events-none bg-surface-200/95 backdrop-blur-md border border-default rounded-lg p-3 shadow-xl text-xs font-mono min-w-[200px]"
                style={{
                  left: `${(hoverIndex / (memTimeseries.length - 1)) * 100}%`,
                  top: '10px',
                  transform: 'translateX(-50%)',
                }}
              >
                <div className="text-[11px] text-foreground-lighter mb-2 pb-1 border-b border-default">
                  {dayjs(activePoint.timestamp).format('YYYY-MM-DD HH:mm:ss')}
                </div>
                <div className="flex items-center justify-between gap-4 py-0.5">
                  <span className="text-foreground-lighter flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full border border-dashed border-foreground" />
                    Total RAM
                  </span>
                  <span className="font-semibold text-foreground">{activePoint.totalRam} MB</span>
                </div>
                <div className="flex items-center justify-between gap-4 py-0.5">
                  <span className="text-pink-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-pink-500" />
                    Swap
                  </span>
                  <span className="font-semibold text-foreground">{activePoint.swap} MB</span>
                </div>
                <div className="flex items-center justify-between gap-4 py-0.5">
                  <span className="text-blue-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    Cache + Buffers
                  </span>
                  <span className="font-semibold text-foreground">{activePoint.cache} MB</span>
                </div>
                <div className="flex items-center justify-between gap-4 py-0.5">
                  <span className="text-emerald-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Used
                  </span>
                  <span className="font-semibold text-foreground">{activePoint.used} MB</span>
                </div>
                <div className="flex items-center justify-between gap-4 pt-1.5 mt-1 border-t border-default font-bold">
                  <span className="text-foreground">Total</span>
                  <span className="text-foreground">{activePoint.total} MB</span>
                </div>
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="mt-4 pt-3 border-t border-default flex flex-wrap items-center gap-6 text-xs text-foreground-lighter">
            <div className="flex items-center gap-2">
              <span className="inline-block w-4 border-b border-dashed border-foreground-lighter" />
              <span>Total RAM</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>Used</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span>Cache + Buffers</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-pink-500" />
              <span>Swap</span>
            </div>
          </div>
        </div>

        {/* 2. Memory Commitment Card */}
        <div className="rounded-xl border border-default bg-surface-100 p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-foreground m-0">Memory commitment</h2>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info size={14} className="text-foreground-lighter cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  Shows aggregate virtual memory committed relative to provisioned capacity.
                </TooltipContent>
              </Tooltip>
            </div>
            <Badge variant="warning" className="uppercase text-[10px] tracking-wider font-mono">
              {data?.memoryCommitment.status || 'WARNING'}
            </Badge>
          </div>

          <div className="mb-4">
            <div className="text-3xl font-semibold text-foreground font-mono">
              {activeCommitPoint
                ? `${activeCommitPoint.committed} GB`
                : data?.memoryCommitment.currentFormatted || '1.1 GB'}
            </div>
          </div>

          {/* Time Series Line Chart */}
          <div className="relative h-44 w-full">
            <svg
              className="w-full h-full overflow-visible"
              viewBox="0 0 1000 160"
              preserveAspectRatio="none"
            >
              <line x1="0" y1="30" x2="1000" y2="30" stroke="currentColor" strokeOpacity="0.08" />
              <line x1="0" y1="80" x2="1000" y2="80" stroke="currentColor" strokeOpacity="0.08" />
              <line x1="0" y1="130" x2="1000" y2="130" stroke="currentColor" strokeOpacity="0.08" />

              {/* 50% Threshold yellow line */}
              <line
                x1="0"
                y1="60"
                x2="1000"
                y2="60"
                stroke="#eab308"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />

              {/* Full Capacity dotted line */}
              <line
                x1="0"
                y1="20"
                x2="1000"
                y2="20"
                stroke="currentColor"
                strokeOpacity="0.3"
                strokeDasharray="3 3"
              />

              {/* Committed green line */}
              {commitTimeseries.length > 1 && (
                <path
                  d={commitTimeseries
                    .map((pt, idx) => {
                      const x = (idx / (commitTimeseries.length - 1)) * 1000
                      const y = 140 - (pt.committed / 1.5) * 110
                      return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`
                    })
                    .join(' ')}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2"
                />
              )}
            </svg>
          </div>

          {/* Legend */}
          <div className="mt-4 pt-3 border-t border-default flex flex-wrap items-center gap-6 text-xs text-foreground-lighter">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>Committed (1.1 GB)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-4 border-b-2 border-yellow-500" />
              <span>50% threshold (1.2 GB)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-4 border-b border-dashed border-foreground-lighter" />
              <span>Full commitment capacity (1.4 GB)</span>
            </div>
          </div>
        </div>

        {/* 3. Database Size & Large Objects Card */}
        <div className="rounded-xl border border-default bg-surface-100 p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-default">
            <div>
              <h2 className="text-base font-semibold text-foreground m-0">Database Size</h2>
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
              <Button asChild type="default" size="small" icon={<ExternalLink size={13} />}>
                <Link href={`/project/${projectRef}/sql/new`}>Open in SQL Editor</Link>
              </Button>
              <Button asChild type="outline" size="small">
                <Link href={`/project/${projectRef}/infrastructure`}>Increase disk size</Link>
              </Button>
            </div>
          </div>

          {/* Large Objects Table */}
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-foreground mb-3">Large Objects</h3>
            <div className="rounded-lg border border-default overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-200/60 border-b border-default text-foreground-lighter font-medium">
                  <tr>
                    <th className="py-2.5 px-4">Object</th>
                    <th className="py-2.5 px-4 text-right">Size</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-default font-mono">
                  {(data?.databaseSize.largeObjects || []).map((obj) => (
                    <tr key={obj.name} className="hover:bg-surface-200/40 transition-colors">
                      <td className="py-2.5 px-4 text-foreground font-medium flex items-center gap-2">
                        <Link
                          href={`/project/${projectRef}/editor?schema=public`}
                          className="hover:text-brand-500 hover:underline flex items-center gap-1.5"
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
          <div className="mt-6 rounded-lg bg-surface-200/40 border border-default p-4 text-xs text-foreground-light flex items-start gap-3">
            <Info size={16} className="text-brand-500 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              New Socket / Supabase projects have a database size of ~40-60mb. This space includes
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
    </ScaffoldContainer>
  )
}

DatabaseObservabilityPage.getLayout = (page) => (
  <DefaultLayout>
    <ObservabilityLayout title="Database Observability">{page}</ObservabilityLayout>
  </DefaultLayout>
)

export default DatabaseObservabilityPage
