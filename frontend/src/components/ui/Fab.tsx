import { clsx } from 'clsx'
import { Plus } from 'lucide-react'
import type { ComponentPropsWithoutRef } from 'react'

type Props = Omit<ComponentPropsWithoutRef<'button'>, 'children'> & {
  'aria-label': string
  /** Menu open: the plus rotates into a cross. */
  open?: boolean
}

/** Black round add button, 56 px. The caller handles positioning. */
export function Fab({ className, type = 'button', open = false, ...rest }: Props) {
  return (
    <button
      type={type}
      className={clsx(
        'flex size-14 items-center justify-center rounded-full bg-inverse text-on-inverse shadow-fab',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        className,
      )}
      {...rest}
    >
      <Plus
        aria-hidden="true"
        size={24}
        strokeWidth={2.2}
        className={clsx('transition-transform duration-200', open && 'rotate-45')}
      />
    </button>
  )
}
