import { clsx } from 'clsx'

export interface Choice<T> {
  value: T
  label: string
}

interface Props<T> {
  label: string
  choices: readonly Choice<T>[]
  value: T
  onChange: (value: T) => void
  hint?: string
  className?: string
}

/** Single choice as pills (radio semantics). */
export function ChoiceGroup<T>({ label, choices, value, onChange, hint, className }: Props<T>) {
  return (
    <fieldset className={clsx('flex flex-col gap-1.5', className)}>
      <legend className="mb-1.5 text-xs font-medium tracking-wide text-muted uppercase">{label}</legend>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
        {choices.map((choice) => {
          const selected = Object.is(choice.value, value)
          return (
            <button
              key={choice.label}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(choice.value)}
              className={clsx(
                'min-h-11 rounded-full border px-4 text-md font-medium transition-colors',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                selected
                  ? 'border-accent bg-accent-soft text-accent-strong'
                  : 'border-line bg-surface text-ink-2 hover:bg-hover',
              )}
            >
              {choice.label}
            </button>
          )
        })}
      </div>
      {hint && <p className="text-sm text-muted">{hint}</p>}
    </fieldset>
  )
}
