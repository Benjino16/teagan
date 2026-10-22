import { useState } from 'react'
import { Link } from 'react-router'
import { EmptyState, IconBadge, ListCard, SectionHeader, listRowStyles } from '../../components/ui'
import { useReorderFacts } from '../../data/queries'
import { milestones } from '../../domain/activities'
import { formatDateRange } from '../../domain/dates'
import { displayName } from '../../domain/people'
import { activityIcon } from '../../icons/activityIcons'
import { SortableFacts } from './SortableFacts'
import type { PersonViewData } from './usePersonView'

/** Knowledge fields and derived milestones. */
export function PersonKnowledge({ data }: { data: PersonViewData }) {
  const { person, facts, activities } = data
  const lifeEvents = milestones(activities, person.id)
  const reorder = useReorderFacts(person.id)
  const [sorting, setSorting] = useState(false)
  const canSort = facts.length >= 2

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="facts" className="flex flex-col gap-2.5">
        <SectionHeader
          id="facts"
          title={`About ${displayName(person)}`}
          aside={
            canSort ? (
              <button
                type="button"
                aria-pressed={sorting}
                onClick={() => setSorting(!sorting)}
                className="-my-3 -mr-2 min-h-11 rounded-tile-sm px-2 text-md font-semibold text-accent-ink hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-accent"
              >
                {sorting ? 'Done' : 'Sort'}
              </button>
            ) : undefined
          }
        />
        {facts.length === 0 ? (
          <EmptyState>Nothing noted yet.</EmptyState>
        ) : sorting && canSort ? (
          <SortableFacts facts={facts} onReorder={(ids) => reorder.mutate(ids)} />
        ) : (
          <ListCard>
            {facts.map((fact) => (
              <li key={fact.id}>
                <Link
                  to={`/people/${person.id}/facts/${fact.id}/edit`}
                  className="flex flex-col gap-0.75 px-4 py-3.5 text-ink no-underline hover:bg-hover"
                >
                  <span className="text-xs font-medium tracking-wide text-muted uppercase">{fact.label}</span>
                  <span className="text-base font-medium whitespace-pre-line">{fact.value}</span>
                </Link>
              </li>
            ))}
          </ListCard>
        )}
      </section>

      {lifeEvents.length > 0 && (
        <section aria-labelledby="milestones" className="flex flex-col gap-2.5">
          <SectionHeader id="milestones" title="Milestones" aside="Impact 5" />
          <ListCard variant="accent">
            {lifeEvents.map((activity) => (
              <li key={activity.id}>
                <Link
                  to={`/activities/${activity.id}`}
                  className={`${listRowStyles} text-ink no-underline hover:bg-hover`}
                >
                  <IconBadge icon={activityIcon(activity.icon).Icon} size={36} shape="circle" tone="accent" />
                  <span className="min-w-0 flex-auto text-base font-semibold">{activity.name}</span>
                  <span className="flex-none text-sm whitespace-nowrap text-muted">
                    {formatDateRange(activity.startDate, activity.endDate)}
                  </span>
                </Link>
              </li>
            ))}
          </ListCard>
        </section>
      )}
    </div>
  )
}
