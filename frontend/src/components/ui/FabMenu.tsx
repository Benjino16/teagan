import { clsx } from 'clsx'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { Fab } from './Fab'

export interface FabMenuItem {
  label: string
  icon: LucideIcon
  /** Without an action the item is visible but disabled. */
  onSelect?: () => void
}

interface Props {
  /** Label of the closed button, e.g. “Add entry”. */
  label: string
  items: readonly FabMenuItem[]
  className?: string
}

/** Add button that opens a right-aligned menu above it. */
export function FabMenu({ label, items, className }: Props) {
  const [open, setOpen] = useState(false)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <>
      {open && <div aria-hidden="true" className="fixed inset-0 bg-scrim" onClick={() => setOpen(false)} />}
      <div className={clsx('flex flex-col items-end gap-4', className)}>
        {open && (
          <ul id={menuId} aria-label={label} className="flex flex-col items-end gap-2.5">
            {items.map(({ label: itemLabel, icon: Icon, onSelect }) => (
              <li key={itemLabel}>
                <button
                  type="button"
                  disabled={!onSelect}
                  onClick={() => {
                    setOpen(false)
                    onSelect?.()
                  }}
                  className={clsx(
                    'flex min-h-11 items-center gap-2.5 rounded-full bg-surface py-2 pr-4.5 pl-3.5 text-base font-semibold text-ink shadow-fab',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                    'disabled:text-faint',
                  )}
                >
                  <Icon aria-hidden="true" size={18} />
                  {itemLabel}
                </button>
              </li>
            ))}
          </ul>
        )}
        <Fab
          open={open}
          aria-label={open ? 'Close menu' : label}
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          onClick={() => setOpen(!open)}
        />
      </div>
    </>
  )
}
