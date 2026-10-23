import { SectionHeader, ShowMore, usePreview } from '../../components/ui'
import type { Activity, Id, IsoDate } from '../../domain/model'
import { companyText } from '../../domain/people'
import { UpcomingActivityCard } from '../activity/UpcomingActivityCard'
import { TODAY_PREVIEW } from './preview'

interface Props {
  activities: Activity[]
  selfId: Id
  nameOf: (id: Id) => string
  groupNameOf: (groupId: Id) => string
  today: IsoDate
}

/** “Ongoing” on Today: ranges with others or a group that are running right now. */
export function OngoingFeed({ activities, selfId, nameOf, groupNameOf, today }: Props) {
  const preview = usePreview(activities, TODAY_PREVIEW)
  if (activities.length === 0) return null

  return (
    <section aria-labelledby="today-ongoing" className="flex flex-col gap-2.5">
      <SectionHeader id="today-ongoing" title="Ongoing" />
      {preview.shown.map((activity) => (
        <UpcomingActivityCard
          key={activity.id}
          activity={activity}
          today={today}
          company={companyText(activity, { selfId, nameOf, groupNameOf })}
        />
      ))}
      <ShowMore hidden={preview.hidden} expanded={preview.expanded} onToggle={preview.toggle} className="px-1" />
    </section>
  )
}
