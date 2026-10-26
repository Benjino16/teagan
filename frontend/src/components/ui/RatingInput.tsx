import { clsx } from 'clsx'
import type { KeyboardEvent } from 'react'

export interface RatingLevel {
  label: string
  description: string
}

interface Props {
  label: string
  /** Levels 1 to N, index 0 = level 1. */
  levels: readonly RatingLevel[]
  /** 0 = nothing chosen yet. */
  value: number
  onChange: (value: number) => void
  /** Classes of the filled dots, default the accent. */
  fill?: string
  /** Focuses the selected dot (the first while nothing is chosen) on mount. */
  autoFocus?: boolean
  className?: string
}

/**
 * Scale as tappable dots (●●●○○). Below it, name and explanation of the selected
 * level, so nobody has to know what a “3” means.
 */
export function RatingInput({
  label,
  levels,
  value,
  onChange,
  fill = 'border-accent bg-accent',
  autoFocus = false,
  className,
}: Props) {
  const current = levels[value - 1]
  // Keyboard users reach the group through the first dot while nothing is chosen
  const focusable = Math.max(1, value)

  function onKeyDown(event: KeyboardEvent) {
    const delta = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[event.key] ?? 0
    if (!delta) return
    event.preventDefault()
    const next = Math.min(levels.length, Math.max(1, value + delta))
    onChange(next)
    ;(event.currentTarget.parentElement?.children[next - 1] as HTMLElement | undefined)?.focus()
  }

  return (
    <fieldset className={clsx('flex flex-col gap-1.5', className)}>
      <legend className="mb-1.5 text-xs font-medium tracking-wide text-muted uppercase">{label}</legend>
      <div role="radiogroup" aria-label={label} className="-ml-2.5 flex">
        {levels.map((level, index) => {
          const step = index + 1
          return (
            <button
              key={step}
              type="button"
              role="radio"
              aria-checked={step === value}
              aria-label={`${step} – ${level.label}`}
              tabIndex={step === focusable ? 0 : -1}
              autoFocus={autoFocus && step === focusable}
              onClick={() => onChange(step)}
              onKeyDown={onKeyDown}
              className="flex size-11 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-accent"
            >
              <span
                aria-hidden="true"
                className={clsx(
                  'size-5 rounded-full border-2 transition-colors',
                  step <= value ? fill : 'border-control bg-surface',
                )}
              />
            </button>
          )
        })}
      </div>
      {current && (
        <p aria-live="polite" className="text-sm text-muted">
          <span className="font-semibold text-ink-2">{current.label}</span> · {current.description}
        </p>
      )}
    </fieldset>
  )
}
