import { describe, expect, it } from 'vitest'
import { createTestDatabase } from '../test/fixture'
import {
  archivedWith,
  buildGroupTree,
  groupPath,
  isGroupArchived,
  groupMembers,
  memberPickerOrder,
  membershipEffects,
  mostSpecificGroups,
  parentOptions,
  splitByArchived,
} from './groups'
import type { Group, Id } from './model'

const db = createTestDatabase()
const others = db.people.filter((p) => !p.isSelf)
const names = (items: { name: string }[]) => items.map((i) => i.name)
// Seed: University (1) › Freshers 2021 (3), Sports (4) › Bouldering (5), Family (6)

describe('groups', () => {
  it('builds the path', () => {
    expect(groupPath(3, db.groups)).toBe('University › Freshers 2021')
  })

  it('counts people including subgroups without duplicates', () => {
    const tree = buildGroupTree(db.groups, db.memberships)
    expect(tree.map((n) => [n.group.name, n.personIds.length, n.children.length])).toEqual([
      ['Family', 0, 0],
      ['Sports', 2, 1],
      ['University', 3, 1],
    ])
  })
})

describe('groupMembers', () => {
  it('lists members with their subgroups', () => {
    const members = groupMembers(4, db.groups, db.memberships, others)
    expect(members.map((m) => [m.person.name, m.subgroupIds])).toEqual([
      ['Jonas Weber', [5]],
      ['Lena Hoffmann', [5]],
    ])
  })

  it('skips people that are not passed in (yourself)', () => {
    const memberships = [{ personId: 1, groupId: 6, createdAt: '' }]
    expect(groupMembers(6, db.groups, memberships, others)).toEqual([])
  })
})

describe('membershipEffects', () => {
  const links = db.memberships

  it('adds the main group along with a subgroup', () => {
    expect(membershipEffects({ personId: 3, groupId: 3, member: true }, db.groups, links)).toEqual({
      add: [3, 1],
      remove: [],
    })
    // Already in the main group
    expect(membershipEffects({ personId: 3, groupId: 5, member: true }, db.groups, links).add).toEqual([])
  })

  it('keeps the main group when leaving a subgroup', () => {
    expect(membershipEffects({ personId: 2, groupId: 3, member: false }, db.groups, links)).toEqual({
      add: [],
      remove: [3],
    })
  })

  it('removes the subgroups when leaving the main group', () => {
    expect(membershipEffects({ personId: 2, groupId: 1, member: false }, db.groups, links).remove).toEqual([1, 3])
  })
})

describe('group placement', () => {
  it('shows only the most specific group per main group', () => {
    expect(mostSpecificGroups([1, 3, 4, 6], db.groups)).toEqual([3, 4, 6])
  })

  it('offers main groups as parents, none for a group with subgroups', () => {
    expect(names(parentOptions(db.groups))).toEqual(['Family', 'Sports', 'University'])
    expect(names(parentOptions(db.groups, 6))).toEqual(['Sports', 'University'])
    expect(parentOptions(db.groups, 1)).toEqual([])
  })

  it('offers no archived main group, except the one a group is already in', () => {
    const groups = archive(db.groups, 4)
    expect(names(parentOptions(groups))).toEqual(['Family', 'University'])
    expect(names(parentOptions(groups, 5))).toEqual(['Family', 'Sports', 'University'])
  })
})

const ARCHIVED_AT = '2026-10-01T12:00:00Z'
const archive = (groups: Group[], ...ids: Id[]) =>
  groups.map((c) => (ids.includes(c.id) ? { ...c, archivedAt: ARCHIVED_AT } : c))
const byId = (groups: Group[], id: Id) => groups.find((c) => c.id === id)!

describe('archived groups', () => {
  it('counts a subgroup as archived along with its main group', () => {
    const groups = archive(db.groups, 4)
    expect(isGroupArchived(byId(groups, 5), groups)).toBe(true)
    expect(archivedWith(byId(groups, 5), groups)?.name).toBe('Sports')
    expect(isGroupArchived(byId(groups, 3), groups)).toBe(false)
  })

  it('keeps the chip of an active main group when the subgroup is archived', () => {
    expect(mostSpecificGroups([1, 3], archive(db.groups, 3))).toEqual([1, 3])
    expect(mostSpecificGroups([4, 5], archive(db.groups, 4))).toEqual([5])
  })

  it('does not archive the main group along with a subgroup', () => {
    const groups = archive(db.groups, 5)
    expect(isGroupArchived(byId(groups, 5), groups)).toBe(true)
    expect(archivedWith(byId(groups, 5), groups)).toBeUndefined()
    expect(isGroupArchived(byId(groups, 4), groups)).toBe(false)
  })

  it('lists an archived main group with its subgroups, an archived subgroup on its own', () => {
    const groups = archive(db.groups, 3, 4)
    const { active, archived } = splitByArchived(buildGroupTree(groups, db.memberships))
    expect(active.map((g) => [g.node.group.name, g.node.children.length, g.archivedSubgroups])).toEqual([
      ['Family', 0, 0],
      ['University', 0, 1],
    ])
    // Sorted by path: “Sports” before “University › Freshers 2021”
    expect(archived.map((g) => [g.parent?.name ?? null, g.node.group.name, g.node.children.length])).toEqual([
      [null, 'Sports', 1],
      ['University', 'Freshers 2021', 0],
    ])
  })
})

describe('memberPickerOrder', () => {
  it('lists members first', () => {
    expect(names(memberPickerOrder(others, new Set([5, 3])))).toEqual([
      'Jonas Weber',
      'Tim Krause',
      'Lena Hoffmann',
      'Mira Schulz',
    ])
  })
})
