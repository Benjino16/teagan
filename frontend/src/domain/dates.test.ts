import { describe, expect, it } from 'vitest'
import {
  formatArchivedSince,
  addDays,
  changePrecision,
  joinPartialDate,
  splitPartialDate,
  dayOf,
  daysBetween,
  formatDate,
  formatDateRange,
  formatDateRangeWithYear,
  formatRelativeFuture,
  formatRelativePast,
  formatRhythm,
  formatSince,
  formatWeekdayLong,
  isFullDate,
  normalizeEnd,
  normalizeStart,
  precisionOf,
  timeOf,
} from './dates'

describe('precision', () => {
  it('detects the precision from the length', () => {
    expect(precisionOf('2024')).toBe('year')
    expect(precisionOf('2025-05')).toBe('month')
    expect(precisionOf('2025-05-14')).toBe('day')
    expect(isFullDate('2025-05-14')).toBe(true)
    expect(isFullDate('2025-05')).toBe(false)
    expect(isFullDate(null)).toBe(false)
  })
})

describe('normalization', () => {
  it('uses the end of the period for partial end dates', () => {
    expect(normalizeEnd('2026-12')).toBe('2026-12-31')
    expect(normalizeEnd('2024-02')).toBe('2024-02-29')
    expect(normalizeEnd('2025-02')).toBe('2025-02-28')
    expect(normalizeEnd('2024')).toBe('2024-12-31')
    expect(normalizeEnd('2024-06-03')).toBe('2024-06-03')
  })

  it('uses the start of the period for partial start dates', () => {
    expect(normalizeStart('2024')).toBe('2024-01-01')
    expect(normalizeStart('2024-09')).toBe('2024-09-01')
  })
})

describe('day arithmetic', () => {
  it('counts days regardless of DST changes', () => {
    expect(daysBetween('2026-10-13', '2026-10-25')).toBe(12)
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2)
    expect(daysBetween('2026-10-25', '2026-10-13')).toBe(-12)
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02')
  })
})

describe('formatting', () => {
  it('describes since when something is archived', () => {
    expect(formatArchivedSince('2026-10-17T09:18:08Z')).toBe('Archived since Oct 17, 2026')
  })

  it('formats by precision', () => {
    expect(formatDate('2024')).toBe('2024')
    expect(formatDate('2025-05')).toBe('May 2025')
    expect(formatDate('2026-03-14')).toBe('Mar 14')
  })

  it('formats ranges', () => {
    expect(formatDateRange('2026-08-08', '2026-08-10')).toBe('Aug 8–10')
    expect(formatDateRange('2026-02-03', '2026-04-18')).toBe('Feb 3 – Apr 18')
    expect(formatDateRange('2026-09-08', '2026-12')).toBe('Sep 8 – Dec 2026')
    expect(formatDateRange('2026-09-22', null)).toBe('Sep 22')
  })

  it('formats ranges with year', () => {
    expect(formatDateRangeWithYear('2026-10-17', '2026-10-24')).toBe('Oct 17–24, 2026')
    expect(formatDateRangeWithYear('2025-12-28', '2026-01-03')).toBe('Dec 28, 2025 – Jan 3, 2026')
    expect(formatDateRangeWithYear('2025-10', '2026-10')).toBe('Oct 2025 – Oct 2026')
    expect(formatDateRangeWithYear('2026-09-22', null)).toBe('Sep 22, 2026')
    expect(formatDateRangeWithYear('2024', null)).toBe('2024')
  })

  it('formats weekday and long month', () => {
    expect(formatWeekdayLong('2026-10-25')).toBe('Sun, October 25')
  })

  it('formats relative texts', () => {
    expect(formatRelativePast(0)).toBe('today')
    expect(formatRelativePast(1)).toBe('yesterday')
    expect(formatRelativePast(13)).toBe('13 days ago')
    expect(formatRelativePast(14)).toBe('2 weeks ago')
    expect(formatRelativePast(21)).toBe('3 weeks ago')
    expect(formatRelativeFuture(0)).toBe('today')
    expect(formatRelativeFuture(1)).toBe('tomorrow')
    expect(formatRelativeFuture(4)).toBe('in 4 days')
    expect(formatSince(3)).toBe('since this week')
    expect(formatSince(7)).toBe('for 1 week')
    expect(formatSince(35)).toBe('for 5 weeks')
  })

  it('switches to months after 7 weeks and to years from 12 months', () => {
    expect(formatRelativePast(49)).toBe('7 weeks ago')
    expect(formatRelativePast(55)).toBe('7 weeks ago')
    expect(formatRelativePast(56)).toBe('2 months ago')
    expect(formatRelativePast(175)).toBe('6 months ago')
    expect(formatRelativePast(340)).toBe('11 months ago')
    expect(formatRelativePast(371)).toBe('1 year ago')
    expect(formatRelativePast(800)).toBe('2 years ago')
    expect(formatSince(371)).toBe('for 1 year')
    expect(formatSince(120)).toBe('for 4 months')
  })

  it('formats the reconnect rhythm', () => {
    expect(formatRhythm(7)).toBe('every week')
    expect(formatRhythm(28)).toBe('every 4 weeks')
    expect(formatRhythm(10)).toBe('every 10 days')
    expect(formatRhythm(182)).toBe('every 6 months')
    expect(formatRhythm(365)).toBe('every year')
    expect(formatRhythm(730)).toBe('every 2 years')
  })
})

