import { LOCAL_STORAGE_KEYS } from 'common'
import { SqlEditor } from 'icons'
import { cn, KeyboardShortcut } from 'ui'

import { SIDEBAR_KEYS } from '@/components/layouts/ProjectLayout/LayoutSidebar/LayoutSidebarProvider'
import { ButtonTooltip } from '@/components/ui/ButtonTooltip'
import { useLocalStorageQuery } from '@/hooks/misc/useLocalStorage'
import { useSidebarManagerSnapshot } from '@/state/sidebar-manager-state'

const InlineEditorKeyboardTooltip = () => {
  const [hotkeyEnabled] = useLocalStorageQuery(
    LOCAL_STORAGE_KEYS.HOTKEY_SIDEBAR(SIDEBAR_KEYS.EDITOR_PANEL),
    true
  )

  return hotkeyEnabled ? <KeyboardShortcut keys={['Meta', 'E']} /> : null
}

export const InlineEditorButton = () => {
  const { activeSidebar, toggleSidebar } = useSidebarManagerSnapshot()
  const isOpen = activeSidebar?.id === SIDEBAR_KEYS.EDITOR_PANEL

  const handleClick = () => {
    toggleSidebar(SIDEBAR_KEYS.EDITOR_PANEL)
  }

  return (
    <ButtonTooltip
      type="outline"
      size="tiny"
      id="editor-trigger"
      className={cn(
        'rounded-full w-[32px] h-[32px] flex items-center justify-center p-0 group transition-all',
        isOpen
          ? 'bg-surface-300 dark:bg-surface-300 border-stronger text-foreground shadow-sm hover:bg-surface-300'
          : 'text-foreground-light hover:text-foreground hover:bg-surface-200'
      )}
      onClick={handleClick}
      tooltip={{
        content: {
          className: 'p-1 pl-2.5',
          text: (
            <div className="flex items-center gap-2.5">
              <span>SQL Editor</span>
              <InlineEditorKeyboardTooltip />
            </div>
          ),
        },
      }}
    >
      <SqlEditor
        size={16}
        strokeWidth={1.5}
        className={cn('transition-colors', isOpen ? 'text-foreground' : 'text-foreground-light group-hover:text-foreground')}
      />
    </ButtonTooltip>
  )
}
