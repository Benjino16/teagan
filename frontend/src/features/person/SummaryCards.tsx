import { ChevronRight, Flower2, HandCoins, RefreshCw } from 'lucide-react'
import { Link } from 'react-router'
import { Card, cardStyles, IconBadge, MediaRow, ProgressBar } from '../../components/ui'
import { ongoingActivities, upcomingActivities } from '../../domain/activities'
import { birthdayCardText, nextBirthday } from '../../domain/birthday'
import { reconnectStatus } from '../../domain/contact'
import { balanceOf, balanceText } from '../../domain/ledger'
import type { Activity, IsoDate, LedgerEntry, Person } from '../../domain/model'
import { displayName, isContactPaused } from '../../domain/people'
import { deathAnniversaryCardText, nextDeathAnniversary } from '../../domain/remembrance'
import { UpcomingActivityCard } from '../activity/UpcomingActivityCard'
import { BirthdayCard } from './BirthdayCard'

interface Props {
  person: Person
  activities: Activity[]
  ledger: LedgerEntry[]
  daysSinceContact: number | null
  today: IsoDate
}

/** Cards below the header: reconnect, birthday, balance, death anniversary, currently, coming up. */
export function SummaryCards({ person, activities, ledger, daysSinceContact, today }: Props) {
  const nextBday = person.birthday ? nextBirthday(person.birthday, today) : null
  const birthday = nextBday && birthdayCardText(nextBday, person.deceased)
  const nextAnniversary = person.diedOn ? nextDeathAnniversary(person.diedOn, today) : null
  const anniversary = nextAnniversary && deathAnniversaryCardText(nextAnniversary)
  const ongoing = ongoingActivities(activities, today)
  const upcoming = upcomingActivities(activities, today)
  // The rhythm pauses while archived or deceased – kept, but not shown as due
  const rhythm = isContactPaused(person) ? null : person.reconnectDays
  // Only while something is open
  const balance = balanceOf(ledger)

  if (rhythm === null && !birthday && balance === 0 && !anniversary && ongoing.length === 0 && upcoming.length === 0) return null

  return (
    <div className="flex flex-col gap-2.5 px-5 pt-4.5">
      {rhythm !== null && <ReconnectCard rhythmDays={rhythm} daysSinceContact={daysSinceContact} />}

      {birthday && <BirthdayCard person={person} title={birthday.title} subtitle={birthday.subtitle} />}

      {balance !== 0 && (
        <Link to={`/people/${person.id}/money`} className={`${cardStyles()} block no-underline hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`}>
          <MediaRow
            leading={<IconBadge icon={HandCoins} />}
            title={balanceText(balance, displayName(person))}
            subtitle={`${ledger.length} ${ledger.length === 1 ? 'entry' : 'entries'}`}
            trailing={<ChevronRight aria-hidden="true" size={18} className="flex-none text-muted" />}
          />
        </Link>
      )}

      {anniversary && (
        <Card>
          <MediaRow leading={<IconBadge icon={Flower2} />} title={anniversary.title} subtitle={anniversary.subtitle} />
        </Card>
      )}

      {ongoing.length > 0 && (
        <section aria-label="Currently" className="flex flex-col gap-2.5">
          {ongoing.map((activity) => (
            <UpcomingActivityCard key={activity.id} activity={activity} today={today} />
          ))}
        </section>
      )}

      {upcoming.length > 0 && (
        <section aria-label="Coming up" className="flex flex-col gap-2.5">
          {upcoming.map((activity) => (
            <UpcomingActivityCard key={activity.id} activity={activity} today={today} />
          ))}
        </section>
      )}
    </div>
  )
}

function ReconnectCard({ rhythmDays, daysSinceContact }: { rhythmDays: number; daysSinceContact: number | null }) {
  const status = reconnectStatus(rhythmDays, daysSinceContact)
  return (
    <Card variant={status.overdue ? 'alert' : 'default'}>
      <MediaRow
        tone={status.overdue ? 'alert' : 'default'}
        leading={<IconBadge icon={RefreshCw} tone={status.overdue ? 'on-alert' : 'accent-soft'} />}
        title={status.title}
        subtitle={status.subtitle}
      >
        <ProgressBar value={status.progress} tone={status.overdue ? 'alert' : 'accent'} className="mt-1.5" />
      </MediaRow>
    </Card>
  )
}
