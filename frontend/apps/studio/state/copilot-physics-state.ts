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

export interface PageTourConfig {
  pageKey: string
  pageName: string
  introMessage: string
  steps: TourStep[]
}

export const PAGE_TOURS: Record<string, PageTourConfig> = {
  overview: {
    pageKey: 'overview',
    pageName: 'Project Dashboard',
    introMessage: 'I landed on your Project Dashboard! Want a quick tour of your compute, infrastructure, and metrics?',
    steps: [
      {
        title: 'Primary Database & Compute',
        description:
          'Your managed Postgres instance with real-time compute metrics, dedicated ARM64 cores, and connection pools.',
        selector: '[data-tour="database-card"]',
        fallbackCoords: { xPercent: 0.52, yPercent: 0.38 },
      },
      {
        title: 'Infrastructure & System Health',
        description:
          'Monitor CPU usage, storage disk capacity, active branches, and automated point-in-time backups.',
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
          'Chat with your AI agent, execute actions, and use Gemini-style hands-free speech-to-text anytime.',
        selector: '[aria-label="Project Copilot"]',
        fallbackCoords: { xPercent: 0.78, yPercent: 0.6 },
      },
    ],
  },
  editor: {
    pageKey: 'editor',
    pageName: 'Table Editor',
    introMessage: 'I landed in your Table Editor! Want to explore how to view, edit, filter, and manage database records?',
    steps: [
      {
        title: 'Table Schema & Navigation',
        description:
          'Explore tables, schemas, views, and foreign key relations organized cleanly in the sidebar tree.',
        selector: 'nav',
        fallbackCoords: { xPercent: 0.18, yPercent: 0.35 },
      },
      {
        title: 'Interactive Data Grid',
        description:
          'View rows, double-click any cell to edit data inline, sort by columns, and filter records with custom SQL conditions.',
        selector: '[role="grid"]',
        fallbackCoords: { xPercent: 0.52, yPercent: 0.45 },
      },
      {
        title: 'Insert Records & Add Columns',
        description:
          'Add new rows or modify your Postgres schema with custom data types, constraints, and default values.',
        selector: 'button',
        fallbackCoords: { xPercent: 0.68, yPercent: 0.22 },
      },
      {
        title: 'Row Level Security (RLS)',
        description:
          'Ensure tables have RLS policies enabled so users can only access their authorized rows.',
        selector: '[aria-label="Project Copilot"]',
        fallbackCoords: { xPercent: 0.78, yPercent: 0.6 },
      },
    ],
  },
  sql: {
    pageKey: 'sql',
    pageName: 'SQL Editor',
    introMessage: 'I landed in the SQL Editor! Want to see how to run queries, inspect execution plans, and use AI?',
    steps: [
      {
        title: 'SQL Code Editor',
        description:
          'Write complex Postgres queries, triggers, and functions with autocompletion, formatting, and syntax highlighting.',
        selector: '.monaco-editor',
        fallbackCoords: { xPercent: 0.48, yPercent: 0.4 },
      },
      {
        title: 'Execute & Benchmark Results',
        description:
          'Run queries with Ctrl/Cmd + Enter to view tabular results, row counts, and instant millisecond execution timing.',
        selector: 'button',
        fallbackCoords: { xPercent: 0.6, yPercent: 0.2 },
      },
      {
        title: 'Pre-built Templates & Snippets',
        description:
          'Load battle-tested quickstarts for pgvector embeddings, auth helpers, RLS rules, and cron schedules.',
        selector: 'nav',
        fallbackCoords: { xPercent: 0.2, yPercent: 0.35 },
      },
      {
        title: 'AI SQL Assistant',
        description:
          'Ask Project Copilot to write, explain, optimize, or debug complex SQL queries directly in context.',
        selector: '[aria-label="Project Copilot"]',
        fallbackCoords: { xPercent: 0.78, yPercent: 0.6 },
      },
    ],
  },
  workflows: {
    pageKey: 'workflows',
    pageName: 'Workflows Canvas',
    introMessage: 'I landed on your Workflows Canvas! Want a tour on building visual event automations and AI pipelines?',
    steps: [
      {
        title: 'Visual Automation Canvas',
        description:
          'Connect event triggers, LLM processing nodes, custom code transformations, and database queries visually.',
        selector: '.react-flow',
        fallbackCoords: { xPercent: 0.5, yPercent: 0.45 },
      },
      {
        title: 'Triggers & Webhooks',
        description:
          'Fire workflows automatically on Postgres table changes, incoming HTTP webhooks, or scheduled crons.',
        selector: 'button',
        fallbackCoords: { xPercent: 0.25, yPercent: 0.25 },
      },
      {
        title: 'Live Runs & Debugging',
        description:
          'Inspect real-time execution payloads, replay past runs, and view node-by-node execution latencies.',
        selector: 'nav',
        fallbackCoords: { xPercent: 0.65, yPercent: 0.3 },
      },
      {
        title: 'Autonomous Agents Integration',
        description:
          'Assign autonomous AI agents as worker nodes to execute complex multi-step tasks in your pipelines.',
        selector: '[aria-label="Project Copilot"]',
        fallbackCoords: { xPercent: 0.78, yPercent: 0.6 },
      },
    ],
  },
  auth: {
    pageKey: 'auth',
    pageName: 'Authentication',
    introMessage: 'I landed in Auth! Want to see how to manage users, configure OAuth providers, and handle security?',
    steps: [
      {
        title: 'User Directory',
        description:
          'Search, create, invite, or delete users, and view their provider identities and MFA statuses.',
        selector: '[role="grid"]',
        fallbackCoords: { xPercent: 0.5, yPercent: 0.4 },
      },
      {
        title: 'Social OAuth & SSO',
        description:
          'Enable Google, GitHub, Apple, and SAML Enterprise SSO with one-click toggles and custom client IDs.',
        selector: 'nav',
        fallbackCoords: { xPercent: 0.22, yPercent: 0.3 },
      },
      {
        title: 'Row Level Security Policies',
        description:
          'Manage fine-grained security policies directly on your Postgres tables based on auth.uid() claims.',
        selector: '[aria-label="Project Copilot"]',
        fallbackCoords: { xPercent: 0.78, yPercent: 0.6 },
      },
    ],
  },
  storage: {
    pageKey: 'storage',
    pageName: 'Storage & Media',
    introMessage: 'I landed in Storage! Want to see how to manage buckets, file policies, and uploads?',
    steps: [
      {
        title: 'Storage Buckets',
        description:
          'Create public or private buckets with custom file size limits and allowed MIME types.',
        selector: 'nav',
        fallbackCoords: { xPercent: 0.22, yPercent: 0.3 },
      },
      {
        title: 'File Explorer & Uploads',
        description:
          'Upload media files, organize with virtual folders, and copy signed URLs for authorized client access.',
        selector: '[role="grid"]',
        fallbackCoords: { xPercent: 0.55, yPercent: 0.4 },
      },
      {
        title: 'Security Access Policies',
        description:
          'Lock down file downloads and uploads with Postgres SQL RLS rules.',
        selector: '[aria-label="Project Copilot"]',
        fallbackCoords: { xPercent: 0.78, yPercent: 0.6 },
      },
    ],
  },
  observability: {
    pageKey: 'observability',
    pageName: 'Observability & Logs',
    introMessage: 'I landed in Observability! Want to explore API request rates, Postgres performance, and logs?',
    steps: [
      {
        title: 'API Gateway Traffic',
        description:
          'Monitor incoming API throughput, status codes, latency percentiles, and error spikes in real time.',
        selector: '.grid',
        fallbackCoords: { xPercent: 0.5, yPercent: 0.35 },
      },
      {
        title: 'Database Query Insights',
        description:
          'Detect slow queries, inspect execution plans, analyze table locks, and optimize missing indexes.',
        selector: '[role="grid"]',
        fallbackCoords: { xPercent: 0.5, yPercent: 0.5 },
      },
      {
        title: 'Realtime Log Drains',
        description:
          'Stream structured logs to external monitoring tools like Datadog, Grafana, or Logflare.',
        selector: '[aria-label="Project Copilot"]',
        fallbackCoords: { xPercent: 0.78, yPercent: 0.6 },
      },
    ],
  },
  settings: {
    pageKey: 'settings',
    pageName: 'Project Settings',
    introMessage: 'I landed in Settings! Want to see where to find your API keys, connection strings, and secrets?',
    steps: [
      {
        title: 'API Keys & Endpoints',
        description:
          'Access your project endpoint URL, public `anon` key, and private `service_role` secret.',
        selector: '.border',
        fallbackCoords: { xPercent: 0.5, yPercent: 0.35 },
      },
      {
        title: 'Database Connection Pooling',
        description:
          'Grab direct Postgres connection strings, transaction pooler (port 6543), and session pooler (port 5432).',
        selector: '.border',
        fallbackCoords: { xPercent: 0.5, yPercent: 0.5 },
      },
      {
        title: 'AI Copilot Configurations',
        description:
          'Manage LLM model options, API keys, and autonomous agent capabilities.',
        selector: '[aria-label="Project Copilot"]',
        fallbackCoords: { xPercent: 0.78, yPercent: 0.6 },
      },
    ],
  },
}

