import { KeyboardShortcut, cn } from 'ui'
import { SIDEBAR_KEYS } from '@/components/layouts/ProjectLayout/LayoutSidebar/LayoutSidebarProvider'
import { ButtonTooltip } from '@/components/ui/ButtonTooltip'
import { useIsFeatureEnabled } from '@/hooks/misc/useIsFeatureEnabled'
import { useSidebarManagerSnapshot } from '@/state/sidebar-manager-state'

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
      className={cn(
        'rounded-full w-[32px] h-[32px] flex items-center justify-center p-0 group transition-all',
        isOpen && 'bg-foreground text-background hover:bg-foreground hover:text-background'
      )}
      onClick={() => toggleSidebar(SIDEBAR_KEYS.PROJECT_COPILOT)}
      tooltip={{
        content: {
          className: 'p-1 pl-2.5',
          text: (
            <div className="flex items-center gap-2.5">
              <span>Project Copilot</span>
              <KeyboardShortcut keys={['Meta', 'I']} />
            </div>
          ),
        },
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-4 h-4 text-foreground-lighter group-hover:text-foreground transition-colors"
      >
        <path d="M12 8V4H8" />
        <rect width="16" height="12" x="4" y="8" rx="2" />
        <path d="M2 14h2" />
        <path d="M20 14h2" />
        <path d="M15 13v2" />
        <path d="M9 13v2" />
      </svg>
    </ButtonTooltip>
  )
}
