import { Link } from 'react-router'
import { cardStyles, IconBadge, MediaRow } from '../../components/ui'
import { isOngoing } from '../../domain/activities'
import { daysBetween, formatDateRange, formatRelativeFuture, formatSince, normalizeStart } from '../../domain/dates'
import type { Activity, IsoDate } from '../../domain/model'
import { activityIcon, ReminderIcon } from '../../icons/activityIcons'

interface Props {
  activity: Activity
  today: IsoDate
  /** Other participants without “with”, e.g. `Lena and Jonas` (from `participantsText`). */
  participants?: string | null
}

/**
 * Card for a future activity (“Oct 17–24 · in 4 days”, bell when a reminder is set)
 * or an ongoing range (“Sep 8 – Dec 15 · ongoing for 5 weeks”).
 */
export function UpcomingActivityCard({ activity, today, participants }: Props) {
  const start = normalizeStart(activity.startDate)
  const relative = isOngoing(activity, today)
    ? `ongoing ${formatSince(daysBetween(start, today))}`
    : formatRelativeFuture(daysBetween(today, start))
  return (
    <Link to={`/activities/${activity.id}`} className={`${cardStyles()} block no-underline hover:bg-canvas`}>
      <MediaRow
        leading={<IconBadge icon={activityIcon(activity.icon).Icon} />}
        title={activity.name}
        subtitle={`${formatDateRange(activity.startDate, activity.endDate)} · ${relative}`}
        trailing={
          activity.reminder && (
            <span role="img" aria-label="Reminder on" className="flex flex-none text-accent">
              <ReminderIcon aria-hidden="true" size={18} />
            </span>
          )
        }
      >
        {participants && <span className="text-sm text-muted">with {participants}</span>}
      </MediaRow>
    </Link>
  )
}
