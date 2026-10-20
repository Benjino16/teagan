import { PageHeader } from '../components/layout/PageHeader'
import { PeopleList } from '../features/people/PeopleList'

/** Everyone, see `PeopleList`. On large screens the list sits beside a person instead, see `PersonPagesLayout`. */
export function PeoplePage() {
  return (
    <>
      <PageHeader title="People" />
      <div className="flex flex-col gap-6 px-5 pt-5">
        <PeopleList />
      </div>
    </>
  )
}
