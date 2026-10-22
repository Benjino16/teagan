import { clsx } from 'clsx'
import type { ComponentPropsWithoutRef } from 'react'

/** Small accent text that acts like a link, e.g. to reveal or switch a form field. */
export function TextButton({ className, type = 'button', ...rest }: ComponentPropsWithoutRef<'button'>) {
  return (
    <button
      type={type}
      className={clsx(
        'min-h-11 rounded-tile px-2 text-left text-sm font-medium text-accent-ink hover:bg-accent-soft',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        className,
      )}
      {...rest}
    />
  )
}
