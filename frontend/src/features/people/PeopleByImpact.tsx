import { ChevronRight, Target } from 'lucide-react'
import { NavLink } from 'react-router'
import { StickyBar } from '../../components/layout/StickyBar'
import { Avatar, ImpactDots, ListCard, listRowStyles, MediaRow } from '../../components/ui'
import type { Person } from '../../domain/model'
import { groupByImpact, isContactPaused } from '../../domain/people'

interface Props {
  people: Person[]
  /** Offset of the sticky impact headers, e.g. the height of a sticky search above them. */
  headerOffset?: number
}

/** People as linked rows, one card per impact level (5 → 1); each level's header sticks while its card scrolls by. */
export function PeopleByImpact({ people, headerOffset = 0 }: Props) {
  return groupByImpact(people).map((group) => (
    <section key={group.impact} aria-label={`Impact ${group.impact}`} className="flex flex-col gap-2.5">
      <StickyBar below={headerOffset} layer="below">
        <ImpactDots value={group.impact} className="px-1" />
      </StickyBar>
      <ListCard>
        {group.people.map((person) => (
          <li key={person.id}>
            {/* Highlighted where the list sits beside the open person (wide screens) */}
            <NavLink
              to={`/people/${person.id}`}
              className={`${listRowStyles} text-ink no-underline hover:bg-canvas aria-[current=page]:bg-accent-soft`}
            >
              <MediaRow
                leading={<Avatar name={person.name} photo={person.photo} size="md" />}
                title={
                  // Focus pauses while archived or deceased
                  person.focus && !isContactPaused(person) ? (
                    <span className="flex items-center gap-1.5">
                      {person.name}
                      <Target aria-label="In focus" role="img" size={14} className="flex-none text-accent" />
                    </span>
                  ) : (
                    person.name
                  )
                }
                subtitle={person.nickname ?? undefined}
                trailing={<ChevronRight aria-hidden="true" size={18} className="flex-none text-muted" />}
              />
            </NavLink>
          </li>
        ))}
      </ListCard>
    </section>
  ))
}
