import { clsx } from 'clsx'
import type { ComponentPropsWithoutRef } from 'react'

type Props = ComponentPropsWithoutRef<'span'> & {
  /** Grey instead of accent, e.g. for something archived. */
  muted?: boolean
}

/** Small rounded label, e.g. for groups. */
export function Chip({ className, muted = false, ...rest }: Props) {
  return (
    <span
      className={clsx(
        'rounded-full px-2.5 py-1.5 text-sm font-medium',
        muted ? 'bg-subtle text-muted' : 'bg-accent-soft text-accent-strong',
        className,
      )}
      {...rest}
    />
  )
}
