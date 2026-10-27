import { proxy, useSnapshot } from 'valtio'

export type CopilotPhysicsMode =
  | 'idle'
  | 'dragging'
  | 'falling'
  | 'landed'
  | 'tour'
  | 'returning'

export interface TourStep {
  title: string
  description: string
  selector?: string
  fallbackCoords: { xPercent: number; yPercent: number }
}

export const TOUR_STEPS: TourStep[] = [
  {
    title: 'Primary Database & Compute',
    description:
      'Here is your managed Postgres instance with real-time compute metrics, memory allocation, and connection pools.',
    selector: '[data-tour="database-card"]',
    fallbackCoords: { xPercent: 0.52, yPercent: 0.38 },
  },
  {
    title: 'Infrastructure & System Health',
    description:
      'Monitor CPU health, storage disk usage, active branches, and automated point-in-time backups.',
    selector: '[data-tour="metrics-card"]',
    fallbackCoords: { xPercent: 0.22, yPercent: 0.38 },
  },
  {
    title: 'Navigation & Studio Tools',
    description:
      'Quickly switch between Table Editor, SQL Studio, Realtime Inspector, and visual Workflow Automations.',
    selector: 'nav[role="navigation"]',
    fallbackCoords: { xPercent: 0.1, yPercent: 0.4 },
  },
  {
    title: 'Project Copilot with Hands-Free Voice',
    description:
      'Chat with your AI agent, run schema tools, and use Gemini-style hands-free speech-to-text anytime.',
    selector: '[aria-label="Project Copilot"]',
    fallbackCoords: { xPercent: 0.78, yPercent: 0.6 },
  },
]

export interface CopilotPhysicsState {
  isDetached: boolean
  mode: CopilotPhysicsMode
  x: number
  y: number
  vx: number
  vy: number
  rotation: number
  rotV: number
  squashX: number
  squashY: number
  slotRect: { left: number; top: number; width: number; height: number } | null
  tourStep: number
  speechText: string
  showSpeech: boolean
  isAwake: boolean
}

export const copilotPhysicsState = proxy<CopilotPhysicsState>({
  isDetached: false,
  mode: 'idle',
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  rotation: 0,
  rotV: 0,
  squashX: 1,
  squashY: 1,
  slotRect: null,
  tourStep: 0,
  speechText: '',
  showSpeech: false,
  isAwake: true,
})

export const useCopilotPhysicsSnapshot = () => useSnapshot(copilotPhysicsState)

export const copilotPhysicsActions = {
  detach(slotRect: DOMRect, clientX: number, clientY: number) {
    copilotPhysicsState.slotRect = {
      left: slotRect.left,
      top: slotRect.top,
      width: slotRect.width,
      height: slotRect.height,
    }
    copilotPhysicsState.x = clientX
    copilotPhysicsState.y = clientY
    copilotPhysicsState.vx = 0
    copilotPhysicsState.vy = 0
    copilotPhysicsState.rotation = 0
    copilotPhysicsState.rotV = 0
    copilotPhysicsState.squashX = 1.08
    copilotPhysicsState.squashY = 0.94
    copilotPhysicsState.isDetached = true
    copilotPhysicsState.mode = 'dragging'
    copilotPhysicsState.showSpeech = false
    copilotPhysicsState.tourStep = 0
  },

  updateDrag(clientX: number, clientY: number, vx: number, vy: number) {
    if (copilotPhysicsState.mode !== 'dragging') return
    copilotPhysicsState.x = clientX
    copilotPhysicsState.y = clientY
    copilotPhysicsState.vx = vx
    copilotPhysicsState.vy = vy
    copilotPhysicsState.rotation = Math.max(-25, Math.min(25, vx * 1.5))
  },

  dropBall(vx: number, vy: number) {
    if (copilotPhysicsState.mode !== 'dragging') return
    copilotPhysicsState.mode = 'falling'
    copilotPhysicsState.vx = Math.max(-22, Math.min(22, vx))
    copilotPhysicsState.vy = Math.max(-20, Math.min(24, vy))
    copilotPhysicsState.rotV = vx * 0.8
  },

  landOnSurface(surfaceName = 'Dashboard') {
    copilotPhysicsState.mode = 'landed'
    copilotPhysicsState.vx = 0
    copilotPhysicsState.vy = 0
    copilotPhysicsState.rotV = 0
    copilotPhysicsState.rotation = 0
    copilotPhysicsState.squashX = 1
    copilotPhysicsState.squashY = 1
    copilotPhysicsState.speechText = `Whoa, nice toss! 🎾 I landed on your ${surfaceName}. Want a quick tour of Powabase?`
    copilotPhysicsState.showSpeech = true
  },

  startTour() {
    copilotPhysicsState.mode = 'tour'
    copilotPhysicsState.tourStep = 0
    const step = TOUR_STEPS[0]
    copilotPhysicsState.speechText = step.description
    copilotPhysicsState.showSpeech = true
  },

  nextTourStep() {
    const next = copilotPhysicsState.tourStep + 1
    if (next >= TOUR_STEPS.length) {
      copilotPhysicsActions.returnHome()
      return
    }
    copilotPhysicsState.tourStep = next
    const step = TOUR_STEPS[next]
    copilotPhysicsState.speechText = step.description
    copilotPhysicsState.showSpeech = true
  },

  returnHome() {
    copilotPhysicsState.mode = 'returning'
    copilotPhysicsState.showSpeech = false
    copilotPhysicsState.speechText = ''
  },

  finishReturn() {
    copilotPhysicsState.isDetached = false
    copilotPhysicsState.mode = 'idle'
    copilotPhysicsState.showSpeech = false
    copilotPhysicsState.speechText = ''
  },
}
