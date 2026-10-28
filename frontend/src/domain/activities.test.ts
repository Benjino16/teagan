import { describe, expect, it } from 'vitest'
import { createTestDatabase } from '../test/fixture'
import { hasParticipant } from './activities'
import {
  activitiesDuring,
  activityStatus,
  enclosingActivity,
  effectiveImpact,
  groupImpact,
  groupNote,
  maxImpact,
  milestones,
  onlyInGroup,
  onlyWith,
  onThisDay,
  participantNote,
  ongoingActivities,
  ongoingWithOthers,
  recentActivities,
  upcomingActivities,
  upcomingWithOthers,
} from './activities'
import type { Activity, ActivityGroup, Group, Impact } from './model'

const today = '2026-10-13'
const db = createTestDatabase()
const LENA = 2
const TIM = 5
const forPerson = (id: number) => db.activities.filter((a) => hasParticipant(a, id))
const byId = (id: number) => db.activities.find((a) => a.id === id)!
const names = (list: Activity[]) => list.map((a) => a.name)

// Groups: University (10) with the subgroups Freshers (11) and Flatmates (12), Family (20)
const UNI = 10
const FRESHERS = 11
const FLATMATES = 12
const FAMILY = 20
const group = (id: number, parentId: number | null): Group => ({ ...db.groups[0]!, id, parentId })
const groups = [group(UNI, null), group(FRESHERS, UNI), group(FLATMATES, UNI), group(FAMILY, null)]
const link = (groupId: number, impact: Impact | null = null, note: string | null = null): ActivityGroup => ({
  groupId,
  impact,
  note,
})
/** A copy of a fixture activity with these groups and people. */
const withGroups = (id: number, base: Activity, groups: ActivityGroup[], personIds: number[] = []): Activity => ({
  ...base,
  id,
  groups,
  participants: personIds.map((personId) => ({ personId, impact: null, note: null })),
})

describe('effectiveImpact', () => {
  it('uses the per-person impact, otherwise the global one', () => {
    const move = byId(16)
    expect(effectiveImpact(move, LENA)).toBe(5)
    expect(effectiveImpact(move, TIM)).toBe(2)
    expect(effectiveImpact(move, 1)).toBe(5)
  })
})

describe('groupImpact', () => {
  const base = { ...byId(1), impact: 2 as Impact }

  it('uses the own value of a direct link, otherwise the global one', () => {
    expect(groupImpact(withGroups(800, base, [link(UNI, 4)]), UNI, groups)).toBe(4)
    expect(groupImpact(withGroups(801, base, [link(UNI)]), UNI, groups)).toBe(2)
  })

  it('takes the highest subgroup value in the main group', () => {
    const viaSubgroups = withGroups(802, base, [link(FRESHERS, 3), link(FLATMATES, 5)])
    expect(groupImpact(viaSubgroups, UNI, groups)).toBe(5)
    expect(groupImpact(viaSubgroups, FRESHERS, groups)).toBe(3)
  })

  it('prefers the direct link over subgroups', () => {
    const both = withGroups(803, base, [link(UNI), link(FRESHERS, 5)])
    expect(groupImpact(both, UNI, groups)).toBe(2)
  })

  it('counts a group value for the highest impact', () => {
    expect(maxImpact(withGroups(804, base, [link(FAMILY, 5)]))).toBe(5)
  })
})

describe('groupNote', () => {
  const base = byId(1)

  it('uses the note of a direct link, even if empty', () => {
    expect(groupNote(withGroups(830, base, [link(UNI, null, 'Hosted it')]), UNI, groups)).toBe('Hosted it')
    expect(groupNote(withGroups(831, base, [link(UNI), link(FRESHERS, null, 'Freshers only')]), UNI, groups)).toBeNull()
  })

  it('collects the subgroup notes in the main group', () => {
    const viaSubgroups = withGroups(832, base, [link(FRESHERS, null, 'First'), link(FLATMATES, null, 'Second')])
    expect(groupNote(viaSubgroups, UNI, groups)).toBe('First\n\nSecond')
    expect(groupNote(viaSubgroups, FAMILY, groups)).toBeNull()
  })
})

