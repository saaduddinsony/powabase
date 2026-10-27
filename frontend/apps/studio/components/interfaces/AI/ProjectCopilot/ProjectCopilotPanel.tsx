import { useParams } from 'common'
import {
  Brain,
  Play,
  RotateCcw,
  Sparkles,
  TriangleAlert,
  X,
  Bot,
  ArrowUp,
  Plus,
  Search,
  Database,
  Layers,
  Mic,
  MicOff,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Button, cn } from 'ui'
import { useSessionAccessTokenQuery } from '@/data/auth/session-access-token-query'
import {
  CopilotPaymentRequiredError,
  CopilotRequestFailedError,
  CopilotServiceUnavailableError,
  CopilotTurnInProgressError,
  hasAiAuth,
  projectCopilotApi,
  streamProjectCopilotChat,
  type ProjectCopilotMessage,
} from '@/lib/ai-api'
import { daysFromNow, dayWord } from '@/lib/credits/format'
import { useTrack } from '@/lib/telemetry/track'
import { getSequence } from '@/components/interfaces/AI/GuideBubbles/guide-sequences'
import { MarkdownText } from '@/components/interfaces/AI/Shared/MarkdownText'
import { guideEngineState } from '@/state/guide-engine-state'
import { SIDEBAR_KEYS } from '@/components/layouts/ProjectLayout/LayoutSidebar/LayoutSidebarProvider'
import { useSidebarManagerSnapshot } from '@/state/sidebar-manager-state'

import { docsNoticeCopy, isDocsNotice } from './docs-notice-copy'
import { looksLikeGuideLaunchClaim } from './launch-claim'
import { ProjectCopilotWelcomeBody } from './ProjectCopilotWelcome'
import { InteractiveCopilotAvatar } from './InteractiveCopilotAvatar'

/** Inline notice shown for a pre-stream turn failure (402/409/503/other). */
interface TurnNotice {
  kind: 'out_of_credits' | 'busy' | 'unavailable' | 'failed'
  message: string
}

function formatOutOfCreditsNotice(err: CopilotPaymentRequiredError): string {
  if (err.renews_at) {
    const dateOnly = err.renews_at.split('T')[0]
    const days = daysFromNow(err.renews_at)
    return days !== null
      ? `Out of credits. Resets on ${dateOnly} (in ${days} ${dayWord(days)}).`
      : `Out of credits. Resets on ${dateOnly}.`
  }
  return 'Out of credits.'
}

/**
 * The persistent Project Copilot chat panel (registered as a sidebar, so it
 * stays mounted across tab navigation).
 */
