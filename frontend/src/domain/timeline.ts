import { byStartAsc, byStartDesc } from './activities'
import { dayOf, daysBetween, isFullDate, normalizeEnd, normalizeStart, yearOf } from './dates'
import type { Activity, Id, Impact, IsoDate, PartialDate } from './model'

/*
 * A person's or a group's timeline: newest first, with year dividers. The impact
 * comes from outside – per person or per group.
 *
 * Two mechanisms for overlaps, both display only:
 * 1. “Meanwhile” (the normal case): point events with a full date are nested into the
 *    shortest matching range (full start, effective impact ≥ 3).
 * 2. Lane (transition): a range (impact ≥ 3) that fully contains another range
 *    does not become a card with “Meanwhile”, but gets a second line from its
 *    end card to its start card. Everything in between stays as usual – including
 *    the contained range with its own “Meanwhile”. At most MAX_LANES lanes in
 *    parallel; surplus ranges fall back to mechanism 1.
 */

export const MAX_LANES = 2

/** From this effective impact on, a range takes in entries (Meanwhile or lane). */
const CONTAINER_IMPACT = 3

export interface TimelineEntry {
  activity: Activity
  impact: Impact
  /** Nested point events, ascending. */
  during: Activity[]
}

/** Section of a lane in a row: starts (end card), runs through, or ends (start card). */
export type LanePart = 'top' | 'middle' | 'bottom'

export interface LaneSegment {
  activityId: Id
  part: LanePart
  impact: Impact
}

/** One entry per lane, `null` = lane not active here. Length = `laneCount`. */
export type Lanes = (LaneSegment | null)[]

export type TimelineRow =
  | { kind: 'year'; year: number; lanes: Lanes }
  | { kind: 'entry'; entry: TimelineEntry; lanes: Lanes; sameDay: SameDay }
  | { kind: 'end'; activity: Activity; impact: Impact; lanes: Lanes }

/** Neighbors in the same-day group: directly above / below on the same day. */
export interface SameDay {
  above: boolean
  below: boolean
}

export interface Timeline {
  rows: TimelineRow[]
  /** Number of lanes in use (0 to MAX_LANES). */
  laneCount: number
}

interface Span {
  start: IsoDate
  end: IsoDate
}

function spanOf(activity: Activity): Span {
  return { start: normalizeStart(activity.startDate), end: normalizeEnd(activity.endDate ?? activity.startDate) }
}

function lengthOf(span: Span): number {
  return daysBetween(span.start, span.end)
}

/** `outer` fully contains `inner` and is strictly larger (with the same span, the smaller ID wins). */
function contains(outer: Activity, inner: Activity): boolean {
  if (outer.id === inner.id) return false
  const o = spanOf(outer)
  const i = spanOf(inner)
  if (i.start < o.start || i.end > o.end) return false
  return lengthOf(i) < lengthOf(o) || outer.id < inner.id
}

/** Ranges that get a lane, with their assigned lane. */
function assignLanes(activities: Activity[], impactOf: ImpactOf): Map<Id, number> {
  const ranges = activities.filter((a) => a.endDate !== null)
  const candidates = ranges
    .filter((r) => impactOf(r) >= CONTAINER_IMPACT && ranges.some((other) => contains(r, other)))
    .sort((a, b) => spanOf(b).end.localeCompare(spanOf(a).end) || spanOf(a).start.localeCompare(spanOf(b).start))

  // From top (latest end) to bottom: a lane is free as soon as its previous line has ended above.
  const laneStarts: (IsoDate | null)[] = Array.from({ length: MAX_LANES }, () => null)
  const assigned = new Map<Id, number>()
  for (const candidate of candidates) {
    const span = spanOf(candidate)
    const lane = laneStarts.findIndex((start) => start === null || start > span.end)
    if (lane === -1) continue
    laneStarts[lane] = span.start
    assigned.set(candidate.id, lane)
  }
  return assigned
}

function findContainer(date: IsoDate, containers: Activity[]): Activity | null {
  let best: Activity | null = null
  let bestLength = Infinity
  for (const c of containers) {
    const end = normalizeEnd(c.endDate!)
    if (date < c.startDate || date > end) continue
    const length = daysBetween(c.startDate, end)
    if (length < bestLength) {
      best = c
      bestLength = length
    }
  }
  return best
}

