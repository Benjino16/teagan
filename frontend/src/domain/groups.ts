import type { Group, Id, Person, Membership } from './model'
import { isContactPaused } from './people'

/** Path from the main group to the group: `University › Freshers 2021`. */
export function groupPath(groupId: Id, groups: Group[]): string {
  const byId = new Map(groups.map((c) => [c.id, c]))
  const names: string[] = []
  const seen = new Set<Id>()
  let current = byId.get(groupId)
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    names.unshift(current.name)
    current = current.parentId === null ? undefined : byId.get(current.parentId)
  }
  return names.join(' › ')
}

/** Archived itself, or along with its main group. */
export function isGroupArchived(group: Group, groups: Group[]): boolean {
  return group.archivedAt !== null || archivedWith(group, groups) !== undefined
}

/** The archived main group a subgroup is archived along with – it can only come back with it. */
export function archivedWith(group: Group, groups: Group[]): Group | undefined {
  if (group.parentId === null) return undefined
  const parent = groups.find((c) => c.id === group.parentId)
  return parent?.archivedAt ? parent : undefined
}

export interface GroupNode {
  group: Group
  children: GroupNode[]
  /** People in this group and all subgroups (without duplicates). */
  personIds: Id[]
}

/** Groups as a tree, alphabetical per level. */
export function buildGroupTree(groups: Group[], memberships: Membership[]): GroupNode[] {
  const childrenOf = new Map<Id | null, Group[]>()
  for (const c of groups) {
    const list = childrenOf.get(c.parentId) ?? []
    list.push(c)
    childrenOf.set(c.parentId, list)
  }

  const membersOf = new Map<Id, Id[]>()
  for (const m of memberships) {
    const list = membersOf.get(m.groupId) ?? []
    list.push(m.personId)
    membersOf.set(m.groupId, list)
  }

  function build(group: Group): GroupNode {
    const people = new Set(membersOf.get(group.id))
    const children = (childrenOf.get(group.id) ?? []).sort(byName).map((child) => {
      const node = build(child)
      node.personIds.forEach((p) => people.add(p))
      return node
    })
    return { group, children, personIds: [...people] }
  }

  return (childrenOf.get(null) ?? []).sort(byName).map(build)
}

export interface ActiveGroup {
  /** Without archived subgroups. */
  node: GroupNode
  archivedSubgroups: number
}

export interface ArchivedGroup {
  node: GroupNode
  /** Set for an archived subgroup of an active main group, which then stands on its own. */
  parent: Group | null
}

/**
 * The group list split by archive state. An archived main group takes its subgroups along;
 * an archived subgroup of an active one is listed on its own, by path.
 */
export function splitByArchived(tree: GroupNode[]): { active: ActiveGroup[]; archived: ArchivedGroup[] } {
  const active: ActiveGroup[] = []
  const archived: ArchivedGroup[] = []
  for (const node of tree) {
    if (node.group.archivedAt) {
      archived.push({ node, parent: null })
      continue
    }
    const children = node.children.filter((child) => !child.group.archivedAt)
    for (const child of node.children) {
      if (child.group.archivedAt) archived.push({ node: child, parent: node.group })
    }
    active.push({ node: { ...node, children }, archivedSubgroups: node.children.length - children.length })
  }
  const path = ({ node, parent }: ArchivedGroup) => (parent ? `${parent.name} › ` : '') + node.group.name
  archived.sort((a, b) => path(a).localeCompare(path(b)))
  return { active, archived }
}

/** Finds a group in the tree. */
export function findGroupNode(tree: GroupNode[], id: Id): GroupNode | undefined {
  for (const node of tree) {
    if (node.group.id === id) return node
    const found = findGroupNode(node.children, id)
    if (found) return found
  }
  return undefined
}

export interface GroupMember {
  person: Person
  /** Subgroups of this group the person is in. */
  subgroupIds: Id[]
}

