import { dayOf, daysBetween, isFullDate, isLeapYear, normalizeEnd, normalizeStart, yearOf } from './dates'
import type { Activity, Group, Id, Impact, ImpactLevel, IsoDate, Mood, MoodLevel } from './model'

/** Impact levels for activities, with an explanation for the form. */
export const ACTIVITY_IMPACT_LEVELS: Record<Impact, ImpactLevel> = {
  1: { label: 'Side note', description: 'A small thing worth keeping, e.g. a voice message or “was in Portugal”.' },
  2: { label: 'Normal', description: 'An ordinary get-together, e.g. dinner or a movie.' },
  3: { label: 'Notable', description: 'Something you like to remember, e.g. a weekend trip.' },
  4: { label: 'Important', description: 'Something special, e.g. a long road trip or being a best man.' },
  5: {
    label: 'Life event',
    description: 'Changed something in life, e.g. a wedding or moving abroad. Shows up as a milestone.',
  },
}

/** Moods for activities, with an explanation for the form. */
export const MOOD_LEVELS: Record<Mood, MoodLevel> = {
  1: { label: 'Very bad', description: 'Hard or painful, e.g. a fight or a farewell.' },
  2: { label: 'Bad', description: 'Tense or disappointing.' },
  3: { label: 'Neutral', description: 'Neither good nor bad.' },
  4: { label: 'Good', description: 'A nice time.' },
  5: { label: 'Very good', description: 'Wonderful, one to keep.' },
}

/** Mood for this person, otherwise the activity's. `null` = none. */
export function effectiveMood(activity: Activity, personId: Id): Mood | null {
  const own = activity.participants.find((p) => p.personId === personId)?.mood
  return own ?? activity.mood
}

/**
 * Mood in the group's timeline: its own value if the activity belongs to the group
 * directly, otherwise that of its subgroups if they agree. Without one the activity's.
 */
export function groupMood(activity: Activity, groupId: Id, groups: Group[]): Mood | null {
  const direct = activity.groups.find((c) => c.groupId === groupId)
  if (direct) return direct.mood ?? activity.mood
  const subgroups = new Set(groups.filter((c) => c.parentId === groupId).map((c) => c.id))
  const moods = new Set(
    activity.groups.flatMap((c) => {
      const mood = subgroups.has(c.groupId) ? (c.mood ?? activity.mood) : null
      return mood === null ? [] : [mood]
    }),
  )
  return moods.size === 1 ? [...moods][0]! : activity.mood
}

/** Impact for this person, otherwise the global value. */
export function effectiveImpact(activity: Activity, personId: Id): Impact {
  const own = activity.participants.find((p) => p.personId === personId)?.impact
  return own ?? activity.impact
}

/**
 * Impact in the group's timeline: its own value if the activity belongs to the group
 * directly, otherwise the highest of its subgroups. Without an own value the global one.
 */
export function groupImpact(activity: Activity, groupId: Id, groups: Group[]): Impact {
  const direct = activity.groups.find((c) => c.groupId === groupId)
  if (direct) return direct.impact ?? activity.impact
  const subgroups = new Set(groups.filter((c) => c.parentId === groupId).map((c) => c.id))
  const viaSubgroups = activity.groups.filter((c) => subgroups.has(c.groupId))
  if (viaSubgroups.length === 0) return activity.impact
  return Math.max(...viaSubgroups.map((c) => c.impact ?? activity.impact)) as Impact
}

/**
 * Note in the group's timeline: its own if the activity belongs to the group directly,
 * otherwise those of its subgroups. `null` = none.
 */
export function groupNote(activity: Activity, groupId: Id, groups: Group[]): string | null {
  const direct = activity.groups.find((c) => c.groupId === groupId)
  if (direct) return direct.note
  const subgroups = new Set(groups.filter((c) => c.parentId === groupId).map((c) => c.id))
  const notes = activity.groups.flatMap((c) => (subgroups.has(c.groupId) && c.note ? [c.note] : []))
  return notes.length > 0 ? notes.join('\n\n') : null
}

/** Note for this person only, shown in their timeline. */
export function participantNote(activity: Activity, personId: Id): string | null {
  return activity.participants.find((p) => p.personId === personId)?.note ?? null
}

export function hasParticipant(activity: Activity, personId: Id): boolean {
  return activity.participants.some((p) => p.personId === personId)
}

/** Events nobody else took part in, yourself included, and without a group – deleting the person deletes them too. */
export function onlyWith(activities: Activity[], personId: Id): Activity[] {
  return activities.filter(
    (a) => a.groups.length === 0 && a.participants.length > 0 && a.participants.every((p) => p.personId === personId),
  )
}

/**
 * Events without people that belong only to the group or its subgroups – deleting the
 * group deletes them too.
 */
export function onlyInGroup(activities: Activity[], groupId: Id, groups: Group[]): Activity[] {
  const doomed = new Set([groupId, ...groups.filter((c) => c.parentId === groupId).map((c) => c.id)])
  return activities.filter(
    (a) => a.participants.length === 0 && a.groups.length > 0 && a.groups.every((c) => doomed.has(c.groupId)),
  )
}

export function isRange(activity: Activity): boolean {
  return activity.endDate !== null
}

export function isFuture(activity: Activity, today: IsoDate): boolean {
  return normalizeStart(activity.startDate) > today
}

/** A range that includes today (any impact). */
export function isOngoing(activity: Activity, today: IsoDate): boolean {
  if (activity.endDate === null) return false
  return normalizeStart(activity.startDate) <= today && normalizeEnd(activity.endDate) >= today
}

