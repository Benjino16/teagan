import { describe, expect, it } from 'vitest'
import { createTestDatabase } from '../test/fixture'
import { effectiveImpact, hasParticipant } from './activities'
import type { Activity, Impact } from './model'
import { buildTimeline, type Timeline, type TimelineRow } from './timeline'

const db = createTestDatabase()
const LENA = 2
const TIM = 5
const forPerson = (id: number) => db.activities.filter((a) => hasParticipant(a, id))
const byId = (id: number) => db.activities.find((a) => a.id === id)!
const impactFor = (personId: number) => (a: Activity) => effectiveImpact(a, personId)

const entries = (t: Timeline) => t.rows.flatMap((r) => (r.kind === 'entry' ? [r.entry] : []))
const entry = (t: Timeline, id: number) => entries(t).find((e) => e.activity.id === id)
const ids = (list: Activity[]) => list.map((a) => a.id)

/** Compact representation: `2026`, `#21`, `end#20`, lanes as `|`/`┐`/`┘`. */
function sketch(t: Timeline): string[] {
  const lane = (r: TimelineRow) =>
    r.lanes.map((s) => (s === null ? ' ' : s.part === 'top' ? '┐' : s.part === 'bottom' ? '┘' : '|')).join('')
  return t.rows.map((r) => {
    const label = r.kind === 'year' ? String(r.year) : r.kind === 'end' ? `end#${r.activity.id}` : `#${r.entry.activity.id}`
    return t.laneCount ? `${lane(r)} ${label}` : label
  })
}

const range = (id: number, startDate: string, endDate: string, impact: Impact = 3): Activity => ({
  ...byId(6),
  id,
  startDate,
  endDate,
  impact,
  participants: [{ personId: LENA, impact: null, mood: null, note: null }],
})
const point = (id: number, startDate: string): Activity => ({ ...byId(3), id, startDate, endDate: null })

describe('meanwhile', () => {
  const timeline = buildTimeline(forPerson(LENA), impactFor(LENA))

  it('groups by year, newest first', () => {
    expect(timeline.rows.filter((r) => r.kind === 'year').map((r) => r.kind === 'year' && r.year)).toEqual([
      2026, 2025, 2024, 2022, 2021,
    ])
    expect(entries(timeline)[0]!.activity.name).toBe('Vacation in Lisbon')
    expect(timeline.laneCount).toBe(0)
  })

  it('nests events during Interrail, newest first', () => {
    expect(ids(entry(timeline, 11)!.during)).toEqual([8, 9, 10])
    expect(entry(timeline, 10)).toBeUndefined()
  })

  it('does not let ranges with impact < 3 swallow anything', () => {
    expect(entry(timeline, 2)!.during).toEqual([])
    expect(entry(timeline, 3)).toBeDefined()
  })

  it('picks the shortest of several containers', () => {
    // 100 contains 101 → 100 gets a lane, the point lands in the shorter 101
    const t = buildTimeline([range(100, '2026-05-01', '2026-05-31'), range(101, '2026-05-08', '2026-05-12'), point(102, '2026-05-10')], impactFor(LENA))
    expect(ids(entry(t, 101)!.during)).toEqual([102])
  })

  it('nests only entries with a full date', () => {
    const t = buildTimeline([byId(11), point(300, '2026-03')], impactFor(LENA))
    expect(entry(t, 11)!.during).toEqual([])
    expect(entry(t, 300)).toBeDefined()
  })
})