describe('participantNote', () => {
  it('belongs to one participant only', () => {
    const gameNight = db.activities.find((a) => a.id === 7)!
    expect(participantNote(gameNight, 4)).toMatch(/switching majors/)
    expect(participantNote(gameNight, LENA)).toBeNull()
    expect(participantNote(gameNight, 99)).toBeNull()
  })
})

describe('status', () => {
  it('detects planned and ongoing entries', () => {
    expect(activityStatus(byId(1), today)).toBe('planned')
    // Photography class ends “2026-12” → runs until Dec 31
    expect(activityStatus(byId(2), today)).toBe('ongoing')
    expect(activityStatus(byId(6), today)).toBeNull()
  })

  it('finds ongoing ranges of any impact', () => {
    expect(names(ongoingActivities(forPerson(LENA), today))).toEqual(['Photography class at the community college'])
  })

  it('lists coming up ascending and limited', () => {
    expect(names(upcomingActivities(db.activities, today))).toEqual(['Vacation in Lisbon', 'Statistics exam'])
    expect(upcomingActivities(db.activities, today, 1)).toHaveLength(1)
  })
})

describe('ongoingWithOthers', () => {
  const SELF = 1
  const ongoing = (id: number, startDate: string, personIds: number[], groupIds: number[] = []): Activity => ({
    ...byId(1),
    id,
    startDate,
    endDate: '2026-12-31',
    participants: personIds.map((personId) => ({ personId, impact: null, note: null })),
    groups: groupIds.map((groupId) => link(groupId)),
  })

  it('shows ongoing ranges with others or a group, most recently started first', () => {
    const list = [ongoing(201, '2026-09-01', [SELF, LENA]), ongoing(202, '2026-10-01', [], [FAMILY])]
    expect(ongoingWithOthers(list, SELF, today).map((a) => a.id)).toEqual([202, 201])
  })

  it('leaves out ranges with only you, and those not running today', () => {
    const list = [
      ongoing(203, '2026-09-01', [SELF]),
      ongoing(204, '2026-11-01', [LENA]),
      { ...ongoing(205, '2026-09-01', [LENA]), endDate: '2026-10-12' },
    ]
    expect(ongoingWithOthers(list, SELF, today)).toEqual([])
  })

  it("puts today's single dates first, earliest time first, and skips other days and month-only dates", () => {
    const single = (id: number, startDate: string) => ({ ...ongoing(id, startDate, [LENA]), endDate: null })
    const list = [
      ongoing(206, '2026-10-01', [LENA]),
      single(207, '2026-10-13T19:00'),
      single(208, '2026-10-13'),
      single(209, '2026-10-12'),
      single(210, '2026-10'),
    ]
    expect(ongoingWithOthers(list, SELF, today).map((a) => a.id)).toEqual([208, 207, 206])
  })
})

describe('recentActivities', () => {
  const SELF = 1
  const past = (id: number, startDate: string, personIds: number[], endDate: string | null = null): Activity => ({
    ...byId(1),
    id,
    startDate,
    endDate,
    participants: personIds.map((personId) => ({ personId, impact: null, note: null })),
  })

  it("shows the person's past activities, with or without you, newest first", () => {
    const list = [
      past(301, '2026-09-20', [SELF, LENA]),
      past(302, '2026-10-01', [LENA], '2026-10-08'),
      past(303, '2026-10-10', [LENA, TIM]),
    ]
    expect(recentActivities(list, LENA, today).map((a) => a.id)).toEqual([303, 302, 301])
  })

  it('includes month-only dates', () => {
    expect(recentActivities([past(304, '2026-08', [LENA])], LENA, today).map((a) => a.id)).toEqual([304])
  })

  it("leaves out other people's, future, today's and ongoing activities", () => {
    const list = [
      past(305, '2026-10-01', [TIM]),
      past(306, '2026-11-01', [LENA]),
      past(307, '2026-10-13T09:00', [LENA]),
      past(308, '2026-10-01', [LENA], '2026-10-20'),
    ]
    expect(recentActivities(list, LENA, today)).toEqual([])
  })

  it('limits to the last 3', () => {
    const list = [1, 2, 3, 4].map((day) => past(310 + day, `2026-10-0${day}`, [LENA]))
    expect(recentActivities(list, LENA, today).map((a) => a.id)).toEqual([314, 313, 312])
  })
})