type Item =
  | { kind: 'entry'; sortKey: PartialDate; entry: TimelineEntry }
  | { kind: 'end'; sortKey: PartialDate; activity: Activity; impact: Impact }

/** The impact an activity has in this timeline, e.g. `effectiveImpact` for a person. */
export type ImpactOf = (activity: Activity) => Impact

export function buildTimeline(activities: Activity[], impactOf: ImpactOf): Timeline {
  const laneOf = assignLanes(activities, impactOf)
  const containers = activities.filter(
    (a) =>
      a.endDate !== null &&
      isFullDate(a.startDate) &&
      impactOf(a) >= CONTAINER_IMPACT &&
      !laneOf.has(a.id),
  )

  // 1. Nest point events
  const sorted = [...activities].sort(byStartDesc)
  const entries = new Map<Id, TimelineEntry>(
    sorted.map((a) => [a.id, { activity: a, impact: impactOf(a), during: [] }]),
  )
  const items: Item[] = []
  for (const a of sorted) {
    const day = dayOf(a.startDate)
    const container = a.endDate === null && isFullDate(day) ? findContainer(day, containers) : null
    if (container) entries.get(container.id)!.during.push(a)
    else items.push({ kind: 'entry', sortKey: a.startDate, entry: entries.get(a.id)! })
  }
  for (const entry of entries.values()) entry.during.sort(byStartAsc)

  // 2. End cards for ranges with a lane
  for (const [id] of laneOf) {
    const entry = entries.get(id)!
    items.push({ kind: 'end', sortKey: normalizeEnd(entry.activity.endDate!), activity: entry.activity, impact: entry.impact })
  }

  // Newest first; on the same date the end goes above the rest, then by time.
  items.sort(
    (a, b) =>
      dayOf(b.sortKey).localeCompare(dayOf(a.sortKey)) ||
      Number(b.kind === 'end') - Number(a.kind === 'end') ||
      b.sortKey.localeCompare(a.sortKey) ||
      itemId(b) - itemId(a),
  )

  // 3. Rows with year dividers and lane sections
  const laneCount = laneOf.size === 0 ? 0 : Math.max(...laneOf.values()) + 1
  const active: (LaneSegment | null)[] = Array.from({ length: laneCount }, () => null)
  const through = (): Lanes => active.map((s) => (s ? { ...s, part: 'middle' } : null))

  const rows: TimelineRow[] = []
  let currentYear: number | null = null
  for (const item of items) {
    const year = yearOf(item.sortKey)
    if (year !== currentYear) {
      rows.push({ kind: 'year', year, lanes: through() })
      currentYear = year
    }

    if (item.kind === 'end') {
      const lane = laneOf.get(item.activity.id)!
      const lanes = through()
      lanes[lane] = { activityId: item.activity.id, part: 'top', impact: item.impact }
      active[lane] = lanes[lane]
      rows.push({ kind: 'end', activity: item.activity, impact: item.impact, lanes })
      continue
    }

    const lane = laneOf.get(item.entry.activity.id)
    const lanes = through()
    if (lane !== undefined) {
      lanes[lane] = { activityId: item.entry.activity.id, part: 'bottom', impact: item.entry.impact }
      active[lane] = null
    }
    rows.push({ kind: 'entry', entry: item.entry, lanes, sameDay: { above: false, below: false } })
  }

  // 4. Same-day groups: consecutive point events with the same full date
  for (let i = 1; i < rows.length; i++) {
    const above = rows[i - 1]!
    const row = rows[i]!
    if (above.kind !== 'entry' || row.kind !== 'entry') continue
    const day = groupDay(row.entry.activity)
    if (day !== null && day === groupDay(above.entry.activity)) {
      above.sameDay.below = true
      row.sameDay.above = true
    }
  }

  return { rows, laneCount }
}

/** The day by which a point event can join a same-day group; `null` for ranges and imprecise dates. */
function groupDay(activity: Activity): IsoDate | null {
  const day = dayOf(activity.startDate)
  return activity.endDate === null && isFullDate(day) ? day : null
}

function itemId(item: Item): Id {
  return item.kind === 'end' ? item.activity.id : item.entry.activity.id
}
