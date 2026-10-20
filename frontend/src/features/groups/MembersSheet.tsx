import { clsx } from 'clsx'
import { useState } from 'react'
import { Avatar, BottomSheet, CheckBox, ListCard, listRowStyles, MediaRow, TextInput } from '../../components/ui'
import { useSetMembership } from '../../data/queries'
import { memberPickerOrder } from '../../domain/groups'
import type { Group, Id, Person, Membership } from '../../domain/model'
import { isArchived } from '../../domain/people'
import { matchesSearch } from '../../domain/search'

interface Props {
  group: Group
  groups: Group[]
  /** Everyone except you. */
  people: Person[]
  /** All memberships of these people. */
  memberships: Membership[]
  onClose: () => void
}

/** Ticking people in or out of a group; every tap saves immediately, keeping members of a subgroup in its main group. */
export function MembersSheet({ group, groups, people, memberships, onClose }: Props) {
  const setMembership = useSetMembership()
  const [query, setQuery] = useState('')
  const byPerson = new Map(memberships.filter((m) => m.groupId === group.id).map((m) => [m.personId, m]))
  const subgroups = groups.filter((c) => c.parentId === group.id)
  // Order from the time of opening, so rows don't jump while ticking.
  const [initialMembers] = useState<ReadonlySet<Id>>(() => new Set(byPerson.keys()))
  // Archived people only while they are still members, so they can be removed
  const shown = memberPickerOrder(people, initialMembers).filter(
    (p) => (!isArchived(p) || initialMembers.has(p.id)) && matchesSearch(query, [p.name, p.nickname]),
  )

  return (
    <BottomSheet title={`Members of ${group.name}`} onClose={onClose}>
      <div className="sticky top-0 z-10 bg-surface pb-3">
        <TextInput
          type="search"
          aria-label="Search people"
          placeholder="Search …"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {shown.length === 0 ? (
        <p className="px-1 py-3 text-md text-muted">No one found.</p>
      ) : (
        <ListCard aria-label="People">
          {shown.map((person) => {
            const membership = byPerson.get(person.id)
            const checked = membership !== undefined
            // In a main group: show what unticking removes as well.
            const alsoIn = subgroups
              .filter((g) => memberships.some((m) => m.personId === person.id && m.groupId === g.id))
              .map((g) => g.name)
            const subtitle = alsoIn.length > 0 ? `also in ${alsoIn.join(', ')}` : undefined
            return (
              <li key={person.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  onClick={() => setMembership.mutate({ personId: person.id, groupId: group.id, member: !checked })}
                  className={clsx(
                    listRowStyles,
                    'py-2.5 hover:bg-canvas focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
                  )}
                >
                  <MediaRow
                    leading={<Avatar name={person.name} photo={person.photo} size="md" />}
                    title={person.name}
                    subtitle={subtitle}
                    trailing={<CheckBox checked={checked} />}
                  />
                </button>
              </li>
            )
          })}
        </ListCard>
      )}
    </BottomSheet>
  )
}
