import { Pencil } from 'lucide-react'
import type { ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router'
import { PageError, PageLoading } from '../../components/layout/PageStatus'
import { PageWithPane } from '../../components/layout/SidePane'
import { useListBeside } from '../../components/layout/useBreakpoint'
import { TopBar } from '../../components/layout/TopBar'
import { IconButton } from '../../components/ui'
import { displayName } from '../../domain/people'
import { getToday } from '../../domain/today'
import { type PersonViewData, usePersonView } from './usePersonView'

interface Props {
  /** Subpage, e.g. “Timeline”. Without = the person's overview. */
  section?: string
  /** On the overview, the name only appears once the large heading has scrolled away. */
  showTitle?: boolean
  children: (data: PersonViewData) => ReactNode
  /** Column to the right of the page on wide screens, e.g. a `SidePane`. */
  aside?: (data: PersonViewData) => ReactNode
}

/** Shared frame of the person pages: top bar, loading, errors. */
export function PersonPageFrame({ section, showTitle = true, children, aside }: Props) {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const view = usePersonView(id, getToday())
  // Large screens: the list of people is already beside the overview, nothing to go back to
  const listBeside = useListBeside()
  const backTo = section ? `/people/${id}` : listBeside ? undefined : '/people'

  if (view.status !== 'ready') {
    return (
      <>
        <TopBar backTo={backTo} title={section} />
        {view.status === 'loading' && <PageLoading />}
        {view.status === 'error' && <PageError message="Couldn't load data." backTo="/people" />}
        {view.status === 'not-found' && <PageError message="This person doesn't exist." backTo="/people" />}
      </>
    )
  }

  const { person } = view.data
  return (
    <PageWithPane pane={aside?.(view.data)}>
      <TopBar
        backTo={backTo}
        title={section ?? person.name}
        subtitle={section ? displayName(person) : undefined}
        showTitle={showTitle}
        trailing={
          section ? undefined : (
            <IconButton
              icon={Pencil}
              iconSize={18}
              aria-label="Edit person"
              onClick={() => navigate(`/people/${person.id}/edit`)}
            />
          )
        }
      />
      {/* Wide screens: a readable column; phones never reach this width */}
      <div className="mx-auto max-w-content">{children(view.data)}</div>
    </PageWithPane>
  )
}
