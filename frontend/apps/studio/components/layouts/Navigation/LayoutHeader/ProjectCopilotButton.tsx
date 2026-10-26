import { cn } from 'ui'
import { SIDEBAR_KEYS } from '@/components/layouts/ProjectLayout/LayoutSidebar/LayoutSidebarProvider'
import { ButtonTooltip } from '@/components/ui/ButtonTooltip'
import { useIsFeatureEnabled } from '@/hooks/misc/useIsFeatureEnabled'
import { useSidebarManagerSnapshot } from '@/state/sidebar-manager-state'
import { InteractiveCopilotAvatar } from '@/components/interfaces/AI/ProjectCopilot/InteractiveCopilotAvatar'

/** Top-nav toggle for the Project Copilot side panel. Visible on project pages. */
export const ProjectCopilotButton = () => {
  const { activeSidebar, toggleSidebar } = useSidebarManagerSnapshot()
  const projectCopilotEnabled = useIsFeatureEnabled('ai:project_copilot')

  if (!projectCopilotEnabled) return null

  const isOpen = activeSidebar?.id === SIDEBAR_KEYS.PROJECT_COPILOT

  return (
    <ButtonTooltip
      type="outline"
      size="tiny"
      id="project-copilot-trigger"
      icon={<InteractiveCopilotAvatar size="tiny" isAwake={isOpen} />}
      className={cn('rounded-full gap-1.5 px-2.5', isOpen && 'bg-foreground text-background')}
      onClick={() => toggleSidebar(SIDEBAR_KEYS.PROJECT_COPILOT)}
      tooltip={{ content: { text: 'Toggle Project Copilot AI' } }}
    >
      <span>Project Copilot</span>
    </ButtonTooltip>
  )
}
