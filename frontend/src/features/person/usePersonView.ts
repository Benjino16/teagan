import { useMemo } from 'react'
import {
  useActivitiesForPerson,
  useGroups,
  useFacts,
  useOpenPoints,
  usePeople,
  usePerson,
  useMemberships,
  useSelf,
} from '../../data/queries'
import { groupPath, isGroupArchived, mostSpecificGroups } from '../../domain/groups'
import type { Activity, Fact, Id, IsoDate, OpenPoint, Person } from '../../domain/model'
import { displayName } from '../../domain/people'

export interface PersonViewData {
  person: Person
  self: Person
  activities: Activity[]
  openPoints: OpenPoint[]
  facts: Fact[]
  /** The person's groups with their path, e.g. `University › Freshers 2021`; archived ones last. */
  groups: PersonGroup[]
  nameOf: (id: Id) => string
  today: IsoDate
}

export interface PersonGroup {
  id: Id
  path: string
  /** Still shown – it says where you know someone from – but muted. */
  archived: boolean
}

export type PersonViewState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'not-found' }
  | { status: 'ready'; data: PersonViewData }

/** Bundles all queries of the person view. Derivations happen in the components via `domain/`. */
export function usePersonView(personId: Id, today: IsoDate): PersonViewState {
  const person = usePerson(personId)
  const self = useSelf()
  const people = usePeople()
  const activities = useActivitiesForPerson(personId)
  const openPoints = useOpenPoints(personId)
  const facts = useFacts(personId)
  const groups = useGroups()
  const memberships = useMemberships()

  const queries = [person, self, people, activities, openPoints, facts, groups, memberships]

  const nameOf = useMemo(() => {
    const names = new Map((people.data ?? []).map((p) => [p.id, displayName(p)]))
    return (id: Id) => names.get(id) ?? 'Unknown'
  }, [people.data])

  if (queries.some((q) => q.isError)) return { status: 'error' }
  if (person.isSuccess && person.data === null) return { status: 'not-found' }
  if (
    !person.data ||
    !self.data ||
    !activities.data ||
    !openPoints.data ||
    !facts.data ||
    !groups.data ||
    !memberships.data ||
    !people.data
  ) {
    return { status: 'loading' }
  }

  const ownGroups = memberships.data.filter((m) => m.personId === personId).map((m) => m.groupId)
  const personGroups = mostSpecificGroups(ownGroups, groups.data)
    .map((id) => ({
      id,
      path: groupPath(id, groups.data),
      archived: isGroupArchived(groups.data.find((c) => c.id === id)!, groups.data),
    }))
    .sort((a, b) => Number(a.archived) - Number(b.archived) || a.path.localeCompare(b.path))

  return {
    status: 'ready',
    data: {
      person: person.data,
      self: self.data,
      activities: activities.data,
      openPoints: openPoints.data,
      facts: facts.data,
      groups: personGroups,
      nameOf,
      today,
    },
  }
}
