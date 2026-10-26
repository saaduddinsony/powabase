import { useTheme } from 'next-themes'
import { useEffect, useId, useRef, useState } from 'react'
import { cn } from 'ui'

export type AvatarSize = 'tiny' | 'small' | 'medium' | 'large' | 'xlarge' | 'hero' | number

export interface InteractiveCopilotAvatarProps {
  size?: AvatarSize
  shape?: 'Circle' | 'Ball' | 'Cube' | 'Pill' | 'Hexagon'
  eyes?: 'Slant' | 'Dots' | 'Squares'
  theme?: 'auto' | 'light' | 'dark'
  isAwake?: boolean
  className?: string
  onClick?: () => void
  showSpeechOnPoke?: boolean
}

const SHAPES: Record<string, string> = {
  Circle: 'M50 4 A46 46 0 1 1 49.99 4 Z',
  Ball: 'M50 4 A46 46 0 1 1 49.99 4 Z',
  Cube: 'M30 6 H70 A24 24 0 0 1 94 30 V70 A24 24 0 0 1 70 94 H30 A24 24 0 0 1 6 70 V30 A24 24 0 0 1 30 6 Z',
  Pill: 'M34 17 H66 A33 33 0 0 1 66 83 H34 A33 33 0 0 1 34 17 Z',
  Hexagon:
    'M59.53 8.50 L81.18 21.00 Q90.70 26.50 90.70 37.50 L90.70 62.50 Q90.70 73.50 81.18 79.00 L59.53 91.50 Q50.00 97.00 40.47 91.50 L18.82 79.00 Q9.30 73.50 9.30 62.50 L9.30 37.50 Q9.30 26.50 18.82 21.00 L40.47 8.50 Q50.00 3.00 59.53 8.50 Z',
}

const EYE_GEOMETRY = {
  Slant: { w: 9, h: 15, r: 4.5 },
  Dots: { w: 11, h: 11, r: 5.5 },
  Squares: { w: 12, h: 12, r: 3.5 },
}

const POKE_MESSAGES = [
  'Hey, I see you.',
  'Boop.',
  'Socket Copilot active.',
  'Hi there!',
  'Watching your queries.',
  'At your service.',
  "I'm ready when you are.",
]

const SPEECH_TINTS = ['#18191c', '#24252a', '#0b0c0e']

