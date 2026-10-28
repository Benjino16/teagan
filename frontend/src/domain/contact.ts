import { byStartAsc, byStartDesc, hasParticipant, isFuture } from './activities'
import { dayOf, daysBetween, formatRelativePast, formatRhythm, isFullDate, pluralize } from './dates'
import type { Activity, Id, IsoDate, Person } from './model'
import { isContactPaused } from './people'

/**
 * Contacts = activities with a full date, not in the future,
 * in which both you AND the person took part. Newest first.
 */
export function contacts(activities: Activity[], personId: Id, selfId: Id, today: IsoDate): Activity[] {
  return activities
    .filter(
      (a) =>
        isFullDate(dayOf(a.startDate)) &&
        dayOf(a.startDate) <= today &&
        hasParticipant(a, personId) &&
        hasParticipant(a, selfId),
    )
    .sort(byStartDesc)
}

export function lastContactDate(
  activities: Activity[],
  personId: Id,
  selfId: Id,
  today: IsoDate,
): IsoDate | null {
  const last = contacts(activities, personId, selfId, today)[0]
  return last ? dayOf(last.startDate) : null
}

/** “Last seen 3 weeks ago” */
export function lastSeenText(daysSince: number | null): string {
  return daysSince === null ? 'No contact logged yet' : `Last seen ${formatRelativePast(daysSince)}`
}

export interface ReconnectStatus {
  overdue: boolean
  /** Days left until the reconnect (negative = overdue), `null` = never in contact. */
  remaining: number | null
  /** Fraction 0–1 for the progress bar. */
  progress: number
  title: string
  subtitle: string
}

export function reconnectStatus(rhythmDays: number, daysSince: number | null): ReconnectStatus {
  const rhythm = formatRhythm(rhythmDays)

  if (daysSince === null) {
    return {
      overdue: true,
      remaining: null,
      progress: 1,
      title: 'Reconnect overdue',
      subtitle: `No contact yet · Goal: ${rhythm}`,
    }
  }

  const remaining = rhythmDays - daysSince
  const progress = Math.min(daysSince / rhythmDays, 1)

  if (remaining < 0) {
    const over = -remaining
    return {
      overdue: true,
      remaining,
      progress,
      title: 'Reconnect overdue',
      subtitle: `by ${pluralize(over, 'day')} · Goal: ${rhythm}`,
    }
  }

  const title =
    remaining === 0
      ? 'Time to reach out today'
      : remaining === 1
        ? 'Next reconnect tomorrow'
        : `Next reconnect in ${remaining} days`

  return {
    overdue: false,
    remaining,
    progress,
    title,
    subtitle: `Goal: ${rhythm}`,
  }
}

export function daysSinceContact(lastContact: IsoDate | null, today: IsoDate): number | null {
  return lastContact === null ? null : daysBetween(lastContact, today)
}

/** Reconnects on “Today”: overdue or at most this many days left. */
export const RECONNECT_WINDOW_DAYS = 7

/** A planned activity covers a reconnect if it is overdue by at most this share of the rhythm by then. */
const COVER_TOLERANCE = 1 / 3

/**
 * The next planned activity with you and the person that makes the reconnect unnecessary:
 * full date, and on that day overdue by at most a third of the rhythm. Already overdue or never
 * contacted counts as due today – meeting soon is all you can still do. `null` if there is none:
 * a vacation in four months doesn't cover a reconnect now.
 */
export function coveringActivity(
  activities: Activity[],
  personId: Id,
  selfId: Id,
  rhythmDays: number,
  daysSince: number | null,
  today: IsoDate,
): Activity | null {
  const remaining = daysSince === null ? 0 : Math.max(rhythmDays - daysSince, 0)
  const next = activities
    .filter(
      (a) =>
        isFullDate(dayOf(a.startDate)) && isFuture(a, today) && hasParticipant(a, personId) && hasParticipant(a, selfId),
    )
    .sort(byStartAsc)[0]
  if (!next) return null
  return daysBetween(today, dayOf(next.startDate)) <= remaining + rhythmDays * COVER_TOLERANCE ? next : null
}

export interface DueReconnect {
  person: Person
  status: ReconnectStatus
  daysSince: number | null
}

export interface DueReconnectOptions {
  /** Leave out reconnects a planned activity covers (`coveringActivity`). */
  hideCovered?: boolean
  withinDays?: number
}

/**
 * Due reconnects for “Today”: everyone active and alive except you with a rhythm, overdue or due soon.
 * Never contacted first, then by days left, then alphabetically.
 */
export function dueReconnects(
  people: Person[],
  activities: Activity[],
  selfId: Id,
  today: IsoDate,
  { hideCovered = false, withinDays = RECONNECT_WINDOW_DAYS }: DueReconnectOptions = {},
): DueReconnect[] {
  const result: DueReconnect[] = []
  for (const person of people) {
    if (person.isSelf || isContactPaused(person) || person.reconnectDays === null) continue
    const daysSince = daysSinceContact(lastContactDate(activities, person.id, selfId, today), today)
    const status = reconnectStatus(person.reconnectDays, daysSince)
    if (status.remaining !== null && status.remaining > withinDays) continue
    if (hideCovered && coveringActivity(activities, person.id, selfId, person.reconnectDays, daysSince, today)) continue
    result.push({ person, status, daysSince })
  }
  const rank = (r: DueReconnect) => r.status.remaining ?? -Infinity
  return result.sort((a, b) => rank(a) - rank(b) || a.person.name.localeCompare(b.person.name))
}

/** Subtitle of a row on “Today”: `52 days overdue · every 2 weeks`. */
export function reconnectRowText(rhythmDays: number, daysSince: number | null): string {
  const rhythm = formatRhythm(rhythmDays)
  if (daysSince === null) return `no contact yet · ${rhythm}`
  const over = daysSince - rhythmDays
  if (over > 0) return `${pluralize(over, 'day')} overdue · ${rhythm}`
  return `last contact ${formatRelativePast(daysSince)} · ${rhythm}`
}
