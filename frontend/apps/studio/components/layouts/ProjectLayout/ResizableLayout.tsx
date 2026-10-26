import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ReactNode, useState, useEffect } from 'react'

import { cn } from '@/lib/utils'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup, usePanelRef } from 'ui'

// v4 interprets bare numbers as pixels; strings without unit are percentages.
const toPercentString = (n: number) => `${n}`

interface ResizableLayoutProps {
  /** Content for the left panel (product menu) */
  leftPanel?: ReactNode
  /** Title shown in the left panel header */
  leftPanelTitle?: string
  /** Main content area */
  children: ReactNode
  /** Whether the left panel is collapsible */
  collapsible?: boolean
  /** Default collapsed state */
  defaultCollapsed?: boolean
  /** Minimum size of left panel in percentage */
  minSize?: number
  /** Maximum size of left panel in percentage */
  maxSize?: number
  /** Default size of left panel in percentage */
  defaultSize?: number
}

/**
 * Two-column layout with a collapsible, drag-resizable left panel.
 *
 * Uses the Studio `ui` package's `ResizablePanelGroup` / `ResizablePanel` /
 * `ResizableHandle` wrappers, which are thin re-exports of
 * `react-resizable-panels` v4. All resize/collapse props pass through
 * unchanged.
 */
export function ResizableLayout({
  leftPanel,
  leftPanelTitle,
  children,
  collapsible = true,
  defaultCollapsed = false,
  minSize = 15,
  maxSize = 35,
  defaultSize = 20,
}: ResizableLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed)
  const leftPanelRef = usePanelRef()

  useEffect(() => {
    if (defaultCollapsed && leftPanelRef.current) {
      try {
        leftPanelRef.current.collapse()
      } catch {}
    }
  }, [defaultCollapsed, leftPanelRef])

  if (!leftPanel) {
    return <div className="h-full w-full">{children}</div>
  }

  function handleCollapse() {
    if (leftPanelRef.current) {
      try {
        leftPanelRef.current.collapse()
      } catch {}
    }
    setIsCollapsed(true)
  }

  function handleExpand() {
    const target = defaultSize || minSize || 20
    if (leftPanelRef.current) {
      try {
        leftPanelRef.current.resize(toPercentString(target))
      } catch {
        try {
          (leftPanelRef.current.resize as any)(target)
        } catch {}
      }
      try {
        leftPanelRef.current.expand(toPercentString(target))
      } catch {
        try {
          leftPanelRef.current.expand()
        } catch {}
      }
    }
    setIsCollapsed(false)
  }

  return (
    <ResizablePanelGroup orientation="horizontal" className="h-full">
      <ResizablePanel
        id="left-panel"
        panelRef={leftPanelRef}
        defaultSize={toPercentString(defaultSize)}
        minSize={toPercentString(minSize)}
        maxSize={toPercentString(maxSize)}
        collapsible={collapsible}
        collapsedSize={toPercentString(0)}
        onResize={(panelSize) => {
          setIsCollapsed(panelSize.asPercentage === 0)
        }}
      >
        <div className="h-full flex flex-col bg-surface-100 border-r border-default">
          {leftPanelTitle && (
            <div className="flex items-center justify-between h-12 px-4 border-b border-default">
              <h3 className="text-sm font-medium text-foreground">{leftPanelTitle}</h3>
              {collapsible && (
                <button
                  type="button"
                  onClick={handleCollapse}
                  className="p-1 rounded hover:bg-surface-200 text-foreground-light hover:text-foreground transition-colors"
                  title="Collapse panel"
                  aria-label="Collapse panel"
                >
                  <ChevronLeft size={16} />
                </button>
              )}
            </div>
          )}
          <div className="flex-1 overflow-hidden">{leftPanel}</div>
        </div>
      </ResizablePanel>

      <ResizableHandle withHandle />

      <ResizablePanel
        id="main-panel"
        defaultSize={toPercentString(100 - defaultSize)}
        minSize={toPercentString(40)}
        className="relative"
      >
        {isCollapsed && collapsible && (
          <button
            type="button"
            onClick={handleExpand}
            className={cn(
              'absolute top-3 left-3 z-10',
              'p-1.5 rounded-md cursor-pointer',
              'bg-surface-200 border border-default',
              'text-foreground-light hover:text-foreground',
              'hover:bg-surface-300 transition-colors',
              'shadow-sm active:scale-95'
            )}
            title="Expand panel"
            aria-label="Expand panel"
          >
            <ChevronRight size={16} />
          </button>
        )}
        <div className="h-full w-full flex flex-col bg-background">{children}</div>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
