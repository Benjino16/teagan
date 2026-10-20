import { clsx } from 'clsx'

interface Props {
  value: number
  max?: number
  /** Screen reader text, default “Impact N of 5”. */
  label?: string
  className?: string
}

/** Scale as dots (●●●○○), e.g. for impact. Reads as “Impact N of 5” for screen readers. */
export function ImpactDots({ value, max = 5, label, className }: Props) {
  return (
    <span role="img" aria-label={label ?? `Impact ${value} of ${max}`} className={clsx('flex items-center gap-1', className)}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={clsx('size-2 rounded-full', i < value ? 'bg-accent' : 'bg-subtle')} />
      ))}
    </span>
  )
}
