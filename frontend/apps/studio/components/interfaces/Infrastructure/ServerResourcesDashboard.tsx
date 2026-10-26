import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  HardDrive,
  Layers,
  RefreshCw,
  Server,
  ShieldCheck,
  Terminal,
  Wifi,
  Zap,
} from 'lucide-react'
import { useState } from 'react'
import { Badge, Button } from 'ui'

export interface ServerResourcesData {
  host: {
    hostname: string
    platform: string
    release: string
    arch: string
    uptimeSeconds: number
    uptimeFormatted: string
    nodeVersion: string
    serverTime: string
    deploymentType: string
  }
  cpu: {
    cores: number
    model: string
    speedMhz: number
    usagePercent: number
    loadAverage: number[]
  }
  memory: {
    totalBytes: number
    usedBytes: number
    freeBytes: number
    rawFreeBytes: number
    buffersBytes: number
    cachedBytes: number
    usedPercent: number
    totalFormatted: string
    usedFormatted: string
    freeFormatted: string
  }
  disk: {
    totalBytes: number
    usedBytes: number
    freeBytes: number
    usedPercent: number
    totalFormatted: string
    usedFormatted: string
    freeFormatted: string
    mount: string
    filesystem: string
  }
  database: {
    status: string
    size: string
    sizeBytes: number
    activeConnections: number
    maxConnections: number
    cacheHitRatio: number
    version: string
  }
  services: Array<{
    name: string
    role: string
    category: string
    port: number
    description: string
    status: 'healthy' | 'unhealthy'
    statusCode?: number
    latencyMs: number
  }>
}