export type ActivityStatus = 'planned' | 'ongoing' | null

export function activityStatus(activity: Activity, today: IsoDate): ActivityStatus {
  if (isFuture(activity, today)) return 'planned'
  if (isOngoing(activity, today)) return 'ongoing'
  return null
}

/** Newest first; the date strings sort correctly lexicographically. */
export function byStartDesc(a: Activity, b: Activity): number {
  return b.startDate.localeCompare(a.startDate) || b.id - a.id
}

export function byStartAsc(a: Activity, b: Activity): number {
  return a.startDate.localeCompare(b.startDate) || a.id - b.id
}

/** Ongoing ranges, most recently started first. */
export function ongoingActivities(activities: Activity[], today: IsoDate): Activity[] {
  return activities.filter((a) => isOngoing(a, today)).sort(byStartDesc)
}

/** “Coming up”: future activities, ascending. */
export function upcomingActivities(activities: Activity[], today: IsoDate, limit = 3): Activity[] {
  return activities
    .filter((a) => isFuture(a, today))
    .sort(byStartAsc)
    .slice(0, limit)
}

/** Activities with at least one person other than you, or a group – what Today shows. */
function withOthers(activities: Activity[], selfId: Id): Activity[] {
  return activities.filter((a) => a.groups.length > 0 || a.participants.some((p) => p.personId !== selfId))
}

/** “Coming up” on Today: future activities with others or a group. */
export function upcomingWithOthers(activities: Activity[], selfId: Id, today: IsoDate, limit = 5): Activity[] {
  return upcomingActivities(withOthers(activities, selfId), today, limit)
}

/** “Ongoing” on Today: ranges with others or a group that include today, most recently started first. */
export function ongoingWithOthers(activities: Activity[], selfId: Id, today: IsoDate): Activity[] {
  return ongoingActivities(withOthers(activities, selfId), today)
}

/** Milestones = effective impact 5, newest first. */
export function milestones(activities: Activity[], personId: Id): Activity[] {
  return activities.filter((a) => effectiveImpact(a, personId) === 5).sort(byStartDesc)
}

/** An activity that started on today's date in an earlier year. */
export interface Memory {
  activity: Activity
  yearsAgo: number
}

/**
 * “On this day”: activities that started on today's day and month in an earlier year – the most meaningful
 * first, then the most recent. Only full start dates count; on Feb 28 of a non-leap year, Feb 29 counts too.
 */
export function onThisDay(activities: Activity[], today: IsoDate): Memory[] {
  const year = yearOf(today)
  const days = [today.slice(5)]
  if (days[0] === '02-28' && !isLeapYear(year)) days.push('02-29')

  return activities
    .filter((a) => {
      const start = dayOf(a.startDate)
      return isFullDate(start) && yearOf(start) < year && days.includes(start.slice(5))
    })
    .map((activity) => ({ activity, yearsAgo: year - yearOf(activity.startDate) }))
    .sort((a, b) => maxImpact(b.activity) - maxImpact(a.activity) || a.yearsAgo - b.yearsAgo || a.activity.id - b.activity.id)
}

/** Highest impact of the activity – global or for any participant or group. */
export function maxImpact(activity: Activity): Impact {
  const own = [...activity.participants, ...activity.groups].map((link) => link.impact ?? 0)
  return Math.max(activity.impact, ...own) as Impact
}

function sharesPersonOrGroup(a: Activity, b: Activity): boolean {
  return (
    a.participants.some((p) => hasParticipant(b, p.personId)) ||
    a.groups.some((c) => b.groups.some((other) => other.groupId === c.groupId))
  )
}

function liesWithin(inner: Activity, outer: Activity): boolean {
  if (inner.id === outer.id || outer.endDate === null) return false
  const innerEnd = normalizeEnd(inner.endDate ?? inner.startDate)
  const outerStart = normalizeStart(outer.startDate)
  const outerEnd = normalizeEnd(outer.endDate)
  if (normalizeStart(inner.startDate) < outerStart || innerEnd > outerEnd) return false
  // Same span: only the one with the higher ID counts as “inside”.
  const sameSpan = normalizeStart(inner.startDate) === outerStart && innerEnd === outerEnd
  return !sameSpan || inner.id > outer.id
}

/** From this impact on, a range collects in the detail view what happened during it. */
const COLLECTS_FROM_IMPACT = 3

/**
 * Detail view: what happened during a range? Everything that lies entirely within
 * its span and shares at least one person or group with it – ranges included –,
 * unless it lies in a shorter contained range (which then lists it).
 * Independent of a person (unlike the timeline). Newest first, like the timeline.
 */
export function activitiesDuring(range: Activity, all: Activity[]): Activity[] {
  if (range.endDate === null || maxImpact(range) < COLLECTS_FROM_IMPACT) return []
  // Direct entries only: whatever lies in a contained, shorter range belongs to that one.
  return all.filter((a) => enclosingActivity(a, all)?.id === range.id).sort(byStartDesc)
}

/** Counterpart: the shortest range in which the activity took place (“Part of”). */
export function enclosingActivity(activity: Activity, all: Activity[]): Activity | null {
  const candidates = all.filter(
    (r) =>
      r.endDate !== null &&
      maxImpact(r) >= COLLECTS_FROM_IMPACT &&
      liesWithin(activity, r) &&
      sharesPersonOrGroup(activity, r),
  )
  const length = (a: Activity) => daysBetween(normalizeStart(a.startDate), normalizeEnd(a.endDate!))
  let best: Activity | null = null
  for (const c of candidates) if (!best || length(c) < length(best)) best = c
  return best
}
