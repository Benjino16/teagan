import { BookOpen, ChevronRight, History } from 'lucide-react'
import { Link } from 'react-router'
import { IconBadge, ListCard, listRowStyles, MediaRow } from '../../components/ui'
import { milestones } from '../../domain/activities'
import type { PersonViewData } from './usePersonView'

function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

/** Entry points to the Timeline and Knowledge subpages. */
export function PersonSections({ data }: { data: PersonViewData }) {
  const { person, activities, facts } = data
  const firstYear = activities.reduce<string | null>(
    (min, a) => (min === null || a.startDate < min ? a.startDate : min),
    null,
  )
  const lifeEvents = milestones(activities, person.id).length

  const sections = [
    {
      to: `/people/${person.id}/timeline`,
      icon: History,
      title: 'Timeline',
      subtitle:
        count(activities.length, 'entry', 'entries') + (firstYear ? ` · since ${firstYear.slice(0, 4)}` : ''),
    },
    {
      to: `/people/${person.id}/knowledge`,
      icon: BookOpen,
      title: 'Knowledge',
      subtitle:
        count(facts.length, 'note', 'notes') +
        (lifeEvents > 0 ? ` · ${count(lifeEvents, 'milestone', 'milestones')}` : ''),
    },
  ]

  return (
    <nav aria-label="More about this person">
      <ListCard>
        {sections.map((section) => (
          <li key={section.to}>
            <Link to={section.to} className={`${listRowStyles} text-ink no-underline hover:bg-canvas`}>
              <MediaRow
                leading={<IconBadge icon={section.icon} size={36} />}
                title={section.title}
                subtitle={section.subtitle}
                trailing={<ChevronRight aria-hidden="true" size={18} className="flex-none text-muted" />}
              />
            </Link>
          </li>
        ))}
      </ListCard>
    </nav>
  )
}