export function ServerResourcesDashboard() {
  const [autoRefresh, setAutoRefresh] = useState(true)

  const { data, isLoading, isRefetching, error, refetch } = useQuery<ServerResourcesData>({
    queryKey: ['server-infrastructure-resources'],
    queryFn: async () => {
      const res = await fetch('/api/platform/infrastructure/server-resources')
      if (!res.ok) {
        throw new Error('Failed to fetch server infrastructure resources')
      }
      return res.json()
    },
    refetchInterval: autoRefresh ? 10000 : false,
  })

  const getUsageColor = (percent: number) => {
    if (percent >= 85) return 'bg-destructive'
    if (percent >= 70) return 'bg-amber-500'
    return 'bg-brand'
  }

  const getUsageBadgeVariant = (percent: number) => {
    if (percent >= 85) return 'destructive'
    if (percent >= 70) return 'warning'
    return 'brand'
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Top Server Header Strip */}
      <div className="flex flex-col gap-4 rounded-xl border border-default bg-surface-100 p-5 md:flex-row md:items-center md:justify-between shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-400/10 text-brand shrink-0 border border-brand-400/20">
            <Server className="h-6 w-6" />
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-semibold text-foreground m-0">
                Host Server Infrastructure
              </h2>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Operational
              </span>
            </div>
            <p className="text-xs text-foreground-light m-0">
              Live hardware metrics and container telemetry from the server where Socket is deployed.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 md:self-center">
          <Button
            type={autoRefresh ? 'default' : 'outline'}
            size="tiny"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <Clock className="h-3 w-3 mr-1 text-foreground-lighter" />
            {autoRefresh ? 'Auto-refresh (10s)' : 'Auto-refresh off'}
          </Button>

          <Button
            type="default"
            size="tiny"
            loading={isRefetching}
            onClick={() => refetch()}
            icon={<RefreshCw className={`h-3 w-3 ${isRefetching ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {isLoading && !data && (
        <div className="rounded-xl border border-default bg-surface-100 p-12 text-center shadow-sm">
          <RefreshCw className="h-6 w-6 animate-spin text-brand mx-auto mb-3" />
          <p className="text-sm text-foreground-light m-0">
            Sampling host hardware metrics and Socket services...
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">
          Error retrieving server resources: {(error as Error).message}
        </div>
      )}

      {data && (
        <>
          {/* Hardware Resource Metric Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* CPU Utilization Card */}
            <div className="rounded-xl border border-default bg-surface-100 p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-200 text-foreground-light">
                      <Cpu className="h-4 w-4" />
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-foreground-lighter">
                      CPU Usage
                    </span>
                  </div>
                  <Badge variant={getUsageBadgeVariant(data.cpu.usagePercent)}>
                    {data.cpu.usagePercent}%
                  </Badge>
                </div>

                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight text-foreground">
                    {data.cpu.usagePercent}%
                  </span>
                  <span className="text-xs text-foreground-light">
                    {data.cpu.cores} Cores ({data.host.arch})
                  </span>
                </div>

                {/* Progress bar */}
                <div className="mt-3.5 h-2 w-full rounded-full bg-surface-200 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${getUsageColor(
                      data.cpu.usagePercent
                    )}`}
                    style={{ width: `${Math.min(100, Math.max(2, data.cpu.usagePercent))}%` }}
                  />
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-default/60 space-y-1.5 text-xs">
                <div className="flex justify-between text-foreground-light">
                  <span>Architecture</span>
                  <span className="font-mono text-foreground font-medium truncate max-w-[140px]" title={data.cpu.model}>
                    {data.cpu.model}
                  </span>
                </div>
                <div className="flex justify-between text-foreground-light">
                  <span>Load Average</span>
                  <span className="font-mono text-foreground font-medium">
                    {data.cpu.loadAverage.join(' · ')}
                  </span>
                </div>
              </div>
            </div>

            {/* Memory (RAM) Card */}
            <div className="rounded-xl border border-default bg-surface-100 p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-200 text-foreground-light">
                      <Zap className="h-4 w-4" />
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-foreground-lighter">
                      Memory (RAM)
                    </span>
                  </div>
                  <Badge variant={getUsageBadgeVariant(data.memory.usedPercent)}>
                    {data.memory.usedPercent}%
                  </Badge>
                </div>

                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight text-foreground">
                    {data.memory.usedFormatted}
                  </span>
                  <span className="text-xs text-foreground-light">
                    / {data.memory.totalFormatted}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="mt-3.5 h-2 w-full rounded-full bg-surface-200 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${getUsageColor(
                      data.memory.usedPercent
                    )}`}
                    style={{ width: `${Math.min(100, Math.max(2, data.memory.usedPercent))}%` }}
                  />
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-default/60 space-y-1.5 text-xs">
                <div className="flex justify-between text-foreground-light">
                  <span>Available / Free</span>
                  <span className="font-mono text-foreground font-medium">
                    {data.memory.freeFormatted}
                  </span>
                </div>
                <div className="flex justify-between text-foreground-light">
                  <span>Total Allocated</span>
                  <span className="font-mono text-foreground font-medium">
                    {data.memory.totalFormatted}
                  </span>
                </div>
              </div>
            </div>

            {/* Storage (Disk) Card */}
            <div className="rounded-xl border border-default bg-surface-100 p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-200 text-foreground-light">
                      <HardDrive className="h-4 w-4" />
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-foreground-lighter">
                      Disk Storage
                    </span>
                  </div>
                  <Badge variant={getUsageBadgeVariant(data.disk.usedPercent)}>
                    {data.disk.usedPercent}%
                  </Badge>
                </div>

                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight text-foreground">
                    {data.disk.usedFormatted}
                  </span>
                  <span className="text-xs text-foreground-light">
                    / {data.disk.totalFormatted}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="mt-3.5 h-2 w-full rounded-full bg-surface-200 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${getUsageColor(
                      data.disk.usedPercent
                    )}`}
                    style={{ width: `${Math.min(100, Math.max(2, data.disk.usedPercent))}%` }}
                  />
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-default/60 space-y-1.5 text-xs">
                <div className="flex justify-between text-foreground-light">
                  <span>Free Space</span>
                  <span className="font-mono text-foreground font-medium">
                    {data.disk.freeFormatted}
                  </span>
                </div>
                <div className="flex justify-between text-foreground-light">
                  <span>Mount / Media</span>
                  <span className="font-mono text-foreground font-medium">
                    {data.disk.mount} ({data.disk.filesystem})
                  </span>
                </div>
              </div>
            </div>

            {/* Database Engine Card */}
            <div className="rounded-xl border border-default bg-surface-100 p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-200 text-foreground-light">
                      <Database className="h-4 w-4" />
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-foreground-lighter">
                      Postgres Engine
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Active
                  </span>
                </div>

                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight text-foreground">
                    {data.database.size}
                  </span>
                  <span className="text-xs text-foreground-light">Database Size</span>
                </div>

                {/* Progress bar for connections */}
                <div className="mt-3.5 h-2 w-full rounded-full bg-surface-200 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(
                          2,
                          (data.database.activeConnections / (data.database.maxConnections || 100)) *
                            100
                        )
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-default/60 space-y-1.5 text-xs">
                <div className="flex justify-between text-foreground-light">
                  <span>Active Connections</span>
                  <span className="font-mono text-foreground font-medium">
                    {data.database.activeConnections} / {data.database.maxConnections}
                  </span>
                </div>
                <div className="flex justify-between text-foreground-light">
                  <span>Cache Hit Ratio</span>
                  <span className="font-mono text-foreground font-medium">
                    {data.database.cacheHitRatio}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Host & Server Details Strip */}
          <div className="rounded-xl border border-default bg-surface-100 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Terminal className="h-4 w-4 text-foreground-lighter" />
              <h3 className="text-sm font-semibold text-foreground m-0">Server Environment & Host Specs</h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-xs">
              <div className="space-y-1">
                <span className="text-foreground-lighter">Hostname</span>
                <p className="font-mono font-medium text-foreground m-0 truncate" title={data.host.hostname}>
                  {data.host.hostname}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-foreground-lighter">Platform / OS</span>
                <p className="font-medium text-foreground m-0">
                  {data.host.platform} ({data.host.arch})
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-foreground-lighter">Kernel Release</span>
                <p className="font-mono font-medium text-foreground m-0 truncate" title={data.host.release}>
                  {data.host.release}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-foreground-lighter">System Uptime</span>
                <p className="font-medium text-foreground m-0">
                  {data.host.uptimeFormatted}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-foreground-lighter">Node Runtime</span>
                <p className="font-mono font-medium text-foreground m-0">
                  {data.host.nodeVersion}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-foreground-lighter">Deployment</span>
                <p className="font-medium text-foreground m-0">
                  {data.host.deploymentType}
                </p>
              </div>
            </div>
          </div>

          {/* Socket Stack Services Table */}
          <div className="rounded-xl border border-default bg-surface-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-default flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-foreground-lighter" />
                <h3 className="text-sm font-semibold text-foreground m-0">
                  Socket Infrastructure Services
                </h3>
              </div>
              <span className="text-xs text-foreground-lighter font-medium">
                {data.services.filter((s) => s.status === 'healthy').length} / {data.services.length} Online
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-default bg-surface-200/50 text-foreground-lighter font-medium">
                    <th className="py-2.5 px-4">Service</th>
                    <th className="py-2.5 px-4">Role & Function</th>
                    <th className="py-2.5 px-4">Category</th>
                    <th className="py-2.5 px-4">Port</th>
                    <th className="py-2.5 px-4">Latency</th>
                    <th className="py-2.5 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-default/60">
                  {data.services.map((service) => (
                    <tr key={service.name} className="hover:bg-surface-200/40 transition-colors">
                      <td className="py-3 px-4 font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          <span>{service.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-foreground-light max-w-xs truncate" title={service.description}>
                        {service.role}
                      </td>
                      <td className="py-3 px-4 text-foreground-lighter">
                        <span className="inline-block px-2 py-0.5 rounded-md bg-surface-200 text-[11px]">
                          {service.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-foreground-light">
                        :{service.port}
                      </td>
                      <td className="py-3 px-4 font-mono text-foreground-light">
                        {service.latencyMs}ms
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Healthy
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
