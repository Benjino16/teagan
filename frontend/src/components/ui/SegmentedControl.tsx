import { clsx } from 'clsx'
import type { KeyboardEvent } from 'react'

export interface Segment<T extends string> {
  value: T
  label: string
}

interface Props<T extends string> {
  segments: readonly Segment<T>[]
  value: T
  onChange: (value: T) => void
  'aria-label': string
  /** Prefix for `id`/`aria-controls` when the segments control tab panels. */
  idPrefix?: string
  className?: string
}

/** Segmented switch with tab semantics and arrow-key navigation. */
export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  idPrefix,
  className,
  'aria-label': ariaLabel,
}: Props<T>) {
  function onKeyDown(event: KeyboardEvent, index: number) {
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!delta) return
    event.preventDefault()
    const next = segments[(index + delta + segments.length) % segments.length]!
    onChange(next.value)
    document.getElementById(`${idPrefix ?? 'segment'}-tab-${next.value}`)?.focus()
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={clsx('grid gap-1 rounded-control bg-subtle p-1', className)}
      style={{ gridTemplateColumns: `repeat(${segments.length}, minmax(0, 1fr))` }}
    >
      {segments.map((segment, index) => {
        const selected = segment.value === value
        return (
          <button
            key={segment.value}
            id={`${idPrefix ?? 'segment'}-tab-${segment.value}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={idPrefix ? `${idPrefix}-panel-${segment.value}` : undefined}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(segment.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={clsx(
              'min-h-11 rounded-tile-sm text-md font-semibold transition-colors',
              'focus-visible:outline-2 focus-visible:outline-accent',
              selected ? 'bg-surface text-ink shadow-raised' : 'text-muted hover:text-ink',
            )}
          >
            {segment.label}
          </button>
        )
      })}
    </div>
  )
}
