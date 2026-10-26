import { useParams } from 'common'
import { ArrowRight, Bot, Key, ShieldAlert } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Button, Switch } from 'ui'
import { toast } from 'sonner'

import DefaultLayout from '@/components/layouts/DefaultLayout'
import { SettingsLayout } from '@/components/layouts/ProjectSettingsLayout/SettingsLayout'
import { InteractiveCopilotAvatar } from '@/components/interfaces/AI/ProjectCopilot/InteractiveCopilotAvatar'
import { SIDEBAR_KEYS } from '@/components/layouts/ProjectLayout/LayoutSidebar/LayoutSidebarProvider'
import { useSidebarManagerSnapshot } from '@/state/sidebar-manager-state'
import type { NextPageWithLayout } from '@/types'

const CopilotSettingsPage: NextPageWithLayout = () => {
  const { ref } = useParams()
  const projectRef = (ref as string) || 'default'
  const { openSidebar } = useSidebarManagerSnapshot()

  const [warnOnDelete, setWarnOnDelete] = useState(true)
  const [model, setModel] = useState('auto')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch(`/api/platform/project-api/${projectRef}/project-copilot/settings`)
        if (res.ok) {
          const data = await res.json()
          if (typeof data.warn_on_delete === 'boolean') {
            setWarnOnDelete(data.warn_on_delete)
          }
          if (data.model) {
            setModel(data.model)
          }
        }
      } catch (err) {
        console.error('Failed to load copilot settings', err)
      } finally {
        setLoading(false)
      }
    }
    loadSettings()
  }, [projectRef])

  const handleSave = async (newWarn?: boolean, newModel?: string) => {
    setSaving(true)
    const payload = {
      warn_on_delete: newWarn !== undefined ? newWarn : warnOnDelete,
      model: newModel !== undefined ? newModel : model,
    }

    try {
      const res = await fetch(`/api/platform/project-api/${projectRef}/project-copilot/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        toast.success('Copilot settings updated')
      } else {
        toast.error('Failed to update copilot settings')
      }
    } catch (err: any) {
      toast.error(err.message || 'Error saving settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto py-8 px-6 space-y-6">
        {/* Header Hero */}
        <div className="rounded-xl border border-default bg-surface-100/60 p-6 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <InteractiveCopilotAvatar size="small" isAwake={true} />
              <h2 className="text-lg font-semibold text-foreground">Project Copilot</h2>
            </div>
            <p className="text-sm text-foreground-lighter max-w-xl">
              An AI assistant that takes action on your behalf across your Socket database, tables,
              and agentic workflows with natural language prompts.
            </p>
          </div>
          <Button
            type="primary"
            size="tiny"
            icon={<Bot size={14} />}
            onClick={() => openSidebar(SIDEBAR_KEYS.PROJECT_COPILOT)}
          >
            Launch Copilot
          </Button>
        </div>

        {/* Safety Safeguards Card */}
        <div className="rounded-xl border border-default bg-surface-100/60 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldAlert size={18} className="text-warning-600" />
            <h3 className="text-base font-medium text-foreground">Safety & Destruction Safeguards</h3>
          </div>
          <p className="text-sm text-foreground-lighter">
            Protect your production and development databases from accidental deletion. When enabled,
            Project Copilot will halt and require explicit confirmation before deleting tables, dropping
            schemas, or truncating data.
          </p>

          <div className="pt-2 flex items-center justify-between border-t border-default">
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-foreground">
                Require confirmation before destructive database actions
              </p>
              <p className="text-xs text-foreground-muted">
                Warns and blocks accidental DROP TABLE, TRUNCATE, and DELETE commands in chat.
              </p>
            </div>
            <Switch
              checked={warnOnDelete}
              onCheckedChange={(checked) => {
                setWarnOnDelete(checked)
                handleSave(checked, undefined)
              }}
            />
          </div>
        </div>

        {/* AI LLM Provider Keys Card */}
        <div className="rounded-xl border border-default bg-surface-100/60 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Key size={18} className="text-brand-600" />
            <h3 className="text-base font-medium text-foreground">Custom LLM Keys</h3>
          </div>
          <p className="text-sm text-foreground-lighter">
            Bring your own API keys for OpenAI, Anthropic, Gemini, Groq, or local Ollama instances to power
            Project Copilot and autonomous agents.
          </p>

          <div className="pt-2 flex items-center justify-between border-t border-default">
            <div>
              <p className="text-sm font-medium text-foreground">LLM Provider Keys</p>
              <p className="text-xs text-foreground-muted">
                Configure OpenAI, Anthropic, Gemini, and Groq API keys for this project.
              </p>
            </div>
            <Button asChild type="default" size="tiny" iconRight={<ArrowRight size={13} />}>
              <Link href={`/project/${projectRef}/settings/llm-keys`}>Configure LLM Keys</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

CopilotSettingsPage.getLayout = (page) => (
  <DefaultLayout>
    <SettingsLayout title="Copilot Settings">{page}</SettingsLayout>
  </DefaultLayout>
)

export default CopilotSettingsPage
