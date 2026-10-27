import React, { useEffect, useRef, useState } from 'react'
import { ArrowRight, Bot, Compass, RotateCcw, Sparkles, X } from 'lucide-react'
import { Button, cn } from 'ui'
import {
  copilotPhysicsActions,
  copilotPhysicsState,
  TOUR_STEPS,
  useCopilotPhysicsSnapshot,
} from '@/state/copilot-physics-state'
import { InteractiveCopilotAvatar } from './InteractiveCopilotAvatar'

const AVATAR_RADIUS = 20

export const CopilotPhysicsOverlay = () => {
  const snap = useCopilotPhysicsSnapshot()
  const overlayRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)
  const lastPointerRef = useRef({ x: 0, y: 0, time: 0 })
  const velocitySamplesRef = useRef<{ vx: number; vy: number }[]>([])

  // Squash scale spring
  const [squash, setSquash] = useState({ x: 1, y: 1 })

  // Tour spotlight target rect
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null)

  // 1. PHYSICS LOOP
  useEffect(() => {
    if (!snap.isDetached || snap.mode !== 'falling') return

    let animId: number
    let lastTime = performance.now()

    const stepPhysics = (now: number) => {
      const dt = Math.min(2.0, (now - lastTime) / 16.67)
      lastTime = now

      const current = copilotPhysicsState
      let nextX = current.x + current.vx * dt
      let nextY = current.y + current.vy * dt
      let nextVy = current.vy + 0.82 * dt // Gravity
      let nextVx = current.vx * 0.988 // Air resistance
      let nextRotV = current.rotV * 0.98
      let nextRotation = current.rotation + nextRotV * dt

      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const floorY = viewportHeight - AVATAR_RADIUS - 12

      // Wall bounce
      if (nextX - AVATAR_RADIUS < 8) {
        nextX = 8 + AVATAR_RADIUS
        nextVx = Math.abs(nextVx) * 0.7
        nextRotV = nextVy * 0.3
      } else if (nextX + AVATAR_RADIUS > viewportWidth - 8) {
        nextX = viewportWidth - 8 - AVATAR_RADIUS
        nextVx = -Math.abs(nextVx) * 0.7
        nextRotV = -nextVy * 0.3
      }

      // Check collisions against dashboard surface cards
      let hitSurface = false
      let surfaceLabel = 'Dashboard'

      // Collect candidate obstacles
      const obstacleElements = document.querySelectorAll<HTMLElement>(
        '[data-tour], [role="region"], .border.rounded-xl, .border.rounded-2xl'
      )

      obstacleElements.forEach((el) => {
        if (hitSurface) return
        const r = el.getBoundingClientRect()
        // If element is visible and large enough to be a card
        if (r.width > 120 && r.height > 60) {
          const isAboveCard =
            nextX >= r.left - 10 &&
            nextX <= r.right + 10 &&
            current.y + AVATAR_RADIUS <= r.top + 14 &&
            nextY + AVATAR_RADIUS >= r.top - 2

          if (isAboveCard && nextVy > 0) {
            hitSurface = true
            nextY = r.top - AVATAR_RADIUS
            nextVy = -nextVy * 0.62 // Elastic restitution
            nextVx = nextVx * 0.75 // Surface friction
            nextRotV = nextVx * 0.8
            surfaceLabel = el.getAttribute('aria-label') || 'Card'
          }
        }
      })

      // Floor bounce
      if (nextY >= floorY) {
        hitSurface = true
        nextY = floorY
        nextVy = -nextVy * 0.58
        nextVx = nextVx * 0.75
        nextRotV = nextVx * 0.8
        surfaceLabel = 'Bottom Dock'
      }

      // Squash & stretch on bounce
      if (hitSurface && Math.abs(nextVy) > 2) {
        setSquash({ x: 1.28, y: 0.72 })
        setTimeout(() => setSquash({ x: 1, y: 1 }), 140)
      }

      // Rest condition
      if (hitSurface && Math.abs(nextVy) < 1.2 && Math.abs(nextVx) < 0.7) {
        current.x = nextX
        current.y = nextY
        copilotPhysicsActions.landOnSurface(surfaceLabel)
        return
      }

      current.x = nextX
      current.y = nextY
      current.vx = nextVx
      current.vy = nextVy
      current.rotation = nextRotation
      current.rotV = nextRotV

      animId = requestAnimationFrame(stepPhysics)
    }

    animId = requestAnimationFrame(stepPhysics)
    return () => cancelAnimationFrame(animId)
  }, [snap.isDetached, snap.mode])

  // 2. TOUR AUTONOMOUS GUIDANCE
  useEffect(() => {
    if (!snap.isDetached || snap.mode !== 'tour') {
      setSpotlightRect(null)
      return
    }

    const currentStep = TOUR_STEPS[snap.tourStep] || TOUR_STEPS[0]
    let targetX = window.innerWidth * currentStep.fallbackCoords.xPercent
    let targetY = window.innerHeight * currentStep.fallbackCoords.yPercent

    if (currentStep.selector) {
      const el = document.querySelector(currentStep.selector)
      if (el) {
        const r = el.getBoundingClientRect()
        setSpotlightRect(r)
        // Position mascot floating just above / to the side of the target element
        targetX = Math.min(window.innerWidth - 80, Math.max(80, r.left + r.width / 2))
        targetY = Math.max(80, r.top - 45)
      } else {
        setSpotlightRect(null)
      }
    }

    let animId: number
    const glideToTarget = () => {
      const cur = copilotPhysicsState
      const dx = targetX - cur.x
      const dy = targetY - cur.y
      cur.x += dx * 0.09
      cur.y += dy * 0.09
      cur.rotation = dx * 0.15

      if (Math.hypot(dx, dy) > 1.5) {
        animId = requestAnimationFrame(glideToTarget)
      }
    }

    animId = requestAnimationFrame(glideToTarget)
    return () => cancelAnimationFrame(animId)
  }, [snap.isDetached, snap.mode, snap.tourStep])

  // 3. RETURNING TO HEADER SLOT ANIMATION
  useEffect(() => {
    if (!snap.isDetached || snap.mode !== 'returning' || !snap.slotRect) return

    let animId: number
    const targetX = snap.slotRect.left + snap.slotRect.width / 2
    const targetY = snap.slotRect.top + snap.slotRect.height / 2

    const flyHome = () => {
      const cur = copilotPhysicsState
      const dx = targetX - cur.x
      const dy = targetY - cur.y
      cur.x += dx * 0.14
      cur.y += dy * 0.14
      cur.rotation = dx * 0.2

      if (Math.hypot(dx, dy) < 4) {
        copilotPhysicsActions.finishReturn()
      } else {
        animId = requestAnimationFrame(flyHome)
      }
    }

    animId = requestAnimationFrame(flyHome)
    return () => cancelAnimationFrame(animId)
  }, [snap.isDetached, snap.mode, snap.slotRect])

  // POINTER DRAG & TOSS HANDLERS
  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation()
    e.preventDefault()
    isDraggingRef.current = true
    lastPointerRef.current = { x: e.clientX, y: e.clientY, time: performance.now() }
    velocitySamplesRef.current = []

    copilotPhysicsState.mode = 'dragging'
    copilotPhysicsState.showSpeech = false

    const onPointerMove = (moveEvt: PointerEvent) => {
      if (!isDraggingRef.current) return
      const now = performance.now()
      const dt = Math.max(1, now - lastPointerRef.current.time)
      const vx = ((moveEvt.clientX - lastPointerRef.current.x) / dt) * 16.67
      const vy = ((moveEvt.clientY - lastPointerRef.current.y) / dt) * 16.67

      velocitySamplesRef.current.push({ vx, vy })
      if (velocitySamplesRef.current.length > 5) velocitySamplesRef.current.shift()

      lastPointerRef.current = { x: moveEvt.clientX, y: moveEvt.clientY, time: now }
      copilotPhysicsActions.updateDrag(moveEvt.clientX, moveEvt.clientY, vx, vy)
    }

    const onPointerUp = () => {
      isDraggingRef.current = false
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)

      const samples = velocitySamplesRef.current
      let avgVx = 0
      let avgVy = 0
      if (samples.length > 0) {
        avgVx = samples.reduce((acc, s) => acc + s.vx, 0) / samples.length
        avgVy = samples.reduce((acc, s) => acc + s.vy, 0) / samples.length
      }

      copilotPhysicsActions.dropBall(avgVx, avgVy)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  if (!snap.isDetached) return null

  const isTour = snap.mode === 'tour'
  const isLanded = snap.mode === 'landed'
  const currentStep = TOUR_STEPS[snap.tourStep]

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 pointer-events-none z-[9999] select-none"
      aria-hidden="true"
    >
      {/* 1. TOUR SPOTLIGHT RING */}
      {isTour && spotlightRect && (
        <div
          className="absolute transition-all duration-300 rounded-2xl pointer-events-none border-2 border-brand-500 shadow-[0_0_40px_rgba(46,211,130,0.35)] ring-4 ring-brand-500/20 animate-pulse"
          style={{
            left: `${spotlightRect.left - 6}px`,
            top: `${spotlightRect.top - 6}px`,
            width: `${spotlightRect.width + 12}px`,
            height: `${spotlightRect.height + 12}px`,
          }}
        />
      )}

      {/* 2. THE FLOATING / FALLING AVATAR BALL */}
      <div
        className={cn(
          'absolute pointer-events-auto transition-transform cursor-grab active:cursor-grabbing',
          snap.mode === 'dragging' && 'scale-110 drop-shadow-2xl'
        )}
        style={{
          left: `${snap.x - AVATAR_RADIUS}px`,
          top: `${snap.y - AVATAR_RADIUS}px`,
          width: `${AVATAR_RADIUS * 2}px`,
          height: `${AVATAR_RADIUS * 2}px`,
          transform: `rotate(${snap.rotation}deg) scale(${squash.x}, ${squash.y})`,
          transition: snap.mode === 'falling' ? 'none' : 'transform 0.15s ease-out',
        }}
        onPointerDown={handlePointerDown}
      >
        {/* Dynamic 3D Spherical Shadow beneath the ball */}
        <div
          className={cn(
            'absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full blur-[3px] pointer-events-none transition-all duration-150',
            snap.mode === 'falling'
              ? 'w-6 h-1.5 bg-black/25'
              : snap.mode === 'dragging'
              ? 'w-10 h-3 bg-black/35 blur-md'
              : 'w-7 h-2 bg-black/40'
          )}
        />

        <InteractiveCopilotAvatar
          size={AVATAR_RADIUS * 2}
          shape="Circle"
          eyes="Slant"
          isAwake={true}
          showSpeechOnPoke={false}
        />
      </div>

      {/* 3. INTERACTIVE SPEECH DIALOGUE BUBBLE */}
      {snap.showSpeech && (
        <div
          className={cn(
            'absolute pointer-events-auto z-50 max-w-sm rounded-2xl p-4 shadow-2xl backdrop-blur-xl border transition-all duration-200 animate-in fade-in zoom-in-95',
            'bg-white/95 dark:bg-[#16171a]/95 text-foreground border-neutral-200/90 dark:border-neutral-800'
          )}
          style={{
            left: `${Math.min(window.innerWidth - 340, Math.max(20, snap.x - 140))}px`,
            top: `${Math.max(20, snap.y - 150)}px`,
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 dark:text-brand-400">
              <Sparkles size={14} />
              <span>{isTour ? currentStep.title : 'Socket Copilot'}</span>
            </div>
            <button
              type="button"
              onClick={() => copilotPhysicsActions.returnHome()}
              className="text-foreground-lighter hover:text-foreground p-0.5 rounded-lg hover:bg-surface-200 transition"
              title="Return to Copilot chat"
            >
              <X size={13} />
            </button>
          </div>

          {/* Body */}
          <p className="text-xs text-foreground leading-relaxed mb-3">{snap.speechText}</p>

          {/* Actions */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-default/50">
            {isLanded ? (
              <>
                <Button
                  type="default"
                  size="tiny"
                  icon={<Compass size={12} />}
                  onClick={() => copilotPhysicsActions.startTour()}
                >
                  Start Guided Tour
                </Button>
                <Button
                  type="text"
                  size="tiny"
                  icon={<RotateCcw size={12} />}
                  onClick={() => copilotPhysicsActions.returnHome()}
                >
                  Back to Chat
                </Button>
              </>
            ) : isTour ? (
              <>
                <span className="text-[10px] text-foreground-lighter font-medium">
                  Step {snap.tourStep + 1} of {TOUR_STEPS.length}
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="outline"
                    size="tiny"
                    onClick={() => copilotPhysicsActions.returnHome()}
                  >
                    Finish
                  </Button>
                  <Button
                    type="default"
                    size="tiny"
                    icon={<ArrowRight size={12} />}
                    onClick={() => copilotPhysicsActions.nextTourStep()}
                  >
                    {snap.tourStep + 1 === TOUR_STEPS.length ? 'Return Home' : 'Next'}
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
