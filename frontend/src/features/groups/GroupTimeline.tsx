import { PageError, PageLoading } from '../../components/layout/PageStatus'
import { useActivitiesForGroup, useSelf } from '../../data/queries'
import { groupImpact, groupNote } from '../../domain/activities'
import type { Group, Id, Person } from '../../domain/model'
import { displayName, participantsText } from '../../domain/people'
import { getToday } from '../../domain/today'
import { ActivityTimeline } from '../timeline/ActivityTimeline'

interface Props {
  groupId: Id
  groups: Group[]
  personById: Map<Id, Person>
}

/** A group's timeline: its own and its subgroups' events, with the impact and notes for this group. */
export function GroupTimeline({ groupId, groups, personById }: Props) {
  const self = useSelf()
  const activities = useActivitiesForGroup(groupId)

  if (self.isError || activities.isError) return <PageError message="Couldn't load data." backTo={`/groups/${groupId}`} />
  if (!self.data || !activities.data) return <PageLoading />

  const selfId = self.data.id
  const nameOf = (personId: Id) => {
    const person = personById.get(personId)
    return person ? displayName(person) : 'Unknown'
  }

  return (
    <ActivityTimeline
      activities={activities.data}
      impactOf={(activity) => groupImpact(activity, groupId, groups)}
      details={(activity) => ({
        others: participantsText(activity, { selfId, nameOf }),
        note: groupNote(activity, groupId, groups),
      })}
      today={getToday()}
    />
  )
}
