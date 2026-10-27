import { useParams } from 'common'
import {
  Check,
  CheckCircle2,
  Clock,
  Database,
  ExternalLink,
  Flame,
  Globe,
  HardDrive,
  Key,
  Layers,
  Plus,
  RefreshCw,
  Search,
  Server,
  Settings2,
  Table as TableIcon,
  Trash2,
  XCircle,
  Zap,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogSection,
  DialogTitle,
  Input_Shadcn_,
  Label_Shadcn_,
} from 'ui'
import { CodeBlock } from 'ui-patterns/CodeBlock'

import DatabaseLayout from '@/components/layouts/DatabaseLayout/DatabaseLayout'
import DefaultLayout from '@/components/layouts/DefaultLayout'
import type { NextPageWithLayout } from '@/types'

interface MySQLConnector {
  id: number
  project_ref: string
  name: string
  host: string
  port: number
  database_name: string
  username: string
  foreign_schema: string
  status: string
  auto_sync_enabled?: boolean
  sync_interval_mins?: number
  last_synced_at?: string
  sync_status?: string
  table_count?: number
  created_at: string
}

interface TableColumn {
  column_name: string
  data_type: string
  is_nullable: string
}

interface TableInfo {
  table_name: string
  column_count: number
  columns: TableColumn[]
}

