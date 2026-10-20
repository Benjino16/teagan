import { clsx } from 'clsx'

interface Props {
  /** Items left out while collapsed (see `usePreview`); nothing to show at 0. */
  hidden: number
  expanded: boolean
  onToggle: () => void
  /** `warm` inside the birthday box, where the accent blue would stick out. */
  tone?: 'accent' | 'warm'
  className?: string
}

const tones = {
  accent: 'text-accent hover:text-accent-strong focus-visible:outline-accent',
  warm: 'text-warm-sub hover:text-warm-text focus-visible:outline-warm-icon',
}

/** Text link below a shortened list: “+3 more”, once expanded “Show less”. */
export function ShowMore({ hidden, expanded, onToggle, tone = 'accent', className }: Props) {
  if (hidden === 0) return null
  return (
    <button
      type="button"
      aria-expanded={expanded}
      onClick={onToggle}
      className={clsx(
        'min-h-11 text-left text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2',
        tones[tone],
        className,
      )}
    >
      {expanded ? 'Show less' : `+${hidden} more`}
    </button>
  )
}
