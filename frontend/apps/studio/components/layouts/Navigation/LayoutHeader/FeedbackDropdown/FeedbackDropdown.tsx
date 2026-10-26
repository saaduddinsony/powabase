import { IS_PLATFORM } from 'common'
import { ArrowUpRight, Lightbulb, TriangleAlert } from 'lucide-react'
import { useRouter } from 'next/router'
import { useState } from 'react'
import {
  Button,
  Popover_Shadcn_,
  PopoverContent_Shadcn_,
  PopoverSeparator_Shadcn_,
  PopoverTrigger_Shadcn_,
} from 'ui'

import { FeedbackWidget } from './FeedbackWidget'
import { SIDEBAR_KEYS } from '@/components/layouts/ProjectLayout/LayoutSidebar/LayoutSidebarProvider'
import { ASSISTANT_SUGGESTIONS } from '@/components/ui/HelpPanel/HelpPanel.constants'
import { getSupportLinkQueryParams } from '@/components/ui/HelpPanel/HelpPanel.utils'
import { HelpSection } from '@/components/ui/HelpPanel/HelpSection'
import { useSelectedOrganizationQuery } from '@/hooks/misc/useSelectedOrganization'
import { useSelectedProjectQuery } from '@/hooks/misc/useSelectedProject'
import { useAiAssistantStateSnapshot } from '@/state/ai-assistant-state'
import { useSidebarManagerSnapshot } from '@/state/sidebar-manager-state'

export const FeedbackDropdown = ({ className }: { className?: string }) => {
  const router = useRouter()
  const { data: project } = useSelectedProjectQuery()
  const { data: org } = useSelectedOrganizationQuery()
  const snap = useAiAssistantStateSnapshot()
  const { openSidebar } = useSidebarManagerSnapshot()
  const [isOpen, setIsOpen] = useState(false)
  const [stage, setStage] = useState<'select' | 'issue-options' | 'widget'>('select')

  const projectRef = project?.parent_project_ref ?? (router.query.ref as string | undefined)
  const supportLinkQueryParams = getSupportLinkQueryParams(
    project,
    org,
    router.query.ref as string | undefined
  )

  return (
    <Popover_Shadcn_
      modal={false}
      open={isOpen}
      onOpenChange={(e) => {
        setIsOpen(e)
        if (!e) setStage('select')
      }}
    >
      <PopoverTrigger_Shadcn_ asChild>
        <Button
          asChild
          onClick={() => {
            setIsOpen((isOpen) => !isOpen)
            setStage('select')
          }}
          type="text"
          className="rounded-full h-[32px] text-foreground-light hover:text-foreground"
        >
          <span className={className}>Feedback</span>
        </Button>
      </PopoverTrigger_Shadcn_>
      <PopoverContent_Shadcn_
        side="bottom"
        align="end"
        className="p-0 flex flex-col w-96"
        id="feedback-widget"
      >
        {stage === 'select' && (
          <div className="flex flex-col gap-4 p-4">
            <div className="font-semibold text-sm text-foreground">What would you like to share?</div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setStage('issue-options')}
                className="group relative flex flex-col justify-between p-4 h-36 rounded-2xl border border-default bg-surface-100 hover:bg-surface-200/60 hover:border-foreground-muted hover:shadow-md active:scale-[0.98] transition-all duration-200 text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground-lighter"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="h-9 w-9 rounded-xl bg-destructive-200/40 text-destructive-600 border border-destructive-400/20 flex items-center justify-center transition-transform group-hover:scale-105">
                    <TriangleAlert size={18} />
                  </div>
                  <ArrowUpRight size={15} className="text-foreground-lighter opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">Issue</div>
                  <div className="text-xs text-foreground-lighter mt-0.5 leading-snug">with my project</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setStage('widget')}
                className="group relative flex flex-col justify-between p-4 h-36 rounded-2xl border border-default bg-surface-100 hover:bg-surface-200/60 hover:border-foreground-muted hover:shadow-md active:scale-[0.98] transition-all duration-200 text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground-lighter"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="h-9 w-9 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center transition-transform group-hover:scale-105">
                    <Lightbulb size={18} />
                  </div>
                  <ArrowUpRight size={15} className="text-foreground-lighter opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">Idea</div>
                  <div className="text-xs text-foreground-lighter mt-0.5 leading-snug">to improve Socket</div>
                </div>
              </button>
            </div>
          </div>
        )}
        {stage === 'issue-options' && (
          <>
            <div className="flex flex-col gap-4 p-4">
              <HelpSection
                excludeIds={[]}
                isPlatform={IS_PLATFORM}
                projectRef={projectRef}
                supportLinkQueryParams={supportLinkQueryParams}
                onAssistantClick={() => {
                  openSidebar(SIDEBAR_KEYS.AI_ASSISTANT)
                  snap.newChat(ASSISTANT_SUGGESTIONS)
                  setIsOpen(false)
                }}
                onSupportClick={() => setIsOpen(false)}
              />
            </div>
            <PopoverSeparator_Shadcn_ />
            <div className="px-4 pt-4 pb-4">
              <Button type="default" size="tiny" onClick={() => setStage('widget')}>
                Leave feedback instead
              </Button>
            </div>
          </>
        )}
        {stage === 'widget' && (
          <FeedbackWidget
            onClose={() => setIsOpen(false)}
            onSwitchToIssueOptions={() => setStage('issue-options')}
          />
        )}
      </PopoverContent_Shadcn_>
    </Popover_Shadcn_>
  )
}
