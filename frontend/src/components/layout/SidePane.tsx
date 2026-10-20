import { clsx } from 'clsx'
import type { ReactNode } from 'react'
import { ScrollColumn } from './ScrollColumn'
import { useBreakpoint } from './useBreakpoint'
import { TOP_BAR_HEIGHT } from './useInView'

interface Props {
  title: string
  /** Left of the page (with a divider on its right) or right of it. */
  side: 'start' | 'end'
  /** Button on the right of the header, e.g. to add an entry to the list. */
  action?: ReactNode
  children: ReactNode
}

/**
 * A column beside the page on wide screens that scrolls on its own.
 * Its header is as tall as the top bar, so `StickyBar`s inside stick right below it just like on a page.
 */
export function SidePane({ title, side, action, children }: Props) {
  return (
    <aside
      aria-label={title}
      className={clsx(
        'h-dvh w-pane flex-none overflow-y-auto overscroll-contain border-line',
        side === 'start' ? 'border-r' : 'border-l',
      )}
    >
      <header
        // + 1 px for the divider, like the top bar's
        style={{ height: TOP_BAR_HEIGHT + 1 }}
        className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-line bg-canvas/90 pr-3 pl-5 backdrop-blur-md"
      >
        <h2 className="truncate text-base font-semibold">{title}</h2>
        {action}
      </header>
      <div className="flex flex-col gap-6 px-5 pt-4 pb-28">{children}</div>
    </aside>
  )
}

/**
 * The page between optional side panes, all full height and each scrolling on its own – the window doesn't scroll,
 * so scrolling over one column never moves another.
 */
export function PaneLayout({ start, end, children }: { start?: ReactNode; end?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex">
      {start}
      <ScrollColumn>{children}</ScrollColumn>
      {end}
    </div>
  )
}

/**
 * A detail page: on wide screens in its own scroll column, with `pane` (e.g. its timeline) on the right.
 * On phones just the page – the pane's content has its own page there.
 */
export function PageWithPane({ pane, children }: { pane?: ReactNode; children: ReactNode }) {
  const wide = useBreakpoint('laptop')
  return wide ? <PaneLayout end={pane}>{children}</PaneLayout> : children
}
