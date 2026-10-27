import React, { useState, useRef, useCallback } from 'react'
import {
  Upload,
  FileCode,
  FileText,
  CheckCircle2,
  AlertCircle,
  X,
  Play,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Database,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge, Button, cn } from 'ui'

interface BenchoUploadDropzoneProps {
  projectRef: string
  onImportComplete?: () => void
}

type ImportPhase = 'idle' | 'selected' | 'parsing' | 'applying_schema' | 'restoring_data' | 'success' | 'error'

export function BenchoUploadDropzone({ projectRef, onImportComplete }: BenchoUploadDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileContent, setFileContent] = useState<string>('')
  const [importPhase, setImportPhase] = useState<ImportPhase>('idle')
  const [progressPercent, setProgressPercent] = useState(0)
  const [statusMessage, setStatusMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [stats, setStats] = useState<{ statements: number; tables: number } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const processFile = (file: File) => {
    const validExtensions = ['.sql', '.dump', '.csv', '.txt']
    const hasValidExt = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext))

    if (!hasValidExt) {
      toast.error('Please upload a valid .sql, .dump, or .csv file')
      return
    }

    if (file.size > 100 * 1024 * 1024) {
      toast.error('File size exceeds maximum upload limit of 100MB')
      return
    }

    setSelectedFile(file)
    setImportPhase('selected')
    setErrorMessage('')

    // Read preview text
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = (e.target?.result as string) || ''
      setFileContent(text)

      // Count statements and tables
      const statements = (text.match(/;/g) || []).length
      const tables = (text.match(/create\s+table/gi) || []).length
      setStats({
        statements: Math.max(1, statements),
        tables: Math.max(tables, (text.match(/insert\s+into/gi) || []).length > 0 ? 1 : 0),
      })
    }
    reader.readAsText(file.slice(0, 1024 * 1024)) // read first 1MB for fast preview
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0])
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0])
    }
  }

  const startRestore = async () => {
    if (!selectedFile) return

    setImportPhase('parsing')
    setProgressPercent(15)
    setStatusMessage('Analyzing SQL dump & validating schema definitions...')

    try {
      // Phase 1 -> 2
      await new Promise((r) => setTimeout(r, 600))
      setProgressPercent(40)
      setImportPhase('applying_schema')
      setStatusMessage('Creating schemas, tables, indexes, and constraints...')

      // Send to server
      const fullText = await selectedFile.text()

      const res = await fetch(`/api/platform/database/${projectRef}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sql: fullText,
          fileName: selectedFile.name,
        }),
      })

      setProgressPercent(75)
      setImportPhase('restoring_data')
      setStatusMessage('Restoring table data and records...')
      await new Promise((r) => setTimeout(r, 700))

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error?.message || 'Failed to execute database restore')
      }

      const result = await res.json()

      setProgressPercent(100)
      setImportPhase('success')
      setStatusMessage(
        `Successfully restored ${result.statementsExecuted || stats?.statements || 1} statements into your database!`
      )
      toast.success('Database restore completed successfully!')
      if (onImportComplete) onImportComplete()
    } catch (err: any) {
      setImportPhase('error')
      setErrorMessage(err.message || 'An unknown error occurred during restore')
      toast.error(`Restore failed: ${err.message}`)
    }
  }

  const reset = () => {
    setSelectedFile(null)
    setFileContent('')
    setImportPhase('idle')
    setProgressPercent(0)
    setStatusMessage('')
    setErrorMessage('')
    setStats(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept=".sql,.dump,.csv,.txt"
        className="hidden"
        onChange={handleFileChange}
      />

      {importPhase === 'idle' && (
        <div
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'group relative rounded-2xl border-2 border-dashed p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300',
            isDragOver
              ? 'border-brand-500 bg-brand-500/10 scale-[1.01] shadow-xl'
              : 'border-default hover:border-foreground-muted bg-surface-100/50 hover:bg-surface-100/80'
          )}
        >
          {/* Animated Glow Halo on Drag Over */}
          <div
            className={cn(
              'absolute inset-0 rounded-2xl bg-gradient-to-r from-brand-500/10 via-emerald-500/10 to-blue-500/10 opacity-0 blur-xl transition-opacity duration-300 pointer-events-none',
              isDragOver && 'opacity-100'
            )}
          />

          {/* Central Floating Upload Icon */}
          <div
            className={cn(
              'relative h-16 w-16 rounded-2xl border border-default bg-surface-200 flex items-center justify-center text-foreground-light transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg',
              isDragOver && 'border-brand-500 text-brand-500 bg-brand-500/20 rotate-6'
            )}
          >
            <Upload size={28} className="transition-transform group-hover:-translate-y-0.5" />
          </div>

          <h3 className="text-base font-semibold text-foreground mt-5 mb-1.5 tracking-tight">
            Drag & drop your database file here, or{' '}
            <span className="text-brand-500 underline underline-offset-4 font-bold">browse</span>
          </h3>

          <p className="text-xs text-foreground-lighter max-w-md mb-5">
            Supports standard PostgreSQL dumps, Supabase / Powabase schema dumps, SQL migration
            files, or CSV data tables up to 100MB.
          </p>

          {/* File Format Badges */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Badge variant="outline" className="font-mono text-[11px] px-2.5 py-0.5 bg-surface-200/50">
              .SQL
            </Badge>
            <Badge variant="outline" className="font-mono text-[11px] px-2.5 py-0.5 bg-surface-200/50">
              .DUMP
            </Badge>
            <Badge variant="outline" className="font-mono text-[11px] px-2.5 py-0.5 bg-surface-200/50">
              .CSV
            </Badge>
            <Badge variant="outline" className="font-mono text-[11px] px-2.5 py-0.5 bg-surface-200/50">
              PG_DUMP PLAIN
            </Badge>
          </div>
        </div>
      )}

      {/* Selected File / In Progress / Completed State */}
      {importPhase !== 'idle' && selectedFile && (
        <div className="rounded-2xl border border-default bg-surface-100 p-6 shadow-sm">
          {/* File Card Header */}
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-default">
            <div className="flex items-center gap-3.5">
              <div className="h-12 w-12 rounded-xl bg-brand-500/10 text-brand-500 border border-brand-500/20 flex items-center justify-center shrink-0">
                <FileCode size={24} />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <span className="truncate max-w-sm">{selectedFile.name}</span>
                  <Badge variant="outline" className="font-mono text-[10px] uppercase">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </Badge>
                </div>
                <div className="text-xs text-foreground-lighter mt-0.5">
                  {stats
                    ? `Estimated ~${stats.statements} statements across ${stats.tables} table(s)`
                    : 'Ready for restoration'}
                </div>
              </div>
            </div>

            {importPhase === 'selected' && (
              <Button
                type="text"
                size="tiny"
                icon={<X size={14} />}
                onClick={reset}
                className="text-foreground-lighter hover:text-foreground"
              >
                Cancel
              </Button>
            )}
          </div>

          {/* Progress / Status Bar */}
          {importPhase !== 'selected' && (
            <div className="mt-5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground flex items-center gap-1.5">
                  {importPhase === 'success' && <CheckCircle2 size={14} className="text-emerald-500" />}
                  {importPhase === 'error' && <AlertCircle size={14} className="text-destructive" />}
                  {statusMessage}
                </span>
                <span className="font-mono text-foreground-lighter">{progressPercent}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-surface-200 overflow-hidden">
                <div
                  className={cn(
                    'h-full transition-all duration-300 rounded-full',
                    importPhase === 'error'
                      ? 'bg-destructive'
                      : importPhase === 'success'
                        ? 'bg-emerald-500'
                        : 'bg-brand-500'
                  )}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Error Message Display */}
          {importPhase === 'error' && (
            <div className="mt-4 rounded-lg bg-destructive/10 border border-destructive/20 p-3.5 text-xs text-destructive">
              <strong>Restore Error:</strong> {errorMessage}
            </div>
          )}

          {/* Action Footer */}
          <div className="mt-6 flex items-center justify-end gap-3">
            {importPhase === 'selected' && (
              <>
                <Button type="default" onClick={reset}>
                  Choose Another File
                </Button>
                <Button
                  type="primary"
                  icon={<Play size={14} />}
                  onClick={startRestore}
                  className="bg-brand-500 hover:bg-brand-600 text-white"
                >
                  Start Database Restore
                </Button>
              </>
            )}

            {importPhase === 'success' && (
              <Button type="primary" icon={<RotateCcw size={14} />} onClick={reset}>
                Import Another File
              </Button>
            )}

            {importPhase === 'error' && (
              <Button type="default" icon={<RotateCcw size={14} />} onClick={startRestore}>
                Retry Restore
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
