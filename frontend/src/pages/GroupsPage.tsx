import { PageHeader } from '../components/layout/PageHeader'
import { GroupList } from '../features/groups/GroupList'

/** All groups, see `GroupList`. On large screens the list sits beside a group instead, see `GroupPagesLayout`. */
export function GroupsPage() {
  return (
    <>
      <PageHeader title="Groups" />
      <div className="px-5 pt-5">
        <GroupList />
      </div>
    </>
  )
}
