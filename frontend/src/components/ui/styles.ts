import { clsx } from 'clsx'
import type { Mood } from '../../domain/model'

/*
 * Reusable class recipes for elements that should look like a building block
 * but are a different element (e.g. a link styled as a card).
 */

export type CardVariant = 'default' | 'accent' | 'filled' | 'warm' | 'alert' | 'dashed' | 'plain'
export type CardPadding = 'none' | 'sm' | 'md' | 'lg'

const cardVariants: Record<CardVariant, string> = {
  default: 'bg-surface border border-line text-ink',
  accent: 'bg-surface border border-accent-line text-ink',
  filled: 'bg-accent text-on-accent',
  warm: 'bg-warm-bg text-warm-text',
  alert: 'bg-alert-bg border border-alert-line text-alert-text',
  dashed: 'border-[1.5px] border-dashed border-accent-dash text-ink',
  plain: 'text-ink',
}

const cardPaddings: Record<CardPadding, string> = {
  none: '',
  sm: 'px-3.5 py-3',
  md: 'px-4 py-3.5',
  lg: 'p-4',
}

export interface CardStyleOptions {
  variant?: CardVariant
  padding?: CardPadding
  /** `sm` = 16 px for compact cards, otherwise 18 px. */
  radius?: 'md' | 'sm'
}

/** Classes of a card – also for buttons/links that look like a card. */
export function cardStyles({ variant = 'default', padding = 'md', radius = 'md' }: CardStyleOptions = {}): string {
  return clsx(
    cardVariants[variant],
    cardPaddings[padding],
    variant !== 'plain' && (radius === 'sm' ? 'rounded-card-sm' : 'rounded-card'),
  )
}

export type ButtonVariant = 'primary' | 'secondary' | 'ghost'

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-inverse text-on-inverse hover:bg-inverse-hover',
  secondary: 'bg-surface text-ink border border-line hover:bg-hover',
  ghost: 'text-accent-ink hover:bg-accent-soft',
}

export function buttonStyles(variant: ButtonVariant = 'primary', className?: string): string {
  return clsx(
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-card-sm px-5 text-base font-semibold',
    'transition-colors disabled:opacity-40',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
    buttonVariants[variant],
    className,
  )
}

export const inputStyles = clsx(
  'min-h-11 w-full rounded-tile border border-line bg-surface px-3.5 text-base text-ink',
  'placeholder:text-faint focus:border-accent focus:outline-2 focus:outline-accent-soft',
)

/**
 * Classes per mood – spelled out so Tailwind finds them. `ring` is muted towards
 * grey so it doesn't stand out too much. `tint` washes a light
 * card from the left. A filled accent card gets a `blend` towards the mood at
 * the bottom right (35 % keeps white text readable) and an `edge` – mixed into
 * the blue alone, red and violet would both turn purple.
 */
export const moodStyles: Record<Mood, { fill: string; input: string; ring: string; tint: string; edge: string; blend: string }> = {
  1: {
    fill: 'bg-mood-1',
    input: 'border-mood-1 bg-mood-1',
    ring: 'ring-[color:color-mix(in_oklab,var(--color-mood-1),var(--color-muted)_35%)]',
    tint: 'bg-linear-to-r from-mood-1/15 to-surface to-70%',
    edge: 'ring-2 ring-mood-1',
    blend: 'bg-linear-to-br from-accent from-40% to-[color-mix(in_oklab,var(--color-accent),var(--color-mood-1)_35%)]',
  },
  2: {
    fill: 'bg-mood-2',
    input: 'border-mood-2 bg-mood-2',
    ring: 'ring-[color:color-mix(in_oklab,var(--color-mood-2),var(--color-muted)_35%)]',
    tint: 'bg-linear-to-r from-mood-2/15 to-surface to-70%',
    edge: 'ring-2 ring-mood-2',
    blend: 'bg-linear-to-br from-accent from-40% to-[color-mix(in_oklab,var(--color-accent),var(--color-mood-2)_35%)]',
  },
  3: {
    fill: 'bg-mood-3',
    input: 'border-mood-3 bg-mood-3',
    ring: 'ring-[color:color-mix(in_oklab,var(--color-mood-3),var(--color-muted)_35%)]',
    tint: 'bg-linear-to-r from-mood-3/15 to-surface to-70%',
    edge: 'ring-2 ring-mood-3',
    blend: 'bg-linear-to-br from-accent from-40% to-[color-mix(in_oklab,var(--color-accent),var(--color-mood-3)_35%)]',
  },
  4: {
    fill: 'bg-mood-4',
    input: 'border-mood-4 bg-mood-4',
    ring: 'ring-[color:color-mix(in_oklab,var(--color-mood-4),var(--color-muted)_35%)]',
    tint: 'bg-linear-to-r from-mood-4/15 to-surface to-70%',
    edge: 'ring-2 ring-mood-4',
    blend: 'bg-linear-to-br from-accent from-40% to-[color-mix(in_oklab,var(--color-accent),var(--color-mood-4)_35%)]',
  },
  5: {
    fill: 'bg-mood-5',
    input: 'border-mood-5 bg-mood-5',
    ring: 'ring-[color:color-mix(in_oklab,var(--color-mood-5),var(--color-muted)_35%)]',
    tint: 'bg-linear-to-r from-mood-5/15 to-surface to-70%',
    edge: 'ring-2 ring-mood-5',
    blend: 'bg-linear-to-br from-accent from-40% to-[color-mix(in_oklab,var(--color-accent),var(--color-mood-5)_35%)]',
  },
}
