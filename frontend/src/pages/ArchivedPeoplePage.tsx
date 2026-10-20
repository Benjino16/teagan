import { PageHeader } from '../components/layout/PageHeader'
import { PageError, PageLoading } from '../components/layout/PageStatus'
import { EmptyState } from '../components/ui'
import { usePeople } from '../data/queries'
import { isArchived } from '../domain/people'
import { PeopleByImpact } from '../features/people/PeopleByImpact'

/** Archived people, grouped by impact like the main list. */
export function ArchivedPeoplePage() {
  const people = usePeople()

  if (people.isPending) return <PageLoading />
  if (people.isError) return <PageError message="Couldn't load people." backTo="/people" />

  const archived = people.data.filter(isArchived)

  return (
    <>
      <PageHeader title="Archived people" backTo="/people" />
      <div className="flex flex-col gap-6 px-5 pt-5">
        {archived.length === 0 ? <EmptyState>No one archived.</EmptyState> : <PeopleByImpact people={archived} />}
      </div>
    </>
  )
}
