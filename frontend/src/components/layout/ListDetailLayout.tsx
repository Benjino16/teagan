import type { ReactNode } from 'react'
import { Navigate, Outlet, useParams } from 'react-router'
import { PageLoading } from './PageStatus'
import { SidePane } from './SidePane'
import { useBreakpoint } from './useBreakpoint'

interface Props {
  /** Heading of the list column, e.g. “People”. */
  title: string
  list: ReactNode
  /** Button in the list's header – on large screens the list page with its add button is never shown. */
  action?: ReactNode
  /** What the list page opens on large screens: a path, `undefined` while it's not known yet, `null` = nothing to open. */
  initial: string | null | undefined
}

/**
 * Around a list page and its detail pages (routes with `:id`). On large screens the list stays on the left
 * and a detail page is open next to it – the list page itself opens `initial`. Elsewhere just the routes.
 * Detail pages scroll in their own column, see `PageWithPane`.
 */
export function ListDetailLayout({ title, list, action, initial }: Props) {
  const roomy = useBreakpoint('large')
  const { id } = useParams()
  const detailOpen = id !== undefined
  // Another entry is a new page, as when coming from the list on phones: no state (an open edit field,
  // scroll position of a side pane) carries over from the previous one.
  const page = <Outlet key={id} />

  if (!roomy || (!detailOpen && initial === null)) return page
  if (!detailOpen) return initial ? <Navigate to={initial} replace /> : <PageLoading />
  return (
    <div className="flex">
      <SidePane title={title} side="start" action={action}>
        {list}
      </SidePane>
      <div className="min-w-0 flex-auto">{page}</div>
    </div>
  )
}
