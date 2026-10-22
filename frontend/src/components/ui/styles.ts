import { clsx } from 'clsx'

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