describe('upcomingWithOthers', () => {
  const SELF = 1
  const future = (id: number, startDate: string, personIds: number[]): Activity => ({
    ...byId(1),
    id,
    startDate,
    endDate: null,
    participants: personIds.map((personId) => ({ personId, impact: null, note: null })),
  })

  it('shows future entries with others, even without you (fixture)', () => {
    expect(names(upcomingWithOthers(db.activities, SELF, today))).toEqual(['Vacation in Lisbon', 'Statistics exam'])
  })

  it('shows group events, even without people', () => {
    const gathering = { ...future(104, '2026-11-04', []), groups: [link(FAMILY)] }
    expect(upcomingWithOthers([gathering], SELF, today).map((a) => a.id)).toEqual([104])
  })

  it('leaves out entries without people or with only you', () => {
    const list = [future(101, '2026-11-01', []), future(102, '2026-11-02', [SELF]), future(103, '2026-11-03', [SELF, LENA])]
    expect(upcomingWithOthers(list, SELF, today).map((a) => a.id)).toEqual([103])
  })

  it('limits to the next 5, ascending', () => {
    const list = [9, 8, 7, 6, 5, 4].map((day) => future(200 + day, `2026-11-0${day}`, [LENA]))
    expect(upcomingWithOthers(list, SELF, today).map((a) => a.startDate)).toEqual([
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
      '2026-11-08',
    ])
  })
})

describe('milestones', () => {
  it('uses the effective impact', () => {
    expect(names(milestones(forPerson(LENA), LENA))).toEqual(["Bachelor's degree", 'Moving to Leipzig'])
    expect(names(milestones(forPerson(TIM), TIM))).toEqual([])
  })
})

describe('detail view: meanwhile and part of', () => {
  it('collects what happened with Lena during Interrail', () => {
    expect(names(activitiesDuring(byId(11), db.activities))).toEqual([
      'Postcard from Ljubljana',
      'Phone call',
      'Video call from Vienna',
    ])
  })

  it('lists contained ranges in the year abroad, but their events only there', () => {
    const during = names(activitiesDuring(byId(20), db.activities))
    expect(during).toContain('Visiting Tim in Lisbon')
    expect(during).toContain('Hiking weekend in the Harz')
    expect(during).not.toContain('Day trip to Sintra')
    expect(during).not.toContain('Year abroad in Lisbon')
    expect(names(activitiesDuring(byId(21), db.activities))).toEqual(['Fado night in the Alfama', 'Day trip to Sintra'])
  })

  it('collects nothing for point events and unimportant ranges', () => {
    expect(activitiesDuring(byId(3), db.activities)).toEqual([])
    expect(activitiesDuring(byId(2), db.activities)).toEqual([]) // Photography class, impact 2
  })

  it('finds the shortest enclosing range', () => {
    expect(enclosingActivity(byId(22), db.activities)?.name).toBe('Visiting Tim in Lisbon')
    expect(enclosingActivity(byId(21), db.activities)?.name).toBe('Year abroad in Lisbon')
    expect(enclosingActivity(byId(9), db.activities)?.name).toBe('Interrail through Europe')
    expect(enclosingActivity(byId(18), db.activities)).toBeNull()
  })
})

