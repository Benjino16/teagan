import { BookOpen, ChevronRight, HandCoins, History } from 'lucide-react'
import { Link } from 'react-router'
import { IconBadge, ListCard, listRowStyles, MediaRow } from '../../components/ui'
import { milestones } from '../../domain/activities'
import { useMoney } from '../../data/queries'
import { balanceOf, balanceText } from '../../domain/ledger'
import { displayName } from '../../domain/people'
import type { PersonViewData } from './usePersonView'

function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

interface Props {
  data: PersonViewData
  /** Wide screens show timeline and knowledge on the page itself – only the rest is linked. */
  onlyMoney?: boolean
}

/** Entry points to the Timeline, Knowledge and Money subpages. */
export function PersonSections({ data, onlyMoney = false }: Props) {
  const { person, activities, facts, ledger } = data
  const money = useMoney()
  const firstYear = activities.reduce<string | null>(
    (min, a) => (min === null || a.startDate < min ? a.startDate : min),
    null,
  )
  const lifeEvents = milestones(activities, person.id).length

  const moneySection = {
    to: `/people/${person.id}/money`,
    icon: HandCoins,
    title: 'Money',
    subtitle: ledger.length === 0 ? 'No entries' : balanceText(balanceOf(ledger), displayName(person), money),
  }
  // No money with yourself
  const sections = onlyMoney ? (person.isSelf ? [] : [moneySection]) : [
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
    ...(person.isSelf ? [] : [moneySection]),
  ]
  if (sections.length === 0) return null

  return (
    <nav aria-label="More about this person">
      <ListCard>
        {sections.map((section) => (
          <li key={section.to}>
            <Link to={section.to} className={`${listRowStyles} text-ink no-underline hover:bg-hover`}>
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
