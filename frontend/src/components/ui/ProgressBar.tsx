import { clsx } from 'clsx'

interface Props {
  /** 0–1 */
  value: number
  tone?: 'accent' | 'alert'
  className?: string
}

/** Thin progress bar, purely visual (the content is in the text next to it). */
export function ProgressBar({ value, tone = 'accent', className }: Props) {
  const percent = Math.round(Math.min(Math.max(value, 0), 1) * 100)
  return (
    <div
      aria-hidden="true"
      className={clsx('h-1 overflow-hidden rounded-full', tone === 'alert' ? 'bg-alert-line' : 'bg-subtle', className)}
    >
      <div
        className={clsx('h-full rounded-full', tone === 'alert' ? 'bg-alert-bar' : 'bg-accent')}
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}