export function resolvePageTour(pathname: string): PageTourConfig {
  const p = pathname.toLowerCase()
  if (p.includes('/editor')) return PAGE_TOURS.editor
  if (p.includes('/sql')) return PAGE_TOURS.sql
  if (p.includes('/workflows')) return PAGE_TOURS.workflows
  if (p.includes('/auth')) return PAGE_TOURS.auth
  if (p.includes('/storage')) return PAGE_TOURS.storage
  if (p.includes('/observability')) return PAGE_TOURS.observability
  if (p.includes('/settings')) return PAGE_TOURS.settings
  return PAGE_TOURS.overview
}

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
  currentTour: PageTourConfig
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
  currentTour: PAGE_TOURS.overview,
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
    // Resolve tour based on current URL path
    if (typeof window !== 'undefined') {
      copilotPhysicsState.currentTour = resolvePageTour(window.location.pathname)
    }
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

    if (typeof window !== 'undefined') {
      copilotPhysicsState.currentTour = resolvePageTour(window.location.pathname)
    }

    const tour = copilotPhysicsState.currentTour
    copilotPhysicsState.speechText = `Whoa, nice toss! 🎾 I landed in your ${tour.pageName} (on ${surfaceName}). Want a quick guided tour of what you can do here?`
    copilotPhysicsState.showSpeech = true
  },

  startTour() {
    if (typeof window !== 'undefined') {
      copilotPhysicsState.currentTour = resolvePageTour(window.location.pathname)
    }
    copilotPhysicsState.mode = 'tour'
    copilotPhysicsState.tourStep = 0
    const step = copilotPhysicsState.currentTour.steps[0]
    copilotPhysicsState.speechText = step ? step.description : 'Welcome to this page!'
    copilotPhysicsState.showSpeech = true
  },

  nextTourStep() {
    const steps = copilotPhysicsState.currentTour.steps
    const next = copilotPhysicsState.tourStep + 1
    if (next >= steps.length) {
      copilotPhysicsActions.returnHome()
      return
    }
    copilotPhysicsState.tourStep = next
    const step = steps[next]
    copilotPhysicsState.speechText = step ? step.description : ''
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
