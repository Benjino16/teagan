import { clsx } from 'clsx'
import { Cake, NotebookPen } from 'lucide-react'
import { Link } from 'react-router'
import { Avatar, cardStyles, IconBadge, listRowStyles, MediaRow, ShowMore, usePreview } from '../../components/ui'
import { birthdayCardText, type PersonBirthday } from '../../domain/birthday'
import { formatRelativeFuture } from '../../domain/dates'
import { TODAY_PREVIEW } from './preview'

interface Props {
  birthdays: PersonBirthday[]
}

/** Upcoming birthdays on “Today”, styled like the birthday card. */
export function BirthdaysBox({ birthdays }: Props) {
  const preview = usePreview(birthdays, TODAY_PREVIEW)
  if (birthdays.length === 0) return null

  return (
    <section
      aria-labelledby="today-birthdays"
      className={clsx(cardStyles({ variant: 'warm', padding: 'none' }), 'overflow-hidden')}
    >
      <div className="flex items-center gap-3 px-4 pt-3.5 pb-1.5">
        <IconBadge icon={Cake} tone="on-warm" size={32} />
        <h2 id="today-birthdays" className="font-display text-lg font-bold text-warm-text">
          Birthdays
        </h2>
      </div>
      <ul className="divide-y divide-warm-line">
        {preview.shown.map(({ person, upcoming }) => {
          const isToday = upcoming.daysUntil === 0
          return (
            <li key={person.id}>
              <Link to={`/people/${person.id}`} className={clsx(listRowStyles, 'no-underline hover:bg-warm-line/50')}>
                <MediaRow
                  tone="warm"
                  leading={<Avatar name={person.name} photo={person.photo} size="md" tone="on-warm" />}
                  title={
                    person.birthdayNote ? (
                      <span className="flex items-center gap-1.5">
                        {person.name}
                        <NotebookPen role="img" aria-label="Has note" size={14} className="flex-none text-warm-icon" />
                      </span>
                    ) : (
                      person.name
                    )
                  }
                  subtitle={birthdayCardText(upcoming).subtitle}
                  trailing={
                    <span
                      className={clsx(
                        'flex-none text-sm',
                        isToday ? 'rounded-full bg-surface px-2.5 py-1 font-semibold text-warm-text' : 'text-warm-sub',
                      )}
                    >
                      {formatRelativeFuture(upcoming.daysUntil)}
                    </span>
                  }
                />
              </Link>
            </li>
          )
        })}
      </ul>
      {preview.hidden > 0 && (
        <div className="border-t border-warm-line px-4">
          <ShowMore
            hidden={preview.hidden}
            expanded={preview.expanded}
            onToggle={preview.toggle}
            tone="warm"
          />
        </div>
      )}
    </section>
  )
}
