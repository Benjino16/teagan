import { clsx } from 'clsx'
import type { ReactNode } from 'react'
import { TOP_BAR_HEIGHT } from './useInView'

/** Height of a `StickyBar` holding a 44 px input – the offset for bars that stick below it. */
export const STICKY_SEARCH_HEIGHT = 44 + 2 * 8

interface Props {
  children: ReactNode
  /** Extra offset in px, to stick below another sticky bar. */
  below?: number
  /** Bars further down sit beneath the ones above, so a bar pushed out by the next one slides under them. */
  layer?: 'top' | 'below'
  className?: string
}

/**
 * Sticks right below the top bar while the page scrolls, e.g. for a search field or a section header.
 * Inside a section it only sticks until the section ends, so the next section's bar takes its place.
 * Meant for the page's padded content column: it reaches to the screen edges so the list scrolls away beneath it.
 */
export function StickyBar({ children, below = 0, layer = 'top', className }: Props) {
  return (
    <div
      // + 1 px for the top bar's divider
      style={{ top: `calc(env(safe-area-inset-top) + ${TOP_BAR_HEIGHT + 1 + below}px)` }}
      className={clsx('sticky -mx-5 -my-2 bg-canvas px-5 py-2', layer === 'top' ? 'z-10' : 'z-5', className)}
    >
      {children}
    </div>
  )
}
