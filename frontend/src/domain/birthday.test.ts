import { describe, expect, it } from 'vitest'
import {
  ageOf,
  birthYearFromAge,
  birthdayCardText,
  formatAge,
  nextBirthday,
  parseBirthday,
  upcomingBirthdays,
} from './birthday'
import type { Person } from './model'

const today = '2026-10-13'

describe('parseBirthday', () => {
  it('understands all three formats from the schema', () => {
    expect(parseBirthday('2000-10-25')).toEqual({ kind: 'date', year: 2000, month: 10, day: 25 })
    expect(parseBirthday('--03-02')).toEqual({ kind: 'date', year: null, month: 3, day: 2 })
    expect(parseBirthday('2004')).toEqual({ kind: 'year', year: 2004 })
    expect(parseBirthday('25.10.2000')).toBeNull()
  })
})

describe('nextBirthday', () => {
  it('computes days and new age (Lena)', () => {
    expect(nextBirthday('2000-10-25', today)).toEqual({ date: '2026-10-25', daysUntil: 12, turns: 26 })
  })

  it('jumps to next year when the day has passed (Jonas, without year)', () => {
    expect(nextBirthday('--03-02', today)).toEqual({ date: '2027-03-02', daysUntil: 140, turns: null })
  })

  it('counts today as the birthday', () => {
    expect(nextBirthday('2000-10-13', today)?.daysUntil).toBe(0)
  })

  it('moves Feb 29 to the 28th in non-leap years', () => {
    expect(nextBirthday('2004-02-29', today)?.date).toBe('2027-02-28')
  })

  it('returns nothing without day and month', () => {
    expect(nextBirthday('2004', today)).toBeNull()
  })
})

describe('age', () => {
  it('is exact with a full date', () => {
    expect(ageOf('2000-10-25', today)).toEqual({ exact: true, years: 25 })
    expect(ageOf('1999-10-13', today)).toEqual({ exact: true, years: 27 })
  })

  it('is approximate with only a year', () => {
    expect(ageOf('2004', today)).toEqual({ exact: false, years: 22 })
    expect(formatAge({ exact: false, years: 22 })).toBe('about 22 years')
    expect(birthYearFromAge(22, today)).toBe('2004')
  })

  it('is unknown without a year', () => {
    expect(ageOf('--03-02', today)).toBeNull()
  })
})

describe('birthdayCardText', () => {
  it('returns title and subtitle', () => {
    expect(birthdayCardText({ date: '2026-10-25', daysUntil: 12, turns: 26 })).toEqual({
      title: 'Birthday in 12 days',
      subtitle: 'Sun, October 25 · turns 26',
    })
    expect(birthdayCardText({ date: '2026-10-14', daysUntil: 1, turns: null }).title).toBe('Birthday tomorrow')
  })

  it('says “would be” for someone who died', () => {
    expect(birthdayCardText({ date: '2026-10-25', daysUntil: 12, turns: 80 }, true).subtitle).toBe(
      'Sun, October 25 · would be 80',
    )
  })
})

describe('upcomingBirthdays', () => {
  let nextId = 1
  function person(name: string, birthday: string | null, isSelf = false): Person {
    return {
      id: nextId++,
      name,
      nickname: null,
      birthday,
      birthdayNote: null,
      reconnectDays: null,
      impact: 3,
      focus: false,
      deceased: false,
      diedOn: null,
      archivedAt: null,
      photo: null,
      isSelf,
      createdAt: '2026-01-01 00:00:00',
      updatedAt: '2026-01-01 00:00:00',
    }
  }

  it('shows only birthdays less than 30 days away, ascending', () => {
    const people = [
      person('Tim', '1999-12-04'), // 52 days
      person('Lena', '2000-10-25'), // 12 days
      person('Ina', '--11-11'), // 29 days
      person('Ole', '--11-12'), // 30 days
      person('Eva', '1990-10-13'), // today
    ]
    expect(upcomingBirthdays(people, today).map((b) => [b.person.name, b.upcoming.daysUntil])).toEqual([
      ['Eva', 0],
      ['Lena', 12],
      ['Ina', 29],
    ])
  })

  it('leaves out yourself, people without a birthday and with only a year', () => {
    const people = [person('Me', '2000-10-20', true), person('A', null), person('B', '2004')]
    expect(upcomingBirthdays(people, today)).toEqual([])
  })

  it('leaves out archived people', () => {
    const archived = { ...person('Lena', '2000-10-25'), archivedAt: '2026-10-01T12:00:00Z' }
    expect(upcomingBirthdays([archived], today)).toEqual([])
  })

  it('leaves out people who died – their birthday is a remembrance day', () => {
    const deceased = { ...person('Opa', '1946-10-25'), deceased: true }
    expect(upcomingBirthdays([deceased], today)).toEqual([])
  })

  it('sorts alphabetically on the same day', () => {
    const people = [person('Zoe', '--10-20'), person('Anna', '--10-20')]
    expect(upcomingBirthdays(people, today).map((b) => b.person.name)).toEqual(['Anna', 'Zoe'])
  })
})
