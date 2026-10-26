import { useTheme } from 'next-themes'
import { useEffect } from 'react'

/**
 * SystemThemeSync guarantees real-time synchronization between OS light/dark mode
 * and the application DOM (both data-theme attribute and CSS class).
 *
 * When theme is set to 'system', it listens to prefers-color-scheme media query
 * changes using both modern addEventListener and legacy addListener, ensuring
 * that changing macOS/Windows appearance updates the dashboard instantly.
 */
export const SystemThemeSync = () => {
  const { theme, resolvedTheme } = useTheme()

  useEffect(() => {
    const applyDomTheme = (effectiveTheme: string) => {
      const root = document.documentElement
      const isDark = effectiveTheme === 'dark' || effectiveTheme === 'classic-dark'

      // Set data-theme attribute
      root.setAttribute('data-theme', effectiveTheme)

      // Synchronize class list so both Tailwind and SCSS rules match
      root.classList.remove('light', 'dark', 'classic-dark')
      root.classList.add(isDark ? 'dark' : 'light')
      if (effectiveTheme === 'classic-dark') {
        root.classList.add('classic-dark')
      }

      // Update native style.colorScheme
      root.style.colorScheme = isDark ? 'dark' : 'light'
    }

    if (theme === 'system') {
      const media = window.matchMedia('(prefers-color-scheme: dark)')
      const syncSystem = () => {
        const sysTheme = media.matches ? 'dark' : 'light'
        applyDomTheme(sysTheme)
      }

      // Initial sync on mount or when switching to 'system'
      syncSystem()

      // Listen for dynamic OS theme changes
      if (typeof media.addEventListener === 'function') {
        media.addEventListener('change', syncSystem)
        return () => media.removeEventListener('change', syncSystem)
      } else if (typeof (media as any).addListener === 'function') {
        ;(media as any).addListener(syncSystem)
        return () => (media as any).removeListener(syncSystem)
      }
    } else if (theme) {
      applyDomTheme(theme)
    }
  }, [theme])

  return null
}
