import Link from 'next/link'
import { useRouter } from 'next/router'
import { cn } from 'ui'

import { useIsFeatureEnabled } from '@/hooks/misc/useIsFeatureEnabled'

export const HomeIcon = ({ className }: { className?: string }) => {
  const largeLogo = useIsFeatureEnabled('branding:large_logo')
  const router = useRouter()

  return (
    <Link href="/organizations" className={cn('items-center justify-center flex-shrink-0 flex', className)}>
      {/* Light logo on dark background */}
      <img
        alt="Socket"
        src={`${router.basePath}/img/socket-light-logo.svg`}
        className={cn('dark:block hidden rounded-md object-contain', largeLogo ? 'h-[24px] w-[24px]' : 'h-[22px] w-[22px]')}
      />
      {/* Dark logo on light background */}
      <img
        alt="Socket"
        src={`${router.basePath}/img/socket-dark-logo.svg`}
        className={cn('dark:hidden block rounded-md object-contain', largeLogo ? 'h-[24px] w-[24px]' : 'h-[22px] w-[22px]')}
      />
    </Link>
  )
}
