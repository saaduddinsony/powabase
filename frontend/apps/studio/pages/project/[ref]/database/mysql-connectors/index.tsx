import { useParams } from 'common'
import {
  Check,
  CheckCircle2,
  Database,
  ExternalLink,
  Flame,
  Globe,
  HardDrive,
  Key,
  Layers,
  Plus,
  RefreshCw,
  Server,
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
  created_at: string
}

const DatabaseMySQLConnectorsPage: NextPageWithLayout = () => {
  const router = useRouter()
  const { ref: projectRef = 'default' } = useParams()

  const [connectors, setConnectors] = useState<MySQLConnector[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [isSaving, setIsSaving] = useState(false)

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
            Connect any remote cPanel, 20i, AWS RDS, PlanetScale, or shared hosting MySQL database into Socket. Query remote tables, execute cross-database joins, and expose instant REST APIs.
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
                <Badge variant="outline" className="border-blue-500/30 text-blue-400">PostgreSQL FDW</Badge>
              </div>
              <p className="text-sm text-foreground-lighter leading-relaxed">
                Connect external MySQL databases from any shared host (cPanel, 20i, Namecheap, DirectAdmin, etc.) without migrating or copying data. PostgreSQL queries the remote MySQL server directly via <code className="text-foreground font-mono bg-surface-200 px-1.5 py-0.5 rounded text-xs">mysql_fdw</code>, giving you full SQL capabilities, joins with Postgres tables, and PostgREST REST APIs.
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
                  <span>Automatic PostgREST REST endpoints</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  <span>Real-time Live Querying</span>
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
              {connectors.map((c) => (
                <div key={c.id} className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-surface-100/50 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-foreground">{c.name}</span>
                      <Badge variant="success" className="text-[10px] py-0 px-1.5">
                        Connected
                      </Badge>
                      <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-mono text-primary border-primary/30">
                        schema: {c.foreign_schema}
                      </Badge>
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
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Link href={`/project/${projectRef}/sql/new?content=SELECT * FROM ${c.foreign_schema}.tables LIMIT 10;`}>
                      <Button
                        type="default"
                        size="tiny"
                        icon={<ExternalLink size={12} />}
                      >
                        Query in SQL
                      </Button>
                    </Link>
                    <Link href={`/project/${projectRef}/editor`}>
                      <Button
                        type="default"
                        size="tiny"
                        icon={<TableIcon size={12} />}
                      >
                        Table Editor
                      </Button>
                    </Link>
                    <Button
                      type="outline"
                      size="tiny"
                      className="text-destructive hover:bg-destructive/10"
                      icon={<Trash2 size={12} />}
                      onClick={() => setDeleteId(c.id)}
                    />
                  </div>
                </div>
              ))}
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
              Direct Remote SQL Query
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
              Instant PostgREST REST API
            </button>
          </div>

          {activeTab === 'join' && (
            <CodeBlock
              language="sql"
              value={joinSnippet}
              hideLineNumbers
              className="max-w-none block !bg-surface-200/50 !py-3 !px-3.5 border border-border text-foreground rounded-lg"
            />
          )}

          {activeTab === 'direct' && (
            <CodeBlock
              language="sql"
              value={directSnippet}
              hideLineNumbers
              className="max-w-none block !bg-surface-200/50 !py-3 !px-3.5 border border-border text-foreground rounded-lg"
            />
          )}

          {activeTab === 'rest' && (
            <CodeBlock
              language="bash"
              value={restSnippet}
              hideLineNumbers
              className="max-w-none block !bg-surface-200/50 !py-3 !px-3.5 border border-border text-foreground rounded-lg"
            />
          )}
        </CardContent>
      </Card>

      {/* Add Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Connect Remote MySQL Database</DialogTitle>
          </DialogHeader>

          <DialogSection className="space-y-4">
            <div className="space-y-1.5">
              <Label_Shadcn_ htmlFor="m-name">Connector Name</Label_Shadcn_>
              <Input_Shadcn_
                id="m-name"
                placeholder="e.g. cPanel WooCommerce DB, 20i Client Database"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label_Shadcn_ htmlFor="m-host">MySQL Hostname / IP</Label_Shadcn_>
                <Input_Shadcn_
                  id="m-host"
                  placeholder="e.g. mysql.mycpanel.com, 192.168.1.50"
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
              <Label_Shadcn_ htmlFor="m-db">Remote Database Name</Label_Shadcn_>
              <Input_Shadcn_
                id="m-db"
                placeholder="e.g. cpaneluser_shop"
                value={formDatabase}
                onChange={(e) => {
                  setFormDatabase(e.target.value)
                  if (!formSchema || formSchema === 'cpanel_remote') {
                    setFormSchema(`cpanel_${e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`)
                  }
                }}
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
