import type { Activity, Group, Fact, Impact, OpenPoint, Person, Membership } from '../domain/model'
import raw from './fixture.json'

/** Test fixture for the pure domain functions: the prototype's demo data, aligned to `FIXTURE_TODAY`. */
export interface Database {
  people: Person[]
  groups: Group[]
  memberships: Membership[]
  activities: Activity[]
  openPoints: OpenPoint[]
  facts: Fact[]
}

/** Timestamp of the fixture when the source has none of its own. */
const FIXTURE_TIMESTAMP = `${raw._meta.today}T12:00:00Z`

const stamps = (createdAt = FIXTURE_TIMESTAMP) => ({ createdAt, updatedAt: createdAt })

/** Converts `fixture.json` (domain field names, optional fields) into the data model. */
export function createTestDatabase(): Database {
  return {
    people: raw.people.map((p) => ({
      id: p.id,
      name: p.name,
      nickname: p.nickname ?? null,
      birthday: p.birthday ?? null,
      birthdayNote: p.birthdayNote ?? null,
      reconnectDays: p.reconnectDays ?? null,
      impact: (p.impact ?? 3) as Impact,
      focus: p.focus ?? false,
      deceased: false,
      diedOn: null,
      archivedAt: null,
      photo: null,
      isSelf: p.isSelf ?? false,
      ...stamps(),
    })),
    groups: raw.groups.map((c) => ({
      id: c.id,
      name: c.name,
      parentId: c.parentId ?? null,
      archivedAt: null,
      ...stamps(),
    })),
    memberships: raw.memberships.map((pc) => ({
      personId: pc.personId,
      groupId: pc.groupId,
      createdAt: FIXTURE_TIMESTAMP,
    })),
    activities: raw.activities.map((a) => ({
      id: a.id,
      name: a.name,
      icon: a.icon,
      startDate: a.startDate,
      endDate: a.endDate ?? null,
      description: a.description ?? null,
      location: 'location' in a ? (a.location ?? null) : null,
      impact: a.impact as Impact,
      mood: null,
      reminder: a.reminder,
      participants: a.people.map((p) => ({
        personId: p.personId,
        impact: ('impact' in p ? (p.impact ?? null) : null) as Impact | null,
        mood: null,
        note: 'note' in p ? (p.note ?? null) : null,
      })),
      groups: [],
      ...stamps(),
    })),
    openPoints: raw.openPoints.map((p) => ({
      id: p.id,
      personId: p.personId,
      text: p.text,
      activityId: p.activityId ?? null,
      doneAt: p.doneAt ? `${p.doneAt}T12:00:00Z` : null,
      ...stamps(`${p.createdAt}T12:00:00Z`),
    })),
    facts: raw.facts.map((f) => ({
      id: f.id,
      personId: f.personId,
      label: f.label,
      value: f.value,
      sort: f.sort,
      ...stamps(),
    })),
  }
}

