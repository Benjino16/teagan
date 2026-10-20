import { clsx } from 'clsx'
import { ChevronRight } from 'lucide-react'
import { NavLink } from 'react-router'
import { listRowStyles } from '../../components/ui'
import type { GroupNode } from '../../domain/groups'
import { peopleCountText } from './useGroupsData'

interface Props {
  nodes: GroupNode[]
  /** Left padding in px, e.g. to align with the main group's name. */
  indent?: number
}

/** Subgroups as `<li>` rows: name, count, chevron; archived ones muted. */
export function SubgroupRows({ nodes, indent = 16 }: Props) {
  return nodes.map(({ group, personIds }) => (
    <li key={group.id}>
      <NavLink
        to={`/groups/${group.id}`}
        className={clsx(
          listRowStyles,
          'py-3 no-underline hover:bg-canvas aria-[current=page]:bg-accent-soft',
          group.archivedAt ? 'text-muted' : 'text-ink',
        )}
        style={{ paddingLeft: indent }}
      >
        <span className="min-w-0 flex-auto text-base font-medium">{group.name}</span>
        <span className="flex-none text-sm text-muted">
          {group.archivedAt ? 'archived' : peopleCountText(personIds.length)}
        </span>
        <ChevronRight aria-hidden="true" size={18} className="flex-none text-muted" />
      </NavLink>
    </li>
  ))
}
