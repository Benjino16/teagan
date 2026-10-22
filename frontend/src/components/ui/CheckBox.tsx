import { clsx } from 'clsx'
import { Check } from 'lucide-react'

/** The visual checkbox of a checkable row. Decorative – the row carries `role="checkbox"`. */
export function CheckBox({ checked, className }: { checked: boolean; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={clsx(
        'flex size-5.5 flex-none items-center justify-center rounded-check border-2 transition-colors',
        checked ? 'border-accent bg-accent text-on-accent' : 'border-control bg-surface',
        className,
      )}
    >
      {checked && <Check size={14} strokeWidth={3} />}
    </span>
  )
}
