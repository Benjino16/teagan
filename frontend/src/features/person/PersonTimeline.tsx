import { effectiveImpact, participantNote } from '../../domain/activities'
import { participantsText } from '../../domain/people'
import { ActivityTimeline } from '../timeline/ActivityTimeline'
import type { PersonViewData } from './usePersonView'

/** The person's timeline, with the impact and notes for this person. */
export function PersonTimeline({ data }: { data: PersonViewData }) {
  const { person, self, nameOf, today } = data
  return (
    <ActivityTimeline
      activities={data.activities}
      impactOf={(activity) => effectiveImpact(activity, person.id)}
      details={(activity) => ({
        others: participantsText(activity, { viewedPersonId: person.id, selfId: self.id, nameOf }),
        note: participantNote(activity, person.id),
      })}
      today={today}
    />
  )
}
