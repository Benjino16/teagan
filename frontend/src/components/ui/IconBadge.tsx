import { clsx } from 'clsx'
import type { LucideIcon } from 'lucide-react'

export type IconBadgeSize = 28 | 32 | 36 | 40 | 44
export type IconBadgeTone = 'subtle' | 'canvas' | 'surface' | 'accent-soft' | 'accent' | 'on-warm' | 'on-alert'

const sizes: Record<IconBadgeSize, { box: string; icon: number; tile: string }> = {
  28: { box: 'size-7', icon: 14, tile: 'rounded-tile-sm' },
  32: { box: 'size-8', icon: 16, tile: 'rounded-tile-sm' },
  36: { box: 'size-9', icon: 18, tile: 'rounded-tile-sm' },
  40: { box: 'size-10', icon: 20, tile: 'rounded-tile' },
  44: { box: 'size-11', icon: 20, tile: 'rounded-tile' },
}

const tones: Record<IconBadgeTone, string> = {
  subtle: 'bg-subtle text-muted',
  canvas: 'bg-canvas text-ink-2',
  surface: 'bg-surface text-ink-2 border border-line',
  'accent-soft': 'bg-accent-soft text-accent-ink',
  accent: 'bg-accent text-on-accent',
  'on-warm': 'bg-surface text-warm-icon',
  'on-alert': 'bg-surface text-alert-icon',
}

interface Props {
  icon: LucideIcon
  size?: IconBadgeSize
  tone?: IconBadgeTone
  /** Circle (timeline, milestones) or rounded tile (cards). */
  shape?: 'circle' | 'tile'
  iconSize?: number
  className?: string
}

/** Icon in a colored circle or tile. Purely decorative (`aria-hidden`). */
export function IconBadge({ icon: Icon, size = 40, tone = 'accent-soft', shape = 'tile', iconSize, className }: Props) {
  const s = sizes[size]
  return (
    <span
      aria-hidden="true"
      className={clsx(
        'flex flex-none items-center justify-center',
        s.box,
        shape === 'circle' ? 'rounded-full' : s.tile,
        tones[tone],
        className,
      )}
    >
      <Icon size={iconSize ?? s.icon} strokeWidth={2} />
    </span>
  )
}
