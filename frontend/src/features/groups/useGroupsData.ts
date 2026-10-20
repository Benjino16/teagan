import { useGroups, usePeople, useMemberships } from '../../data/queries'
import { buildGroupTree, type GroupNode } from '../../domain/groups'
import type { Group, Id, Person, Membership } from '../../domain/model'

export interface GroupsData {
  groups: Group[]
  /** Without your own memberships – you never appear in groups. */
  memberships: Membership[]
  /** Everyone except you. */
  people: Person[]
  personById: Map<Id, Person>
  tree: GroupNode[]
}

export type GroupsState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: GroupsData }

/** Bundles the queries of the group pages. */
export function useGroupsData(): GroupsState {
  const groups = useGroups()
  const memberships = useMemberships()
  const people = usePeople()

  if (groups.isError || memberships.isError || people.isError) return { status: 'error' }
  if (!groups.data || !memberships.data || !people.data) return { status: 'loading' }

  const others = people.data.filter((p) => !p.isSelf)
  const personById = new Map(others.map((p) => [p.id, p]))
  const ownLinks = memberships.data.filter((m) => personById.has(m.personId))

  return {
    status: 'ready',
    data: {
      groups: groups.data,
      memberships: ownLinks,
      people: others,
      personById,
      tree: buildGroupTree(groups.data, ownLinks),
    },
  }
}

/** `No one yet` · `1 person` · `3 people` */
export function peopleCountText(count: number): string {
  if (count === 0) return 'No one yet'
  return `${count} ${count === 1 ? 'person' : 'people'}`
}
