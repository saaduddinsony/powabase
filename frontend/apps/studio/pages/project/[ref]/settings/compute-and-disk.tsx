import { useParams } from 'common'
import {
  Activity,
  Check,
  CheckCircle2,
  Copy,
  Cpu,
  Download,
  ExternalLink,
  Flame,
  Globe,
  HardDrive,
  Layers,
  Plus,
  Radio,
  RefreshCw,
  Server,
  Shield,
  Terminal,
  Trash2,
  XCircle,
  Zap,
} from 'lucide-react'
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

import DefaultLayout from '@/components/layouts/DefaultLayout'
import SettingsLayout from '@/components/layouts/ProjectSettingsLayout/SettingsLayout'
import type { NextPageWithLayout } from '@/types'

interface ComputeNode {
  id: number
  project_ref: string
  node_id: string
  name: string
  auth_token: string
  role: string
  cpu_cores: number
  cpu_usage_pct: number
  memory_total_mb: number
  memory_used_mb: number
  disk_free_gb: number
  os_info: string
  ip_address?: string
  status: string
  last_heartbeat: string
  created_at: string
}

const ComputeAndDiskPage: NextPageWithLayout = () => {
  const { ref: projectRef = 'default' } = useParams()

  const [nodes, setNodes] = useState<ComputeNode[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [newNodeName, setNewNodeName] = useState('')
  const [newNodeRole, setNewNodeRole] = useState('worker')
  const [generatedNode, setGeneratedNode] = useState<ComputeNode | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  const fetchNodes = async () => {
    try {
      setIsLoading(true)
      const res = await fetch(`/api/v1/projects/${projectRef}/compute/nodes`)
      const data = await res.json()
      if (Array.isArray(data)) {
        setNodes(data)
      } else {
        setNodes([])
      }
    } catch (err: any) {
      toast.error('Failed to load compute nodes')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (projectRef) {
      fetchNodes()
    }
  }, [projectRef])

  const handleRegisterNode = async () => {
    if (!newNodeName.trim()) {
      toast.error('Please enter a server name')
      return
    }

    try {
      setIsGenerating(true)
      const res = await fetch(`/api/v1/projects/${projectRef}/compute/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newNodeName.trim(),
          role: newNodeRole,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message || 'Failed to register node')

      setGeneratedNode(data)
      toast.success('Worker token generated!')
      fetchNodes()
    } catch (err: any) {
      toast.error(err.message || 'Error generating worker token')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDeleteNode = async () => {
    if (!deleteId) return
    try {
      const res = await fetch(`/api/v1/projects/${projectRef}/compute/nodes/${deleteId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to disconnect node')
      toast.success('Compute node removed')
      setDeleteId(null)
      fetchNodes()
    } catch (err: any) {
      toast.error(err.message || 'Error removing node')
    }
  }

  // Aggregate stats
  const totalCores = 4 + nodes.reduce((sum, n) => sum + (n.cpu_cores || 1), 0)
  const totalMemGB = Math.round(24 + nodes.reduce((sum, n) => sum + (n.memory_total_mb || 1024) / 1024, 0))
  const onlineCount = 1 + nodes.filter((n) => n.status === 'online').length

  const joinCommand = generatedNode
    ? `curl -sSL https://backend.freightsolution.xyz/download/socket-worker.sh | bash -s -- --hub=https://backend.freightsolution.xyz --token=${generatedNode.auth_token} --name="${generatedNode.name}"`
    : `curl -sSL https://backend.freightsolution.xyz/download/socket-worker.sh | bash -s -- --hub=https://backend.freightsolution.xyz --token=<WORKER_TOKEN> --name="Remote-Node"`

  return (
    <div className="flex flex-col gap-y-6 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Compute & Multi-Node Cluster</h1>
            <Badge variant="success">Zero-Root Clustering</Badge>
          </div>
          <p className="text-sm text-foreground-lighter mt-1">
            Scale and distribute workloads across multiple servers, cPanel hosts, or cheap VPSes without needing root privileges.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="default"
            icon={<RefreshCw className={isLoading ? 'animate-spin' : ''} size={14} />}
            onClick={fetchNodes}
          >
            Refresh
          </Button>
          <Button
            type="primary"
            icon={<Plus size={14} />}
            onClick={() => {
              setGeneratedNode(null)
              setNewNodeName('')
              setIsAddModalOpen(true)
            }}
          >
            Connect Remote Server
          </Button>
        </div>
      </div>

      {/* Cluster Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-border/80">
          <div className="flex items-center justify-between text-foreground-lighter text-xs mb-1">
            <span>Cluster Nodes</span>
            <Server size={15} className="text-primary" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">{onlineCount}</span>
            <span className="text-xs text-foreground-lighter">({nodes.length + 1} registered)</span>
          </div>
          <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            All nodes operational
          </p>
        </Card>

        <Card className="p-4 border-border/80">
          <div className="flex items-center justify-between text-foreground-lighter text-xs mb-1">
            <span>Total CPU Capacity</span>
            <Cpu size={15} className="text-primary" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">{totalCores}</span>
            <span className="text-xs text-foreground-lighter">vCPU / Cores</span>
          </div>
          <p className="text-[11px] text-foreground-lighter mt-1">ARM64 + x86_64 mixed architecture</p>
        </Card>

        <Card className="p-4 border-border/80">
          <div className="flex items-center justify-between text-foreground-lighter text-xs mb-1">
            <span>Aggregated RAM</span>
            <Activity size={15} className="text-primary" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">{totalMemGB}</span>
            <span className="text-xs text-foreground-lighter">GB Cluster Memory</span>
          </div>
          <p className="text-[11px] text-foreground-lighter mt-1">Distributed memory pool</p>
        </Card>

        <Card className="p-4 border-border/80">
          <div className="flex items-center justify-between text-foreground-lighter text-xs mb-1">
            <span>Inbound Ports Required</span>
            <Shield size={15} className="text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-400">0</span>
            <span className="text-xs text-foreground-lighter">(Zero firewall rules)</span>
          </div>
          <p className="text-[11px] text-foreground-lighter mt-1">Outbound-only secure heartbeats</p>
        </Card>
      </div>

      {/* Primary Node & Architecture Hero */}
      <Card className="border-primary/20 bg-gradient-to-r from-card via-card to-primary/5 shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Cpu size={22} />
                </span>
                <h2 className="text-lg font-semibold text-foreground">Zero-Root Multi-Node Compute Clustering</h2>
                <Badge variant="outline" className="border-purple-500/30 text-purple-400">User-Space Daemon</Badge>
              </div>
              <p className="text-sm text-foreground-lighter leading-relaxed">
                Connect any remote Linux machine into your Socket compute cluster — even on restricted cPanel hosting, shared server accounts, or managed cloud instances where you don&apos;t have root or sudo privileges. The lightweight worker agent polls Socket via outbound HTTPS, eliminating the need for open firewall ports, static IPs, or port forwarding.
              </p>
              <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-foreground-light">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  <span>Runs without root or sudo</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  <span>Works in cPanel terminal & SSH</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  <span>Pure Bash & curl (under 10MB RAM)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  <span>Auto-reconnecting heartbeat</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row lg:flex-col gap-2 shrink-0 w-full sm:w-auto">
              <a
                href="/download/socket-worker.sh"
                download="socket-worker.sh"
                className="w-full sm:w-auto"
              >
                <Button
                  type="primary"
                  size="medium"
                  className="w-full justify-center"
                  icon={<Download size={15} />}
                >
                  Download socket-worker.sh
                </Button>
              </a>
              <Button
                type="default"
                size="medium"
                className="w-full justify-center"
                icon={<Terminal size={14} />}
                onClick={() => {
                  setGeneratedNode(null)
                  setNewNodeName('')
                  setIsAddModalOpen(true)
                }}
              >
                Get 1-Line Join Command
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cluster Nodes Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-semibold">Active Cluster Compute Nodes</CardTitle>
            <CardDescription className="text-xs">
              Primary controller and connected remote workers executing project workloads
            </CardDescription>
          </div>
          <Badge variant="outline">
            {nodes.length + 1} Total Nodes
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border overflow-x-auto">
            {/* Primary Node Row */}
            <div className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-surface-100/30">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-foreground">Socket Hub Primary (This Server)</span>
                  <Badge variant="success" className="text-[10px] py-0 px-1.5">
                    Controller & DB
                  </Badge>
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-mono text-primary border-primary/30">
                    Host: 161.118.224.130
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-foreground-lighter font-mono">
                  <span className="flex items-center gap-1 text-foreground-light">
                    <Cpu size={12} /> 4 OCPU ARM64
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Activity size={12} /> 24 GB RAM
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Globe size={12} /> Ubuntu 24.04 LTS (Docker Swarm)
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="success" className="flex items-center gap-1 text-xs">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Primary Online
                </Badge>
              </div>
            </div>

            {/* Remote Nodes */}
            {nodes.map((node) => {
              const isOnline = node.status === 'online'
              return (
                <div key={node.id} className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-surface-100/50 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-foreground">{node.name}</span>
                      <Badge
                        variant={isOnline ? 'success' : 'outline'}
                        className={`text-[10px] py-0 px-1.5 ${!isOnline ? 'text-foreground-lighter' : ''}`}
                      >
                        {isOnline ? 'Online' : 'Offline'}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-mono">
                        role: {node.role}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-foreground-lighter font-mono">
                      <span className="flex items-center gap-1 text-foreground-light">
                        <Cpu size={12} /> {node.cpu_cores} Core(s) ({node.cpu_usage_pct}%)
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Activity size={12} /> {node.memory_used_mb}MB / {node.memory_total_mb}MB RAM
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <HardDrive size={12} /> {node.disk_free_gb}GB Free
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Globe size={12} /> {node.os_info || 'Linux'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      type="outline"
                      size="tiny"
                      className="text-destructive hover:bg-destructive/10"
                      icon={<Trash2 size={12} />}
                      onClick={() => setDeleteId(node.id)}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Add Remote Worker Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Connect Remote Server (No Root Required)</DialogTitle>
          </DialogHeader>

          <DialogSection className="space-y-4">
            {!generatedNode ? (
              <>
                <div className="space-y-1.5">
                  <Label_Shadcn_ htmlFor="srv-name">Server / Worker Name</Label_Shadcn_>
                  <Input_Shadcn_
                    id="srv-name"
                    placeholder="e.g. cPanel Secondary Server, 20i Cloud Worker, Hetzner VPS"
                    value={newNodeName}
                    onChange={(e) => setNewNodeName(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label_Shadcn_ htmlFor="srv-role">Worker Role</Label_Shadcn_>
                  <Input_Shadcn_
                    id="srv-role"
                    placeholder="worker"
                    value={newNodeRole}
                    onChange={(e) => setNewNodeRole(e.target.value)}
                  />
                  <p className="text-[11px] text-foreground-lighter">
                    Workload assignment (e.g. <code className="font-mono">worker</code>, <code className="font-mono">edge-functions</code>, <code className="font-mono">cron-jobs</code>).
                  </p>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                  <Check size={16} />
                  <span>Node registered! Run the command below on your remote server to connect.</span>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-semibold text-foreground">1-Line Setup Command</p>
                  <CodeBlock
                    language="bash"
                    value={joinCommand}
                    hideLineNumbers
                    className="max-w-none block !bg-surface-200/50 !py-3 !px-3.5 border border-border text-foreground rounded-lg"
                  />
                </div>

                <div className="text-xs text-foreground-lighter space-y-1 pt-1">
                  <p>• Paste this into any SSH terminal, cPanel Terminal, or crontab.</p>
                  <p>• Does NOT require root or sudo privileges.</p>
                  <p>• Outbound HTTPS only — no firewall ports need to be opened.</p>
                </div>
              </div>
            )}
          </DialogSection>

          <DialogFooter className="flex items-center justify-between">
            <Button type="default" onClick={() => setIsAddModalOpen(false)}>
              Close
            </Button>

            {!generatedNode ? (
              <Button
                type="primary"
                loading={isGenerating}
                disabled={isGenerating || !newNodeName}
                onClick={handleRegisterNode}
              >
                Generate Join Command
              </Button>
            ) : (
              <Button
                type="primary"
                icon={<Copy size={14} />}
                onClick={() => {
                  navigator.clipboard.writeText(joinCommand)
                  toast.success('Join command copied to clipboard!')
                }}
              >
                Copy Command
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Disconnect Compute Node</DialogTitle>
          </DialogHeader>
          <DialogSection>
            <p className="text-sm text-foreground-lighter">
              Are you sure you want to disconnect this compute node? Any jobs currently assigned to it will fail over to the primary server or another active worker node.
            </p>
          </DialogSection>
          <DialogFooter className="flex items-center justify-end gap-2">
            <Button type="default" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button type="danger" onClick={handleDeleteNode}>
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

ComputeAndDiskPage.getLayout = (page) => (
  <DefaultLayout>
    <SettingsLayout title="Compute & Cluster Nodes">{page}</SettingsLayout>
  </DefaultLayout>
)

export default ComputeAndDiskPage
