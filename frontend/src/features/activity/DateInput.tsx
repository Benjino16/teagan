import { useEffect, useId, useRef } from 'react'
import { inputStyles, TextButton, TextInput } from '../../components/ui'
import { changePrecision, type DateParts, type DatePrecision, MONTH_NAMES } from '../../domain/dates'

/** One step coarser or finer at a time: day ↔ month ↔ year. */
const SWITCHES: Record<DatePrecision, readonly { to: DatePrecision; label: string }[]> = {
  day: [{ to: 'month', label: 'Only know the month?' }],
  month: [
    { to: 'year', label: 'Only know the year?' },
    { to: 'day', label: 'Know the exact day?' },
  ],
  year: [{ to: 'month', label: 'Know the month?' }],
}

interface Props {
  label: string
  value: DateParts
  onChange: (value: DateParts) => void
  /** Offers the optional time next to the day (point events only). */
  withTime?: boolean
}

/**
 * Partial date: the exact day by default, small buttons below
 * switch to a coarser or finer precision.
 */
export function DateInput({ label, value, onChange, withTime = false }: Props) {
  const labelId = useId()
  const fields = useRef<HTMLDivElement>(null)
  // The pressed button disappears, so focus moves to the new fields
  const focusFields = useRef(false)
  useEffect(() => {
    if (!focusFields.current) return
    focusFields.current = false
    fields.current?.querySelector<HTMLElement>('input, select')?.focus()
  }, [value.precision])

  function switchTo(precision: DatePrecision) {
    focusFields.current = true
    onChange(changePrecision(value, precision))
  }

  const yearInput = (
    <TextInput
      aria-label={`${label}: year`}
      inputMode="numeric"
      maxLength={4}
      placeholder="Year"
      value={value.year}
      onChange={(e) => onChange({ ...value, year: e.target.value.replace(/\D/g, '') })}
    />
  )

  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-1.5">
      <span id={labelId} className="text-xs font-medium tracking-wide text-muted uppercase">
        {label}
      </span>
      <div ref={fields}>
        {value.precision === 'day' && !withTime && (
          <TextInput
            type="date"
            aria-label={`${label}: date`}
            value={value.day}
            onChange={(e) => onChange({ ...value, day: e.target.value })}
          />
        )}

        {value.precision === 'day' && withTime && (
          <div className="grid grid-cols-[1fr_8rem] gap-3">
            <TextInput
              type="date"
              aria-label={`${label}: date`}
              value={value.day}
              onChange={(e) => onChange({ ...value, day: e.target.value })}
            />
            <TextInput
              type="time"
              aria-label={`${label}: time (optional)`}
              value={value.time}
              onChange={(e) => onChange({ ...value, time: e.target.value })}
            />
          </div>
        )}

        {value.precision === 'month' && (
          <div className="grid grid-cols-[1fr_6rem] gap-3">
            <select
              aria-label={`${label}: month`}
              className={inputStyles}
              value={value.month}
              onChange={(e) => onChange({ ...value, month: Number(e.target.value) })}
            >
              {MONTH_NAMES.map((name, index) => (
                <option key={name} value={index + 1}>
                  {name}
                </option>
              ))}
            </select>
            {yearInput}
          </div>
        )}

        {value.precision === 'year' && <div className="w-24">{yearInput}</div>}
      </div>

      <div className="-ml-2 flex flex-wrap">
        {SWITCHES[value.precision].map(({ to, label: text }) => (
          <TextButton key={to} onClick={() => switchTo(to)}>
            {text}
          </TextButton>
        ))}
      </div>
    </div>
  )
}
