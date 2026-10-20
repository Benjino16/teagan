import { clsx } from 'clsx'
import { Flower2 } from 'lucide-react'
import { Link } from 'react-router'
import { Avatar, cardStyles, IconBadge, listRowStyles, MediaRow, ShowMore, usePreview } from '../../components/ui'
import { formatRelativeFuture } from '../../domain/dates'
import { TODAY_PREVIEW } from './preview'
import { type Remembrance, remembranceText } from '../../domain/remembrance'

interface Props {
  remembrances: Remembrance[]
}

/** Birthdays and death anniversaries of people who died, on “Today” – quieter than the birthday box. */
export function RemembranceBox({ remembrances }: Props) {
  const preview = usePreview(remembrances, TODAY_PREVIEW)
  if (remembrances.length === 0) return null

  return (
    <section
      aria-labelledby="today-remembrance"
      className={clsx(cardStyles({ padding: 'none' }), 'overflow-hidden')}
    >
      <div className="flex items-center gap-3 px-4 pt-3.5 pb-1.5">
        <IconBadge icon={Flower2} size={32} />
        <h2 id="today-remembrance" className="font-display text-lg font-bold">
          Remembrance
        </h2>
      </div>
      <ul className="divide-y divide-divider">
        {preview.shown.map((remembrance) => {
          const { person, daysUntil } = remembrance
          return (
            <li key={`${person.id}-${remembrance.kind}`}>
              <Link to={`/people/${person.id}`} className={clsx(listRowStyles, 'text-ink no-underline hover:bg-canvas')}>
                <MediaRow
                  leading={<Avatar name={person.name} photo={person.photo} size="md" />}
                  title={person.name}
                  subtitle={remembranceText(remembrance)}
                  trailing={
                    <span
                      className={clsx(
                        'flex-none text-sm',
                        daysUntil === 0 ? 'rounded-full bg-canvas px-2.5 py-1 font-semibold' : 'text-muted',
                      )}
                    >
                      {formatRelativeFuture(daysUntil)}
                    </span>
                  }
                />
              </Link>
            </li>
          )
        })}
      </ul>
      {preview.hidden > 0 && (
        <div className="border-t border-divider px-4">
          <ShowMore hidden={preview.hidden} expanded={preview.expanded} onToggle={preview.toggle} />
        </div>
      )}
    </section>
  )
}
