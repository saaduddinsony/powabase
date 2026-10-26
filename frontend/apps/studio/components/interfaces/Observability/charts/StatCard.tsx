import { cn } from "ui"

// Small metric card used for the 5-card "health strip" at the top of
// each observability page. Tone maps to the severity of the number.

export type StatCardTone = "ok" | "warn" | "danger" | "neutral"

interface StatCardProps {
  label: string
  value: number | string | null | undefined
  tone?: StatCardTone
  hint?: string
  onClick?: () => void
  isLoading?: boolean
}

// Tailwind `red` / `amber` are remapped to Radix palettes in this repo's
// tailwind config, so named classes render muddy in dark mode. Use
// arbitrary hex (Tailwind canonical values) for the tone accents.
// See memory/project_tailwind_radix_remap.md.
const TONE_STYLES: Record<StatCardTone, { badge: string; value: string }> = {
  ok: {
    badge: "bg-surface-100 border-default hover:border-foreground-muted",
    value: "text-foreground",
  },
  warn: {
    badge: "bg-surface-100 border-amber-500/30 hover:border-amber-500/50",
    value: "text-amber-500",
  },
  danger: {
    badge: "bg-surface-100 border-destructive/30 hover:border-destructive/50",
    value: "text-destructive",
  },
  neutral: {
    badge: "bg-surface-100 border-default hover:border-foreground-muted",
    value: "text-foreground",
  },
}

export function StatCard({ label, value, tone = "neutral", hint, onClick, isLoading }: StatCardProps) {
  const styles = TONE_STYLES[tone]
  const displayValue = isLoading ? "…" : value ?? 0
  const interactive = !!onClick
  const Component = interactive ? "button" : "div"

  return (
    <Component
      type={interactive ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "flex flex-col gap-1 rounded-lg border border-default p-4 text-left transition-colors",
        styles.badge,
        interactive ? "hover:brightness-105 cursor-pointer" : "cursor-default",
      )}
      style={{ borderRadius: '8px' }}
    >
      <span className="text-xs uppercase tracking-wider text-foreground-muted">{label}</span>
      <span className={cn("text-2xl font-semibold tabular-nums", styles.value)}>{displayValue}</span>
      {hint && <span className="text-xs text-foreground-muted">{hint}</span>}
    </Component>
  )
}
