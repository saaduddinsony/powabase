import { useParams } from 'common'
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  Check,
  CheckCircle2,
  Database,
  Download,
  FileCode,
  HardDrive,
  Info,
  Layers,
  Play,
  RefreshCw,
  Server,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  Badge,
  Button,
  Input,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  cn,
} from 'ui'

import { BenchoUploadDropzone } from '@/components/interfaces/Database/ImportExport/BenchoUploadDropzone'
import DatabaseLayout from '@/components/layouts/DatabaseLayout/DatabaseLayout'
import DefaultLayout from '@/components/layouts/DefaultLayout'
import { ScaffoldContainer, ScaffoldHeader, ScaffoldSection } from '@/components/layouts/Scaffold'
import type { NextPageWithLayout } from '@/types'

const DatabaseImportExportPage: NextPageWithLayout = () => {
  const router = useRouter()
  const { ref } = useParams()
  const projectRef = typeof ref === 'string' ? ref : ref?.[0] || 'default'

  const [activeTab, setActiveTab] = useState<'upload' | 'supabase' | 'mysql' | 'export'>('upload')

  // Supabase / Powabase Migration Form State
  const [pgUri, setPgUri] = useState('')
  const [isTestingPg, setIsTestingPg] = useState(false)
  const [pgTestResult, setPgTestResult] = useState<{
    success: boolean
    database?: string
    tableCount?: number
    version?: string
    error?: string
  } | null>(null)
  const [isMigratingPg, setIsMigratingPg] = useState(false)
  const [pgMigrateResult, setPgMigrateResult] = useState<{
    success: boolean
    message?: string
    migratedTablesCount?: number
    error?: string
  } | null>(null)

  // MySQL Migration Form State
  const [mysqlHost, setMysqlHost] = useState('localhost')
  const [mysqlPort, setMysqlPort] = useState('3306')
  const [mysqlDb, setMysqlDb] = useState('')
  const [mysqlUser, setMysqlUser] = useState('root')
  const [mysqlPass, setMysqlPass] = useState('')
  const [isTestingMysql, setIsTestingMysql] = useState(false)
  const [mysqlTestResult, setMysqlTestResult] = useState<{
    success: boolean
    message?: string
    error?: string
  } | null>(null)
  const [isMigratingMysql, setIsMigratingMysql] = useState(false)
  const [mysqlMigrateResult, setMysqlMigrateResult] = useState<{
    success: boolean
    message?: string
    error?: string
  } | null>(null)

  // Export State
  const [exportSchema, setExportSchema] = useState('public')
  const [exportIncludeData, setExportIncludeData] = useState(true)
  const [isExporting, setIsExporting] = useState(false)

  // Test Postgres Connection
  const handleTestPg = async () => {
    if (!pgUri) {
      toast.error('Please enter a PostgreSQL connection string')
      return
    }
    setIsTestingPg(true)
    setPgTestResult(null)
    try {
      const res = await fetch(`/api/platform/database/${projectRef}/migrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test-connection',
          sourceType: 'supabase',
          connectionString: pgUri,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setPgTestResult({
          success: true,
          database: data.database,
          tableCount: data.tableCount,
          version: data.version,
        })
        toast.success('Connection verified successfully!')
      } else {
        setPgTestResult({
          success: false,
          error: data.error?.message || 'Connection test failed',
        })
        toast.error(data.error?.message || 'Connection test failed')
      }
    } catch (err: any) {
      setPgTestResult({ success: false, error: err.message })
      toast.error(`Error: ${err.message}`)
    } finally {
      setIsTestingPg(false)
    }
  }

  // Start Postgres Migration
  const handleStartPgMigration = async () => {
    if (!pgUri) return
    setIsMigratingPg(true)
    setPgMigrateResult(null)
    try {
      const res = await fetch(`/api/platform/database/${projectRef}/migrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start-migration',
          sourceType: 'supabase',
          connectionString: pgUri,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setPgMigrateResult({
          success: true,
          message: data.message,
          migratedTablesCount: data.migratedTablesCount,
        })
        toast.success('Migration completed successfully!')
      } else {
        setPgMigrateResult({
          success: false,
          error: data.error?.message || 'Migration failed',
        })
        toast.error(data.error?.message || 'Migration failed')
      }
    } catch (err: any) {
      setPgMigrateResult({ success: false, error: err.message })
      toast.error(`Migration error: ${err.message}`)
    } finally {
      setIsMigratingPg(false)
    }
  }

  // Test MySQL Connection
  const handleTestMysql = async () => {
    setIsTestingMysql(true)
    setMysqlTestResult(null)
    try {
      const res = await fetch(`/api/platform/database/${projectRef}/migrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test-connection',
          sourceType: 'mysql',
          mysqlConfig: {
            host: mysqlHost,
            port: mysqlPort,
            database: mysqlDb,
            user: mysqlUser,
          },
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setMysqlTestResult({ success: true, message: data.message })
        toast.success(data.message)
      } else {
        setMysqlTestResult({ success: false, error: data.error?.message })
        toast.error(data.error?.message || 'MySQL test failed')
      }
    } catch (err: any) {
      setMysqlTestResult({ success: false, error: err.message })
      toast.error(err.message)
    } finally {
      setIsTestingMysql(false)
    }
  }

  // Start MySQL Migration
  const handleStartMysqlMigration = async () => {
    setIsMigratingMysql(true)
    setMysqlMigrateResult(null)
    try {
      const res = await fetch(`/api/platform/database/${projectRef}/migrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start-migration',
          sourceType: 'mysql',
          mysqlConfig: {
            host: mysqlHost,
            port: mysqlPort,
            database: mysqlDb,
            user: mysqlUser,
          },
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setMysqlMigrateResult({ success: true, message: data.message })
        toast.success('MySQL migration schema mapping applied!')
      } else {
        setMysqlMigrateResult({ success: false, error: data.error?.message })
        toast.error(data.error?.message)
      }
    } catch (err: any) {
      setMysqlMigrateResult({ success: false, error: err.message })
      toast.error(err.message)
    } finally {
      setIsMigratingMysql(false)
    }
  }

  // Handle Export Download
  const handleDownloadExport = () => {
    setIsExporting(true)
    const url = `/api/platform/database/${projectRef}/export?schema=${exportSchema}&includeData=${exportIncludeData}`
    const a = document.createElement('a')
    a.href = url
    a.download = `socket-export-${exportSchema}-${new Date().toISOString().split('T')[0]}.sql`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    toast.success('Database export initiated')
    setTimeout(() => setIsExporting(false), 1500)
  }

  return (
    <ScaffoldContainer size="large" className="pb-24">
      <ScaffoldSection isFullWidth className="pt-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-default">
          <div>
            <h1 className="text-2xl font-semibold text-foreground tracking-tight m-0">
              Database Import & Export / Migrations
            </h1>
            <p className="text-sm text-foreground-lighter mt-1 m-0">
              Import from SQL files, stream direct migrations from Supabase, Powabase, or MySQL, and
              export automated backups with zero data loss.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs font-mono flex items-center gap-1.5 py-1">
              <ShieldCheck size={14} className="text-emerald-500" />
              <span>Persistent Volume Protected</span>
            </Badge>
          </div>
        </div>
      </ScaffoldSection>

      {/* Tabs Navigation */}
      <div className="mt-6">
        <div className="flex items-center gap-2 border-b border-default pb-px">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-all',
              activeTab === 'upload'
                ? 'border-brand-500 text-foreground font-semibold'
                : 'border-transparent text-foreground-lighter hover:text-foreground'
            )}
          >
            <ArrowDownToLine size={14} />
            <span>Restore SQL File (Dropzone)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('supabase')}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-all',
              activeTab === 'supabase'
                ? 'border-brand-500 text-foreground font-semibold'
                : 'border-transparent text-foreground-lighter hover:text-foreground'
            )}
          >
            <Database size={14} className="text-emerald-500" />
            <span>Migrate from Supabase / Powabase</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('mysql')}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-all',
              activeTab === 'mysql'
                ? 'border-brand-500 text-foreground font-semibold'
                : 'border-transparent text-foreground-lighter hover:text-foreground'
            )}
          >
            <Server size={14} className="text-blue-500" />
            <span>Migrate from MySQL</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-all',
              activeTab === 'export'
                ? 'border-brand-500 text-foreground font-semibold'
                : 'border-transparent text-foreground-lighter hover:text-foreground'
            )}
          >
            <ArrowUpFromLine size={14} />
            <span>Export & Backup</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="mt-8">
          {/* TAB 1: Bencho Upload Dropzone */}
          {activeTab === 'upload' && (
            <div className="flex flex-col gap-6 max-w-3xl">
              <div>
                <h3 className="text-base font-semibold text-foreground m-0">
                  Custom File Upload & SQL Restore
                </h3>
                <p className="text-xs text-foreground-lighter mt-1">
                  Drag and drop your SQL script or database dump to instantly parse, validate, and
                  restore tables into your PostgreSQL instance.
                </p>
              </div>

              <BenchoUploadDropzone projectRef={projectRef} />
            </div>
          )}

          {/* TAB 2: Supabase / Powabase Direct Migration */}
          {activeTab === 'supabase' && (
            <div className="flex flex-col gap-6 max-w-2xl rounded-2xl border border-default bg-surface-100 p-6 shadow-xs">
              <div>
                <h3 className="text-base font-semibold text-foreground m-0 flex items-center gap-2">
                  <Database size={18} className="text-emerald-500" />
                  <span>Direct Migration from Supabase / Powabase</span>
                </h3>
                <p className="text-xs text-foreground-lighter mt-1">
                  Connect to your existing Supabase or Powabase cloud project and stream tables and
                  data directly into Socket.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-foreground block mb-1.5">
                    Source PostgreSQL Connection URI
                  </label>
                  <Input
                    type="password"
                    placeholder="postgres://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"
                    value={pgUri}
                    onChange={(e) => setPgUri(e.target.value)}
                    className="font-mono text-xs"
                  />
                  <span className="text-[11px] text-foreground-lighter mt-1 block">
                    Find this in Supabase Project Settings → Database → Connection string (URI).
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    type="default"
                    size="small"
                    onClick={handleTestPg}
                    disabled={isTestingPg || !pgUri}
                    icon={isTestingPg ? <RefreshCw size={13} className="animate-spin" /> : undefined}
                  >
                    {isTestingPg ? 'Testing...' : 'Test Connection'}
                  </Button>

                  <Button
                    type="primary"
                    size="small"
                    onClick={handleStartPgMigration}
                    disabled={isMigratingPg || !pgTestResult?.success}
                    icon={isMigratingPg ? <RefreshCw size={13} className="animate-spin" /> : <Play size={13} />}
                    className="bg-brand-500 hover:bg-brand-600 text-white"
                  >
                    {isMigratingPg ? 'Migrating Tables...' : 'Start Full Migration'}
                  </Button>
                </div>

                {/* Connection Test Result */}
                {pgTestResult && (
                  <div
                    className={cn(
                      'p-3.5 rounded-xl border text-xs',
                      pgTestResult.success
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-destructive/10 border-destructive/30 text-destructive'
                    )}
                  >
                    {pgTestResult.success ? (
                      <div className="flex items-center gap-2 font-mono">
                        <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                        <span>
                          Connected! Found <strong>{pgTestResult.tableCount} tables</strong> in database &quot;
                          {pgTestResult.database}&quot; ({pgTestResult.version}).
                        </span>
                      </div>
                    ) : (
                      <div>
                        <strong>Connection Error:</strong> {pgTestResult.error}
                      </div>
                    )}
                  </div>
                )}

                {/* Migration Result */}
                {pgMigrateResult && (
                  <div
                    className={cn(
                      'p-4 rounded-xl border text-xs font-mono',
                      pgMigrateResult.success
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-destructive/10 border-destructive/30 text-destructive'
                    )}
                  >
                    {pgMigrateResult.success ? (
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                        <span>{pgMigrateResult.message}</span>
                      </div>
                    ) : (
                      <div>
                        <strong>Migration Failed:</strong> {pgMigrateResult.error}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: MySQL Migration */}
          {activeTab === 'mysql' && (
            <div className="flex flex-col gap-6 max-w-2xl rounded-2xl border border-default bg-surface-100 p-6 shadow-xs">
              <div>
                <h3 className="text-base font-semibold text-foreground m-0 flex items-center gap-2">
                  <Server size={18} className="text-blue-500" />
                  <span>Migrate from MySQL Database</span>
                </h3>
                <p className="text-xs text-foreground-lighter mt-1">
                  Introspect remote MySQL tables and convert schema & data types to PostgreSQL with
                  automatic dialect mapping.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">Host</label>
                  <Input
                    value={mysqlHost}
                    onChange={(e) => setMysqlHost(e.target.value)}
                    placeholder="e.g. db.example.com"
                    className="text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">Port</label>
                  <Input
                    value={mysqlPort}
                    onChange={(e) => setMysqlPort(e.target.value)}
                    placeholder="3306"
                    className="text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">Database Name</label>
                  <Input
                    value={mysqlDb}
                    onChange={(e) => setMysqlDb(e.target.value)}
                    placeholder="my_mysql_db"
                    className="text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">Username</label>
                  <Input
                    value={mysqlUser}
                    onChange={(e) => setMysqlUser(e.target.value)}
                    placeholder="root"
                    className="text-xs"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-foreground block mb-1">Password</label>
                  <Input
                    type="password"
                    value={mysqlPass}
                    onChange={(e) => setMysqlPass(e.target.value)}
                    placeholder="••••••••••••"
                    className="text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  type="default"
                  size="small"
                  onClick={handleTestMysql}
                  disabled={isTestingMysql}
                  icon={isTestingMysql ? <RefreshCw size={13} className="animate-spin" /> : undefined}
                >
                  {isTestingMysql ? 'Probing...' : 'Test MySQL Connectivity'}
                </Button>

                <Button
                  type="primary"
                  size="small"
                  onClick={handleStartMysqlMigration}
                  disabled={isMigratingMysql}
                  icon={isMigratingMysql ? <RefreshCw size={13} className="animate-spin" /> : <Play size={13} />}
                  className="bg-brand-500 hover:bg-brand-600 text-white"
                >
                  {isMigratingMysql ? 'Converting...' : 'Map & Convert to PostgreSQL'}
                </Button>
              </div>

              {mysqlTestResult && (
                <div
                  className={cn(
                    'p-3.5 rounded-xl border text-xs',
                    mysqlTestResult.success
                      ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                      : 'bg-destructive/10 border-destructive/30 text-destructive'
                  )}
                >
                  {mysqlTestResult.message || mysqlTestResult.error}
                </div>
              )}

              {mysqlMigrateResult && (
                <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs">
                  {mysqlMigrateResult.message}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Database Export */}
          {activeTab === 'export' && (
            <div className="flex flex-col gap-6 max-w-2xl rounded-2xl border border-default bg-surface-100 p-6 shadow-xs">
              <div>
                <h3 className="text-base font-semibold text-foreground m-0 flex items-center gap-2">
                  <ArrowUpFromLine size={18} className="text-brand-500" />
                  <span>Export Database Backup</span>
                </h3>
                <p className="text-xs text-foreground-lighter mt-1">
                  Download a complete SQL dump of your tables, schemas, and records for safe offline
                  storage or migration.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-foreground block mb-1.5">
                    Target Schema
                  </label>
                  <select
                    value={exportSchema}
                    onChange={(e) => setExportSchema(e.target.value)}
                    className="w-full text-xs rounded-lg border border-default bg-surface-200 px-3 py-2 text-foreground"
                  >
                    <option value="public">public (Application tables)</option>
                    <option value="auth">auth (Authentication users & identities)</option>
                    <option value="storage">storage (Buckets & files metadata)</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="includeData"
                    checked={exportIncludeData}
                    onChange={(e) => setExportIncludeData(e.target.checked)}
                    className="rounded border-default text-brand-500 focus:ring-brand-500"
                  />
                  <label htmlFor="includeData" className="text-xs text-foreground">
                    Include table records and rows (INSERT statements)
                  </label>
                </div>

                <div className="pt-2">
                  <Button
                    type="primary"
                    icon={
                      isExporting ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />
                    }
                    onClick={handleDownloadExport}
                    disabled={isExporting}
                    className="bg-brand-500 hover:bg-brand-600 text-white"
                  >
                    {isExporting ? 'Generating Dump...' : 'Download SQL Export (.sql)'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </ScaffoldContainer>
  )
}

DatabaseImportExportPage.getLayout = (page) => (
  <DefaultLayout>
    <DatabaseLayout title="Database Import & Export">{page}</DatabaseLayout>
  </DefaultLayout>
)

export default DatabaseImportExportPage
