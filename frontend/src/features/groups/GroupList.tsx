import { PageError, PageLoading } from '../../components/layout/PageStatus'
import { ArchiveLink, EmptyState } from '../../components/ui'
import { splitByArchived } from '../../domain/groups'
import { GroupCard } from './GroupCard'
import { useGroupsData } from './useGroupsData'

/**
 * Active groups: one card per top-level group with its subgroups; a link at the bottom leads to the archived ones.
 * The Groups page on phones, a side column next to the open group on wide screens.
 */
export function GroupList() {
  const groupsData = useGroupsData()

  if (groupsData.status === 'loading') return <PageLoading />
  if (groupsData.status === 'error') return <PageError message="Couldn't load groups." />

  const { tree, personById } = groupsData.data
  const { active, archived } = splitByArchived(tree)

  return (
    <div className="flex flex-col gap-2.5">
      {active.length === 0 ? (
        <EmptyState>No groups yet.</EmptyState>
      ) : (
        active.map(({ node, archivedSubgroups }) => (
          <GroupCard key={node.group.id} node={node} archivedSubgroups={archivedSubgroups} personById={personById} />
        ))
      )}
      <ArchiveLink to="/groups/archived" count={archived.length} />
    </div>
  )
}
