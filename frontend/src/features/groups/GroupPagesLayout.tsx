import { Plus } from 'lucide-react'
import { useNavigate } from 'react-router'
import { ListDetailLayout } from '../../components/layout/ListDetailLayout'
import { IconButton } from '../../components/ui'
import { splitByArchived } from '../../domain/groups'
import { GroupList } from './GroupList'
import { useGroupsData } from './useGroupsData'

/** Groups and the group pages – on large screens a group is open next to the list, by default the first one. */
export function GroupPagesLayout() {
  const groupsData = useGroupsData()
  const navigate = useNavigate()
  const first =
    groupsData.status === 'ready' ? (splitByArchived(groupsData.data.tree).active[0]?.node.group ?? null) : undefined
  // Without groups (or when they fail to load) the Groups page shows as on phones
  const initial = groupsData.status === 'error' ? null : first && `/groups/${first.id}`
  return (
    <ListDetailLayout
      title="Groups"
      list={<GroupList />}
      action={<IconButton icon={Plus} aria-label="New group" onClick={() => navigate('/groups/new')} />}
      initial={initial}
    />
  )
}
