import React, { useRef } from 'react'
import { Bot } from 'lucide-react'
import {
  copilotPhysicsActions,
  useCopilotPhysicsSnapshot,
} from '@/state/copilot-physics-state'
import { InteractiveCopilotAvatar } from './InteractiveCopilotAvatar'

export const CopilotAvatarSlot = () => {
  const snap = useCopilotPhysicsSnapshot()
  const slotRef = useRef<HTMLDivElement>(null)
  const isPointerDownRef = useRef(false)
  const startPosRef = useRef({ x: 0, y: 0 })

  const handlePointerDown = (e: React.PointerEvent) => {
    isPointerDownRef.current = true
    startPosRef.current = { x: e.clientX, y: e.clientY }

    const onPointerMove = (moveEvt: PointerEvent) => {
      if (!isPointerDownRef.current) return
      const dx = moveEvt.clientX - startPosRef.current.x
      const dy = moveEvt.clientY - startPosRef.current.y
      const dist = Math.hypot(dx, dy)

      // When moved more than 4px, detach into the physics overlay!
      if (dist > 4 && slotRef.current) {
        window.removeEventListener('pointermove', onPointerMove)
        window.removeEventListener('pointerup', onPointerUp)
        isPointerDownRef.current = false

        const rect = slotRef.current.getBoundingClientRect()
        copilotPhysicsActions.detach(rect, moveEvt.clientX, moveEvt.clientY)
      }
    }

    const onPointerUp = () => {
      isPointerDownRef.current = false
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  if (snap.isDetached) {
    return (
      <button
        ref={slotRef}
        type="button"
        onClick={() => copilotPhysicsActions.returnHome()}
        title="Copilot is out on your dashboard! Click to recall."
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
      title="Click and drag me out onto your dashboard! 🎾"
      className="cursor-grab active:cursor-grabbing hover:scale-105 transition-transform inline-flex items-center justify-center rounded-full"
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
