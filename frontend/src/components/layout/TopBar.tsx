import { clsx } from 'clsx'
import { ChevronLeft } from 'lucide-react'
import { type ReactNode, useEffect, useEffectEvent } from 'react'
import { useBack } from '../../app/useBack'
import { IconButton } from '../ui'
import { TOP_BAR_HEIGHT } from './useInView'
import { useScrolled } from './useScrolled'

interface Props {
  /** Shows a back button; target if there is no history. */
  backTo?: string
  title?: string
  subtitle?: string
  /** Hide the title while the page's large heading is still visible. */
  showTitle?: boolean
  /** Action on the right, e.g. edit. */
  trailing?: ReactNode
}

/** Sticky top bar of all pages. Gets a divider when scrolling. */
export function TopBar({ backTo, title, subtitle, showTitle = true, trailing }: Props) {
  const back = useBack(backTo ?? '/')
  const scrolled = useScrolled()

  // Escape goes back like the button. Whoever handles it first (a sheet, the add menu,
  // clearing a search) prevents the default; in a text field it only leaves the field.
  const onEscape = useEffectEvent((event: KeyboardEvent) => {
    if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) return
    if (document.querySelector('dialog[open]')) return
    const target = event.target
    if (target instanceof HTMLElement && target.matches('input, textarea, select, [contenteditable="true"]')) {
      target.blur()
      return
    }
    back()
  })

  useEffect(() => {
    if (!backTo) return
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [backTo])

  return (
    <header
      className={clsx(
        'sticky top-0 z-20 border-b bg-canvas/90 pt-[env(safe-area-inset-top)] backdrop-blur-md transition-colors',
        scrolled ? 'border-line' : 'border-transparent',
      )}
    >
      {/* Same side padding as the page, so the buttons line up with the content */}
      <div style={{ height: TOP_BAR_HEIGHT }} className="flex items-center gap-2 px-5">
        {backTo ? <IconButton icon={ChevronLeft} aria-label="Back" onClick={back} /> : <Spacer />}
        <div
          aria-hidden={!showTitle}
          className={clsx(
            'flex min-w-0 flex-auto flex-col items-center text-center transition-opacity duration-150',
            showTitle ? 'opacity-100' : 'opacity-0',
          )}
        >
          {title && <p className="w-full truncate text-base font-semibold">{title}</p>}
          {subtitle && <p className="w-full truncate text-xs text-muted">{subtitle}</p>}
        </div>
        {trailing ?? <Spacer />}
      </div>
    </header>
  )
}

function Spacer() {
  return <span aria-hidden="true" className="size-11 flex-none" />
}
