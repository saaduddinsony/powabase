import React, { useRef } from 'react'
import {
  copilotPhysicsActions,
  useCopilotPhysicsSnapshot,
} from '@/state/copilot-physics-state'
import { InteractiveCopilotAvatar } from './InteractiveCopilotAvatar'

export const CopilotAvatarSlot = () => {
  const snap = useCopilotPhysicsSnapshot()
  const slotRef = useRef<HTMLDivElement>(null)

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only primary mouse button or touch/pen
    if (e.button !== 0 && e.pointerType === 'mouse') return
    e.preventDefault()
    e.stopPropagation()

    const slotEl = slotRef.current
    if (!slotEl) return

    const rect = slotEl.getBoundingClientRect()
    // Immediately detach and enter dragging mode right from the first press
    copilotPhysicsActions.detach(rect, e.clientX, e.clientY)

    let lastX = e.clientX
    let lastY = e.clientY
    let lastTime = performance.now()
    const velocitySamples: { vx: number; vy: number }[] = []

    const onPointerMove = (moveEvt: PointerEvent) => {
      const now = performance.now()
      const dt = Math.max(1, now - lastTime)
      const vx = ((moveEvt.clientX - lastX) / dt) * 16.67
      const vy = ((moveEvt.clientY - lastY) / dt) * 16.67
      velocitySamples.push({ vx, vy })
      if (velocitySamples.length > 5) velocitySamples.shift()

      lastX = moveEvt.clientX
      lastY = moveEvt.clientY
      lastTime = now

      copilotPhysicsActions.updateDrag(moveEvt.clientX, moveEvt.clientY, vx, vy)
    }

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)

      let avgVx = 0
      let avgVy = 0
      if (velocitySamples.length > 0) {
        avgVx = velocitySamples.reduce((acc, s) => acc + s.vx, 0) / velocitySamples.length
        avgVy = velocitySamples.reduce((acc, s) => acc + s.vy, 0) / velocitySamples.length
      }

      copilotPhysicsActions.dropBall(avgVx, avgVy)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp, { once: true })
  }

  if (snap.isDetached) {
    return (
      <button
        type="button"
        onClick={() => copilotPhysicsActions.returnHome()}
        title="Copilot is out exploring! Click to recall back into chat."
        className="w-[26px] h-[26px] rounded-full border border-dashed border-brand-500/60 bg-brand-500/10 flex items-center justify-center text-brand-600 dark:text-brand-400 hover:bg-brand-500/20 transition group select-none"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500" />
        </span>
      </button>
    )
  }

  return (
    <div
      ref={slotRef}
      onPointerDown={handlePointerDown}
      title="Click & drag me directly out onto your screen! 🎾"
      className="cursor-grab active:cursor-grabbing hover:scale-105 transition-transform inline-flex items-center justify-center rounded-full select-none"
    >
      <InteractiveCopilotAvatar
        size="small"
        shape="Circle"
        eyes="Slant"
        isAwake={true}
        showSpeechOnPoke={false}
      />
    </div>
  )
}
