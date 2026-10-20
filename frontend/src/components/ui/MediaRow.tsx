import { clsx } from 'clsx'
import type { ReactNode } from 'react'

export type MediaRowTone = 'default' | 'warm' | 'alert' | 'inverted'

const titleTones: Record<MediaRowTone, string> = {
  default: 'text-ink',
  warm: 'text-warm-text',
  alert: 'text-alert-text',
  inverted: 'text-white',
}

const subtitleTones: Record<MediaRowTone, string> = {
  default: 'text-muted',
  warm: 'text-warm-sub',
  alert: 'text-alert-sub',
  inverted: 'text-on-accent-muted',
}

interface Props {
  leading?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  trailing?: ReactNode
  /** Additional content below the subtitle, e.g. a progress bar. */
  children?: ReactNode
  tone?: MediaRowTone
  className?: string
}

/** Base layout “icon · title/subtitle · trailing”, without its own surface. */
export function MediaRow({ leading, title, subtitle, trailing, children, tone = 'default', className }: Props) {
  return (
    <span className={clsx('flex w-full min-w-0 items-center gap-3', className)}>
      {leading}
      <span className="flex min-w-0 flex-auto flex-col gap-0.5">
        <span className={clsx('text-base font-semibold', titleTones[tone])}>{title}</span>
        {subtitle != null && <span className={clsx('text-sm', subtitleTones[tone])}>{subtitle}</span>}
        {children}
      </span>
      {trailing}
    </span>
  )
}
