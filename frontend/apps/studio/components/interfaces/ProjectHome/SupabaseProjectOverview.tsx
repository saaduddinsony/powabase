import { IS_PLATFORM, useParams } from 'common'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import {
  Activity,
  Archive,
  Check,
  ChevronDown,
  Cpu,
  Database,
  GitBranch,
  Github,
  Globe2,
  Layers,
  Network,
  Sparkles,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Badge, Button, cn, Skeleton } from 'ui'

import dynamic from 'next/dynamic'
import { ClientLibrary } from '@/components/interfaces/Home/ClientLibrary'
import { EXAMPLE_PROJECTS } from '@/components/interfaces/Home/Home.constants'
import { OverviewStats } from '@/components/interfaces/ProjectHome/OverviewStats'
import { ProjectConnectionPopover } from '@/components/interfaces/ProjectHome/ProjectConnectionPopover'
import { ScaffoldContainer, ScaffoldSection } from '@/components/layouts/Scaffold'
import { useBranchesQuery } from '@/data/branches/branches-query'
import { useBackupsQuery } from '@/data/database/backups-query'
import { useMigrationsQuery } from '@/data/database/migrations-query'
import { useCustomContent } from '@/hooks/custom-content/useCustomContent'
import { useSelectedOrganizationQuery } from '@/hooks/misc/useSelectedOrganization'
import { useSelectedProjectQuery } from '@/hooks/misc/useSelectedProject'
import { EMPTY_ARR } from '@/lib/void'

const RegionalWorldMap = dynamic(
  () => import('./RegionalWorldMap').then((m) => m.RegionalWorldMap),
  { ssr: false }
)

dayjs.extend(relativeTime)

interface ServerResourcesResponse {
  cpu: {
    usagePercent: number
    cores: number
    model: string
  }
  memory: {
    usedPercent: number
    usedFormatted: string
    totalFormatted: string
  }
  disk: {
    usedPercent: number
    usedFormatted: string
    totalFormatted: string
  }
  database: {
    activeConnections: number
    maxConnections: number
    size: string
    status: string
  }
  host: {
    hostname: string
    platform: string
    arch: string
  }
}

