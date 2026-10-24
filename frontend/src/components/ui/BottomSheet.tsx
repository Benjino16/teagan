import { clsx } from 'clsx'
import { X } from 'lucide-react'
import { type ReactNode, useEffect, useId, useRef } from 'react'
import { IconButton } from './IconButton'

interface Props {
  title: string
  onClose: () => void
  /** `tall` = fixed height for long lists, `fit` = as tall as the content. */
  size?: 'tall' | 'fit'
  children: ReactNode
}

/**
 * Overlay from the bottom as a modal `<dialog>` (focus trap, Escape closes).
 * “×”, Escape or a tap outside calls `onClose`. The content scrolls.
 * An element with `data-autofocus` gets focus on open (otherwise the “×”).
 */
export function BottomSheet({ title, onClose, size = 'tall', children }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const pressedOutside = useRef(false)

  // No close() on cleanup: that fires `onClose` (StrictMode would close the overlay right away).
  // When React removes the dialog, it ends anyway.
  useEffect(() => {
    const dialog = ref.current
    if (!dialog || dialog.open) return
    dialog.showModal()
    // React's `autoFocus` applies before showModal() and would be overridden.
    dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus()
  }, [])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      // Tapping the dimmed area closes – only if the press started there too: a drag from
      // inside (e.g. selecting text) ends with a click on the dialog itself
      onPointerDown={(event) => {
        pressedOutside.current = event.target === event.currentTarget
      }}
      onClick={(event) => event.target === event.currentTarget && pressedOutside.current && onClose()}
      className={clsx(
        'mx-auto mt-auto mb-0 max-h-[85dvh] w-full max-w-app rounded-t-card bg-surface p-0 text-ink',
        'backdrop:bg-scrim open:flex open:flex-col',
        size === 'tall' && 'h-[85dvh]',
      )}
    >
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <h2 id={titleId} className="flex-auto pl-1 font-display text-xl font-bold">
          {title}
        </h2>
        <IconButton icon={X} aria-label="Close" onClick={onClose} />
      </div>
      <div className="flex-auto overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),12px)]">{children}</div>
    </dialog>
  )
}
