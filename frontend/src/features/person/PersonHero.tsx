import { Target } from 'lucide-react'
import type { Ref } from 'react'
import { Link } from 'react-router'
import { Avatar, Chip } from '../../components/ui'
import { ageOf, formatAge, parseBirthday } from '../../domain/birthday'
import { lastSeenText } from '../../domain/contact'
import type { IsoDate, Person } from '../../domain/model'
import { isContactPaused } from '../../domain/people'
import { deathText } from '../../domain/remembrance'
import type { PersonGroup } from './usePersonView'

interface Props {
  person: Person
  groups: PersonGroup[]
  daysSinceContact: number | null
  today: IsoDate
  /** Observed to show the name in the top bar. */
  nameRef?: Ref<HTMLHeadingElement>
}

/** Avatar, name and nickname, contact status and groups. */
export function PersonHero({ person, groups, daysSinceContact, today, nameRef }: Props) {
  // Only an approximate age (year known, day not) appears here – subtly instead of its own card.
  // For someone who died, the age at death in `deathText` takes its place.
  const approximateAge =
    person.birthday && !person.deceased && parseBirthday(person.birthday)?.kind === 'year'
      ? ageOf(person.birthday, today)
      : null

  return (
    <section aria-labelledby="person-name" className="flex flex-col">
      <div className="flex items-center gap-4 px-5 pt-1">
        <Avatar name={person.name} photo={person.photo} />
        <div className="flex min-w-0 flex-col gap-1">
          <h1 id="person-name" ref={nameRef} className="font-display text-3xl leading-[1.1] font-bold tracking-tight">
            {person.name}
          </h1>
          {person.nickname && <p className="text-md text-muted">Goes by {person.nickname}</p>}
          <p className="text-md text-muted">
            {lastSeenText(daysSinceContact)}
            {approximateAge && ` · ${formatAge(approximateAge)}`}
          </p>
          {person.deceased && <p className="text-md text-muted">{deathText(person)}</p>}
          {/* Paused while archived or deceased */}
          {person.focus && !isContactPaused(person) && (
            <p className="flex items-center gap-1.5 text-sm font-medium text-accent-strong">
              <Target aria-hidden="true" size={14} className="flex-none" />
              In focus
            </p>
          )}
        </div>
      </div>

      {groups.length > 0 && (
        <ul aria-label="Groups" className="flex flex-wrap gap-2 px-5 pt-3.5">
          {groups.map(({ id, path, archived }) => (
            <li key={id}>
              <Link
                to={`/groups/${id}`}
                className="block rounded-full no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <Chip muted={archived} className={archived ? 'block hover:bg-line' : 'block hover:bg-accent-line'}>
                  {path}
                </Chip>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