export const InteractiveCopilotAvatar = ({
  size = 'small',
  shape = 'Circle',
  eyes = 'Slant',
  theme = 'auto',
  isAwake = true,
  className,
  onClick,
  showSpeechOnPoke = true,
}: InteractiveCopilotAvatarProps) => {
  const { resolvedTheme } = useTheme()
  const rawId = useId()
  const clipId = `eyt-clip-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`

  const isDarkMode = theme === 'dark' || (theme === 'auto' && resolvedTheme === 'dark')

  // Numeric pixel dimension
  const pixelSize =
    typeof size === 'number'
      ? size
      : {
          tiny: 22,
          small: 26,
          medium: 38,
          large: 56,
          xlarge: 85,
          hero: 104,
        }[size] ?? 26

  const containerRef = useRef<HTMLDivElement>(null)
  const eyeLeftGroupRef = useRef<SVGGElement>(null)
  const eyeRightGroupRef = useRef<SVGGElement>(null)

  // Poke speech state
  const [speechText, setSpeechText] = useState('')
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [speechTint, setSpeechTint] = useState(SPEECH_TINTS[0])
  const [isPoked, setIsPoked] = useState(false)
  const speechCounterRef = useRef(0)
  const lastMsgIndexRef = useRef(-1)

  const eyeGeo = EYE_GEOMETRY[eyes] ?? EYE_GEOMETRY.Slant

  // Bencho 3D spherical eye tracking kinematics
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let animFrame: number | null = null
    let isVisible = true

    // Kinematic spring state
    const pos = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0 }
    let lastTime = 0
    let lastBlinkTime = 0
    let nextBlinkTime = performance.now() + 2200

    const renderFrame = (now: number) => {
      let blinkScale = 1
      if (now > nextBlinkTime) {
        lastBlinkTime = now
        nextBlinkTime = now + (isAwake ? 2600 + Math.random() * 3200 : 4500)
      }

      const blinkElapsed = now - lastBlinkTime
      if (blinkElapsed < 160) {
        blinkScale = 1 - 0.92 * Math.sin((blinkElapsed / 160) * Math.PI)
      }

      // Physics spring step
      const dt = lastTime ? Math.min(2.5, (now - lastTime) / 16.67) : 1
      lastTime = now

      const stiffness = 0.075
      const damping = 0.28
      pos.vx += ((pos.tx - pos.x) * stiffness - pos.vx * damping) * dt
      pos.vy += ((pos.ty - pos.y) * stiffness - pos.vy * damping) * dt
      pos.x += pos.vx * dt
      pos.y += pos.vy * dt

      // 3D Spherical projection with foreshortening
      const clampVal = (v: number) => Math.min(0.92, Math.max(-0.92, v))
      const yaw = Math.asin(clampVal(pos.x))
      const pitch = -Math.asin(clampVal(pos.y))
      const cosYaw = Math.cos(yaw)
      const sinYaw = Math.sin(yaw)
      const cosPitch = Math.cos(pitch)
      const sinPitch = Math.sin(pitch)
      const tilt = 56 * pos.x * pos.y

      const eyeSpread = 0.19
      const eyesList = [-eyeSpread, eyeSpread]

      eyesList.forEach((eyeX, idx) => {
        const groupEl = idx === 0 ? eyeLeftGroupRef.current : eyeRightGroupRef.current
        if (!groupEl) return

        const z0 = Math.sqrt(Math.max(0, 1 - eyeX * eyeX))
        const x1 = eyeX * cosYaw + z0 * sinYaw
        const z1 = -eyeX * sinYaw + z0 * cosYaw
        const y2 = -z1 * sinPitch
        const z2 = z1 * cosPitch

        const depth = Math.min(1, Math.max(0, z2))
        const foreshorten = 0.45 + 0.55 * depth
        const widthScale = foreshorten * (0.7 + 0.3 * depth)

        const finalW = eyeGeo.w * widthScale
        const finalH = Math.max(0.8, eyeGeo.h * foreshorten * blinkScale)

        const rect = groupEl.firstElementChild as SVGRectElement | null
        if (rect) {
          rect.setAttribute('x', (-finalW / 2).toFixed(2))
          rect.setAttribute('y', (-finalH / 2).toFixed(2))
          rect.setAttribute('width', finalW.toFixed(2))
          rect.setAttribute('height', finalH.toFixed(2))
          rect.setAttribute('rx', Math.min(eyeGeo.r, finalW / 2, finalH / 2).toFixed(2))
        }

        const posX = 50 + x1 * 50
        const posY = 50 + y2 * 50
        groupEl.setAttribute(
          'transform',
          `translate(${posX.toFixed(2)} ${posY.toFixed(2)}) rotate(${tilt.toFixed(2)})`
        )
        groupEl.style.opacity = !isAwake ? '0.35' : depth < 0.05 ? '0' : '1'
      })

      animFrame = requestAnimationFrame(renderFrame)
    }

    animFrame = requestAnimationFrame(renderFrame)

    // Visibility observer to avoid background RAF cycles
    const onVisibility = () => {
      if (document.hidden) {
        if (animFrame) cancelAnimationFrame(animFrame)
        animFrame = null
      } else if (!animFrame && isVisible) {
        lastTime = performance.now()
        animFrame = requestAnimationFrame(renderFrame)
      }
    }

    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting
      onVisibility()
    })
    observer.observe(container)
    document.addEventListener('visibilitychange', onVisibility)

    // Global pointermove tracking
    const onPointerMove = (e: PointerEvent) => {
      if (!isAwake) {
        pos.tx = 0
        pos.ty = 0
        return
      }

      const rect = container.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2

      const dx = e.clientX - centerX
      const dy = e.clientY - centerY
      const dist = Math.hypot(dx, dy) || 1

      // Smooth logarithmic / tanh tracking clamp
      const reach = Math.max(80, window.innerWidth * 0.22)
      const lookFactor = Math.min(0.88, Math.tanh(dist / reach) * 1.05)

      pos.tx = (dx / dist) * lookFactor
      pos.ty = (dy / dist) * lookFactor
    }

    const onPointerLeave = () => {
      pos.tx = 0
      pos.ty = 0
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    document.documentElement.addEventListener('pointerleave', onPointerLeave)

    return () => {
      if (animFrame) cancelAnimationFrame(animFrame)
      observer.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pointermove', onPointerMove)
      document.documentElement.removeEventListener('pointerleave', onPointerLeave)
    }
  }, [isAwake, eyeGeo.h, eyeGeo.w, eyeGeo.r])

  // Poke handler with speech animation
  const handlePoke = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsPoked(true)
    setTimeout(() => setIsPoked(false), 200)

    if (onClick) {
      onClick()
    }

    if (!showSpeechOnPoke || pixelSize < 34) return

    const cur = ++speechCounterRef.current
    const available = POKE_MESSAGES.map((_, i) => i).filter((i) => i !== lastMsgIndexRef.current)
    const nextIdx = available[Math.floor(Math.random() * available.length)]
    lastMsgIndexRef.current = nextIdx
    const fullMsg = POKE_MESSAGES[nextIdx]

    setSpeechTint(SPEECH_TINTS[Math.floor(Math.random() * SPEECH_TINTS.length)])
    setSpeechText('')
    setIsSpeaking(true)

    // Typewriter effect
    for (let i = 1; i <= fullMsg.length; i++) {
      await new Promise((r) => setTimeout(r, 26 + Math.random() * 20))
      if (cur !== speechCounterRef.current) return
      setSpeechText(fullMsg.slice(0, i))
    }

    await new Promise((r) => setTimeout(r, 2200))
    if (cur === speechCounterRef.current) {
      setIsSpeaking(false)
    }
  }

  const pathD = SHAPES[shape] ?? SHAPES.Cube

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative inline-flex items-center justify-center select-none flex-shrink-0 rounded-full',
        onClick && 'cursor-pointer',
        className
      )}
      style={{
        width: `${pixelSize}px`,
        height: `${pixelSize}px`,
      }}
      onClick={handlePoke}
    >
      <svg
        viewBox="0 0 100 100"
        className={cn(
          'w-full h-full overflow-visible transition-transform duration-200 ease-out',
          isPoked ? 'scale-90' : 'hover:scale-105 active:scale-95'
        )}
      >
        <defs>
          <clipPath id={clipId}>
            <path d={pathD} />
          </clipPath>
        </defs>

        {/* Squircle Body with Light/Dark Bencho Styling */}
        <path
          d={pathD}
          className="transition-colors duration-300"
          fill={isDarkMode ? '#1e1f23' : '#ffffff'}
          stroke={isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)'}
          strokeWidth="1.5"
          style={{
            filter: isDarkMode
              ? 'drop-shadow(0 2px 8px rgba(0,0,0,0.45))'
              : 'drop-shadow(0 2px 6px rgba(0,0,0,0.06))',
          }}
        />

        {/* Eyes within clipPath */}
        <g clipPath={`url(#${clipId})`}>
          {/* Left Eye */}
          <g ref={eyeLeftGroupRef} transform="translate(40.50 50.00)">
            <rect
              fill={isDarkMode ? '#ffffff' : '#17181a'}
              x={-eyeGeo.w / 2}
              y={-eyeGeo.h / 2}
              width={eyeGeo.w}
              height={eyeGeo.h}
              rx={eyeGeo.r}
              className="transition-colors duration-300"
            />
          </g>

          {/* Right Eye */}
          <g ref={eyeRightGroupRef} transform="translate(59.50 50.00)">
            <rect
              fill={isDarkMode ? '#ffffff' : '#17181a'}
              x={-eyeGeo.w / 2}
              y={-eyeGeo.h / 2}
              width={eyeGeo.w}
              height={eyeGeo.h}
              rx={eyeGeo.r}
              className="transition-colors duration-300"
            />
          </g>
        </g>
      </svg>

      {/* Bencho Speech Bubble Pill */}
      {showSpeechOnPoke && pixelSize >= 34 && (
        <span
          className={cn(
            'absolute left-[92%] top-[10%] whitespace-nowrap z-50 pointer-events-none text-xs font-normal',
            'px-3 py-1.5 rounded-2xl flex items-center gap-1.5 shadow-lg border transition-all duration-200',
            isDarkMode
              ? 'bg-[#18191c] text-[#fbfbfa] border-white/10'
              : 'bg-white text-[#17181a] border-black/10',
            isSpeaking ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-90 -translate-y-1'
          )}
          style={{
            transformOrigin: '0% 50%',
          }}
          aria-live="polite"
        >
          <span>{speechText}</span>
          <span className="w-1 h-3 rounded-full bg-current animate-pulse opacity-70" />
        </span>
      )}
    </div>
  )
}