describe('lane for ranges that contain other ranges', () => {
  const timeline = buildTimeline(forPerson(TIM), impactFor(TIM))

  it('draws the year abroad as a lane from the end card to the start card', () => {
    expect(timeline.laneCount).toBe(1)
    expect(sketch(timeline)).toEqual([
      '  2026',
      '┐ end#20', // End “2026-10” = Oct 31, above everything else
      '| #34',
      '| #6', // Harz weekend: range without a lane
      '| #7',
      '| #21', // Visit with its own meanwhile
      '| #25',
      '| 2025',
      '| #24',
      '| #35',
      '| #13',
      '┘ #20', // Start “2025-10”
      '  2024',
      '  #16',
      '  2021',
      '  #18',
    ])
  })

  it('keeps point events in the year abroad as usual', () => {
    expect(entry(timeline, 20)!.during).toEqual([])
    expect(entry(timeline, 24)).toBeDefined()
    expect(entry(timeline, 25)).toBeDefined()
  })

  it('nests events during the visit into the visit', () => {
    expect(ids(entry(timeline, 21)!.during)).toEqual([23, 22])
  })

  it('puts the end card at the end of the month for a partial end', () => {
    const end = timeline.rows.find((r) => r.kind === 'end')!
    expect(end.kind === 'end' && end.activity.id).toBe(20)
  })

  it('ignores ranges with impact < 3 as lanes', () => {
    const t = buildTimeline([range(400, '2026-01-01', '2026-06-30', 2), range(401, '2026-03-01', '2026-03-05')], impactFor(LENA))
    expect(t.laneCount).toBe(0)
  })

  it('uses at most two lanes, the rest gets meanwhile', () => {
    const t = buildTimeline(
      [
        range(500, '2026-01-01', '2026-12-31'),
        range(501, '2026-02-01', '2026-11-30'),
        range(502, '2026-03-01', '2026-10-31'),
        range(503, '2026-04-01', '2026-04-05'),
        point(504, '2026-05-10'),
      ],
      impactFor(LENA),
    )
    expect(t.laneCount).toBe(2)
    expect(t.rows.filter((r) => r.kind === 'end').map((r) => r.kind === 'end' && r.activity.id)).toEqual([500, 501])
    // 502 has no free lane left → container again
    expect(ids(entry(t, 502)!.during)).toEqual([504])
  })

  it('reuses a lane when ranges do not overlap', () => {
    const t = buildTimeline(
      [
        range(600, '2026-07-01', '2026-09-30'),
        range(601, '2026-08-01', '2026-08-05'),
        range(602, '2026-01-01', '2026-03-31'),
        range(603, '2026-02-01', '2026-02-05'),
      ],
      impactFor(LENA),
    )
    expect(t.laneCount).toBe(1)
  })
})

describe('several events on one day', () => {
  // Party (entered first, lower ID) in the evening, coffee (entered later) in the morning
  const party = point(400, '2026-05-10T21:00')
  const coffee = point(401, '2026-05-10T09:00')

  it('orders by time, not by creation', () => {
    const t = buildTimeline([party, coffee], impactFor(LENA))
    expect(sketch(t)).toEqual(['2026', '#400', '#401'])
  })

  it('nests timed events in a range on the same day', () => {
    const t = buildTimeline([range(402, '2026-05-01', '2026-05-10'), party, coffee], impactFor(LENA))
    expect(ids(entry(t, 402)!.during)).toEqual([400, 401])
  })

  it('keeps the end of a lane range above timed events of its last day', () => {
    const outer = range(410, '2026-05-01', '2026-05-10')
    const inner = range(411, '2026-05-02', '2026-05-04')
    const t = buildTimeline([outer, inner, point(412, '2026-05-10T09:00')], impactFor(LENA))
    expect(sketch(t)).toEqual(['  2026', '┐ end#410', '| #412', '| #411', '┘ #410'])
  })

  const sameDay = (t: Timeline) =>
    t.rows.flatMap((r) => (r.kind === 'entry' ? [`#${r.entry.activity.id} ${+r.sameDay.above}${+r.sameDay.below}`] : []))

  it('marks consecutive point events of one day as a group', () => {
    const t = buildTimeline([party, coffee, point(403, '2026-05-10'), point(404, '2026-05-09')], impactFor(LENA))
    expect(sameDay(t)).toEqual(['#400 01', '#401 11', '#403 10', '#404 00'])
  })

  it('leaves ranges, imprecise dates and split groups out', () => {
    const t = buildTimeline([range(420, '2026-05-10', '2026-05-12', 2), point(421, '2026-05-10'), point(422, '2026-05'), point(423, '2026-05')], impactFor(LENA))
    expect(sameDay(t)).toEqual(['#421 00', '#420 00', '#423 00', '#422 00'])

    const outer = range(410, '2026-05-01', '2026-05-10')
    const inner = range(411, '2026-05-02', '2026-05-04')
    const split = buildTimeline([outer, inner, point(412, '2026-05-10T09:00'), point(413, '2026-05-10T20:00')], impactFor(LENA))
    expect(sameDay(split).slice(0, 2)).toEqual(['#413 01', '#412 10'])
  })
})
