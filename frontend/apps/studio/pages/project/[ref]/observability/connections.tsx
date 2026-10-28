import { useParams } from 'common'
import {
  AlertCircle,
  Check,
  ChevronDown,
  Filter,
  Layers,
  Pause,
  Play,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Badge,
  Button,
  Checkbox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  cn,
} from 'ui'

import DefaultLayout from '@/components/layouts/DefaultLayout'
import ObservabilityLayout from '@/components/layouts/ObservabilityLayout/ObservabilityLayout'
import type { NextPageWithLayout } from '@/types'

interface SessionItem {
  pid: number
  state: string
  query: string
  applicationName: string
  username: string
  duration: string
  blockedBy: number | null
}

interface ConnectionsData {
  connections: {
    total: number
    max: number
    active: number
    idle: number
    idleInTransaction: number
    blocked: number
    topBlocker: string
    longestRunning: string
  }
  sessions: SessionItem[]
}

const DatabaseConnectionsPage: NextPageWithLayout = () => {
  const { ref } = useParams()
  const projectRef = typeof ref === 'string' ? ref : ref?.[0] || 'default'

  const [isPaused, setIsPaused] = useState(false)
  const [selectedState, setSelectedState] = useState<string>('All')
  const [onlyRootBlockers, setOnlyRootBlockers] = useState(false)

  const { data, isLoading, refetch, isFetching } = useQuery<ConnectionsData>({
    queryKey: ['database-connections-stats', projectRef],
    queryFn: async () => {
      const res = await fetch(
        `/api/platform/database/${projectRef}/observability-stats?section=connections`
      )
      if (!res.ok) throw new Error('Failed to fetch connection stats')
      return res.json()
    },
    refetchInterval: isPaused ? false : 5000,
  })

  const stats = data?.connections || {
    total: 7,
    max: 60,
    active: 0,
    idle: 5,
    idleInTransaction: 0,
    blocked: 0,
    topBlocker: '-',
    longestRunning: '-',
  }

  const rawSessions = data?.sessions || []
  const filteredSessions = rawSessions.filter((s) => {
    if (selectedState !== 'All' && s.state.toLowerCase() !== selectedState.toLowerCase()) {
      return false
    }
    if (onlyRootBlockers && !s.blockedBy) {
      return false
    }
    return true
  })

  return (
    <div className="flex flex-col grow gap-6 px-5 py-6 mx-auto w-full max-w-7xl">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-foreground tracking-tight m-0">
            Database Connections
          </h1>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-mono">
            <span className={cn('w-2 h-2 rounded-full bg-emerald-500', !isPaused && 'animate-pulse')} />
            {isPaused ? 'PAUSED' : 'LIVE'}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="default"
            size="tiny"
            icon={isPaused ? <Play size={12} /> : <Pause size={12} />}
            onClick={() => setIsPaused(!isPaused)}
          >
            {isPaused ? 'Resume' : 'Pause'}
          </Button>
          <Button
            type="default"
            size="tiny"
            icon={<Sparkles size={12} className="text-brand-500" />}
            onClick={() => {}}
          >
            Summarize activity
          </Button>
          <Button
            type="default"
            size="tiny"
            icon={<RefreshCw size={12} className={cn(isFetching && 'animate-spin')} />}
            onClick={() => refetch()}
          />
        </div>
      </div>

      {/* 2. Overview Section */}
      <div>
        <h2 className="text-xs font-semibold text-foreground-lighter uppercase tracking-wider mb-3">
          Overview
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-surface-100 rounded-md border border-default p-4 shadow-xs">
            <div className="text-[11px] text-foreground-lighter uppercase font-medium">
              Connections
            </div>
            <div className="text-2xl font-semibold text-foreground font-mono mt-1">
              {stats.total}/{stats.max}
            </div>
          </div>

          <div className="bg-surface-100 rounded-md border border-default p-4 shadow-xs">
            <div className="text-[11px] text-foreground-lighter uppercase font-medium">
              Active queries
            </div>
            <div className="text-2xl font-semibold text-foreground font-mono mt-1 text-emerald-500">
              {stats.active}
            </div>
          </div>

          <div className="bg-surface-100 rounded-md border border-default p-4 shadow-xs">
            <div className="text-[11px] text-foreground-lighter uppercase font-medium">
              Idle in transaction
            </div>
            <div className="text-2xl font-semibold text-foreground font-mono mt-1">
              {stats.idleInTransaction}
            </div>
          </div>

          <div className="bg-surface-100 rounded-md border border-default p-4 shadow-xs">
            <div className="text-[11px] text-foreground-lighter uppercase font-medium">
              Blocked queries
            </div>
            <div className="text-2xl font-semibold text-foreground font-mono mt-1">
              {stats.blocked}
            </div>
          </div>

          <div className="bg-surface-100 rounded-md border border-default p-4 shadow-xs">
            <div className="text-[11px] text-foreground-lighter uppercase font-medium">
              Top blocker
            </div>
            <div className="text-2xl font-semibold text-foreground font-mono mt-1">
              {stats.topBlocker}
            </div>
          </div>

          <div className="bg-surface-100 rounded-md border border-default p-4 shadow-xs">
            <div className="text-[11px] text-foreground-lighter uppercase font-medium">
              Longest running
            </div>
            <div className="text-2xl font-semibold text-foreground font-mono mt-1">
              {stats.longestRunning}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Sessions Section */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <h2 className="text-xs font-semibold text-foreground-lighter uppercase tracking-wider m-0">
            Sessions
          </h2>

          <div className="flex flex-wrap items-center gap-2">
            {/* State filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs border border-default rounded-md bg-surface-100 hover:bg-surface-200 text-foreground"
                >
                  <span className="text-foreground-lighter">State:</span>
                  <span className="capitalize">{selectedState}</span>
                  <ChevronDown size={12} className="text-foreground-lighter" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                {['All', 'Active', 'Idle', 'Idle in transaction'].map((st) => (
                  <DropdownMenuItem key={st} onClick={() => setSelectedState(st)}>
                    {st}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Roles filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs border border-default rounded-md bg-surface-100 hover:bg-surface-200 text-foreground"
                >
                  <span className="text-foreground-lighter">Roles:</span>
                  <span>All (3)</span>
                  <ChevronDown size={12} className="text-foreground-lighter" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem>postgres</DropdownMenuItem>
                <DropdownMenuItem>authenticated</DropdownMenuItem>
                <DropdownMenuItem>anon</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Root blockers checkbox */}
            <label className="flex items-center gap-1.5 text-xs text-foreground-lighter cursor-pointer select-none pl-2">
              <input
                type="checkbox"
                checked={onlyRootBlockers}
                onChange={(e) => setOnlyRootBlockers(e.target.checked)}
                className="rounded border-default text-brand-500 focus:ring-0"
              />
              <span>Root blockers</span>
            </label>
          </div>
        </div>

        {/* Sessions Table Container */}
        <div className="bg-surface-100 rounded-md border border-default shadow-xs overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-200/60 border-b border-default text-foreground-lighter font-medium">
              <tr>
                <th className="py-2.5 px-4 font-normal w-28">STATE</th>
                <th className="py-2.5 px-4 font-normal">QUERY · SESSION</th>
                <th className="py-2.5 px-4 font-normal w-32">DURATION</th>
                <th className="py-2.5 px-4 font-normal w-32">BLOCKED BY</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-default font-mono">
              {filteredSessions.length > 0 ? (
                filteredSessions.map((session) => (
                  <tr key={session.pid} className="hover:bg-surface-200/40 transition-colors">
                    <td className="py-2.5 px-4">
                      <span
                        className={cn(
                          'inline-flex px-1.5 py-0.5 rounded text-[10px] font-sans font-medium uppercase',
                          session.state === 'active'
                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                            : 'bg-surface-300 text-foreground-lighter'
                        )}
                      >
                        {session.state}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-foreground truncate max-w-md">
                      <div className="font-mono text-xs truncate">
                        {session.query || '<idle connection>'}
                      </div>
                      <div className="text-[11px] text-foreground-lighter font-sans">
                        PID: {session.pid} · User: {session.username || 'postgres'} · App:{' '}
                        {session.applicationName || 'socket'}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-foreground-light">{session.duration}</td>
                    <td className="py-2.5 px-4 text-foreground-lighter">
                      {session.blockedBy ? `PID ${session.blockedBy}` : '-'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center text-foreground-lighter">
                      <div className="w-10 h-10 rounded-full bg-surface-200 flex items-center justify-center mb-3">
                        <Layers size={18} className="text-foreground-lighter" />
                      </div>
                      <p className="text-sm font-medium text-foreground m-0">No active sessions</p>
                      <p className="text-xs text-foreground-lighter mt-1 max-w-sm m-0">
                        There are currently no active database connections for the anon,
                        authenticated, and postgres roles.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

DatabaseConnectionsPage.getLayout = (page) => (
  <DefaultLayout>
    <ObservabilityLayout title="Database Connections">{page}</ObservabilityLayout>
  </DefaultLayout>
)

export default DatabaseConnectionsPage
