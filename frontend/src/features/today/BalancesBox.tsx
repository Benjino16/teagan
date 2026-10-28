import { clsx } from 'clsx'
import { HandCoins } from 'lucide-react'
import { Link } from 'react-router'
import { Avatar, cardStyles, IconBadge, listRowStyles, MediaRow, ShowMore, usePreview } from '../../components/ui'
import { useMoney } from '../../data/queries'
import { balanceRowText, overallText } from '../../domain/ledger'
import type { Balance, Id, Person } from '../../domain/model'
import { TODAY_PREVIEW } from './preview'

interface Props {
  /** Largest amounts first, as the backend sends them. */
  balances: Balance[]
  personById: Map<Id, Person>
}

/** Everyone with money open on “Today”, with the overall direction on top. */
export function BalancesBox({ balances, personById }: Props) {
  const money = useMoney()
  const rows = balances.flatMap((b) => {
    const person = personById.get(b.personId)
    return person ? [{ person, balance: b.balanceCents }] : []
  })
  const preview = usePreview(rows, TODAY_PREVIEW)
  if (rows.length === 0) return null

  return (
    <section aria-labelledby="today-money" className={clsx(cardStyles({ padding: 'none' }), 'overflow-hidden')}>
      <div className="flex items-center gap-3 px-4 pt-3.5 pb-1.5">
        <IconBadge icon={HandCoins} size={32} />
        <h2 id="today-money" className="font-display text-lg font-bold">
          Money
        </h2>
      </div>
      <p className="px-4 pt-1 pb-3 text-md font-medium text-ink-2">{overallText(balances, money)}</p>
      <ul className="divide-y divide-divider border-t border-divider">
        {preview.shown.map(({ person, balance }) => (
          <li key={person.id}>
            <Link
              to={`/people/${person.id}/money`}
              className={clsx(listRowStyles, 'text-ink no-underline hover:bg-hover')}
            >
              <MediaRow
                leading={<Avatar name={person.name} photo={person.photo} size="md" />}
                title={person.name}
                subtitle={balanceRowText(balance, money)}
              />
            </Link>
          </li>
        ))}
      </ul>
      {preview.hidden > 0 && (
        <div className="border-t border-divider px-4">
          <ShowMore hidden={preview.hidden} expanded={preview.expanded} onToggle={preview.toggle} />
        </div>
      )}
    </section>
  )
}
