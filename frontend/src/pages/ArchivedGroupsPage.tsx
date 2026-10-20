import { PageHeader } from '../components/layout/PageHeader'
import { PageError, PageLoading } from '../components/layout/PageStatus'
import { EmptyState } from '../components/ui'
import { splitByArchived } from '../domain/groups'
import { GroupCard } from '../features/groups/GroupCard'
import { useGroupsData } from '../features/groups/useGroupsData'

/** Archived main groups with their subgroups, and archived subgroups of active ones on their own. */
export function ArchivedGroupsPage() {
  const groupsData = useGroupsData()

  if (groupsData.status === 'loading') return <PageLoading />
  if (groupsData.status === 'error') return <PageError message="Couldn't load groups." backTo="/groups" />

  const { tree, personById } = groupsData.data
  const { archived } = splitByArchived(tree)

  return (
    <>
      <PageHeader title="Archived groups" backTo="/groups" />
      <div className="flex flex-col gap-2.5 px-5 pt-5">
        {archived.length === 0 ? (
          <EmptyState>Nothing archived.</EmptyState>
        ) : (
          archived.map(({ node, parent }) => (
            <GroupCard key={node.group.id} node={node} parent={parent} personById={personById} />
          ))
        )}
      </div>
    </>
  )
}
