import { clsx } from 'clsx'
import type { ReactNode } from 'react'

interface Props {
  checked: boolean
  onChange: (checked: boolean) => void
  label: ReactNode
  hint?: ReactNode
  disabled?: boolean
  className?: string
}

/** On/off row with a switch on the right; the whole row is the touch target. */
export function Switch({ checked, onChange, label, hint, disabled, className }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        'flex min-h-11 w-full items-center justify-between gap-4 text-left disabled:opacity-40',
        'rounded-tile-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        className,
      )}
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-base font-medium text-ink">{label}</span>
        {hint != null && <span className="text-sm text-muted">{hint}</span>}
      </span>
      <span
        aria-hidden="true"
        className={clsx(
          'relative h-7 w-12 flex-none rounded-full transition-colors',
          checked ? 'bg-accent' : 'bg-control',
        )}
      >
        <span
          className={clsx(
            'absolute top-0.5 left-0.5 size-6 rounded-full bg-knob shadow-raised transition-transform',
            checked && 'translate-x-5',
          )}
        />
      </span>
    </button>
  )
}
