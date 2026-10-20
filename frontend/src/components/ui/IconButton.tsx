import { clsx } from 'clsx'
import type { LucideIcon } from 'lucide-react'
import type { ComponentPropsWithoutRef } from 'react'

type Props = Omit<ComponentPropsWithoutRef<'button'>, 'children'> & {
  icon: LucideIcon
  /** Required, since the button has no visible text. */
  'aria-label': string
  iconSize?: number
}

/** Round icon button, 44 px touch target. */
export function IconButton({ icon: Icon, iconSize = 20, className, type = 'button', ...rest }: Props) {
  return (
    <button
      type={type}
      className={clsx(
        'flex size-11 flex-none items-center justify-center rounded-full border border-line bg-surface text-ink',
        'transition-colors hover:bg-canvas disabled:opacity-40',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        className,
      )}
      {...rest}
    >
      <Icon aria-hidden="true" size={iconSize} />
    </button>
  )
}
