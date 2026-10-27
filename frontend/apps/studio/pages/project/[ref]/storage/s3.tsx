import { useParams } from 'common'
import {
  Check,
  CheckCircle2,
  Copy,
  Database,
  Download,
  ExternalLink,
  FolderSync,
  Globe,
  HardDrive,
  Key,
  Layers,
  Plus,
  RefreshCw,
  Server,
  Trash2,
  XCircle,
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
import StorageLayout from '@/components/layouts/StorageLayout/StorageLayout'
import type { NextPageWithLayout } from '@/types'

interface StorageGateway {
  id: number
  project_ref: string
  name: string
  endpoint_url: string
  region: string
  access_key: string
  secret_key: string
  is_active: boolean
  created_at: string
}

const StorageS3GatewaysPage: NextPageWithLayout = () => {
  const { ref: projectRef = 'default' } = useParams()

  const [gateways, setGateways] = useState<StorageGateway[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [testingId, setTestingId] = useState<number | null>(null)
  const [testResult, setTestResult] = useState<Record<number, { success: boolean; message: string }>>({})

  // Form State
  const [formName, setFormName] = useState('')
  const [formEndpoint, setFormEndpoint] = useState('')
  const [formRegion, setFormRegion] = useState('us-east-1')
  const [formAccessKey, setFormAccessKey] = useState('')
  const [formSecretKey, setFormSecretKey] = useState('')
  const [isModalTesting, setIsModalTesting] = useState(false)
  const [modalTestMessage, setModalTestMessage] = useState<{ success: boolean; text: string } | null>(null)
  const [codeTab, setCodeTab] = useState<'node' | 'python' | 'php'>('node')

  // Fetch gateways
  const fetchGateways = async () => {
    try {
      setIsLoading(true)
      const res = await fetch(`/api/v1/projects/${projectRef}/storage/gateways`)
      const data = await res.json()
      if (Array.isArray(data)) {
        setGateways(data)
      } else {
        setGateways([])
      }
    } catch (err: any) {
      toast.error('Failed to load storage gateways')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (projectRef) {
      fetchGateways()
    }
  }, [projectRef])

  const handleTestConnection = async (endpoint: string, accessKey: string, secretKey: string, gatewayId?: number) => {
    if (!endpoint) {
      toast.error('Please specify an endpoint URL')
      return
    }

    try {
      if (gatewayId) setTestingId(gatewayId)
      else setIsModalTesting(true)

      const res = await fetch(`/api/v1/projects/${projectRef}/storage/gateways/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint_url: endpoint,
          access_key: accessKey,
          secret_key: secretKey,
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        const msg = data.bucketCount !== undefined
          ? `Connected! Found ${data.bucketCount} bucket(s). (HTTP ${data.status})`
          : data.message || 'Connected successfully!'

        if (gatewayId) {
          setTestResult((prev) => ({ ...prev, [gatewayId]: { success: true, message: msg } }))
        } else {
          setModalTestMessage({ success: true, text: msg })
        }
        toast.success(msg)
      } else {
        const msg = data.error?.message || data.message || 'Connection test failed'
        if (gatewayId) {
          setTestResult((prev) => ({ ...prev, [gatewayId]: { success: false, message: msg } }))
        } else {
          setModalTestMessage({ success: false, text: msg })
        }
        toast.error(msg)
      }
    } catch (err: any) {
      const msg = err.message || 'Network error while testing gateway'
      if (gatewayId) {
        setTestResult((prev) => ({ ...prev, [gatewayId]: { success: false, message: msg } }))
      } else {
        setModalTestMessage({ success: false, text: msg })
      }
      toast.error(msg)
    } finally {
      if (gatewayId) setTestingId(null)
      else setIsModalTesting(false)
    }
  }

  const handleSaveGateway = async () => {
    if (!formName.trim() || !formEndpoint.trim() || !formAccessKey.trim() || !formSecretKey.trim()) {
      toast.error('Please fill in all required fields')
      return
    }

    try {
      setIsSaving(true)
      const res = await fetch(`/api/v1/projects/${projectRef}/storage/gateways`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          endpoint_url: formEndpoint.trim(),
          region: formRegion.trim() || 'us-east-1',
          access_key: formAccessKey.trim(),
          secret_key: formSecretKey.trim(),
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message || 'Failed to save gateway')

      toast.success('Remote S3 storage gateway added!')
      setIsAddModalOpen(false)
      setFormName('')
      setFormEndpoint('')
      setFormRegion('us-east-1')
      setFormAccessKey('')
      setFormSecretKey('')
      setModalTestMessage(null)
      fetchGateways()
    } catch (err: any) {
      toast.error(err.message || 'Error saving gateway')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteGateway = async () => {
    if (!deleteId) return
    try {
      const res = await fetch(`/api/v1/projects/${projectRef}/storage/gateways/${deleteId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete gateway')
      toast.success('Gateway deleted')
      setDeleteId(null)
      fetchGateways()
    } catch (err: any) {
      toast.error(err.message || 'Error deleting gateway')
    }
  }

  const sampleGateway = gateways[0] || {
    endpoint_url: 'https://storage.yourdomain.com/socket-storage.php',
    region: 'us-east-1',
    access_key: 'SOCKET_AK_...',
    secret_key: 'SOCKET_SK_...',
  }

  const nodeSnippet = `import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'

const s3 = new S3Client({
  endpoint: '${sampleGateway.endpoint_url}',
  region: '${sampleGateway.region}',
  credentials: {
    accessKeyId: '${sampleGateway.access_key}',
    secretAccessKey: '${sampleGateway.secret_key}',
  },
  forcePathStyle: true, // Needed for self-hosted S3 gateways
})

const { Contents } = await s3.send(new ListObjectsV2Command({ Bucket: 'uploads' }))
console.log(Contents)`

  const pythonSnippet = `import boto3

s3 = boto3.client(
    's3',
    endpoint_url='${sampleGateway.endpoint_url}',
    region_name='${sampleGateway.region}',
    aws_access_key_id='${sampleGateway.access_key}',
    aws_secret_access_key='${sampleGateway.secret_key}'
)

response = s3.list_objects_v2(Bucket='uploads')
for obj in response.get('Contents', []):
    print(obj['Key'], obj['Size'])`

  const phpSnippet = `<?php
require 'vendor/autoload.php';

use Aws\\S3\\S3Client;

$s3 = new S3Client([
    'version'     => 'latest',
    'region'      => '${sampleGateway.region}',
    'endpoint'    => '${sampleGateway.endpoint_url}',
    'use_path_style_endpoint' => true,
    'credentials' => [
        'key'    => '${sampleGateway.access_key}',
        'secret' => '${sampleGateway.secret_key}',
    ],
]);

$objects = $s3->listObjectsV2(['Bucket' => 'uploads']);`

  return (
    <div className="flex flex-col gap-y-6 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">S3 & Remote Storage Gateways</h1>
            <Badge variant="success">Socket Universal S3</Badge>
          </div>
          <p className="text-sm text-foreground-lighter mt-1">
            Turn any cPanel, shared host, or remote server into an unlimited S3-compatible storage cluster with zero external dependencies.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="default"
            icon={<RefreshCw className={isLoading ? 'animate-spin' : ''} size={14} />}
            onClick={fetchGateways}
          >
            Refresh
          </Button>
          <Button
            type="primary"
            icon={<Plus size={14} />}
            onClick={() => setIsAddModalOpen(true)}
          >
            Connect Remote Gateway
          </Button>
        </div>
      </div>

      {/* Hero: Drop-in PHP S3 Gateway */}
      <Card className="border-primary/20 bg-gradient-to-r from-card via-card to-primary/5 shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-lg bg-primary/10 text-primary">
                  <HardDrive size={22} />
                </span>
                <h2 className="text-lg font-semibold text-foreground">Drop-in Shared-Hosting Gateway (PHP)</h2>
                <Badge variant="outline" className="border-emerald-500/30 text-emerald-400">Zero Dependencies</Badge>
              </div>
              <p className="text-sm text-foreground-lighter leading-relaxed">
                Have existing cPanel, 20i, Plesk, or Cloud hosting with plenty of unused disk space? Drop <code className="text-foreground font-mono bg-surface-200 px-1.5 py-0.5 rounded text-xs">socket-storage.php</code> into any directory. It instantly turns your shared host into an AWS S3-compatible storage bucket with automatic AWS SigV4 auth, multipart uploads, and a sleek web file manager.
              </p>
              <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-foreground-light">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  <span>PHP 7.4 to 8.4+</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  <span>No root or MySQL required</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  <span>AWS SigV4 & Presigned URLs</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  <span>Built-in Web GUI</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row lg:flex-col gap-2 shrink-0 w-full sm:w-auto">
              <a
                href="/download/socket-storage.php"
                download="socket-storage.php"
                className="w-full sm:w-auto"
              >
                <Button
                  type="primary"
                  size="medium"
                  className="w-full justify-center"
                  icon={<Download size={15} />}
                >
                  Download socket-storage.php
                </Button>
              </a>
              <Button
                type="default"
                size="medium"
                className="w-full justify-center"
                icon={<Copy size={14} />}
                onClick={() => {
                  const url = `${window.location.origin}/download/socket-storage.php`
                  navigator.clipboard.writeText(url)
                  toast.success('Download link copied to clipboard!')
                }}
              >
                Copy Direct URL
              </Button>
            </div>
          </div>

          {/* Quick Setup Instructions */}
          <div className="mt-6 pt-5 border-t border-border grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-200 text-xs font-semibold text-foreground">
                1
              </div>
              <div className="text-xs">
                <p className="font-medium text-foreground">Upload File</p>
                <p className="text-foreground-lighter mt-0.5">
                  Drop into <code className="font-mono text-foreground">public_html/s3/index.php</code> or any folder via cPanel File Manager or FTP.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-200 text-xs font-semibold text-foreground">
                2
              </div>
              <div className="text-xs">
                <p className="font-medium text-foreground">Open in Browser</p>
                <p className="text-foreground-lighter mt-0.5">
                  Visit the script URL in your browser. It automatically generates your Access Key and Secret Key on first run.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-200 text-xs font-semibold text-foreground">
                3
              </div>
              <div className="text-xs">
                <p className="font-medium text-foreground">Connect to Socket</p>
                <p className="text-foreground-lighter mt-0.5">
                  Click &quot;Connect Remote Gateway&quot; below, paste the endpoint & credentials, and start storing files.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Connected Gateways List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-semibold">Connected Storage Gateways</CardTitle>
            <CardDescription className="text-xs">
              Configured remote S3 storage nodes linked to project <code className="font-mono">{projectRef}</code>
            </CardDescription>
          </div>
          <Badge variant="outline">
            {gateways.length} {gateways.length === 1 ? 'Gateway' : 'Gateways'} Configured
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          {gateways.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="p-3 rounded-full bg-surface-200 text-foreground-lighter mb-3">
                <FolderSync size={24} />
              </div>
              <h3 className="text-sm font-medium text-foreground">No remote storage gateways added yet</h3>
              <p className="text-xs text-foreground-lighter max-w-sm mt-1 mb-4">
                Connect your first cPanel shared hosting S3 gateway, Cloudflare R2, MinIO, or AWS S3 bucket to expand your storage cluster.
              </p>
              <Button
                type="primary"
                size="tiny"
                icon={<Plus size={14} />}
                onClick={() => setIsAddModalOpen(true)}
              >
                Connect Remote Gateway
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border overflow-x-auto">
              {gateways.map((gw) => {
                const result = testResult[gw.id]
                const isTesting = testingId === gw.id

                return (
                  <div key={gw.id} className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-surface-100/50 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-foreground">{gw.name}</span>
                        <Badge variant="success" className="text-[10px] py-0 px-1.5">
                          Active
                        </Badge>
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-mono">
                          {gw.region}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-foreground-lighter font-mono">
                        <span className="flex items-center gap-1 text-foreground-light">
                          <Globe size={12} /> {gw.endpoint_url}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Key size={12} /> {gw.access_key}
                        </span>
                      </div>
                      {result && (
                        <div className={`text-xs mt-1.5 flex items-center gap-1.5 ${result.success ? 'text-emerald-400' : 'text-destructive'}`}>
                          {result.success ? <Check size={13} /> : <XCircle size={13} />}
                          <span>{result.message}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        type="default"
                        size="tiny"
                        icon={<RefreshCw className={isTesting ? 'animate-spin' : ''} size={12} />}
                        loading={isTesting}
                        onClick={() => handleTestConnection(gw.endpoint_url, gw.access_key, gw.secret_key, gw.id)}
                      >
                        Test Ping
                      </Button>
                      <Button
                        type="default"
                        size="tiny"
                        icon={<ExternalLink size={12} />}
                        onClick={() => window.open(gw.endpoint_url, '_blank')}
                      >
                        Open GUI
                      </Button>
                      <Button
                        type="outline"
                        size="tiny"
                        className="text-destructive hover:bg-destructive/10"
                        icon={<Trash2 size={12} />}
                        onClick={() => setDeleteId(gw.id)}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Code Snippets Integration */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">SDK & Code Integration</CardTitle>
          <CardDescription className="text-xs">
            Connect directly to your S3 storage endpoints using standard AWS S3 SDKs in any language.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4 border-b border-border pb-2">
            <button
              type="button"
              onClick={() => setCodeTab('node')}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                codeTab === 'node'
                  ? 'bg-surface-300 text-foreground font-medium'
                  : 'text-foreground-lighter hover:text-foreground'
              }`}
            >
              Node.js (@aws-sdk/client-s3)
            </button>
            <button
              type="button"
              onClick={() => setCodeTab('python')}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                codeTab === 'python'
                  ? 'bg-surface-300 text-foreground font-medium'
                  : 'text-foreground-lighter hover:text-foreground'
              }`}
            >
              Python (boto3)
            </button>
            <button
              type="button"
              onClick={() => setCodeTab('php')}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                codeTab === 'php'
                  ? 'bg-surface-300 text-foreground font-medium'
                  : 'text-foreground-lighter hover:text-foreground'
              }`}
            >
              PHP (aws-sdk-php)
            </button>
          </div>

          {codeTab === 'node' && (
            <CodeBlock
              language="typescript"
              value={nodeSnippet}
              hideLineNumbers
              className="max-w-none block !bg-surface-200/50 !py-3 !px-3.5 border border-border text-foreground rounded-lg"
            />
          )}

          {codeTab === 'python' && (
            <CodeBlock
              language="python"
              value={pythonSnippet}
              hideLineNumbers
              className="max-w-none block !bg-surface-200/50 !py-3 !px-3.5 border border-border text-foreground rounded-lg"
            />
          )}

          {codeTab === 'php' && (
            <CodeBlock
              language="php"
              value={phpSnippet}
              hideLineNumbers
              className="max-w-none block !bg-surface-200/50 !py-3 !px-3.5 border border-border text-foreground rounded-lg"
            />
          )}
        </CardContent>
      </Card>

      {/* Add Gateway Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Connect Remote S3 Gateway</DialogTitle>
          </DialogHeader>

          <DialogSection className="space-y-4">
            <div className="space-y-1.5">
              <Label_Shadcn_ htmlFor="gw-name">Gateway Name</Label_Shadcn_>
              <Input_Shadcn_
                id="gw-name"
                placeholder="e.g. Client cPanel Storage, 20i Cloud Storage"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label_Shadcn_ htmlFor="gw-url">Endpoint URL</Label_Shadcn_>
              <Input_Shadcn_
                id="gw-url"
                placeholder="https://storage.yourdomain.com/socket-storage.php"
                value={formEndpoint}
                onChange={(e) => setFormEndpoint(e.target.value)}
              />
              <p className="text-[11px] text-foreground-lighter">
                The full URL to your hosted <code className="font-mono">socket-storage.php</code> or any S3-compatible service URL.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label_Shadcn_ htmlFor="gw-region">Region</Label_Shadcn_>
                <Input_Shadcn_
                  id="gw-region"
                  placeholder="us-east-1"
                  value={formRegion}
                  onChange={(e) => setFormRegion(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label_Shadcn_ htmlFor="gw-ak">Access Key ID</Label_Shadcn_>
                <Input_Shadcn_
                  id="gw-ak"
                  placeholder="SOCKET_AK_..."
                  value={formAccessKey}
                  onChange={(e) => setFormAccessKey(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label_Shadcn_ htmlFor="gw-sk">Secret Access Key</Label_Shadcn_>
              <Input_Shadcn_
                id="gw-sk"
                type="password"
                placeholder="SOCKET_SK_..."
                value={formSecretKey}
                onChange={(e) => setFormSecretKey(e.target.value)}
              />
            </div>

            {modalTestMessage && (
              <div className={`p-2.5 rounded text-xs flex items-center gap-2 border ${
                modalTestMessage.success
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-destructive/10 border-destructive/30 text-destructive'
              }`}>
                {modalTestMessage.success ? <Check size={14} /> : <XCircle size={14} />}
                <span>{modalTestMessage.text}</span>
              </div>
            )}
          </DialogSection>

          <DialogFooter className="flex items-center justify-between">
            <Button
              type="default"
              loading={isModalTesting}
              disabled={isModalTesting || !formEndpoint}
              onClick={() => handleTestConnection(formEndpoint, formAccessKey, formSecretKey)}
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
                disabled={isSaving || !formName || !formEndpoint || !formAccessKey || !formSecretKey}
                onClick={handleSaveGateway}
              >
                Save Gateway
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Disconnect Gateway</DialogTitle>
          </DialogHeader>
          <DialogSection>
            <p className="text-sm text-foreground-lighter">
              Are you sure you want to remove this storage gateway? Any external files on the remote server will remain intact, but Socket Studio will no longer route requests to it.
            </p>
          </DialogSection>
          <DialogFooter className="flex items-center justify-end gap-2">
            <Button type="default" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button type="danger" onClick={handleDeleteGateway}>
              Remove Gateway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

StorageS3GatewaysPage.getLayout = (page) => (
  <DefaultLayout>
    <StorageLayout title="S3 & Remote Gateways">{page}</StorageLayout>
  </DefaultLayout>
)

export default StorageS3GatewaysPage
