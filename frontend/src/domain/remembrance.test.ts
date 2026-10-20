import { describe, expect, it } from 'vitest'
import type { Person } from './model'
import {
  deathAnniversaryCardText,
  deathText,
  nextDeathAnniversary,
  remembranceText,
  upcomingRemembrances,
} from './remembrance'

const today = '2026-10-13'

describe('nextDeathAnniversary', () => {
  it('counts the years since the day of death', () => {
    expect(nextDeathAnniversary('2019-10-20', today)).toEqual({ date: '2026-10-20', daysUntil: 7, years: 7 })
  })

  it('includes today and jumps to next year once the day has passed', () => {
    expect(nextDeathAnniversary('2019-10-13', today)).toEqual({ date: '2026-10-13', daysUntil: 0, years: 7 })
    expect(nextDeathAnniversary('2019-10-12', today)?.date).toBe('2027-10-12')
  })

  it('starts one year after the day itself, never at 0 years', () => {
    expect(nextDeathAnniversary('2026-10-13', today)).toEqual({ date: '2027-10-13', daysUntil: 365, years: 1 })
    expect(nextDeathAnniversary('2026-10-01', today)).toEqual({ date: '2027-10-01', daysUntil: 353, years: 1 })
  })

  it('falls on Feb 28 in non-leap years', () => {
    expect(nextDeathAnniversary('2020-02-29', today)?.date).toBe('2027-02-28')
  })
})

describe('deathText', () => {
  it('adds the age at death when the birthday allows it', () => {
    expect(deathText({ birthday: '1945-05-01', diedOn: '2019-03-03' })).toBe('Died Mar 3, 2019 at 73')
    expect(deathText({ birthday: '1945', diedOn: '2019-03-03' })).toBe('Died Mar 3, 2019 at about 74')
    expect(deathText({ birthday: '--05-01', diedOn: '2019-03-03' })).toBe('Died Mar 3, 2019')
    expect(deathText({ birthday: null, diedOn: '2019-03-03' })).toBe('Died Mar 3, 2019')
  })

  it('says only deceased without a date', () => {
    expect(deathText({ birthday: '1945-05-01', diedOn: null })).toBe('Deceased')
  })
})

describe('deathAnniversaryCardText', () => {
  it('reads like the birthday card', () => {
    expect(deathAnniversaryCardText({ date: '2026-10-20', daysUntil: 7, years: 7 })).toEqual({
      title: 'Death anniversary in 7 days',
      subtitle: 'Tue, October 20 · 7 years',
    })
    expect(deathAnniversaryCardText({ date: '2026-10-13', daysUntil: 0, years: 1 }).title).toBe('Death anniversary today')
  })
})

describe('upcomingRemembrances', () => {
  let nextId = 1
  function person(name: string, fields: Partial<Person> = {}): Person {
    return {
      id: nextId++,
      name,
      nickname: null,
      birthday: null,
      birthdayNote: null,
      reconnectDays: null,
      impact: 3,
      focus: false,
      deceased: true,
      diedOn: null,
      archivedAt: null,
      photo: null,
      isSelf: false,
      createdAt: '2026-01-01 00:00:00',
      updatedAt: '2026-01-01 00:00:00',
      ...fields,
    }
  }

  it('lists birthdays and death anniversaries of people who died, ascending', () => {
    const people = [
      person('Opa', { birthday: '1946-10-25', diedOn: '2020-10-14' }), // birthday in 12, anniversary in 1
      person('Oma', { birthday: '--10-14', diedOn: '2021-11-30' }), // birthday in 1, anniversary in 48
    ]
    expect(upcomingRemembrances(people, today).map((r) => [r.person.name, r.kind, r.daysUntil])).toEqual([
      ['Oma', 'birthday', 1],
      ['Opa', 'deathAnniversary', 1],
      ['Opa', 'birthday', 12],
    ])
  })

  it('leaves out the living and the archived', () => {
    const people = [
      person('Lena', { birthday: '2000-10-25', deceased: false }),
      person('Opa', { birthday: '1946-10-25', archivedAt: '2026-10-01T12:00:00Z' }),
    ]
    expect(upcomingRemembrances(people, today)).toEqual([])
  })

  it('describes each kind', () => {
    const [birthday, anniversary] = upcomingRemembrances(
      [person('Opa', { birthday: '1946-10-25', diedOn: '2019-10-25' })],
      today,
    )
    expect(remembranceText(birthday!)).toBe('Birthday · Sun, October 25 · would be 80')
    expect(remembranceText(anniversary!)).toBe('Death anniversary · Sun, October 25 · 7 years')
  })
})
