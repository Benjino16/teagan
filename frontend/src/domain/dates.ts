import type { IsoDate, PartialDate } from './model'

export type DatePrecision = 'year' | 'month' | 'day'

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const DAY_MS = 86_400_000

/** The time counts as part of the day precision (see `timeOf`). */
export function precisionOf(date: PartialDate): DatePrecision {
  if (date.length >= 10) return 'day'
  if (date.length === 7) return 'month'
  return 'year'
}

export function isFullDate(date: PartialDate | null | undefined): date is IsoDate {
  return !!date && date.length === 10
}

/** The date without the time: `2026-10-13T20:00` → `2026-10-13`. */
export function dayOf(date: PartialDate): PartialDate {
  return date.slice(0, 10)
}

/** The time `HH:MM`, if there is one. */
export function timeOf(date: PartialDate): string | null {
  return date.length > 10 ? date.slice(11, 16) : null
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function parts(date: PartialDate): { year: number; month: number; day: number } {
  return {
    year: Number(date.slice(0, 4)),
    month: date.length >= 7 ? Number(date.slice(5, 7)) : 1,
    day: date.length >= 10 ? Number(date.slice(8, 10)) : 1,
  }
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function toIsoDate(year: number, month: number, day: number): IsoDate {
  return `${year}-${pad(month)}-${pad(day)}`
}

/** First day of the period: `2026-12` → `2026-12-01`. */
export function normalizeStart(date: PartialDate): IsoDate {
  const { year, month, day } = parts(date)
  return toIsoDate(year, month, day)
}

/** Last day of the period: `2026-12` → `2026-12-31`, `2024` → `2024-12-31`. */
export function normalizeEnd(date: PartialDate): IsoDate {
  const { year, month } = parts(date)
  switch (precisionOf(date)) {
    case 'day':
      return dayOf(date)
    case 'month':
      return toIsoDate(year, month, daysInMonth(year, month))
    case 'year':
      return toIsoDate(year, 12, 31)
  }
}

function utc(date: IsoDate): number {
  const { year, month, day } = parts(date)
  return Date.UTC(year, month - 1, day)
}

/** Whole days from `from` to `to` (positive if `to` is later). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((utc(to) - utc(from)) / DAY_MS)
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const d = new Date(utc(date) + days * DAY_MS)
  return toIsoDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
}

export function yearOf(date: PartialDate): number {
  return Number(date.slice(0, 4))
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

/** `Mar 14` */
export function formatDayMonth(date: IsoDate): string {
  const { month, day } = parts(date)
  return `${MONTHS_SHORT[month - 1]} ${day}`
}

/** `Sat, October 25` */
export function formatWeekdayLong(date: IsoDate): string {
  const { month, day } = parts(date)
  const weekday = new Date(utc(date)).getUTCDay()
  return `${WEEKDAYS_SHORT[weekday]}, ${MONTHS_LONG[month - 1]} ${day}`
}

function withTime(text: string, date: PartialDate): string {
  const time = timeOf(date)
  return time ? `${text}, ${time}` : text
}

/** By precision: `2024` · `May 2025` · `Mar 14` · `Mar 14, 20:00`. */
export function formatDate(date: PartialDate): string {
  const { year, month } = parts(date)
  switch (precisionOf(date)) {
    case 'day':
      return withTime(formatDayMonth(date), date)
    case 'month':
      return `${MONTHS_SHORT[month - 1]} ${year}`
    case 'year':
      return String(year)
  }
}

/** Date or range: `Aug 8–10` · `Feb 3 – Apr 18` · `Sep 8 – Dec 2026`. */
export function formatDateRange(start: PartialDate, end: PartialDate | null): string {
  if (!end) return formatDate(start)
  if (isFullDate(start) && isFullDate(end)) {
    if (start.slice(0, 7) === end.slice(0, 7)) {
      return `${formatDayMonth(start)}–${parts(end).day}`
    }
    return `${formatDayMonth(start)} – ${formatDayMonth(end)}`
  }
  return `${formatDate(start)} – ${formatDate(end)}`
}

const DAYS_PER_MONTH = 365.25 / 12

/**
 * Rough duration for texts: up to 13 days in days, up to 7 weeks in weeks,
 * then in months, from 12 months on in years.
 */
function roughDuration(days: number): { amount: number; unit: 'day' | 'week' | 'month' | 'year' } {
  if (days < 14) return { amount: days, unit: 'day' }
  const weeks = Math.floor(days / 7)
  if (weeks <= 7) return { amount: weeks, unit: 'week' }
  const months = Math.round(days / DAYS_PER_MONTH)
  if (months < 12) return { amount: months, unit: 'month' }
  return { amount: Math.floor(days / 365.25) || 1, unit: 'year' }
}

/** `1 day` · `5 days` · `1 week` … */
export function pluralize(amount: number, unit: string): string {
  return `${amount} ${unit}${amount === 1 ? '' : 's'}`
}

/** `5 days` · `3 weeks` · `1 month` · `2 years`. */
function roughDurationText(days: number): string {
  const { amount, unit } = roughDuration(days)
  return pluralize(amount, unit)
}

/** `today` · `yesterday` · `5 days ago` · `3 weeks ago` · `4 months ago` · `2 years ago`. */
export function formatRelativePast(days: number): string {
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${roughDurationText(days)} ago`
}

/** `today` · `tomorrow` · `in 4 days`. */
export function formatRelativeFuture(days: number): string {
  if (days <= 0) return 'today'
  if (days === 1) return 'tomorrow'
  return `in ${days} days`
}

/** `since this week` · `for 5 weeks` · `for 4 months` · `for 1 year`. */
export function formatSince(days: number): string {
  if (days < 7) return 'since this week'
  if (days < 14) return 'for 1 week'
  return `for ${roughDurationText(days)}`
}

/** The reconnect choices for half a year and a year. */
export const HALF_YEAR_DAYS = 182
export const YEAR_DAYS = 365

/** Reconnect rhythm: `every week` · `every 4 weeks` · `every 10 days` · `every 6 months` · `every year`. */
export function formatRhythm(days: number): string {
  if (days === 1) return 'every day'
  if (days === HALF_YEAR_DAYS) return 'every 6 months'
  if (days % YEAR_DAYS === 0) return days === YEAR_DAYS ? 'every year' : `every ${days / YEAR_DAYS} years`
  if (days % 7 !== 0) return `every ${days} days`
  const weeks = days / 7
  return weeks === 1 ? 'every week' : `every ${weeks} weeks`
}

/** `Archived since Oct 17, 2026` */
export function formatArchivedSince(archivedAt: string): string {
  return `Archived since ${formatDateRangeWithYear(dateOfTimestamp(archivedAt), null)}`
}

/** Date part of a timestamp `YYYY-MM-DD HH:MM:SS` (or of a date). */
export function dateOfTimestamp(timestamp: string): IsoDate {
  return timestamp.slice(0, 10)
}

function withYear(date: PartialDate): string {
  return precisionOf(date) === 'day' ? withTime(`${formatDayMonth(date)}, ${yearOf(date)}`, date) : formatDate(date)
}

/** With year, for views without year dividers: `Oct 17–24, 2026` · `Dec 28, 2025 – Jan 3, 2026`. */
export function formatDateRangeWithYear(start: PartialDate, end: PartialDate | null): string {
  if (!end) return withYear(start)
  if (isFullDate(start) && isFullDate(end) && yearOf(start) === yearOf(end)) {
    return `${formatDateRange(start, end)}, ${yearOf(end)}`
  }
  return `${withYear(start)} – ${withYear(end)}`
}

/** Month names for select fields, index 0 = January. */
export const MONTH_NAMES: readonly string[] = MONTHS_LONG

/** Input of a partial date in separate parts (forms). */
export interface DateParts {
  precision: DatePrecision
  /** Full date from a date field, only with precision `day`. */
  day: string
  /** Optional time `HH:MM` from a time field (empty = none), only with precision `day`. */
  time: string
  /** 1–12, with precision `month`. */
  month: number
  /** Free text from the year field, with `month` and `year`. */
  year: string
}

const FULL_DATE = /^\d{4}-\d{2}-\d{2}$/
const YEAR = /^\d{4}$/
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

export function splitPartialDate(date: PartialDate): DateParts {
  const { year, month } = parts(date)
  const day = precisionOf(date) === 'day'
  return { precision: precisionOf(date), day: day ? dayOf(date) : '', time: timeOf(date) ?? '', month, year: String(year) }
}

/** Joins the parts into a date; `null` if they are incomplete or invalid. */
export function joinPartialDate(parts: DateParts): PartialDate | null {
  switch (parts.precision) {
    case 'day':
      if (!FULL_DATE.test(parts.day)) return null
      if (!parts.time) return parts.day
      return TIME.test(parts.time) ? `${parts.day}T${parts.time}` : null
    case 'month':
      return YEAR.test(parts.year) && parts.month >= 1 && parts.month <= 12 ? `${parts.year}-${pad(parts.month)}` : null
    case 'year':
      return YEAR.test(parts.year) ? parts.year : null
  }
}

/** Changes the precision, keeping what has been entered (more precise → 1st of the period). */
export function changePrecision(parts: DateParts, precision: DatePrecision): DateParts {
  const date = joinPartialDate(parts)
  if (date === null) return { ...parts, precision }
  const next = splitPartialDate(normalizeStart(date))
  const day = precision === 'day'
  return { ...next, precision, day: day ? next.day : '', time: day ? parts.time : '' }
}
