import { useEffect, useRef, useState } from 'react'
import { cn } from 'ui'

export interface InteractiveCopilotAvatarProps {
  size?: 'tiny' | 'small' | 'medium' | 'large'
  className?: string
  isAwake?: boolean
  onClick?: () => void
}

export const InteractiveCopilotAvatar = ({
  size = 'small',
  className,
  isAwake = true,
  onClick,
}: InteractiveCopilotAvatarProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 })
  const [isBlinking, setIsBlinking] = useState(false)

  // Dimensions based on size
  const sizeMap = {
    tiny: { container: 'w-5 h-5', eyeW: 'w-[2.5px]', eyeH: 'h-[6px]', gap: 'gap-[2.5px]', maxOffset: 1.5 },
    small: { container: 'w-6 h-6', eyeW: 'w-[3px]', eyeH: 'h-[8px]', gap: 'gap-[3px]', maxOffset: 2.2 },
    medium: { container: 'w-8 h-8', eyeW: 'w-[4px]', eyeH: 'h-[11px]', gap: 'gap-[4px]', maxOffset: 3.2 },
    large: { container: 'w-10 h-10', eyeW: 'w-[5px]', eyeH: 'h-[14px]', gap: 'gap-[5px]', maxOffset: 4.2 },
  }

  const currentSize = sizeMap[size]

  // Track cursor position and move eyes
  useEffect(() => {
    if (!isAwake) {
      setEyeOffset({ x: 0, y: 0 })
      return
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2

      const dx = e.clientX - centerX
      const dy = e.clientY - centerY
      const dist = Math.hypot(dx, dy)

      if (dist === 0) {
        setEyeOffset({ x: 0, y: 0 })
        return
      }

      // Smooth damped offset
      const maxOffset = currentSize.maxOffset
      const factor = Math.min(dist / 180, 1)
      const angle = Math.atan2(dy, dx)
      const x = Math.cos(angle) * maxOffset * factor
      const y = Math.sin(angle) * maxOffset * factor

      setEyeOffset({ x, y })
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [isAwake, currentSize.maxOffset])

  // Random natural blink cycle
  useEffect(() => {
    if (!isAwake) return

    let timeoutId: NodeJS.Timeout
    const triggerBlink = () => {
      setIsBlinking(true)
      setTimeout(() => {
        setIsBlinking(false)
        const nextDelay = 3000 + Math.random() * 4000
        timeoutId = setTimeout(triggerBlink, nextDelay)
      }, 140)
    }

    const initialDelay = 2500 + Math.random() * 3000
    timeoutId = setTimeout(triggerBlink, initialDelay)

    return () => clearTimeout(timeoutId)
  }, [isAwake])

  return (
    <div
      ref={containerRef}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={cn(
        'relative rounded-full flex items-center justify-center select-none overflow-hidden transition-transform duration-200',
        'bg-[#121316] border border-[#2b2d31]/60 shadow-sm',
        currentSize.container,
        onClick && 'cursor-pointer hover:scale-105 active:scale-95',
        className
      )}
      style={{
        background: 'radial-gradient(circle at 35% 35%, #222328 0%, #111215 100%)',
      }}
    >
      {/* Subtle eye glow & socket */}
      <div
        className={cn('flex items-center justify-center transition-transform duration-75 ease-out', currentSize.gap)}
        style={{
          transform: `translate(${eyeOffset.x}px, ${eyeOffset.y}px)`,
        }}
      >
        {/* Left eye pill */}
        <div
          className={cn(
            'bg-white rounded-full transition-all duration-100 shadow-[0_0_4px_rgba(255,255,255,0.7)]',
            currentSize.eyeW,
            currentSize.eyeH
          )}
          style={{
            transform: isBlinking ? 'scaleY(0.08)' : 'scaleY(1)',
            opacity: isAwake ? 1 : 0.4,
          }}
        />
        {/* Right eye pill */}
        <div
          className={cn(
            'bg-white rounded-full transition-all duration-100 shadow-[0_0_4px_rgba(255,255,255,0.7)]',
            currentSize.eyeW,
            currentSize.eyeH
          )}
          style={{
            transform: isBlinking ? 'scaleY(0.08)' : 'scaleY(1)',
            opacity: isAwake ? 1 : 0.4,
          }}
        />
      </div>
    </div>
  )
}
