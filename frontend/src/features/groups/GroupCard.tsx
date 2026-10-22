import { clsx } from 'clsx'
import { ChevronRight, LayoutGrid } from 'lucide-react'
import { Link, NavLink } from 'react-router'
import { AvatarStack, cardStyles, IconBadge, listRowStyles } from '../../components/ui'
import type { GroupNode } from '../../domain/groups'
import { pluralize } from '../../domain/dates'
import type { Group, Id, Person } from '../../domain/model'
import { byImpactThenName } from '../../domain/people'
import { SubgroupRows } from './SubgroupRows'
import { peopleCountText } from './useGroupsData'

interface Props {
  node: GroupNode
  personById: Map<Id, Person>
  /** Main group of a subgroup that stands on its own (archive), shown above the name. */
  parent?: Group | null
  /** Subgroups left out because they are archived – a row leads to them. */
  archivedSubgroups?: number
}

/** A top-level group with avatar stack and its subgroups. */
export function GroupCard({ node, personById, parent = null, archivedSubgroups = 0 }: Props) {
  const { group, children, personIds } = node
  const headingId = `group-${group.id}`
  const members = personIds.flatMap((id) => personById.get(id) ?? []).sort(byImpactThenName)

  return (
    <section aria-labelledby={headingId} className={clsx(cardStyles({ padding: 'none' }), 'overflow-hidden')}>
      {/* Highlighted where the list sits beside the open group (large screens) */}
      <NavLink
        to={`/groups/${group.id}`}
        className={clsx(listRowStyles, 'text-ink no-underline hover:bg-hover aria-[current=page]:bg-accent-soft')}
      >
        <IconBadge icon={LayoutGrid} />
        <span className="flex min-w-0 flex-auto flex-col gap-0.5">
          {parent && <span className="text-sm text-muted">{parent.name} ›</span>}
          <h2 id={headingId} className="font-display text-lg leading-tight font-bold">
            {group.name}
          </h2>
          <span className="text-sm text-muted">{peopleCountText(personIds.length)}</span>
        </span>
        <AvatarStack people={members} />
        <ChevronRight aria-hidden="true" size={18} className="flex-none text-muted" />
      </NavLink>
      {(children.length > 0 || archivedSubgroups > 0) && (
        <ul aria-label={`Subgroups of ${group.name}`} className="divide-y divide-divider border-t border-divider">
          {/* Aligned with the group name: 16 px padding + 40 px icon + 12 px gap */}
          <SubgroupRows nodes={children} indent={68} />
          {archivedSubgroups > 0 && (
            <li>
              <Link
                to="/groups/archived"
                className={clsx(listRowStyles, 'py-3 text-sm text-muted no-underline hover:bg-hover')}
                style={{ paddingLeft: 68 }}
              >
                <span className="flex-auto">{pluralize(archivedSubgroups, 'subgroup')} archived</span>
                <ChevronRight aria-hidden="true" size={18} className="flex-none" />
              </Link>
            </li>
          )}
        </ul>
      )}
    </section>
  )
}
