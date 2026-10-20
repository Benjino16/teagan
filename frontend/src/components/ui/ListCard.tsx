import { clsx } from 'clsx'
import type { ComponentPropsWithoutRef } from 'react'

type Props = ComponentPropsWithoutRef<'ul'> & {
  variant?: 'default' | 'accent'
}

/** Card with rows and dividers. Children are `<li>`. */
export function ListCard({ variant = 'default', className, ...rest }: Props) {
  return (
    <ul
      className={clsx(
        'divide-y divide-divider overflow-hidden rounded-card border bg-surface',
        variant === 'accent' ? 'border-accent-line' : 'border-line',
        className,
      )}
      {...rest}
    />
  )
}

/** Padding of a list row – for `<div>`, `<button>` or `<a>`. */
export const listRowStyles = 'flex w-full items-center gap-3 px-4 py-3.5 text-left'
