import { type ReactNode, useLayoutEffect, useState } from 'react'
import { useLocation } from 'react-router'
import { ScrollRootContext } from './useScrollRoot'

/**
 * A full-height column that scrolls on its own instead of with the window, for layouts with side panes.
 * Top bar and sticky bars inside stick to its top. Starts at the top on every new page.
 */
export function ScrollColumn({ children }: { children: ReactNode }) {
  const [root, setRoot] = useState<HTMLElement | null>(null)
  const { pathname } = useLocation()

  useLayoutEffect(() => {
    root?.scrollTo(0, 0)
  }, [root, pathname])

  return (
    <div ref={setRoot} className="h-dvh min-w-0 flex-auto overflow-y-auto overscroll-contain">
      <ScrollRootContext value={root}>
        {/* Room for the add button in the corner */}
        <div className="pb-28">{children}</div>
      </ScrollRootContext>
    </div>
  )
}
