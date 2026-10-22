import { clsx } from 'clsx'
import { Ellipsis } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { CheckBox } from './CheckBox'

interface Props {
  checked: boolean
  onToggle: () => void
  label: string
  meta?: ReactNode
  /** Optional edit target: shows a muted “⋯” button at the end of the row. */
  editTo?: string
  className?: string
}

const focusRing = 'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent'

/** Checkable row; the whole row (except the “⋯” button) is the touch target. */
export function CheckRow({ checked, onToggle, label, meta, editTo, className }: Props) {
  const toggle = (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className={clsx(
        'flex min-w-0 flex-auto items-start gap-3 py-3.5 pl-4 text-left',
        editTo ? 'pr-1' : 'w-full pr-4',
        focusRing,
        !editTo && className,
      )}
    >
      <CheckBox checked={checked} className="mt-px" />
      <Text checked={checked} label={label} meta={meta} />
    </button>
  )

  if (!editTo) return toggle

  return (
    <div className={clsx('flex w-full items-start', className)}>
      {toggle}
      <Link
        to={editTo}
        aria-label={`Edit “${label}”`}
        className={clsx(
          'mt-1.5 mr-1.5 flex size-11 flex-none items-center justify-center rounded-full text-faint hover:bg-hover hover:text-ink',
          focusRing,
        )}
      >
        <Ellipsis aria-hidden="true" size={20} />
      </Link>
    </div>
  )
}

function Text({ checked, label, meta }: { checked: boolean; label: string; meta?: ReactNode }) {
  return (
    <span className="flex min-w-0 flex-col gap-0.75">
      <span className={clsx('text-base leading-snug font-medium', checked ? 'text-faint line-through' : 'text-ink')}>
        {label}
      </span>
      {meta != null && <span className="text-xs text-muted">{meta}</span>}
    </span>
  )
}
