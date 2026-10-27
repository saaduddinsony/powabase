import { useParams } from 'common'
import {
  Check,
  CheckCircle2,
  Copy,
  Database,
  Download,
  ExternalLink,
  File,
  FileArchive,
  FileText,
  Film,
  FolderOpen,
  FolderSync,
  Globe,
  HardDrive,
  Image as ImageIcon,
  Key,
  Layers,
  Link2,
  Music,
  Plus,
  RefreshCw,
  Search,
  Server,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
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

interface RemoteFile {
  key: string
  name: string
  size: number
  last_modified: string
  url: string
}

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

function getFileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) {
    return <ImageIcon size={14} className="text-blue-400 shrink-0" />
  }
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) {
    return <Film size={14} className="text-purple-400 shrink-0" />
  }
  if (['mp3', 'wav', 'ogg', 'aac'].includes(ext)) {
    return <Music size={14} className="text-amber-400 shrink-0" />
  }
  if (['zip', 'tar', 'gz', 'rar', '7z'].includes(ext)) {
    return <FileArchive size={14} className="text-emerald-400 shrink-0" />
  }
  if (['txt', 'md', 'json', 'csv', 'pdf', 'doc', 'docx'].includes(ext)) {
    return <FileText size={14} className="text-rose-400 shrink-0" />
  }
  return <File size={14} className="text-foreground-lighter shrink-0" />
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

  // Remote S3 Browser Modal State
  const [explorerGateway, setExplorerGateway] = useState<StorageGateway | null>(null)
  const [remoteBuckets, setRemoteBuckets] = useState<string[]>([])
  const [selectedBucket, setSelectedBucket] = useState('default')
  const [remoteFiles, setRemoteFiles] = useState<RemoteFile[]>([])
  const [isLoadingFiles, setIsLoadingFiles] = useState(false)
  const [fileFilter, setFileFilter] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Presigned URL Modal State
  const [presignedTarget, setPresignedTarget] = useState<{ gateway: StorageGateway; bucket: string; key: string } | null>(null)
  const [presignedExpiry, setPresignedExpiry] = useState<number>(3600)
  const [generatedUrl, setGeneratedUrl] = useState('')
  const [isGeneratingUrl, setIsGeneratingUrl] = useState(false)

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
      toast.error('Please enter endpoint URL')
      return
    }

    if (gatewayId) {
      setTestingId(gatewayId)
    } else {
      setIsModalTesting(true)
      setModalTestMessage(null)
    }

    try {
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
        const msg = data.message || 'Gateway connected successfully!'
        if (gatewayId) {
          setTestResult((prev) => ({ ...prev, [gatewayId]: { success: true, message: msg } }))
        } else {
          setModalTestMessage({ success: true, text: msg })
        }
        toast.success(msg)
      } else {
        const errMsg = data.error?.message || 'Connection test failed'
        if (gatewayId) {
          setTestResult((prev) => ({ ...prev, [gatewayId]: { success: false, message: errMsg } }))
        } else {
          setModalTestMessage({ success: false, text: errMsg })
        }
        toast.error(errMsg)
      }
    } catch (err: any) {
      const msg = err.message || 'Network error testing gateway'
      if (gatewayId) {
        setTestResult((prev) => ({ ...prev, [gatewayId]: { success: false, message: msg } }))
      } else {
        setModalTestMessage({ success: false, text: msg })
      }
      toast.error(msg)
    } finally {
      setTestingId(null)
      setIsModalTesting(false)
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

      toast.success(`Gateway "${data.name}" added successfully!`)
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
      toast.success('Gateway disconnected successfully')
      setDeleteId(null)
      fetchGateways()
    } catch (err: any) {
      toast.error(err.message || 'Error deleting gateway')
    }
  }

  // Open Remote S3 Browser
  const handleOpenExplorer = async (gw: StorageGateway) => {
    setExplorerGateway(gw)
    setFileFilter('')
    setIsLoadingFiles(true)

    try {
      const res = await fetch(`/api/v1/projects/${projectRef}/storage/gateways/${gw.id}/buckets`)
      const bucketsData = await res.json()
      const bucketList = Array.isArray(bucketsData) && bucketsData.length > 0 ? bucketsData : ['default']
      setRemoteBuckets(bucketList)
      setSelectedBucket(bucketList[0])
      fetchRemoteFiles(gw.id, bucketList[0])
    } catch (err) {
      toast.error('Failed to load remote buckets')
      setIsLoadingFiles(false)
    }
  }

  const fetchRemoteFiles = async (gatewayId: number, bucket: string) => {
    setIsLoadingFiles(true)
    try {
      const res = await fetch(
        `/api/v1/projects/${projectRef}/storage/gateways/${gatewayId}/files?bucket=${encodeURIComponent(bucket)}`
      )
      const data = await res.json()
      if (Array.isArray(data)) {
        setRemoteFiles(data)
      } else {
        setRemoteFiles([])
      }
    } catch (err) {
      toast.error('Failed to load files from gateway')
      setRemoteFiles([])
    } finally {
      setIsLoadingFiles(false)
    }
  }

  const handleDeleteRemoteFile = async (key: string) => {
    if (!explorerGateway) return
    try {
      const res = await fetch(
        `/api/v1/projects/${projectRef}/storage/gateways/${explorerGateway.id}/files?bucket=${encodeURIComponent(
          selectedBucket
        )}`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key }),
        }
      )
      if (!res.ok) throw new Error('Failed to delete remote file')
      toast.success(`Deleted "${key}" from ${selectedBucket}`)
      fetchRemoteFiles(explorerGateway.id, selectedBucket)
    } catch (err: any) {
      toast.error(err.message || 'Error deleting remote file')
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !explorerGateway) return

    setIsUploading(true)
    try {
      // 1. Request presigned upload URL (PUT)
      const presignRes = await fetch(
        `/api/v1/projects/${projectRef}/storage/gateways/${explorerGateway.id}/presign`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bucket: selectedBucket,
            key: file.name,
            operation: 'PUT',
            expires_in: 3600,
          }),
        }
      )

      const presignData = await presignRes.json()
      if (!presignRes.ok || !presignData.url) {
        throw new Error(presignData.error?.message || 'Failed to generate upload URL')
      }

      // 2. PUT file directly to remote gateway
      const uploadRes = await fetch(presignData.url, {
        method: 'PUT',
        body: file,
      })

      if (!uploadRes.ok && uploadRes.status !== 200 && uploadRes.status !== 201) {
        throw new Error(`Upload failed with HTTP ${uploadRes.status}`)
      }

      toast.success(`Successfully uploaded "${file.name}" to ${selectedBucket}`)
      fetchRemoteFiles(explorerGateway.id, selectedBucket)
    } catch (err: any) {
      toast.error(err.message || 'Error uploading file')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleOpenPresignedModal = async (gw: StorageGateway, bucket: string, key: string) => {
    setPresignedTarget({ gateway: gw, bucket, key })
    setIsGeneratingUrl(true)
    setGeneratedUrl('')

    try {
      const res = await fetch(`/api/v1/projects/${projectRef}/storage/gateways/${gw.id}/presign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bucket,
          key,
          expires_in: presignedExpiry,
          operation: 'GET',
        }),
      })
      const data = await res.json()
      if (res.ok && data.url) {
        setGeneratedUrl(data.url)
      } else {
        toast.error('Failed to create presigned URL')
      }
    } catch (err) {
      toast.error('Network error creating presigned link')
    } finally {
      setIsGeneratingUrl(false)
    }
  }

  const handlePresignedExpiryChange = async (expiry: number) => {
    setPresignedExpiry(expiry)
    if (!presignedTarget) return
    setIsGeneratingUrl(true)
    try {
      const res = await fetch(`/api/v1/projects/${projectRef}/storage/gateways/${presignedTarget.gateway.id}/presign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bucket: presignedTarget.bucket,
          key: presignedTarget.key,
          expires_in: expiry,
          operation: 'GET',
        }),
      })
      const data = await res.json()
      if (res.ok && data.url) {
        setGeneratedUrl(data.url)
      }
    } catch (err) {
      // ignore
    } finally {
      setIsGeneratingUrl(false)
    }
  }

  const filteredFiles = remoteFiles.filter((f) =>
    f.key.toLowerCase().includes(fileFilter.toLowerCase())
  )

  const activeGw = gateways[0]
  const sampleEndpoint = activeGw?.endpoint_url || 'https://storage.yourdomain.com'
  const sampleAccessKey = activeGw?.access_key || '<ACCESS_KEY>'
  const sampleSecretKey = activeGw?.secret_key || '<SECRET_KEY>'

  const nodeSnippet = `import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  endpoint: "${sampleEndpoint}",
  region: "us-east-1",
  credentials: {
    accessKeyId: "${sampleAccessKey}",
    secretAccessKey: "${sampleSecretKey}",
  },
  forcePathStyle: true,
});

// Upload an object
await s3.send(new PutObjectCommand({
  Bucket: "uploads",
  Key: "documents/invoice-101.pdf",
  Body: fileBuffer,
  ContentType: "application/pdf"
}));`

  const pythonSnippet = `import boto3

s3 = boto3.client(
    's3',
    endpoint_url='${sampleEndpoint}',
    aws_access_key_id='${sampleAccessKey}',
    aws_secret_access_key='${sampleSecretKey}',
    region_name='us-east-1'
)

# Upload a file
s3.upload_file('local_image.jpg', 'uploads', 'images/photo.jpg')`

  const phpSnippet = `use Aws\\S3\\S3Client;

$s3 = new S3Client([
    'version'     => 'latest',
    'region'      => 'us-east-1',
    'endpoint'    => '${sampleEndpoint}',
    'use_path_style_endpoint' => true,
    'credentials' => [
        'key'    => '${sampleAccessKey}',
        'secret' => '${sampleSecretKey}',
    ],
]);`

  return (
    <div className="flex flex-col gap-y-6 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">S3 Gateways & Shared-Hosting Storage</h1>
            <Badge variant="success">S3 SigV4 Active</Badge>
          </div>
          <p className="text-sm text-foreground-lighter mt-1">
            Turn unlimited cPanel, Plesk, 20i, or shared-hosting storage into unified S3 object buckets. Browse remote files, generate presigned URLs, and stream media effortlessly.
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

      {/* Feature Showcase Banner */}
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
                  <span>Interactive Remote File Browser</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  <span>AWS SigV4 Presigned Upload & Download URLs</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  <span>Direct Browser Streaming & Range Headers</span>
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
                        type="primary"
                        size="tiny"
                        icon={<FolderOpen size={12} />}
                        onClick={() => handleOpenExplorer(gw)}
                      >
                        Browse Files
                      </Button>
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
              Node.js (AWS SDK v3)
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
              PHP (AWS SDK)
            </button>
          </div>

          {codeTab === 'node' && <CodeBlock language="typescript" value={nodeSnippet} hideLineNumbers />}
          {codeTab === 'python' && <CodeBlock language="python" value={pythonSnippet} hideLineNumbers />}
          {codeTab === 'php' && <CodeBlock language="php" value={phpSnippet} hideLineNumbers />}
        </CardContent>
      </Card>

      {/* Remote S3 File Browser Modal */}
      <Dialog open={explorerGateway !== null} onOpenChange={(open) => !open && setExplorerGateway(null)}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="p-4 border-b border-border">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <FolderOpen size={17} className="text-primary" />
                  <span>{explorerGateway?.name} — Storage Explorer</span>
                </DialogTitle>
                <p className="text-xs text-foreground-lighter mt-0.5 font-mono">
                  {explorerGateway?.endpoint_url}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <Button
                  type="primary"
                  size="tiny"
                  icon={<Upload size={12} />}
                  loading={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Upload File
                </Button>
                <Button
                  type="default"
                  size="tiny"
                  icon={<RefreshCw className={isLoadingFiles ? 'animate-spin' : ''} size={12} />}
                  onClick={() => explorerGateway && fetchRemoteFiles(explorerGateway.id, selectedBucket)}
                >
                  Refresh
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* Subheader: Bucket Selector & Search Bar */}
          <div className="p-3 bg-surface-100/50 border-b border-border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-foreground-lighter">Bucket:</span>
              <select
                className="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-mono shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={selectedBucket}
                onChange={(e) => {
                  setSelectedBucket(e.target.value)
                  if (explorerGateway) fetchRemoteFiles(explorerGateway.id, e.target.value)
                }}
              >
                {remoteBuckets.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative flex-1 sm:max-w-xs">
              <Search size={13} className="absolute left-2.5 top-2.5 text-foreground-lighter" />
              <Input_Shadcn_
                placeholder="Filter files..."
                className="pl-8 text-xs h-8 font-mono"
                value={fileFilter}
                onChange={(e) => setFileFilter(e.target.value)}
              />
            </div>
          </div>

          {/* File Explorer Content Table */}
          <div className="flex-1 overflow-auto p-4 min-h-[300px]">
            {isLoadingFiles ? (
              <div className="flex flex-col items-center justify-center p-12 text-xs text-foreground-lighter">
                <RefreshCw className="animate-spin mb-2" size={20} />
                <span>Reading remote objects from S3 gateway...</span>
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center text-xs text-foreground-lighter">
                <FolderOpen size={28} className="mb-2 opacity-50" />
                <p className="font-medium text-foreground">No files found in bucket &quot;{selectedBucket}&quot;</p>
                <p className="mt-1">Upload a file above to begin storing objects on this remote host.</p>
              </div>
            ) : (
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs font-mono border-collapse">
                  <thead>
                    <tr className="bg-surface-200/60 border-b border-border">
                      <th className="p-2.5 font-medium text-foreground">Name / Key</th>
                      <th className="p-2.5 font-medium text-foreground">Size</th>
                      <th className="p-2.5 font-medium text-foreground">Last Modified</th>
                      <th className="p-2.5 font-medium text-foreground text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredFiles.map((f) => (
                      <tr key={f.key} className="hover:bg-surface-100/50 transition-colors">
                        <td className="p-2.5">
                          <div className="flex items-center gap-2">
                            {getFileIcon(f.name)}
                            <span className="font-medium text-foreground">{f.name}</span>
                          </div>
                        </td>
                        <td className="p-2.5 text-foreground-light">{formatBytes(f.size)}</td>
                        <td className="p-2.5 text-foreground-lighter">
                          {new Date(f.last_modified).toLocaleString()}
                        </td>
                        <td className="p-2.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <a href={f.url} target="_blank" rel="noopener noreferrer">
                              <Button type="default" size="tiny" icon={<Download size={11} />}>
                                Download
                              </Button>
                            </a>
                            <Button
                              type="default"
                              size="tiny"
                              icon={<Link2 size={11} />}
                              onClick={() => explorerGateway && handleOpenPresignedModal(explorerGateway, selectedBucket, f.key)}
                            >
                              Presigned URL
                            </Button>
                            <Button
                              type="outline"
                              size="tiny"
                              className="text-destructive hover:bg-destructive/10"
                              icon={<Trash2 size={11} />}
                              onClick={() => handleDeleteRemoteFile(f.key)}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <DialogFooter className="p-3 border-t border-border flex items-center justify-between">
            <span className="text-[11px] text-foreground-lighter font-mono">
              {filteredFiles.length} {filteredFiles.length === 1 ? 'object' : 'objects'} in {selectedBucket}
            </span>
            <Button type="default" onClick={() => setExplorerGateway(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Presigned URL Modal */}
      <Dialog open={presignedTarget !== null} onOpenChange={(open) => !open && setPresignedTarget(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 size={16} className="text-primary" />
              <span>Generate Presigned S3 Link</span>
            </DialogTitle>
          </DialogHeader>

          <DialogSection className="space-y-4">
            <div className="text-xs text-foreground-lighter">
              File: <strong className="text-foreground font-mono">{presignedTarget?.key}</strong> in bucket <strong className="text-foreground font-mono">{presignedTarget?.bucket}</strong>
            </div>

            <div className="space-y-1.5">
              <Label_Shadcn_ htmlFor="p-exp">Link Expiry Duration</Label_Shadcn_>
              <select
                id="p-exp"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={presignedExpiry}
                onChange={(e) => handlePresignedExpiryChange(parseInt(e.target.value, 10))}
              >
                <option value={3600}>1 Hour (Standard)</option>
                <option value={86400}>24 Hours (1 Day)</option>
                <option value={604800}>7 Days (1 Week)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label_Shadcn_>Generated AWS SigV4 URL</Label_Shadcn_>
              {isGeneratingUrl ? (
                <div className="p-4 text-center text-xs text-foreground-lighter">
                  <RefreshCw className="animate-spin mb-1 inline" size={14} /> Generating...
                </div>
              ) : (
                <div className="relative">
                  <textarea
                    rows={4}
                    readOnly
                    className="w-full rounded-md border border-input bg-surface-200/50 p-2.5 font-mono text-[11px] text-foreground shadow-sm break-all focus-visible:outline-none"
                    value={generatedUrl}
                  />
                  <Button
                    type="primary"
                    size="tiny"
                    className="absolute right-2 bottom-2"
                    icon={<Copy size={11} />}
                    onClick={() => {
                      navigator.clipboard.writeText(generatedUrl)
                      toast.success('Presigned URL copied to clipboard!')
                    }}
                  >
                    Copy Link
                  </Button>
                </div>
              )}
              <p className="text-[11px] text-foreground-lighter">
                Allows any client or browser to access the remote file directly without needing your S3 credentials.
              </p>
            </div>
          </DialogSection>

          <DialogFooter className="flex items-center justify-end">
            <Button type="default" onClick={() => setPresignedTarget(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Connect Gateway Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Connect S3 Storage Gateway</DialogTitle>
          </DialogHeader>

          <DialogSection className="space-y-4">
            <div className="space-y-1.5">
              <Label_Shadcn_ htmlFor="gw-name">Gateway Name</Label_Shadcn_>
              <Input_Shadcn_
                id="gw-name"
                placeholder="e.g. cPanel Media Storage, 20i S3 Bucket"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label_Shadcn_ htmlFor="gw-url">Endpoint URL</Label_Shadcn_>
              <Input_Shadcn_
                id="gw-url"
                placeholder="https://storage.clientdomain.com/storage.php"
                value={formEndpoint}
                onChange={(e) => setFormEndpoint(e.target.value)}
              />
              <p className="text-[11px] text-foreground-lighter">
                The HTTPS URL where <code className="font-mono">socket-storage.php</code> was uploaded.
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
