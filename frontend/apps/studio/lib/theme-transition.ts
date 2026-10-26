/**
 * Smooth corner-takeover circular reveal transition for switching themes.
 * Uses native document.startViewTransition with circular clip-path animation.
 */
export function executeThemeTransition(
  nextTheme: string,
  setTheme: (t: string) => void,
  event?: React.MouseEvent | MouseEvent | { clientX?: number; clientY?: number }
) {
  if (typeof document === 'undefined') {
    setTheme(nextTheme)
    return
  }

  // Fallback for browsers without View Transitions or users who prefer reduced motion
  if (
    !('startViewTransition' in document) ||
    (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  ) {
    setTheme(nextTheme)
    return
  }

  // Find origin point: event coords, or top-right corner if event not provided
  let x = typeof window !== 'undefined' ? window.innerWidth - 36 : 40
  let y = 36
  if (event && typeof event.clientX === 'number' && event.clientX > 0) {
    x = event.clientX
    y = event.clientY ?? 36
  }

  const endRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y)
  )

  try {
    const transition = (document as any).startViewTransition(() => {
      setTheme(nextTheme)
    })

    if (transition && typeof transition.ready?.then === 'function') {
      transition.ready.then(() => {
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${endRadius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 750,
            easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
            pseudoElement: '::view-transition-new(root)',
          }
        )
      }).catch(() => {
        // Fallback silently if animate fails
      })
    }
  } catch {
    setTheme(nextTheme)
  }
}
