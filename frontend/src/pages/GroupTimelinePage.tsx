import { useParams } from 'react-router'
import { PageError, PageLoading } from '../components/layout/PageStatus'
import { PageWithPane } from '../components/layout/SidePane'
import { TopBar } from '../components/layout/TopBar'
import { groupPath } from '../domain/groups'
import { GroupTimeline } from '../features/groups/GroupTimeline'
import { useGroupsData } from '../features/groups/useGroupsData'

/** A group's timeline, as a separate page. */
export function GroupTimelinePage() {
  const id = Number(useParams().id)
  const groupsData = useGroupsData()
  const backTo = `/groups/${id}`

  if (groupsData.status === 'ready' && !groupsData.data.groups.some((c) => c.id === id)) {
    return (
      <>
        <TopBar backTo="/groups" title="Timeline" />
        <PageError message="This group doesn't exist." backTo="/groups" />
      </>
    )
  }
  if (groupsData.status !== 'ready') {
    return (
      <>
        <TopBar backTo={backTo} title="Timeline" />
        {groupsData.status === 'loading' ? <PageLoading /> : <PageError message="Couldn't load data." backTo={backTo} />}
      </>
    )
  }

  const { groups, personById } = groupsData.data
  return (
    <PageWithPane>
      <TopBar backTo={backTo} title="Timeline" subtitle={groupPath(id, groups)} />
      <div className="mx-auto max-w-content px-5 pt-2">
        <GroupTimeline groupId={id} groups={groups} personById={personById} />
      </div>
    </PageWithPane>
  )
}