describe('detail view with groups', () => {
  // Interrail and a phone call during it, both without people – only the group connects them
  const trip = withGroups(810, byId(11), [link(FRESHERS)])
  const call = withGroups(811, byId(9), [link(FRESHERS)])
  const other = withGroups(812, byId(9), [link(FAMILY)])

  it('connects events through a shared group', () => {
    expect(enclosingActivity(call, [trip, call, other])?.id).toBe(810)
    expect(activitiesDuring(trip, [trip, call, other]).map((a) => a.id)).toEqual([811])
  })

  it('needs the same group, not just one in the same main group', () => {
    const flatmates = withGroups(813, byId(9), [link(FLATMATES)])
    expect(enclosingActivity(flatmates, [trip, flatmates])).toBeNull()
  })
})

describe('onlyWith', () => {
  it('keeps only events where nobody else took part', () => {
    const base = byId(16)
    const participant = (personId: number) => ({ personId, impact: null, note: null })
    const solo = { ...base, id: 901, participants: [participant(TIM)] }
    const withSelf = { ...base, id: 902, participants: [participant(TIM), participant(1)] }
    const empty = { ...base, id: 903, participants: [] }
    expect(onlyWith([solo, withSelf, empty], TIM).map((a) => a.id)).toEqual([901])
  })

  it('keeps events with a group', () => {
    const inGroup = withGroups(904, byId(16), [link(FAMILY)], [TIM])
    expect(onlyWith([inGroup], TIM)).toEqual([])
  })
})

describe('onlyInGroup', () => {
  const base = byId(16)

  it('finds events without people that belong only to the group or its subgroups', () => {
    const list = [
      withGroups(920, base, [link(UNI)]),
      withGroups(921, base, [link(UNI), link(FRESHERS)]),
      withGroups(922, base, [link(FRESHERS)]),
      withGroups(923, base, [link(UNI)], [LENA]),
      withGroups(924, base, [link(UNI), link(FAMILY)]),
    ]
    expect(onlyInGroup(list, UNI, groups).map((a) => a.id)).toEqual([920, 921, 922])
    expect(onlyInGroup(list, FRESHERS, groups).map((a) => a.id)).toEqual([922])
  })
})

describe('onThisDay', () => {
  const at = (id: number, startDate: string, impact: Impact = 3): Activity => ({
    ...db.activities[0]!,
    id,
    startDate,
    endDate: null,
    impact,
    participants: [],
    groups: [],
  })
  const ids = (list: { activity: Activity }[]) => list.map((m) => m.activity.id)

  it('finds activities that started on this day in earlier years, with how long ago', () => {
    const list = [at(1, '2022-10-13'), at(2, '2025-10-13T19:30'), at(3, '2022-10-14'), at(4, '2026-10-13')]
    expect(onThisDay(list, today)).toEqual([
      { activity: list[1], yearsAgo: 1 },
      { activity: list[0], yearsAgo: 4 },
    ])
  })

  it('skips dates without a day', () => {
    expect(onThisDay([at(1, '2022-10'), at(2, '2022')], today)).toEqual([])
  })

  it('puts the most meaningful first, then the most recent', () => {
    const list = [at(1, '2024-10-13', 2), at(2, '2019-10-13', 5), at(3, '2023-10-13', 2)]
    expect(ids(onThisDay(list, today))).toEqual([2, 1, 3])
  })

  it('counts a participant’s higher impact', () => {
    const personal = { ...at(1, '2019-10-13', 2), participants: [{ personId: LENA, impact: 5 as Impact, note: null }] }
    expect(ids(onThisDay([at(2, '2024-10-13', 3), personal], today))).toEqual([1, 2])
  })

  it('shows Feb 29 on Feb 28 of a non-leap year, and only on the 29th in a leap year', () => {
    const leapDay = at(1, '2024-02-29')
    expect(ids(onThisDay([leapDay], '2027-02-28'))).toEqual([1])
    expect(ids(onThisDay([leapDay], '2028-02-28'))).toEqual([])
    expect(ids(onThisDay([leapDay], '2028-02-29'))).toEqual([1])
  })
})
