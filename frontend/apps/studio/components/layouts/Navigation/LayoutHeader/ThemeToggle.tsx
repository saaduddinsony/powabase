import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { cn } from 'ui'

import { ButtonTooltip } from '@/components/ui/ButtonTooltip'
import { executeThemeTransition } from '@/lib/theme-transition'

export const ThemeToggle = ({ className }: { className?: string }) => {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className={cn('w-[32px] h-[32px] rounded-full border border-default opacity-40', className)} />
    )
  }

  const isDark = resolvedTheme === 'dark' || theme === 'dark'
  const nextTheme = isDark ? 'light' : 'dark'

  const handleToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    executeThemeTransition(nextTheme, setTheme, e)
  }

  return (
    <ButtonTooltip
      id="theme-toggle-button"
      type="outline"
      size="tiny"
      className={cn(
        'rounded-full w-[32px] h-[32px] flex items-center justify-center p-0 group transition-all duration-200',
        'hover:border-stronger hover:bg-surface-200/80 active:scale-95',
        className
      )}
      onClick={handleToggle}
      tooltip={{
        content: {
          text: isDark ? 'Switch to light mode' : 'Switch to dark mode',
        },
      }}
    >
      {isDark ? (
        <Sun
          size={16}
          strokeWidth={1.75}
          className="text-foreground-light group-hover:text-amber-400 transition-colors"
        />
      ) : (
        <Moon
          size={16}
          strokeWidth={1.75}
          className="text-foreground-light group-hover:text-indigo-500 transition-colors"
        />
      )}
    </ButtonTooltip>
  )
}