const DatabaseMySQLConnectorsPage: NextPageWithLayout = () => {
  const router = useRouter()
  const { ref: projectRef = 'default' } = useParams()

  const [connectors, setConnectors] = useState<MySQLConnector[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [syncingId, setSyncingId] = useState<number | null>(null)

  // Form State
  const [formName, setFormName] = useState('')
  const [formHost, setFormHost] = useState('')
  const [formPort, setFormPort] = useState('3306')
  const [formDatabase, setFormDatabase] = useState('')
  const [formUsername, setFormUsername] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formSchema, setFormSchema] = useState('cpanel_remote')
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  // Sync Settings Modal State
  const [syncConfigConnector, setSyncConfigConnector] = useState<MySQLConnector | null>(null)
  const [configAutoSync, setConfigAutoSync] = useState(false)
  const [configInterval, setConfigInterval] = useState(60)
  const [isSavingSyncConfig, setIsSavingSyncConfig] = useState(false)

  // Table Exploration Modal State
  const [exploreConnector, setExploreConnector] = useState<MySQLConnector | null>(null)
  const [exploreTables, setExploreTables] = useState<TableInfo[]>([])
  const [isLoadingTables, setIsLoadingTables] = useState(false)
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [tableFilter, setTableFilter] = useState('')
  const [tableData, setTableData] = useState<{ columns: string[]; rows: any[] } | null>(null)
  const [isLoadingRows, setIsLoadingRows] = useState(false)
  const [activeExploreTab, setActiveExploreTab] = useState<'data' | 'schema'>('data')

  // Query example tab
  const [activeTab, setActiveTab] = useState<'join' | 'direct' | 'rest'>('join')

  const fetchConnectors = async () => {
    try {
      setIsLoading(true)
      const res = await fetch(`/api/v1/projects/${projectRef}/database/mysql-connectors`)
      const data = await res.json()
      if (Array.isArray(data)) {
        setConnectors(data)
      } else {
        setConnectors([])
      }
    } catch (err: any) {
      toast.error('Failed to load MySQL connectors')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (projectRef) {
      fetchConnectors()
    }
  }, [projectRef])

  const handleTest = async () => {
    if (!formHost.trim() || !formDatabase.trim() || !formUsername.trim() || !formPassword.trim()) {
      toast.error('Please enter Host, Database Name, Username, and Password to test')
      return
    }

    try {
      setIsTesting(true)
      setTestResult(null)
      const res = await fetch(`/api/v1/projects/${projectRef}/database/mysql-connectors/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: formHost.trim(),
          port: formPort ? parseInt(formPort, 10) : 3306,
          database_name: formDatabase.trim(),
          username: formUsername.trim(),
          password: formPassword,
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setTestResult({ success: true, message: data.message })
        toast.success(data.message)
      } else {
        const msg = data.error?.message || data.message || 'Connection failed'
        setTestResult({ success: false, message: msg })
        toast.error(msg)
      }
    } catch (err: any) {
      const msg = err.message || 'Network error while testing connection'
      setTestResult({ success: false, message: msg })
      toast.error(msg)
    } finally {
      setIsTesting(false)
    }
  }

  const handleSave = async () => {
    if (!formName.trim() || !formHost.trim() || !formDatabase.trim() || !formUsername.trim() || !formPassword.trim() || !formSchema.trim()) {
      toast.error('Please fill in all required fields')
      return
    }

    try {
      setIsSaving(true)
      const res = await fetch(`/api/v1/projects/${projectRef}/database/mysql-connectors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          host: formHost.trim(),
          port: formPort ? parseInt(formPort, 10) : 3306,
          database_name: formDatabase.trim(),
          username: formUsername.trim(),
          password: formPassword,
          foreign_schema: formSchema.trim().toLowerCase(),
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message || 'Failed to connect MySQL database')

      toast.success(`Successfully connected! Imported foreign schema "${data.foreign_schema}".`)
      setIsAddModalOpen(false)
      setFormName('')
      setFormHost('')
      setFormPort('3306')
      setFormDatabase('')
      setFormUsername('')
      setFormPassword('')
      setFormSchema('cpanel_remote')
      setTestResult(null)
      fetchConnectors()
    } catch (err: any) {
      toast.error(err.message || 'Error connecting to MySQL')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      const res = await fetch(`/api/v1/projects/${projectRef}/database/mysql-connectors/${deleteId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete connector')
      toast.success('MySQL connector and foreign schema removed')
      setDeleteId(null)
      fetchConnectors()
    } catch (err: any) {
      toast.error(err.message || 'Error deleting connector')
    }
  }

  const handleSync = async (connector: MySQLConnector) => {
    try {
      setSyncingId(connector.id)
      const res = await fetch(`/api/v1/projects/${projectRef}/database/mysql-connectors/${connector.id}/sync`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message || 'Failed to synchronize schema')

      toast.success(`Schema synchronized! ${data.table_count ?? 0} foreign tables updated.`)
      fetchConnectors()
    } catch (err: any) {
      toast.error(err.message || 'Error syncing MySQL schema')
    } finally {
      setSyncingId(null)
    }
  }

  const handleOpenSyncConfig = (connector: MySQLConnector) => {
    setSyncConfigConnector(connector)
    setConfigAutoSync(connector.auto_sync_enabled ?? false)
    setConfigInterval(connector.sync_interval_mins ?? 60)
  }

  const handleSaveSyncConfig = async () => {
    if (!syncConfigConnector) return
    try {
      setIsSavingSyncConfig(true)
      const res = await fetch(`/api/v1/projects/${projectRef}/database/mysql-connectors/${syncConfigConnector.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auto_sync_enabled: configAutoSync,
          sync_interval_mins: configInterval,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message || 'Failed to update sync settings')

      toast.success('Auto-sync settings updated successfully')
      setSyncConfigConnector(null)
      fetchConnectors()
    } catch (err: any) {
      toast.error(err.message || 'Error saving sync settings')
    } finally {
      setIsSavingSyncConfig(false)
    }
  }

  const handleOpenExplorer = async (connector: MySQLConnector) => {
    setExploreConnector(connector)
    setSelectedTable(null)
    setTableData(null)
    setTableFilter('')
    setIsLoadingTables(true)

    try {
      const res = await fetch(`/api/v1/projects/${projectRef}/database/mysql-connectors/${connector.id}/tables`)
      const data = await res.json()
      if (Array.isArray(data)) {
        setExploreTables(data)
        if (data.length > 0) {
          handleSelectTable(connector.id, data[0].table_name)
        }
      } else {
        setExploreTables([])
      }
    } catch (err: any) {
      toast.error('Failed to load foreign tables')
    } finally {
      setIsLoadingTables(false)
    }
  }

  const handleSelectTable = async (connectorId: number, tableName: string) => {
    setSelectedTable(tableName)
    setIsLoadingRows(true)
    try {
      const res = await fetch(`/api/v1/projects/${projectRef}/database/mysql-connectors/${connectorId}/tables/${tableName}`)
      const data = await res.json()
      if (res.ok) {
        setTableData(data)
      } else {
        setTableData(null)
        toast.error(data.error?.message || 'Failed to load table rows')
      }
    } catch (err: any) {
      toast.error('Network error loading table data')
    } finally {
      setIsLoadingRows(false)
    }
  }

  const sampleSchema = connectors[0]?.foreign_schema || 'cpanel_store'

  const joinSnippet = `-- Cross-Database JOIN between PostgreSQL and remote MySQL
SELECT 
  u.id AS user_id,
  u.email,
  m.order_id,
  m.total_amount,
  m.status
FROM public.profiles u
JOIN ${sampleSchema}.orders m ON u.email = m.customer_email
WHERE m.status = 'completed'
ORDER BY m.total_amount DESC;`

  const directSnippet = `-- Query remote cPanel MySQL tables directly with standard SQL
SELECT 
  id,
  product_name,
  sku,
  price,
  stock_quantity
FROM ${sampleSchema}.products
WHERE stock_quantity < 10;`

  const restSnippet = `// PostgREST exposes your foreign MySQL tables automatically!
// Requesting foreign MySQL data via Socket REST API:

curl -X GET 'https://backend.freightsolution.xyz/rest/v1/${sampleSchema}.products?price=gt.50' \\
  -H "apikey: <YOUR_ANON_OR_SERVICE_KEY>" \\
  -H "Authorization: Bearer <YOUR_ANON_OR_SERVICE_KEY>"`

  const filteredExploreTables = exploreTables.filter((t) =>
    t.table_name.toLowerCase().includes(tableFilter.toLowerCase())
  )

  const currentTableObj = exploreTables.find((t) => t.table_name === selectedTable)

  return (
    <div className="flex flex-col gap-y-6 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Foreign Databases & MySQL Connectors</h1>
            <Badge variant="success">mysql_fdw v1.2 Active</Badge>
          </div>
          <p className="text-sm text-foreground-lighter mt-1">
            Connect any remote cPanel, 20i, AWS RDS, PlanetScale, or shared hosting MySQL database into Socket. Query remote tables, execute cross-database joins, and trigger real-time auto-synchronization.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="default"
            icon={<RefreshCw className={isLoading ? 'animate-spin' : ''} size={14} />}
            onClick={fetchConnectors}
          >
            Refresh
          </Button>
          <Button
            type="primary"
            icon={<Plus size={14} />}
            onClick={() => setIsAddModalOpen(true)}
          >
            Connect Remote MySQL
          </Button>
        </div>
      </div>

      {/* Feature Showcase Banner */}
      <Card className="border-primary/20 bg-gradient-to-r from-card via-card to-primary/5 shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Database size={22} />
                </span>
                <h2 className="text-lg font-semibold text-foreground">Zero-Duplication Foreign Table Federation</h2>
                <Badge variant="outline" className="border-blue-500/30 text-blue-400">PostgreSQL FDW + Real-time Sync</Badge>
              </div>
              <p className="text-sm text-foreground-lighter leading-relaxed">
                Connect external MySQL databases from any shared host (cPanel, 20i, Namecheap, DirectAdmin, etc.) without migrating or copying data. PostgreSQL queries the remote MySQL server directly via <code className="text-foreground font-mono bg-surface-200 px-1.5 py-0.5 rounded text-xs">mysql_fdw</code>, giving you full SQL capabilities, joins with Postgres tables, automated schema synchronization, and PostgREST REST APIs.
              </p>
              <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-foreground-light">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  <span>Works with cPanel & 20i Cloud MySQL</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  <span>Cross-Database SQL Joins</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  <span>Automated Schema Auto-Sync Intervals</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  <span>Visual Table & Live Data Explorer</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row lg:flex-col gap-2 shrink-0 w-full sm:w-auto">
              <Button
                type="primary"
                size="medium"
                className="w-full justify-center"
                icon={<Plus size={15} />}
                onClick={() => setIsAddModalOpen(true)}
              >
                + Connect cPanel MySQL
              </Button>
              <Link href={`/project/${projectRef}/sql/new`}>
                <Button
                  type="default"
                  size="medium"
                  className="w-full justify-center"
                  icon={<ExternalLink size={14} />}
                >
                  Open SQL Editor
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Connected Connectors List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-semibold">Connected MySQL Databases</CardTitle>
            <CardDescription className="text-xs">
              Configured remote MySQL foreign servers mapped into project <code className="font-mono">{projectRef}</code>
            </CardDescription>
          </div>
          <Badge variant="outline">
            {connectors.length} {connectors.length === 1 ? 'Server' : 'Servers'} Connected
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          {connectors.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="p-3 rounded-full bg-surface-200 text-foreground-lighter mb-3">
                <Database size={24} />
              </div>
              <h3 className="text-sm font-medium text-foreground">No remote MySQL databases connected yet</h3>
              <p className="text-xs text-foreground-lighter max-w-sm mt-1 mb-4">
                Connect your cPanel, 20i Cloud, or external MySQL databases to query remote tables seamlessly from Socket.
              </p>
              <Button
                type="primary"
                size="tiny"
                icon={<Plus size={14} />}
                onClick={() => setIsAddModalOpen(true)}
              >
                Connect Remote MySQL
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border overflow-x-auto">
              {connectors.map((c) => {
                const isSyncing = syncingId === c.id
                return (
                  <div key={c.id} className="p-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 hover:bg-surface-100/50 transition-colors">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-sm text-foreground">{c.name}</span>
                        <Badge variant="success" className="text-[10px] py-0 px-1.5">
                          Connected
                        </Badge>
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-mono text-primary border-primary/30">
                          schema: {c.foreign_schema}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-mono">
                          {c.table_count ?? 0} {c.table_count === 1 ? 'Table' : 'Tables'}
                        </Badge>
                        {c.auto_sync_enabled ? (
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-emerald-500/30 text-emerald-400">
                            Auto-Sync ({c.sync_interval_mins || 60}m)
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5 text-foreground-lighter">
                            Auto-Sync Off
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-foreground-lighter font-mono">
                        <span className="flex items-center gap-1 text-foreground-light">
                          <Server size={12} /> {c.host}:{c.port}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Database size={12} /> db: {c.database_name}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Key size={12} /> user: {c.username}
                        </span>
                        {c.last_synced_at && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-[11px]">
                              <Clock size={11} /> Synced: {new Date(c.last_synced_at).toLocaleTimeString()}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <Button
                        type="default"
                        size="tiny"
                        icon={<RefreshCw className={isSyncing ? 'animate-spin' : ''} size={12} />}
                        loading={isSyncing}
                        onClick={() => handleSync(c)}
                      >
                        Sync Schema
                      </Button>
                      <Button
                        type="default"
                        size="tiny"
                        icon={<TableIcon size={12} />}
                        onClick={() => handleOpenExplorer(c)}
                      >
                        Explore Tables & Data
                      </Button>
                      <Button
                        type="default"
                        size="tiny"
                        icon={<Settings2 size={12} />}
                        onClick={() => handleOpenSyncConfig(c)}
                      >
                        Auto-Sync
                      </Button>
                      <Button
                        type="default"
                        size="tiny"
                        icon={<ExternalLink size={12} />}
                        onClick={(e) => {
                          e.stopPropagation()
                          const sql = `SELECT * FROM "${c.foreign_schema}".tables LIMIT 10;`
                          window.open(`/project/${projectRef}/sql/new?content=${encodeURIComponent(sql)}`, '_blank')
                        }}
                      >
                        SQL
                      </Button>
                      <Button
                        type="outline"
                        size="tiny"
                        className="text-destructive hover:bg-destructive/10"
                        icon={<Trash2 size={12} />}
                        onClick={() => setDeleteId(c.id)}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Interactive SQL & REST Helper */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">How to Query Remote MySQL in Socket</CardTitle>
          <CardDescription className="text-xs">
            Examples showing cross-database joins, direct querying, and automated PostgREST endpoints.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4 border-b border-border pb-2">
            <button
              type="button"
              onClick={() => setActiveTab('join')}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                activeTab === 'join'
                  ? 'bg-surface-300 text-foreground font-medium'
                  : 'text-foreground-lighter hover:text-foreground'
              }`}
            >
              Cross-Database JOIN (Postgres + MySQL)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('direct')}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                activeTab === 'direct'
                  ? 'bg-surface-300 text-foreground font-medium'
                  : 'text-foreground-lighter hover:text-foreground'
              }`}
            >
              Direct SQL Query
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('rest')}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                activeTab === 'rest'
                  ? 'bg-surface-300 text-foreground font-medium'
                  : 'text-foreground-lighter hover:text-foreground'
              }`}
            >
              PostgREST REST API
            </button>
          </div>

          {activeTab === 'join' && (
            <div className="space-y-2">
              <CodeBlock language="sql" value={joinSnippet} hideLineNumbers />
              <p className="text-xs text-foreground-lighter">
                Joins local Postgres profiles with orders residing physically on your remote MySQL server. PostgreSQL pushes down filters and queries automatically over TCP.
              </p>
            </div>
          )}

          {activeTab === 'direct' && (
            <div className="space-y-2">
              <CodeBlock language="sql" value={directSnippet} hideLineNumbers />
              <p className="text-xs text-foreground-lighter">
                Query MySQL foreign tables identically to native Postgres tables. Supports <code className="font-mono">SELECT</code>, <code className="font-mono">INSERT</code>, <code className="font-mono">UPDATE</code>, and <code className="font-mono">DELETE</code>.
              </p>
            </div>
          )}

          {activeTab === 'rest' && (
            <div className="space-y-2">
              <CodeBlock language="bash" value={restSnippet} hideLineNumbers />
              <p className="text-xs text-foreground-lighter">
                Every foreign table in the mapped schema is instantly accessible via your Supabase / Socket REST endpoints, complete with filtering, sorting, and JSON responses.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table & Live Data Explorer Modal */}
      <Dialog open={exploreConnector !== null} onOpenChange={(open) => !open && setExploreConnector(null)}>
        <DialogContent className="sm:max-w-5xl max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="p-4 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <Database size={16} className="text-primary" />
                  <span>{exploreConnector?.name} Explorer</span>
                  <Badge variant="outline" className="font-mono text-xs">
                    schema: {exploreConnector?.foreign_schema}
                  </Badge>
                </DialogTitle>
                <p className="text-xs text-foreground-lighter mt-0.5">
                  Explore imported foreign tables, inspect column schemas, and preview live MySQL records.
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
            {/* Left Sidebar: Table List */}
            <div className="w-full md:w-64 border-r border-border flex flex-col shrink-0 bg-surface-100/30">
              <div className="p-3 border-b border-border">
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-2.5 text-foreground-lighter" />
                  <Input_Shadcn_
                    placeholder="Filter tables..."
                    className="pl-8 text-xs h-8"
                    value={tableFilter}
                    onChange={(e) => setTableFilter(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {isLoadingTables ? (
                  <div className="p-4 text-center text-xs text-foreground-lighter">Loading tables...</div>
                ) : filteredExploreTables.length === 0 ? (
                  <div className="p-4 text-center text-xs text-foreground-lighter">No foreign tables found</div>
                ) : (
                  filteredExploreTables.map((t) => {
                    const isSelected = t.table_name === selectedTable
                    return (
                      <button
                        key={t.table_name}
                        onClick={() => exploreConnector && handleSelectTable(exploreConnector.id, t.table_name)}
                        className={`w-full flex items-center justify-between p-2 rounded text-left text-xs transition-colors ${
                          isSelected
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'hover:bg-surface-200 text-foreground-light'
                        }`}
                      >
                        <span className="truncate font-mono">{t.table_name}</span>
                        <span className="text-[10px] text-foreground-lighter ml-1 shrink-0 font-mono">
                          {t.column_count} cols
                        </span>
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            {/* Right Pane: Table Details & Live Data Preview */}
            <div className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden">
              {selectedTable ? (
                <>
                  <div className="p-3.5 border-b border-border flex flex-wrap items-center justify-between gap-3 bg-surface-100/20">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold font-mono text-foreground">
                          {exploreConnector?.foreign_schema}.{selectedTable}
                        </span>
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-mono">
                          {currentTableObj?.columns.length || 0} columns
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-surface-200 rounded p-0.5">
                        <button
                          type="button"
                          onClick={() => setActiveExploreTab('data')}
                          className={`px-2.5 py-1 text-xs rounded transition-colors ${
                            activeExploreTab === 'data' ? 'bg-surface-300 text-foreground font-medium' : 'text-foreground-lighter'
                          }`}
                        >
                          Live Records (50 max)
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveExploreTab('schema')}
                          className={`px-2.5 py-1 text-xs rounded transition-colors ${
                            activeExploreTab === 'schema' ? 'bg-surface-300 text-foreground font-medium' : 'text-foreground-lighter'
                          }`}
                        >
                          Columns & Types
                        </button>
                      </div>

                      <Button
                        type="default"
                        size="tiny"
                        icon={<ExternalLink size={12} />}
                        onClick={(e) => {
                          e.stopPropagation()
                          const sql = `SELECT * FROM "${exploreConnector?.foreign_schema}"."${selectedTable}" LIMIT 100;`
                          window.open(`/project/${projectRef}/sql/new?content=${encodeURIComponent(sql)}`, '_blank')
                        }}
                      >
                        Open in SQL
                      </Button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-auto p-4">
                    {activeExploreTab === 'data' ? (
                      isLoadingRows ? (
                        <div className="flex flex-col items-center justify-center p-12 text-xs text-foreground-lighter">
                          <RefreshCw className="animate-spin mb-2" size={18} />
                          <span>Streaming remote rows from MySQL...</span>
                        </div>
                      ) : !tableData || tableData.rows.length === 0 ? (
                        <div className="p-8 text-center text-xs text-foreground-lighter">
                          No rows returned from remote table <code className="font-mono">{selectedTable}</code>
                        </div>
                      ) : (
                        <div className="border border-border rounded-lg overflow-x-auto">
                          <table className="w-full text-left text-xs font-mono border-collapse">
                            <thead>
                              <tr className="bg-surface-200/60 border-b border-border">
                                {tableData.columns.map((col) => (
                                  <th key={col} className="p-2.5 font-medium text-foreground text-xs whitespace-nowrap">
                                    {col}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {tableData.rows.map((row, idx) => (
                                <tr key={idx} className="hover:bg-surface-100/40">
                                  {tableData.columns.map((col) => {
                                    const val = row[col]
                                    return (
                                      <td key={col} className="p-2.5 text-foreground-light whitespace-nowrap max-w-xs truncate">
                                        {val === null || val === undefined ? (
                                          <span className="text-foreground-lighter italic">NULL</span>
                                        ) : typeof val === 'object' ? (
                                          JSON.stringify(val)
                                        ) : (
                                          String(val)
                                        )}
                                      </td>
                                    )
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )
                    ) : (
                      <div className="border border-border rounded-lg overflow-x-auto">
                        <table className="w-full text-left text-xs font-mono border-collapse">
                          <thead>
                            <tr className="bg-surface-200/60 border-b border-border">
                              <th className="p-2.5 font-medium text-foreground">Column Name</th>
                              <th className="p-2.5 font-medium text-foreground">Data Type</th>
                              <th className="p-2.5 font-medium text-foreground">Nullable</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {currentTableObj?.columns.map((col) => (
                              <tr key={col.column_name} className="hover:bg-surface-100/40">
                                <td className="p-2.5 text-foreground font-semibold">{col.column_name}</td>
                                <td className="p-2.5 text-primary">{col.data_type}</td>
                                <td className="p-2.5 text-foreground-lighter">
                                  {col.is_nullable === 'YES' ? 'nullable' : 'not null'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center p-8 text-xs text-foreground-lighter">
                  Select a foreign table from the list to explore
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="p-3 border-t border-border flex items-center justify-end">
            <Button type="default" onClick={() => setExploreConnector(null)}>
              Close Explorer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Auto-Sync Settings Modal */}
      <Dialog open={syncConfigConnector !== null} onOpenChange={(open) => !open && setSyncConfigConnector(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Schema Auto-Sync & Change Tracking</DialogTitle>
          </DialogHeader>

          <DialogSection className="space-y-4">
            <p className="text-xs text-foreground-lighter">
              Configure automatic background synchronization for <strong className="text-foreground">{syncConfigConnector?.name}</strong>. Socket will automatically discover new tables and schema alterations created in MySQL.
            </p>

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-surface-100/50">
                <div>
                  <div className="text-xs font-medium text-foreground">Enable Automated Sync</div>
                  <div className="text-[11px] text-foreground-lighter">
                    Periodically re-evaluates foreign schema and refreshes table metadata
                  </div>
                </div>
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                  checked={configAutoSync}
                  onChange={(e) => setConfigAutoSync(e.target.checked)}
                />
              </div>

              {configAutoSync && (
                <div className="space-y-1.5">
                  <Label_Shadcn_ htmlFor="sync-interval">Sync Frequency</Label_Shadcn_>
                  <select
                    id="sync-interval"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={configInterval}
                    onChange={(e) => setConfigInterval(parseInt(e.target.value, 10))}
                  >
                    <option value={15}>Every 15 Minutes (High Frequency)</option>
                    <option value={30}>Every 30 Minutes</option>
                    <option value={60}>Every 1 Hour (Recommended)</option>
                    <option value={360}>Every 6 Hours</option>
                    <option value={1440}>Every 24 Hours</option>
                  </select>
                </div>
              )}
            </div>
          </DialogSection>

          <DialogFooter className="flex items-center justify-end gap-2">
            <Button type="default" onClick={() => setSyncConfigConnector(null)}>
              Cancel
            </Button>
            <Button
              type="primary"
              loading={isSavingSyncConfig}
              onClick={handleSaveSyncConfig}
            >
              Save Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Connect Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Connect Remote MySQL Database</DialogTitle>
          </DialogHeader>

          <DialogSection className="space-y-4">
            <div className="space-y-1.5">
              <Label_Shadcn_ htmlFor="m-name">Display Name</Label_Shadcn_>
              <Input_Shadcn_
                id="m-name"
                placeholder="e.g. cPanel Production DB, 20i WordPress DB"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label_Shadcn_ htmlFor="m-host">MySQL Server Host / IP</Label_Shadcn_>
                <Input_Shadcn_
                  id="m-host"
                  placeholder="e.g. 161.118.224.130 or mysql.myhost.com"
                  value={formHost}
                  onChange={(e) => setFormHost(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label_Shadcn_ htmlFor="m-port">Port</Label_Shadcn_>
                <Input_Shadcn_
                  id="m-port"
                  placeholder="3306"
                  value={formPort}
                  onChange={(e) => setFormPort(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label_Shadcn_ htmlFor="m-db">MySQL Database Name</Label_Shadcn_>
              <Input_Shadcn_
                id="m-db"
                placeholder="e.g. cpaneluser_ecommerce"
                value={formDatabase}
                onChange={(e) => setFormDatabase(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label_Shadcn_ htmlFor="m-user">MySQL Username</Label_Shadcn_>
                <Input_Shadcn_
                  id="m-user"
                  placeholder="e.g. cpaneluser_dbadmin"
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label_Shadcn_ htmlFor="m-pass">MySQL Password</Label_Shadcn_>
                <Input_Shadcn_
                  id="m-pass"
                  type="password"
                  placeholder="••••••••••••"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label_Shadcn_ htmlFor="m-schema">Target Postgres Foreign Schema</Label_Shadcn_>
              <Input_Shadcn_
                id="m-schema"
                placeholder="cpanel_store"
                value={formSchema}
                onChange={(e) => setFormSchema(e.target.value)}
              />
              <p className="text-[11px] text-foreground-lighter">
                The PostgreSQL schema where remote MySQL tables will be mapped (e.g. <code className="font-mono">SELECT * FROM {formSchema || 'cpanel_remote'}.table_name</code>).
              </p>
            </div>

            {testResult && (
              <div className={`p-2.5 rounded text-xs flex items-center gap-2 border ${
                testResult.success
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-destructive/10 border-destructive/30 text-destructive'
              }`}>
                {testResult.success ? <Check size={14} /> : <XCircle size={14} />}
                <span>{testResult.message}</span>
              </div>
            )}
          </DialogSection>

          <DialogFooter className="flex items-center justify-between">
            <Button
              type="default"
              loading={isTesting}
              disabled={isTesting || !formHost || !formDatabase || !formUsername || !formPassword}
              onClick={handleTest}
            >
              Test Connection
            </Button>

            <div className="flex items-center gap-2">
              <Button type="default" onClick={() => setIsAddModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="primary"
                loading={isSaving}
                disabled={isSaving || !formName || !formHost || !formDatabase || !formUsername || !formPassword || !formSchema}
                onClick={handleSave}
              >
                Import Tables
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <Dialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Disconnect MySQL Server</DialogTitle>
          </DialogHeader>
          <DialogSection>
            <p className="text-sm text-foreground-lighter">
              Are you sure you want to disconnect this MySQL database? The target PostgreSQL foreign schema will be removed, but your remote MySQL database and data will remain completely untouched.
            </p>
          </DialogSection>
          <DialogFooter className="flex items-center justify-end gap-2">
            <Button type="default" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button type="danger" onClick={handleDelete}>
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

DatabaseMySQLConnectorsPage.getLayout = (page) => (
  <DefaultLayout>
    <DatabaseLayout title="Foreign Tables (MySQL)">{page}</DatabaseLayout>
  </DefaultLayout>
)

export default DatabaseMySQLConnectorsPage