describe('date input in parts', () => {
  it('splits and rejoins partial dates', () => {
    for (const date of ['2026-10-13T20:00', '2026-10-13', '2026-10', '2026']) {
      expect(joinPartialDate(splitPartialDate(date))).toBe(date)
    }
    expect(splitPartialDate('2026-03')).toEqual({ precision: 'month', day: '', time: '', month: 3, year: '2026' })
    expect(splitPartialDate('2026-10-13T09:30')).toMatchObject({ precision: 'day', day: '2026-10-13', time: '09:30' })
  })

  it('returns null for incomplete input', () => {
    expect(joinPartialDate({ precision: 'day', day: '', time: '', month: 1, year: '' })).toBeNull()
    expect(joinPartialDate({ precision: 'year', day: '', time: '', month: 1, year: '26' })).toBeNull()
    expect(joinPartialDate({ precision: 'day', day: '2026-10-13', time: '9:3', month: 1, year: '' })).toBeNull()
  })

  it('keeps the input when changing precision', () => {
    const day = splitPartialDate('2026-10-13')
    expect(joinPartialDate(changePrecision(day, 'month'))).toBe('2026-10')
    expect(joinPartialDate(changePrecision(day, 'year'))).toBe('2026')
    expect(joinPartialDate(changePrecision(splitPartialDate('2026-10'), 'day'))).toBe('2026-10-01')
    expect(joinPartialDate(changePrecision(splitPartialDate('2026'), 'month'))).toBe('2026-01')
  })

  it('drops the time when leaving day precision', () => {
    const timed = splitPartialDate('2026-10-13T20:00')
    expect(joinPartialDate(changePrecision(timed, 'month'))).toBe('2026-10')
    expect(joinPartialDate(changePrecision(changePrecision(timed, 'month'), 'day'))).toBe('2026-10-01')
  })
})

describe('time of day', () => {
  it('splits a timed date into day and time', () => {
    expect(dayOf('2026-10-13T20:00')).toBe('2026-10-13')
    expect(timeOf('2026-10-13T20:00')).toBe('20:00')
    expect(timeOf('2026-10-13')).toBeNull()
    expect(precisionOf('2026-10-13T20:00')).toBe('day')
    expect(isFullDate('2026-10-13T20:00')).toBe(false)
  })

  it('counts only the date in calculations', () => {
    expect(normalizeStart('2026-10-13T20:00')).toBe('2026-10-13')
    expect(normalizeEnd('2026-10-13T20:00')).toBe('2026-10-13')
    expect(daysBetween('2026-10-13T20:00', '2026-10-15')).toBe(2)
  })

  it('shows the time after the date', () => {
    expect(formatDate('2026-10-13T20:00')).toBe('Oct 13, 20:00')
    expect(formatDateRange('2026-10-13T09:00', null)).toBe('Oct 13, 09:00')
    expect(formatDateRangeWithYear('2026-10-13T09:00', null)).toBe('Oct 13, 2026, 09:00')
  })

  it('sorts same-day events by time', () => {
    expect(['2026-10-13T20:00', '2026-10-12', '2026-10-13T09:00'].sort()).toEqual([
      '2026-10-12',
      '2026-10-13T09:00',
      '2026-10-13T20:00',
    ])
  })
})
