import Link from 'next/link'
import { useRouter } from 'next/router'
import { useParams } from 'common'
import { useEffect, useState } from 'react'
import { cn } from 'ui'

import { useIsFeatureEnabled } from '@/hooks/misc/useIsFeatureEnabled'
import { SIDEBAR_KEYS } from '@/components/layouts/ProjectLayout/LayoutSidebar/LayoutSidebarProvider'
import { useSidebarManagerSnapshot } from '@/state/sidebar-manager-state'
import { InteractiveCopilotAvatar } from '@/components/interfaces/AI/ProjectCopilot/InteractiveCopilotAvatar'

export const HomeIcon = ({ className }: { className?: string }) => {
  const largeLogo = useIsFeatureEnabled('branding:large_logo')
  const router = useRouter()
  const { ref } = useParams()
  const { activeSidebar, openSidebar } = useSidebarManagerSnapshot()

  const isCopilotOpen = activeSidebar?.id === SIDEBAR_KEYS.PROJECT_COPILOT
  const [showAvatar, setShowAvatar] = useState(false)

  // Periodic smooth morphing cycle when Copilot is not currently open
  useEffect(() => {
    if (isCopilotOpen) {
      setShowAvatar(false)
      return
    }

    let morphTimeout: NodeJS.Timeout
    let switchTimeout: NodeJS.Timeout

    const startCycle = () => {
      // Stay as logo for 7 seconds, then transform to avatar for 4 seconds
      switchTimeout = setTimeout(() => {
        setShowAvatar(true)
        morphTimeout = setTimeout(() => {
          setShowAvatar(false)
          startCycle()
        }, 4500)
      }, 7000)
    }

    startCycle()

    return () => {
      clearTimeout(switchTimeout)
      clearTimeout(morphTimeout)
    }
  }, [isCopilotOpen])

  // Navigate to Dashboard Home: active project overview or default project
  const homeHref = ref ? `/project/${ref}` : '/project/default'

  const handleAvatarClick = (e: React.MouseEvent) => {
    if (showAvatar && !isCopilotOpen) {
      e.preventDefault()
      e.stopPropagation()
      openSidebar(SIDEBAR_KEYS.PROJECT_COPILOT)
    }
  }

  const logoDimension = largeLogo ? 'h-[24px] w-[24px]' : 'h-[22px] w-[22px]'

  return (
    <div className={cn('relative items-center justify-center flex-shrink-0 flex', logoDimension, className)}>
      {/* Interactive Avatar Mode */}
      <div
        onClick={handleAvatarClick}
        title="Project Copilot AI Assistant"
        className={cn(
          'absolute inset-0 flex items-center justify-center transition-all duration-500 ease-in-out cursor-pointer',
          showAvatar && !isCopilotOpen
            ? 'opacity-100 scale-100 pointer-events-auto rotate-0'
            : 'opacity-0 scale-75 pointer-events-none -rotate-12'
        )}
      >
        <InteractiveCopilotAvatar size="small" isAwake={showAvatar && !isCopilotOpen} />
      </div>

      {/* Socket Logo Mode */}
      <Link
        href={homeHref}
        className={cn(
          'items-center justify-center flex-shrink-0 flex transition-all duration-500 ease-in-out',
          showAvatar && !isCopilotOpen
            ? 'opacity-0 scale-75 pointer-events-none rotate-12'
            : 'opacity-100 scale-100 pointer-events-auto rotate-0'
        )}
      >
        {/* Light logo on dark background */}
        <img
          alt="Socket"
          src={`${router.basePath}/img/socket-light-logo.svg`}
          className={cn('dark:block hidden rounded-md object-contain', logoDimension)}
        />
        {/* Dark logo on light background */}
        <img
          alt="Socket"
          src={`${router.basePath}/img/socket-dark-logo.svg`}
          className={cn('dark:hidden block rounded-md object-contain', logoDimension)}
        />
      </Link>
    </div>
  )
}
