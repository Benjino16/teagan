import { ChevronRight, HandCoins } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { Button, Card, EmptyState, IconBadge, ListCard, listRowStyles, MediaRow, SectionHeader } from '../../components/ui'
import { formatDateRangeWithYear, formatDayMonth, yearOf } from '../../domain/dates'
import { useMoney } from '../../data/queries'
import { balanceOf, balanceText, entryText, settlingCents } from '../../domain/ledger'
import { displayName } from '../../domain/people'
import type { PersonViewData } from './usePersonView'

/** Balance and every entry with the person, newest first. */
export function PersonMoney({ data }: { data: PersonViewData }) {
  const { person, ledger, activities, today } = data
  const name = displayName(person)
  const activityById = new Map(activities.map((a) => [a.id, a]))
  const navigate = useNavigate()
  const money = useMoney()
  const balance = balanceOf(ledger)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2.5">
        <Card>
          <MediaRow leading={<IconBadge icon={HandCoins} />} title={balanceText(balance, name, money)} />
        </Card>
        {balance !== 0 && (
          // Only prefills the form – nothing is saved until it's submitted
          <Button
            variant="secondary"
            onClick={() =>
              navigate(`/people/${person.id}/money/new?amount=${settlingCents(balance)}&note=${encodeURIComponent('Settled up')}`)
            }
          >
            Settle up
          </Button>
        )}
      </div>

      <section aria-labelledby="money-entries" className="flex flex-col gap-2.5">
        <SectionHeader id="money-entries" title="Entries" aside={ledger.length} />
        {ledger.length === 0 ? (
          <EmptyState>No money noted yet.</EmptyState>
        ) : (
          <ListCard>
            {ledger.map((entry) => {
              const date = yearOf(entry.date) === yearOf(today) ? formatDayMonth(entry.date) : formatDateRangeWithYear(entry.date, null)
              const source = entry.activityId === null ? undefined : activityById.get(entry.activityId)
              return (
                <li key={entry.id}>
                  <Link
                    to={`/people/${person.id}/money/${entry.id}/edit`}
                    className={`${listRowStyles} text-ink no-underline hover:bg-hover`}
                  >
                    <MediaRow
                      title={entryText(entry.amountCents, name, money)}
                      subtitle={[date, entry.note, source?.name].filter(Boolean).join(' · ')}
                      trailing={<ChevronRight aria-hidden="true" size={18} className="flex-none text-muted" />}
                    />
                  </Link>
                </li>
              )
            })}
          </ListCard>
        )}
      </section>
    </div>
  )
}
