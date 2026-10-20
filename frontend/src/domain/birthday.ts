import { daysBetween, formatWeekdayLong, isLeapYear, pluralize, toIsoDate, yearOf } from './dates'
import type { Birthday, IsoDate, Person } from './model'
import { isArchived } from './people'

export type ParsedBirthday =
  | { kind: 'date'; month: number; day: number; year: number | null }
  | { kind: 'year'; year: number }

const FULL = /^(\d{4})-(\d{2})-(\d{2})$/
const NO_YEAR = /^--(\d{2})-(\d{2})$/
const YEAR_ONLY = /^(\d{4})$/

export function parseBirthday(value: Birthday): ParsedBirthday | null {
  let m = FULL.exec(value)
  if (m) return { kind: 'date', year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) }
  m = NO_YEAR.exec(value)
  if (m) return { kind: 'date', year: null, month: Number(m[1]), day: Number(m[2]) }
  m = YEAR_ONLY.exec(value)
  if (m) return { kind: 'year', year: Number(m[1]) }
  return null
}

export function isValidBirthday(value: Birthday): boolean {
  return parseBirthday(value) !== null
}

/** Birthday in a given year; Feb 29 falls on the 28th in non-leap years. */
function birthdayIn(year: number, month: number, day: number): IsoDate {
  if (month === 2 && day === 29 && !isLeapYear(year)) return toIsoDate(year, 2, 28)
  return toIsoDate(year, month, day)
}

export interface UpcomingBirthday {
  date: IsoDate
  daysUntil: number
  /** Age on that day, only if the birth year is known. */
  turns: number | null
}

/** Next birthday from today (today included). `null` without day/month. */
export function nextBirthday(value: Birthday, today: IsoDate): UpcomingBirthday | null {
  const parsed = parseBirthday(value)
  if (!parsed || parsed.kind !== 'date') return null
  const thisYear = yearOf(today)
  let date = birthdayIn(thisYear, parsed.month, parsed.day)
  if (date < today) date = birthdayIn(thisYear + 1, parsed.month, parsed.day)
  return {
    date,
    daysUntil: daysBetween(today, date),
    turns: parsed.year === null ? null : yearOf(date) - parsed.year,
  }
}

export type Age = { exact: true; years: number } | { exact: false; years: number }

/**
 * Current age. Exact with a full date; approximate with only a year
 * (difference in years, actually ±1). `null` without a year.
 */
export function ageOf(value: Birthday, today: IsoDate): Age | null {
  const parsed = parseBirthday(value)
  if (!parsed || parsed.year === null) return null
  const diff = yearOf(today) - parsed.year
  if (parsed.kind === 'year') return { exact: false, years: diff }
  const hadBirthday = birthdayIn(yearOf(today), parsed.month, parsed.day) <= today
  return { exact: true, years: hadBirthday ? diff : diff - 1 }
}

/** `26 years` · `about 22 years` */
export function formatAge(age: Age): string {
  return `${age.exact ? '' : 'about '}${pluralize(age.years, 'year')}`
}

/** Birth year from an approximate age, as stored in the `birthday` field as `YYYY`. */
export function birthYearFromAge(age: number, today: IsoDate): Birthday {
  return String(yearOf(today) - age)
}

export interface BirthdayCardText {
  title: string
  subtitle: string
}

/**
 * Texts of the birthday card: “Birthday in 12 days” / “Sat, October 25 · turns 26”;
 * for someone who died “… · would be 80”.
 */
export function birthdayCardText(upcoming: UpcomingBirthday, deceased = false): BirthdayCardText {
  const { daysUntil, turns, date } = upcoming
  const title =
    daysUntil === 0
      ? 'Birthday today'
      : daysUntil === 1
        ? 'Birthday tomorrow'
        : `Birthday in ${daysUntil} days`
  const subtitle = formatWeekdayLong(date) + (turns === null ? '' : ` · ${deceased ? 'would be' : 'turns'} ${turns}`)
  return { title, subtitle }
}

/** Lead time of the birthday box on “Today”: shown when `daysUntil` is smaller. */
export const BIRTHDAY_WINDOW_DAYS = 30

export interface PersonBirthday {
  person: Person
  upcoming: UpcomingBirthday
}

/**
 * Upcoming birthdays for “Today”: everyone active and alive except yourself whose next
 * birthday is less than `withinDays` days away; ascending by days, then alphabetically.
 * Birthdays of people who died are remembrance days instead, see `upcomingRemembrances`.
 */
export function upcomingBirthdays(
  people: Person[],
  today: IsoDate,
  withinDays: number = BIRTHDAY_WINDOW_DAYS,
): PersonBirthday[] {
  const result: PersonBirthday[] = []
  for (const person of people) {
    if (person.isSelf || isArchived(person) || person.deceased || !person.birthday) continue
    const upcoming = nextBirthday(person.birthday, today)
    if (upcoming && upcoming.daysUntil < withinDays) result.push({ person, upcoming })
  }
  return result.sort(
    (a, b) => a.upcoming.daysUntil - b.upcoming.daysUntil || a.person.name.localeCompare(b.person.name),
  )
}