/**
 * Members of a group, alphabetical. Memberships of people missing
 * from `people` are skipped – pass everyone except yourself.
 */
export function groupMembers(
  groupId: Id,
  groups: Group[],
  memberships: Membership[],
  people: Person[],
): GroupMember[] {
  const byId = new Map(people.map((p) => [p.id, p]))
  const subgroups = new Set(groups.filter((c) => c.parentId === groupId).map((c) => c.id))
  const members = new Map<Id, GroupMember>()

  for (const m of memberships) {
    const person = byId.get(m.personId)
    if (!person || (m.groupId !== groupId && !subgroups.has(m.groupId))) continue
    const member = members.get(person.id) ?? { person, subgroupIds: [] }
    if (m.groupId !== groupId) member.subgroupIds.push(m.groupId)
    members.set(person.id, member)
  }

  return [...members.values()].sort((a, b) => a.person.name.localeCompare(b.person.name))
}

/**
 * “Add all members” on an event: everyone in the group or its subgroups who isn't a participant yet,
 * alphabetical. Archived and deceased people are left out – add them one by one if they were there.
 */
export function membersToAdd(
  groupId: Id,
  groups: Group[],
  memberships: Membership[],
  people: Person[],
  participantIds: ReadonlySet<Id>,
): Person[] {
  return groupMembers(groupId, groups, memberships, people)
    .map((m) => m.person)
    .filter((p) => !participantIds.has(p.id) && !isContactPaused(p))
}

export interface MembershipChange {
  personId: Id
  groupId: Id
  member: boolean
}

/**
 * Which memberships a change adds or removes, keeping “subgroup ⇒ main group”:
 * adding to a subgroup adds the main group, removing from a main group removes its subgroups.
 * Shared by the repository and the optimistic update, so both behave the same.
 */
export function membershipEffects(
  change: MembershipChange,
  groups: Group[],
  memberships: Membership[],
): { add: Id[]; remove: Id[] } {
  const { personId, groupId, member } = change
  const has = (id: Id) => memberships.some((m) => m.personId === personId && m.groupId === id)

  if (member) {
    const parentId = groups.find((c) => c.id === groupId)?.parentId ?? null
    return { add: [groupId, ...(parentId === null ? [] : [parentId])].filter((id) => !has(id)), remove: [] }
  }
  const subgroups = groups.filter((c) => c.parentId === groupId).map((c) => c.id)
  return { add: [], remove: [groupId, ...subgroups].filter(has) }
}

/**
 * A person's groups without main groups that a subgroup already implies (person chips).
 * An archived subgroup implies nothing, so its active main group keeps its own chip.
 */
export function mostSpecificGroups(groupIds: Id[], groups: Group[]): Id[] {
  const ids = new Set(groupIds)
  const implied = new Set(
    groups.filter((c) => ids.has(c.id) && c.parentId !== null && c.archivedAt === null).map((c) => c.parentId!),
  )
  return groupIds.filter((id) => !implied.has(id))
}

/** Order in the member picker: members first, then everyone else, alphabetical each. */
export function memberPickerOrder(people: Person[], memberIds: ReadonlySet<Id>): Person[] {
  return [...people].sort(
    (a, b) => Number(memberIds.has(b.id)) - Number(memberIds.has(a.id)) || a.name.localeCompare(b.name),
  )
}

/**
 * Main groups a group may be placed in: not itself, not if it has subgroups,
 * no archived ones – unless it already is in one.
 */
export function parentOptions(groups: Group[], id?: Id): Group[] {
  if (id !== undefined && groups.some((c) => c.parentId === id)) return []
  const current = groups.find((c) => c.id === id)?.parentId
  return groups
    .filter((c) => c.parentId === null && c.id !== id && (c.archivedAt === null || c.id === current))
    .sort(byName)
}

function byName(a: Group, b: Group): number {
  return a.name.localeCompare(b.name)
}
