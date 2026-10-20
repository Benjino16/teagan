import { ageOf, BIRTHDAY_WINDOW_DAYS, nextBirthday } from './birthday'
import { addDays, daysBetween, formatDateRangeWithYear, formatRelativeFuture, formatWeekdayLong, pluralize } from './dates'
import type { IsoDate, Person } from './model'
import { isArchived } from './people'

export interface UpcomingDeathAnniversary {
  date: IsoDate
  daysUntil: number
  years: number
}

/**
 * Next anniversary of the day of death from today (today included). The day itself
 * never counts – the first one is a year later. Feb 29 falls on the 28th like birthdays.
 */
export function nextDeathAnniversary(diedOn: IsoDate, today: IsoDate): UpcomingDeathAnniversary | null {
  const from = today > diedOn ? today : addDays(diedOn, 1)
  const next = nextBirthday(diedOn, from)
  if (!next || next.turns === null) return null
  return { date: next.date, daysUntil: daysBetween(today, next.date), years: next.turns }
}

/** `Died Mar 3, 2019 at 74` · `Died Mar 3, 2019 at about 74` · `Died Mar 3, 2019` · `Deceased` */
export function deathText(person: Pick<Person, 'birthday' | 'diedOn'>): string {
  if (!person.diedOn) return 'Deceased'
  const age = person.birthday ? ageOf(person.birthday, person.diedOn) : null
  const at = age ? ` at ${age.exact ? '' : 'about '}${age.years}` : ''
  return `Died ${formatDateRangeWithYear(person.diedOn, null)}${at}`
}

/** Texts of the card on the person page: “Death anniversary in 40 days” / “Tue, March 3 · 7 years”. */
export function deathAnniversaryCardText(upcoming: UpcomingDeathAnniversary): { title: string; subtitle: string } {
  const when = formatRelativeFuture(upcoming.daysUntil)
  return {
    title: `Death anniversary ${when}`,
    subtitle: `${formatWeekdayLong(upcoming.date)} · ${pluralize(upcoming.years, 'year')}`,
  }
}

export type Remembrance =
  | { kind: 'birthday'; person: Person; date: IsoDate; daysUntil: number; wouldBe: number | null }
  | { kind: 'deathAnniversary'; person: Person; date: IsoDate; daysUntil: number; years: number }

/** `Birthday · Sat, October 25 · would be 80` · `Death anniversary · Tue, March 3 · 7 years` */
export function remembranceText(remembrance: Remembrance): string {
  const day = formatWeekdayLong(remembrance.date)
  if (remembrance.kind === 'birthday') {
    return `Birthday · ${day}` + (remembrance.wouldBe === null ? '' : ` · would be ${remembrance.wouldBe}`)
  }
  return `Death anniversary · ${day} · ${pluralize(remembrance.years, 'year')}`
}

/**
 * Remembrance days for “Today”: birthdays and death anniversaries of people who died
 * (not archived) less than `withinDays` days away; ascending by days, then alphabetically,
 * a person's birthday before their death anniversary.
 */
export function upcomingRemembrances(
  people: Person[],
  today: IsoDate,
  withinDays: number = BIRTHDAY_WINDOW_DAYS,
): Remembrance[] {
  const result: Remembrance[] = []
  for (const person of people) {
    if (!person.deceased || isArchived(person)) continue
    const birthday = person.birthday ? nextBirthday(person.birthday, today) : null
    if (birthday && birthday.daysUntil < withinDays) {
      result.push({ kind: 'birthday', person, date: birthday.date, daysUntil: birthday.daysUntil, wouldBe: birthday.turns })
    }
    const anniversary = person.diedOn ? nextDeathAnniversary(person.diedOn, today) : null
    if (anniversary && anniversary.daysUntil < withinDays) {
      result.push({ kind: 'deathAnniversary', person, ...anniversary })
    }
  }
  const rank = (r: Remembrance) => (r.kind === 'birthday' ? 0 : 1)
  return result.sort(
    (a, b) => a.daysUntil - b.daysUntil || a.person.name.localeCompare(b.person.name) || rank(a) - rank(b),
  )
}