export const ProjectCopilotPanel = () => {
  const { ref } = useParams()
  const { data: token } = useSessionAccessTokenQuery()
  const { closeSidebar } = useSidebarManagerSnapshot()
  const track = useTrack()

  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ProjectCopilotMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [statusTool, setStatusTool] = useState<string>('')
  const [isResetting, setIsResetting] = useState(false)
  const [showToolsMenu, setShowToolsMenu] = useState(false)

  // Bootstrap (session get-or-create + history load)
  const [bootstrapError, setBootstrapError] = useState(false)
  const [retryTick, setRetryTick] = useState(0)
  const [docsNotice, setDocsNotice] = useState<string | null>(null)
  const [turnNotice, setTurnNotice] = useState<TurnNotice | null>(null)
  const [reasoning, setReasoning] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const mountedRef = useRef(true)
  const sawTriggerGuideRef = useRef(false)
  const sessionIdRef = useRef<string | null>(null)

  useEffect(() => {
    sessionIdRef.current = sessionId
  }, [sessionId])

  const prevRefRef = useRef<string | undefined>(undefined)

  // Ensure a session exists, then load its history. Compatible with both cloud & self-hosted
  useEffect(() => {
    let cancelled = false
    if (!hasAiAuth(token) || !ref) return
    if (prevRefRef.current !== undefined && prevRefRef.current !== ref) {
      abortRef.current?.abort()
      abortRef.current = null
      sessionIdRef.current = null
      setSessionId(null)
      setMessages([])
      setIsStreaming(false)
      setDocsNotice(null)
      setTurnNotice(null)
    }
    prevRefRef.current = ref
    setBootstrapError(false)
    ;(async () => {
      const authToken = token || ''
      const existing = await projectCopilotApi.getSession(authToken, ref)
      let sid = existing.session?.id ?? null
      if (!sid) {
        sid = (await projectCopilotApi.createSession(authToken, ref)).id
      }
      if (cancelled) return
      const { messages } = await projectCopilotApi.getMessages(authToken, ref, sid)
      if (cancelled) return
      setSessionId(sid)
      setMessages(messages)
    })().catch((err) => {
      if (cancelled) return
      console.error('[project-copilot] session bootstrap failed', err)
      setBootstrapError(true)
    })
    return () => {
      cancelled = true
    }
  }, [token, ref, retryTick])

  useEffect(
    () => () => {
      mountedRef.current = false
      abortRef.current?.abort()
    },
    []
  )

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, statusTool, reasoning])

  // =========================================================
  // Speech-to-Text (Web Speech API, Gemini-style hands-free)
  // =========================================================
  const [isListening, setIsListening] = useState(false)
  const [speechError, setSpeechError] = useState<string | null>(null)
  const recognitionRef = useRef<any>(null)
  const inputBaseRef = useRef<string>('')

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        // ignore
      }
      recognitionRef.current = null
    }
    setIsListening(false)
  }, [])

  const startListening = useCallback(() => {
    setSpeechError(null)
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setSpeechError('Speech recognition is not supported in this browser. Please use Chrome, Safari, or Edge.')
      return
    }

    try {
      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'en-US'

      // Prepend previous input if user already typed something
      inputBaseRef.current = input ? (input.endsWith(' ') ? input : `${input} `) : ''

      recognition.onstart = () => {
        setIsListening(true)
        setSpeechError(null)
      }

      recognition.onresult = (event: any) => {
        let interimTranscript = ''
        let finalTranscript = ''

        for (let i = 0; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + ' '
          } else {
            interimTranscript += event.results[i][0].transcript
          }
        }

        const combined = (finalTranscript + interimTranscript).trim()
        if (combined) {
          setInput(inputBaseRef.current + combined)
        }
      }

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error)
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setSpeechError('Microphone permission denied. Please allow microphone access.')
          setIsListening(false)
        } else if (event.error === 'no-speech') {
          // Allow pause
        } else {
          setIsListening(false)
        }
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognitionRef.current = recognition
      recognition.start()
    } catch (err) {
      console.error('Failed to start speech recognition:', err)
      setSpeechError('Could not initialize microphone.')
      setIsListening(false)
    }
  }, [input])

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }, [isListening, startListening, stopListening])

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch {
          // ignore
        }
      }
    }
  }, [])

  const handleReset = useCallback(async () => {
    stopListening()
    if (!hasAiAuth(token) || !ref || isResetting) return
    setIsResetting(true)
    abortRef.current?.abort()
    guideEngineState.finish()
    const current = sessionIdRef.current
    sessionIdRef.current = null
    setSessionId(null)
    setMessages([])
    setInput('')
    setStatusTool('')
    setReasoning('')
    setDocsNotice(null)
    setTurnNotice(null)
    setIsStreaming(false)
    try {
      const authToken = token || ''
      if (current) await projectCopilotApi.deleteSession(authToken, ref, current)
      const created = await projectCopilotApi.createSession(authToken, ref)
      if (!mountedRef.current) return
      sessionIdRef.current = created.id
      setSessionId(created.id)
    } catch (err) {
      if (mountedRef.current) {
        console.error('[project-copilot] reset failed', err)
        setBootstrapError(true)
      }
    } finally {
      if (mountedRef.current) setIsResetting(false)
    }
  }, [token, ref, isResetting, stopListening])

  const send = useCallback(
    async (text: string) => {
      stopListening()
      const message = text.trim()
      if (!message || isStreaming || !hasAiAuth(token) || !ref || !sessionId) return
      const turnSessionId = sessionId
      const authToken = token || ''

      setInput('')
      setIsStreaming(true)
      setStatusTool('')
      setReasoning('')
      setDocsNotice(null)
      setTurnNotice(null)
      setShowToolsMenu(false)
      sawTriggerGuideRef.current = false

      const optimisticUserId = `optimistic-${crypto.randomUUID()}`
      setMessages((prev) => [
        ...prev,
        {
          id: optimisticUserId,
          session_id: turnSessionId,
          role: 'user',
          content: message,
          guide_event: null,
          created_at: new Date().toISOString(),
        },
      ])

      const controller = new AbortController()
      abortRef.current = controller
      let threwMessage: string | null = null
      let completedContent: string | null = null

      try {
        await streamProjectCopilotChat(
          authToken,
          ref,
          turnSessionId,
          { message },
          (event) => {
            if (event.event === 'tool_call') {
              setStatusTool(
                event.tool_call.name === 'search_docs'
                  ? 'Searching the docs…'
                  : `Using ${event.tool_call.name}…`
              )
            } else if (event.event === 'reasoning_delta') {
              setReasoning((prev) => prev + event.delta)
            } else if (event.event === 'trigger_guide') {
              sawTriggerGuideRef.current = true
              if (mountedRef.current && sessionIdRef.current === turnSessionId) {
                const seq = getSequence(event.sequence_id)
                if (seq) {
                  guideEngineState.start(event.sequence_id, 'copilot')
                } else {
                  track('guide_launch_missing', {
                    sequence_id: event.sequence_id,
                    reason: 'unknown_sequence_id',
                    chatId: turnSessionId,
                  })
                }
              }
            } else if (event.event === 'notice') {
              if (
                isDocsNotice(event.kind) &&
                mountedRef.current &&
                sessionIdRef.current === turnSessionId
              ) {
                setDocsNotice(event.kind)
              }
            } else if (event.event === 'complete') {
              completedContent = event.content
            } else if (event.event === 'error') {
              threwMessage = event.error
            }
          },
          { signal: controller.signal }
        )
      } catch (err) {
        const stillCurrentAfterCatch = mountedRef.current && sessionIdRef.current === turnSessionId
        if ((err as Error).name === 'AbortError') {
          // Intentional cancel (unmount)
        } else if (
          err instanceof CopilotPaymentRequiredError ||
          err instanceof CopilotTurnInProgressError ||
          err instanceof CopilotServiceUnavailableError ||
          err instanceof CopilotRequestFailedError
        ) {
          if (stillCurrentAfterCatch) {
            if (err instanceof CopilotPaymentRequiredError) {
              setTurnNotice({
                kind: 'out_of_credits',
                message: formatOutOfCreditsNotice(err),
              })
            } else if (err instanceof CopilotTurnInProgressError) {
              setTurnNotice({
                kind: 'busy',
                message: 'A turn is already in progress. Please wait for it to finish.',
              })
            } else if (err instanceof CopilotServiceUnavailableError) {
              setTurnNotice({
                kind: 'unavailable',
                message: 'Copilot is temporarily unavailable. Please try again in a moment.',
              })
            } else {
              setTurnNotice({
                kind: 'failed',
                message: 'Could not send message. Please try again.',
              })
            }
          }
        } else {
          threwMessage = (err as Error).message || 'Request failed'
        }
      } finally {
        if (mountedRef.current) {
          setStatusTool('')
          setReasoning('')
          setIsStreaming(false)
        }
        abortRef.current = null

        // Reload persisted messages
        if (mountedRef.current && sessionIdRef.current === turnSessionId) {
          try {
            const { messages } = await projectCopilotApi.getMessages(authToken, ref, turnSessionId)
            if (mountedRef.current && sessionIdRef.current === turnSessionId) {
              setMessages(messages)
            }
          } catch {
            // Keep optimistic message
          }
        }
      }
    },
    [isStreaming, token, ref, sessionId, track]
  )

  return (
    <div className="flex flex-col h-full bg-studio" role="complementary" aria-label="Project Copilot">
      {/* Header with single InteractiveCopilotAvatar on top left */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-default flex-shrink-0">
        <div className="flex items-center gap-x-2.5">
          <InteractiveCopilotAvatar size="small" shape="Circle" eyes="Slant" isAwake={true} showSpeechOnPoke={true} />
          <h2 className="text-sm font-semibold text-foreground">Project Copilot</h2>
        </div>
        <div className="flex items-center gap-x-0.5">
          <Button
            type="text"
            size="tiny"
            className="px-1"
            onClick={handleReset}
            loading={isResetting}
            disabled={isResetting}
            aria-label="Start a new chat"
            icon={<RotateCcw size={15} />}
          />
          <Button
            type="text"
            size="tiny"
            className="px-1"
            onClick={() => closeSidebar(SIDEBAR_KEYS.PROJECT_COPILOT)}
            aria-label="Close copilot"
            icon={<X size={16} />}
          />
        </div>
      </div>

      <p className="px-4 py-1.5 text-xs text-foreground-lighter border-b border-default flex-shrink-0">
        Chats are visible to everyone in this project — don’t paste secrets or API keys.
      </p>

      {/* Main Chat Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-y-4">
        {bootstrapError && !sessionId && (
          <div
            className="self-start max-w-[95%] flex flex-col gap-y-2 rounded-md border border-warning-500 bg-warning-200 px-3 py-2.5"
            role="alert"
          >
            <div className="flex items-start gap-x-1.5">
              <TriangleAlert size={14} className="mt-0.5 flex-shrink-0 text-warning-600" />
              <p className="text-xs text-warning-600">
                Could not connect to Project Copilot. Check your connection or try again.
              </p>
            </div>
            <div className="self-end">
              <Button
                type="default"
                size="tiny"
                icon={<RotateCcw size={12} />}
                onClick={() => setRetryTick((t) => t + 1)}
              >
                Retry
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-y-4" aria-live="polite">
          {messages.length === 0 && !bootstrapError && (
            <ProjectCopilotWelcomeBody onPromptClick={(prompt) => void send(prompt)} />
          )}

          {messages.map((m) => {
            const seq =
              m.guide_event?.sequence_id !== undefined
                ? getSequence(m.guide_event.sequence_id)
                : undefined
            return (
              <div
                key={m.id}
                className={
                  m.role === 'user'
                    ? 'self-end max-w-[85%] bg-surface-300 rounded-2xl px-3.5 py-2.5 text-foreground shadow-2xs'
                    : 'self-start max-w-[95%]'
                }
              >
                {m.role === 'user' ? (
                  <p className="text-xs text-foreground whitespace-pre-wrap break-words leading-relaxed">
                    {m.content}
                  </p>
                ) : (
                  <div className="flex items-start gap-x-2.5">
                    <div className="w-5 h-5 rounded-md bg-foreground text-background flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                      <Bot size={11} />
                    </div>
                    <div className="flex-1">
                      <MarkdownText className="text-xs text-foreground leading-relaxed">{m.content}</MarkdownText>
                    </div>
                  </div>
                )}
                {seq && (
                  <Button
                    type="default"
                    size="tiny"
                    className="mt-2 ml-7"
                    icon={<Play size={12} />}
                    onClick={() => guideEngineState.start(seq.id, 'replay')}
                  >
                    Replay: {seq.title}
                  </Button>
                )}
              </div>
            )
          })}
        </div>

        {/* Streaming / Thinking status line */}
        {isStreaming && (
          <div className="self-start w-full flex flex-col gap-y-1.5" aria-live="off">
            {reasoning && (
              <div className="flex flex-col gap-y-1 rounded-xl border border-default bg-surface-100 px-3 py-2">
                <div className="flex items-center gap-x-1.5 text-xs font-medium text-foreground-lighter">
                  <Brain size={12} />
                  Thinking
                </div>
                <p className="text-xs text-foreground-light whitespace-pre-wrap break-words">
                  {reasoning}
                </p>
              </div>
            )}
            <div className="flex items-center gap-x-2">
              <Bot size={13} className="text-brand-500 animate-pulse" />
              <p className="text-xs text-foreground-lighter">{statusTool || 'Thinking…'}</p>
            </div>
          </div>
        )}

        {docsNotice && !isStreaming && (
          <div
            className="self-start max-w-[95%] flex items-start gap-x-1.5 rounded-xl border border-warning-500 bg-warning-200 px-3 py-2"
            role="status"
          >
            <TriangleAlert size={13} className="mt-0.5 flex-shrink-0 text-warning-600" />
            <p className="text-xs text-warning-600">{docsNoticeCopy(docsNotice)}</p>
          </div>
        )}

        {turnNotice && !isStreaming && (
          <div
            className="self-start max-w-[95%] flex items-start gap-x-1.5 rounded-xl border border-warning-500 bg-warning-200 px-3 py-2"
            role="status"
          >
            <TriangleAlert size={13} className="mt-0.5 flex-shrink-0 text-warning-600" />
            <p className="text-xs text-warning-600">{turnNotice.message}</p>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* ========================================================= */}
      {/* GEMINI-STYLE CHAT TRAY (User screenshot 2 inspired)       */}
      {/* ========================================================= */}
      <div className="p-3 border-t border-default/40 bg-surface-100/30 flex-shrink-0">
        <form
          className={cn(
            'relative rounded-[22px] border bg-white dark:bg-[#191a1d] shadow-[0_4px_20px_rgba(0,0,0,0.06)] transition-all p-2.5 space-y-2',
            isListening
              ? 'border-red-500/50 ring-2 ring-red-500/20'
              : 'border-neutral-200 dark:border-neutral-800 focus-within:ring-2 focus-within:ring-brand-500/25 focus-within:border-brand-500/80'
          )}
          onSubmit={(e) => {
            e.preventDefault()
            void send(input)
          }}
        >
          {/* Text input area */}
          <textarea
            aria-label="Message Project Copilot"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send(input)
              }
            }}
            rows={input.split('\n').length > 2 ? Math.min(5, input.split('\n').length) : 2}
            placeholder={
              isListening
                ? 'Listening… Speak whatever you like hands-free…'
                : sessionId
                ? 'Ask Copilot or type @ for tools…'
                : isResetting
                ? 'Connecting…'
                : 'Ask Copilot anything…'
            }
            className="w-full resize-none bg-transparent px-1.5 text-xs text-foreground placeholder:text-foreground-lighter/60 focus:outline-none leading-relaxed"
            disabled={isStreaming}
          />

          {/* Gemini-style Live Audio Wave / Listening Banner */}
          {isListening && (
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-[11px] animate-in fade-in duration-200">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              </span>
              <span className="font-medium tracking-tight">Listening hands-free… Speak now</span>
              {/* Animated audio equalizer wave */}
              <div className="flex items-center gap-0.5 ml-auto">
                <span className="w-0.5 h-2.5 bg-red-500 rounded-full animate-[pulse_0.5s_ease-in-out_infinite]" />
                <span className="w-0.5 h-4 bg-red-500 rounded-full animate-[pulse_0.7s_ease-in-out_infinite_0.1s]" />
                <span className="w-0.5 h-1.5 bg-red-500 rounded-full animate-[pulse_0.4s_ease-in-out_infinite_0.2s]" />
                <span className="w-0.5 h-3.5 bg-red-500 rounded-full animate-[pulse_0.6s_ease-in-out_infinite_0.3s]" />
                <span className="w-0.5 h-2 bg-red-500 rounded-full animate-[pulse_0.5s_ease-in-out_infinite_0.15s]" />
              </div>
            </div>
          )}

          {speechError && (
            <div className="px-2 py-1 rounded-lg bg-warning-200/60 border border-warning-400 text-warning-700 dark:text-warning-300 text-[10px]">
              {speechError}
            </div>
          )}

          {/* Bottom Controls Row inside Tray */}
          <div className="flex items-center justify-between pt-1">
            {/* Left: Tools popup button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowToolsMenu((v) => !v)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-200 hover:bg-surface-300 text-foreground-lighter hover:text-foreground text-[11px] font-medium transition shadow-2xs"
              >
                <Plus
                  size={12}
                  className={`transition-transform duration-150 ${showToolsMenu ? 'rotate-45' : ''}`}
                />
                <span>Tools</span>
              </button>

              {/* Gemini-style Tools popup */}
              {showToolsMenu && (
                <div className="absolute bottom-9 left-0 w-48 rounded-2xl bg-white dark:bg-[#1a1b1e] border border-neutral-200/90 dark:border-neutral-800 shadow-2xl p-1.5 z-30 space-y-0.5 animate-in fade-in duration-150 select-none">
                  <button
                    type="button"
                    onClick={() => {
                      setInput((prev) => (prev ? `${prev} @docs ` : '@docs '))
                      setShowToolsMenu(false)
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-foreground rounded-xl hover:bg-surface-200 transition text-left"
                  >
                    <Search size={13} className="text-brand-500" />
                    <span>Search Docs</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInput((prev) => (prev ? `${prev} @database ` : '@database '))
                      setShowToolsMenu(false)
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-foreground rounded-xl hover:bg-surface-200 transition text-left"
                  >
                    <Database size={13} className="text-emerald-500" />
                    <span>Query Database</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInput((prev) => (prev ? `${prev} @workflow ` : '@workflow '))
                      setShowToolsMenu(false)
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-foreground rounded-xl hover:bg-surface-200 transition text-left"
                  >
                    <Layers size={13} className="text-violet-500" />
                    <span>Workflow Canvas</span>
                  </button>
                </div>
              )}
            </div>

            {/* Right: Model Tag + Speech-to-Text Mic Button + Send Button */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-foreground-lighter px-2 py-0.5 rounded-full bg-surface-200/70 border border-default/40 font-medium select-none">
                Copilot Pro
              </span>

              {/* Gemini-inspired Speech-to-Text Microphone Button */}
              <button
                type="button"
                onClick={toggleListening}
                disabled={isStreaming}
                title={isListening ? 'Stop listening' : 'Speech to text (hands-free)'}
                aria-label={isListening ? 'Stop listening' : 'Speech to text (hands-free)'}
                className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center transition-all active:scale-95 shadow-xs',
                  isListening
                    ? 'bg-red-500 text-white shadow-red-500/30 animate-pulse'
                    : 'bg-surface-200 hover:bg-surface-300 text-foreground-lighter hover:text-foreground'
                )}
              >
                {isListening ? (
                  <MicOff size={14} strokeWidth={2} />
                ) : (
                  <Mic size={14} strokeWidth={2} />
                )}
              </button>

              <button
                type="submit"
                disabled={!input.trim() || isStreaming}
                aria-label="Send Message"
                className="w-7 h-7 rounded-full bg-foreground text-background hover:opacity-90 active:scale-95 flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed shadow-xs"
              >
                <ArrowUp size={14} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </form>

        <p className="text-[10px] text-foreground-lighter/70 text-center mt-2 select-none">
          Project Copilot is AI and can make mistakes. Verify critical actions.
        </p>
      </div>
    </div>
  )
}