export function SupabaseProjectOverview() {
  const router = useRouter()
  const { ref } = useParams()
  const projectRef = typeof ref === 'string' ? ref : ref?.[0]
  const { data: project } = useSelectedProjectQuery()
  const { data: organization } = useSelectedOrganizationQuery()

  const [showExplorerCallout, setShowExplorerCallout] = useState(false)
  const [canvasMode, setCanvasMode] = useState<'node' | 'map'>('node')

  useEffect(() => {
    try {
      const dismissed = typeof window !== 'undefined' ? localStorage.getItem('socket-overview-explorer-dismissed') : null
      if (!dismissed) {
        setShowExplorerCallout(true)
      }
    } catch {
      // noop
    }
  }, [])

  const handleDismissCallout = () => {
    setShowExplorerCallout(false)
    try {
      localStorage.setItem('socket-overview-explorer-dismissed', 'true')
    } catch {
      // noop
    }
  }

  // Fetch real-time hardware telemetry from Socket server
  const { data: serverResources } = useQuery<ServerResourcesResponse>({
    queryKey: ['project-overview-server-resources'],
    queryFn: async () => {
      const res = await fetch('/api/platform/infrastructure/server-resources')
      if (!res.ok) throw new Error('Failed to fetch server resources')
      return res.json()
    },
    refetchInterval: 10000,
  })

  // Branches
  const { data: branchesData, isPending: isLoadingBranches } = useBranchesQuery({
    projectRef: project?.parent_project_ref ?? project?.ref,
  })
  const latestNonDefaultBranch = useMemo(() => {
    const list = (branchesData ?? []).filter((b) => !b.is_default)
    if (list.length === 0) return undefined
    return list
      .slice()
      .sort(
        (a, b) =>
          new Date(b.created_at ?? b.updated_at).valueOf() -
          new Date(a.created_at ?? a.updated_at).valueOf()
      )[0]
  }, [branchesData])

  // Migrations
  const { data: migrationsData = EMPTY_ARR, isPending: isLoadingMigrations } = useMigrationsQuery({
    projectRef: project?.ref,
    projectStatus: project?.status,
    connectionString: project?.connectionString,
  })
  const latestMigration = useMemo(() => migrationsData[0], [migrationsData])

  // Backups
  const { data: backupsData, isPending: isLoadingBackups } = useBackupsQuery({
    projectRef: project?.ref,
    projectStatus: project?.status,
  })
  const latestBackup = useMemo(() => {
    const list = backupsData?.backups ?? []
    if (list.length === 0) return undefined
    return list
      .slice()
      .sort((a, b) => new Date(b.inserted_at).valueOf() - new Date(a.inserted_at).valueOf())[0]
  }, [backupsData])

  // Client libraries
  const { projectHomepageClientLibraries: clientLibraries } = useCustomContent([
    'project_homepage:client_libraries',
  ])

  const projectName = project?.name ?? 'Default Project'
  const isHealthy = project?.status !== 'INACTIVE'

  return (
    <div className="w-full pb-20">
      <ScaffoldContainer size="large">
        <ScaffoldSection isFullWidth>
          <div className="flex flex-col gap-8 pt-4">
            {/* Top Header */}
            <div className="flex flex-col gap-1">
              <h1 className="text-3xl font-semibold text-foreground tracking-tight m-0">
                {projectName}
              </h1>
              <div className="flex items-center gap-3">
                <ProjectConnectionPopover projectRef={projectRef} />
              </div>
            </div>

            {/* Main 2-Column Hero Grid: 6 Status Cards (Left) + Topology Canvas (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* Left Column: 2x3 Grid of Metadata Cards */}
              <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* 1. STATUS */}
                <Link
                  href={`/project/${projectRef}/observability`}
                  className="rounded-xl border border-default bg-surface-100 p-4 flex items-center gap-3.5 shadow-sm hover:border-foreground-muted transition-all group"
                >
                  <div className="h-11 w-11 rounded-lg bg-surface-200/80 border border-default flex items-center justify-center shrink-0">
                    <div className="grid grid-cols-3 gap-1 p-0.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    </div>
                  </div>
                  <div className="truncate">
                    <div className="text-[10px] font-semibold text-foreground-lighter tracking-wider uppercase">
                      STATUS
                    </div>
                    <div className="text-sm font-medium text-foreground truncate mt-0.5">
                      {isHealthy ? 'Healthy' : 'Unhealthy'}
                    </div>
                  </div>
                </Link>

                {/* 2. COMPUTE SIZE */}
                <Link
                  href={`/project/${projectRef}/infrastructure`}
                  className="rounded-xl border border-default bg-surface-100 p-4 flex items-center gap-3.5 shadow-sm hover:border-foreground-muted transition-all group"
                >
                  <div className="h-11 w-11 rounded-lg bg-surface-200/80 border border-default flex items-center justify-center shrink-0 text-foreground-light">
                    <Cpu size={18} />
                  </div>
                  <div className="truncate">
                    <div className="text-[10px] font-semibold text-foreground-lighter tracking-wider uppercase">
                      COMPUTE SIZE
                    </div>
                    <div className="text-sm font-medium text-foreground truncate mt-0.5 flex items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px] uppercase font-mono px-1.5 py-0">
                        {serverResources?.cpu?.cores
                          ? `${serverResources.cpu.cores} Cores · ${serverResources.memory.totalFormatted}`
                          : 'DEDICATED'}
                      </Badge>
                    </div>
                  </div>
                </Link>

                {/* 3. GITHUB */}
                <Link
                  href={`/project/${projectRef}/settings/integrations`}
                  className="rounded-xl border border-default bg-surface-100 p-4 flex items-center gap-3.5 shadow-sm hover:border-foreground-muted transition-all group"
                >
                  <div className="h-11 w-11 rounded-lg bg-surface-200/80 border border-default flex items-center justify-center shrink-0 text-foreground-light">
                    <Github size={18} />
                  </div>
                  <div className="truncate">
                    <div className="text-[10px] font-semibold text-foreground-lighter tracking-wider uppercase">
                      GITHUB
                    </div>
                    <div className="text-sm font-medium text-foreground-lighter truncate mt-0.5">
                      No repository connected
                    </div>
                  </div>
                </Link>

                {/* 4. RECENT BRANCH */}
                <Link
                  href={`/project/${projectRef}/branches`}
                  className="rounded-xl border border-default bg-surface-100 p-4 flex items-center gap-3.5 shadow-sm hover:border-foreground-muted transition-all group"
                >
                  <div className="h-11 w-11 rounded-lg bg-surface-200/80 border border-default flex items-center justify-center shrink-0 text-foreground-light">
                    <GitBranch size={18} />
                  </div>
                  <div className="truncate">
                    <div className="text-[10px] font-semibold text-foreground-lighter tracking-wider uppercase">
                      RECENT BRANCH
                    </div>
                    <div className="text-sm font-medium text-foreground-lighter truncate mt-0.5">
                      {IS_PLATFORM && isLoadingBranches ? (
                        <Skeleton className="h-4 w-16" />
                      ) : (
                        latestNonDefaultBranch?.name ?? 'No branches'
                      )}
                    </div>
                  </div>
                </Link>

                {/* 5. LAST MIGRATION */}
                <Link
                  href={`/project/${projectRef}/database/migrations`}
                  className="rounded-xl border border-default bg-surface-100 p-4 flex items-center gap-3.5 shadow-sm hover:border-foreground-muted transition-all group"
                >
                  <div className="h-11 w-11 rounded-lg bg-surface-200/80 border border-default flex items-center justify-center shrink-0 text-foreground-light">
                    <Database size={18} />
                  </div>
                  <div className="truncate">
                    <div className="text-[10px] font-semibold text-foreground-lighter tracking-wider uppercase">
                      LAST MIGRATION
                    </div>
                    <div className="text-sm font-medium text-foreground truncate mt-0.5">
                      {isLoadingMigrations ? (
                        <Skeleton className="h-4 w-20" />
                      ) : latestMigration ? (
                        latestMigration.name
                      ) : (
                        <span className="text-foreground-lighter">No migrations</span>
                      )}
                    </div>
                  </div>
                </Link>

                {/* 6. LAST BACKUP */}
                <Link
                  href={`/project/${projectRef}/database/backups/scheduled`}
                  className="rounded-xl border border-default bg-surface-100 p-4 flex items-center gap-3.5 shadow-sm hover:border-foreground-muted transition-all group"
                >
                  <div className="h-11 w-11 rounded-lg bg-surface-200/80 border border-default flex items-center justify-center shrink-0 text-foreground-light">
                    <Archive size={18} />
                  </div>
                  <div className="truncate">
                    <div className="text-[10px] font-semibold text-foreground-lighter tracking-wider uppercase">
                      LAST BACKUP
                    </div>
                    <div className="text-sm font-medium text-foreground truncate mt-0.5">
                      {IS_PLATFORM && isLoadingBackups ? (
                        <Skeleton className="h-4 w-20" />
                      ) : latestBackup ? (
                        dayjs(latestBackup.inserted_at).fromNow()
                      ) : (
                        <span className="text-foreground-lighter">No backups</span>
                      )}
                    </div>
                  </div>
                </Link>
              </div>

              {/* Right Column: Interactive Dot-Matrix Canvas with Primary Database Card */}
              <div
                className={`lg:col-span-6 relative flex flex-col justify-between rounded-xl border border-default bg-surface-100/40 min-h-[300px] shadow-sm overflow-hidden ${
                  canvasMode === 'node' ? 'p-5' : 'p-0'
                }`}
                style={{
                  backgroundImage:
                    canvasMode === 'node'
                      ? 'radial-gradient(rgba(128, 128, 128, 0.22) 1.5px, transparent 1.5px)'
                      : undefined,
                  backgroundSize: '18px 18px',
                }}
              >
                {/* Top Right Canvas Controls */}
                <div className="absolute top-3.5 right-3.5 z-20">
                  <div className="inline-flex items-center bg-surface-100/90 backdrop-blur-md rounded-lg border border-default p-1 shadow-sm gap-1">
                    <button
                      type="button"
                      onClick={() => setCanvasMode('node')}
                      title="Show infrastructure as a diagram"
                      aria-label="Show infrastructure as a diagram"
                      className={`h-7.5 min-w-[34px] px-2.5 rounded-md flex items-center justify-center transition-all duration-150 ${
                        canvasMode === 'node'
                          ? 'bg-surface-200 text-foreground shadow-xs'
                          : 'text-foreground-lighter hover:text-foreground hover:bg-surface-200/50'
                      }`}
                    >
                      <Network size={15} className={canvasMode === 'node' ? 'text-foreground' : 'text-foreground-lighter'} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCanvasMode('map')}
                      title="Show infrastructure on the map"
                      aria-label="Show infrastructure on the map"
                      className={`h-7.5 min-w-[34px] px-2.5 rounded-md flex items-center justify-center transition-all duration-150 ${
                        canvasMode === 'map'
                          ? 'bg-surface-200 text-foreground shadow-xs'
                          : 'text-foreground-lighter hover:text-foreground hover:bg-surface-200/50'
                      }`}
                    >
                      <Globe2 size={15} className={canvasMode === 'map' ? 'text-foreground' : 'text-foreground-lighter'} />
                    </button>
                  </div>
                </div>

                {/* Center Content: Either Primary Database Node or Regional World Map */}
                {canvasMode === 'map' ? (
                  <RegionalWorldMap
                    coordinates={serverResources?.host?.coordinates || [103.8, 1.37]}
                    label={
                      serverResources?.host?.region
                        ? `${serverResources.host.region} · Dedicated Host`
                        : 'Southeast Asia (Singapore) · Dedicated Host'
                    }
                    regionCode={serverResources?.host?.regionCode || 'ap-southeast-1'}
                  />
                ) : (
                  <div className="flex items-center justify-center my-auto py-2 z-10">
                    <Link
                      href={`/project/${projectRef}/infrastructure`}
                      className="w-full max-w-sm rounded-xl border border-default bg-surface-100/95 backdrop-blur-sm p-4 shadow-md hover:border-foreground-muted hover:shadow-lg transition-all"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shrink-0 mt-0.5">
                            <Database size={18} />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-foreground">
                              Primary Database
                            </div>
                            <div className="text-xs text-foreground-light mt-0.5">
                              {serverResources?.host?.region || 'Southeast Asia (Singapore)'}
                            </div>
                            <div className="text-[11px] text-foreground-lighter font-mono mt-0.5">
                              {serverResources?.host?.regionCode || 'ap-southeast-1'} ·{' '}
                              {serverResources?.cpu?.model?.includes('Neoverse')
                                ? 'Ampere Altra ARM64'
                                : serverResources?.cpu?.model || 'ARM64 Dedicated'}
                            </div>
                          </div>
                        </div>

                        {/* Country Flag Badge */}
                        <img
                          src="/img/regions/ap-southeast-1.svg"
                          alt="Singapore"
                          className="rounded-xs border border-default/80 mt-1 w-8 shadow-xs"
                          title={serverResources?.host?.country || 'Singapore'}
                        />
                      </div>

                    {/* Mini Resource Metrics Strip */}
                    <div className="mt-3.5 pt-2.5 border-t border-default/70 flex items-center justify-between text-[11px] font-mono text-foreground-light">
                      <span>
                        CPU{' '}
                        <strong className="text-foreground font-semibold">
                          {serverResources ? `${serverResources.cpu.usagePercent}%` : '—'}
                        </strong>
                      </span>
                      <span>·</span>
                      <span>
                        Disk{' '}
                        <strong className="text-foreground font-semibold">
                          {serverResources ? `${serverResources.disk.usedPercent}%` : '—'}
                        </strong>
                      </span>
                      <span>·</span>
                      <span>
                        RAM{' '}
                        <strong className="text-foreground font-semibold">
                          {serverResources ? `${serverResources.memory.usedPercent}%` : '—'}
                        </strong>
                      </span>
                      <span>·</span>
                      <span>
                        <strong className="text-foreground font-semibold">
                          {serverResources?.database
                            ? `${serverResources.database.activeConnections}/${serverResources.database.maxConnections}`
                            : '—'}
                        </strong>{' '}
                        conns
                      </span>
                    </div>
                  </Link>
                </div>
              )}

                {/* Canvas Footer Hint */}
                {canvasMode === 'node' && (
                  <div className="flex justify-between items-center text-[11px] text-foreground-lighter z-10">
                    <span>Socket Bare-Metal / Dedicated Runtime</span>
                    <Link
                      href={`/project/${projectRef}/infrastructure`}
                      className="hover:text-foreground text-brand transition-colors"
                    >
                      Manage server &rarr;
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Request Telemetry Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-5 text-sm">
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <span className="grid grid-cols-2 gap-0.5 p-0.5">
                    <span className="h-1 w-1 rounded-full bg-foreground-lighter" />
                    <span className="h-1 w-1 rounded-full bg-foreground-lighter" />
                    <span className="h-1 w-1 rounded-full bg-foreground-lighter" />
                    <span className="h-1 w-1 rounded-full bg-foreground-lighter" />
                  </span>
                  <span className="tabular-nums font-semibold">0 Total Requests</span>
                </div>
                <div className="text-sm text-foreground-light tabular-nums">
                  100.0% Success Rate
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-default bg-surface-100 text-xs text-foreground-light cursor-default">
                  <span>Last 60 minutes</span>
                  <ChevronDown size={12} className="text-foreground-lighter" />
                </div>
              </div>
            </div>

            {/* 4 Core Pillars Grid (API GATEWAY, STORAGE, REALTIME, POSTGRES) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. API GATEWAY */}
              <Link
                href={`/project/${projectRef}/infrastructure`}
                className="rounded-xl border border-default bg-surface-100 p-4 shadow-sm hover:border-foreground-muted transition-all block group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-foreground-lighter tracking-wider uppercase">
                    API GATEWAY
                  </span>
                  <div className="flex items-center gap-2 text-[10px] text-foreground-lighter">
                    <span className="inline-flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      WARNINGS 0
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                      ERRORS 0
                    </span>
                  </div>
                </div>
                <div className="mt-3 text-2xl font-semibold text-foreground tracking-tight tabular-nums">
                  0
                </div>
              </Link>

              {/* 2. STORAGE */}
              <Link
                href={`/project/${projectRef}/storage/buckets`}
                className="rounded-xl border border-default bg-surface-100 p-4 shadow-sm hover:border-foreground-muted transition-all block group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-foreground-lighter tracking-wider uppercase">
                    STORAGE
                  </span>
                  <div className="flex items-center gap-2 text-[10px] text-foreground-lighter">
                    <span className="inline-flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      WARNINGS 0
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                      ERRORS 0
                    </span>
                  </div>
                </div>
                <div className="mt-3 text-2xl font-semibold text-foreground tracking-tight tabular-nums">
                  0
                </div>
              </Link>

              {/* 3. REALTIME */}
              <Link
                href={`/project/${projectRef}/realtime/inspector`}
                className="rounded-xl border border-default bg-surface-100 p-4 shadow-sm hover:border-foreground-muted transition-all block group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-foreground-lighter tracking-wider uppercase">
                    REALTIME
                  </span>
                  <div className="flex items-center gap-2 text-[10px] text-foreground-lighter">
                    <span className="inline-flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      WARNINGS 0
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                      ERRORS 0
                    </span>
                  </div>
                </div>
                <div className="mt-3 text-2xl font-semibold text-foreground tracking-tight tabular-nums">
                  0
                </div>
              </Link>

              {/* 4. POSTGRES */}
              <Link
                href={`/project/${projectRef}/editor`}
                className="rounded-xl border border-default bg-surface-100 p-4 shadow-sm hover:border-foreground-muted transition-all block group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-foreground-lighter tracking-wider uppercase">
                    POSTGRES
                  </span>
                  <div className="flex items-center gap-2 text-[10px] text-foreground-lighter">
                    <span className="inline-flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      WARNINGS 0
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                      ERRORS 0
                    </span>
                  </div>
                </div>
                <div className="mt-3 text-2xl font-semibold text-foreground tracking-tight tabular-nums">
                  {serverResources?.database?.activeConnections ?? 0}
                </div>
              </Link>
            </div>

            {/* Powabase AI Observability Stats */}
            <div className="border-t border-default/70 pt-8 mt-2">
              <OverviewStats projectRef={projectRef ?? 'default'} />
            </div>

            {/* Client Libraries */}
            <div className="border-t border-default/70 pt-8">
              <div className="space-y-4">
                <div>
                  <h2 className="text-base font-medium text-foreground m-0">Client libraries</h2>
                  <p className="text-xs text-foreground-light m-0 mt-1">
                    Connect and integrate with your Socket backend across any programming language or framework.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
                  {(clientLibraries ?? []).map((lib: any) => (
                    <ClientLibrary key={lib.language} {...lib} />
                  ))}
                </div>
              </div>
            </div>

            {/* Example Projects */}
            <div className="border-t border-default/70 pt-8">
              <div className="space-y-4">
                <div>
                  <h2 className="text-base font-medium text-foreground m-0">Example projects</h2>
                  <p className="text-xs text-foreground-light m-0 mt-1">
                    Kickstart your application with production-ready full-stack templates.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                  {EXAMPLE_PROJECTS.slice(0, 6).map((project) => (
                    <a
                      key={project.title}
                      href={project.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl border border-default bg-surface-100 p-4 shadow-sm hover:border-foreground-muted transition-all block group"
                    >
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-[10px] uppercase font-mono">
                          {project.framework}
                        </Badge>
                        <span className="text-xs text-foreground-lighter group-hover:text-foreground transition-colors">
                          &rarr;
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-foreground mt-2.5 mb-1">
                        {project.title}
                      </h4>
                      <p className="text-xs text-foreground-light line-clamp-2 m-0">
                        {project.description}
                      </p>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </ScaffoldSection>
      </ScaffoldContainer>

      {/* Floating Preview Callout: Explorer & Notebooks */}
      {showExplorerCallout && (
        <div className="fixed bottom-6 right-6 z-40 max-w-sm w-full rounded-2xl border border-default bg-surface-100/95 backdrop-blur-md p-4 shadow-2xl transition-all animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center justify-between mb-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 uppercase tracking-wider">
              PREVIEW
            </span>
            <button
              type="button"
              onClick={handleDismissCallout}
              className="text-foreground-lighter hover:text-foreground transition-colors p-1 rounded-md"
              title="Dismiss"
            >
              <X size={14} />
            </button>
          </div>

          <div className="text-[11px] font-medium text-foreground-lighter mb-1">
            User growth
          </div>
          <p className="text-[11px] text-foreground-light m-0 mb-2">
            Track how your user base is trending.
          </p>

          {/* Mini SQL code preview */}
          <div className="rounded-lg bg-surface-200/90 border border-default p-2.5 font-mono text-[11px] text-foreground-light overflow-x-auto select-all">
            <span className="text-brand-600 font-semibold">select</span><br />
            &nbsp;&nbsp;date_trunc(&apos;week&apos;, last_sign_in_at) as week,<br />
            &nbsp;&nbsp;count(distinct id) as active_users
          </div>

          <div className="mt-3">
            <div className="text-xs font-semibold text-foreground">
              Explorer & Notebooks
            </div>
            <p className="text-xs text-foreground-light mt-0.5 m-0">
              New unified workspace for querying data and chatting with Assistant.
            </p>
          </div>

          <Button
            type="default"
            size="tiny"
            className="w-full mt-3 font-medium"
            onClick={() => router.push(`/project/${projectRef}/sql/new`)}
          >
            Enable Explorer
          </Button>
        </div>
      )}
    </div>
  )
}
