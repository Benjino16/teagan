import { describe, expect, it } from 'vitest'
import { createTestDatabase } from '../test/fixture'
import {
  contacts,
  daysSinceContact,
  dueReconnects,
  lastContactDate,
  lastSeenText,
  reconnectRowText,
  reconnectStatus,
} from './contact'

const today = '2026-10-13'
const db = createTestDatabase()
const SELF = 1

describe('last contact', () => {
  it('counts only shared, past activities with a full date', () => {
    // Lena: coffee on Sep 22 – not the vacation (future, without you) or the photography class (without you)
    expect(lastContactDate(db.activities, 2, SELF, today)).toBe('2026-09-22')
    // Mira: Harz weekend
    expect(lastContactDate(db.activities, 4, SELF, today)).toBe('2026-08-08')
  })

  it('does not count Interrail, but the phone call during it', () => {
    const names = contacts(db.activities, 2, SELF, today).map((a) => a.name)
    expect(names).not.toContain('Interrail through Europe')
    expect(names).not.toContain('Postcard from Ljubljana')
    expect(names).toContain('Video call from Vienna')
  })

  it('counts a timed event of today, and reports only the date', () => {
    const coffee = { ...db.activities[0]!, id: 900, startDate: `${today}T09:00`, endDate: null, participants: [{ personId: 2, impact: null, mood: null, note: null }, { personId: SELF, impact: null, mood: null, note: null }] }
    expect(lastContactDate([...db.activities, coffee], 2, SELF, today)).toBe(today)
  })

  it('phrases “last seen”', () => {
    expect(lastSeenText(daysSinceContact('2026-09-22', today))).toBe('Last seen 3 weeks ago')
    expect(lastSeenText(null)).toBe('No contact logged yet')
  })
})

describe('reconnectStatus', () => {
  it('counts down', () => {
    expect(reconnectStatus(28, 21)).toMatchObject({ overdue: false, remaining: 7, title: 'Next reconnect in 7 days' })
    expect(reconnectStatus(28, 27).title).toBe('Next reconnect tomorrow')
    expect(reconnectStatus(28, 28).title).toBe('Time to reach out today')
    expect(reconnectStatus(28, 21).subtitle).toBe('Goal: every 4 weeks')
    expect(reconnectStatus(28, 14).progress).toBe(0.5)
  })

  it('is overdue once expired', () => {
    const status = reconnectStatus(14, 66)
    expect(status).toMatchObject({ overdue: true, remaining: -52, progress: 1, title: 'Reconnect overdue' })
    expect(status.subtitle).toBe('by 52 days · Goal: every 2 weeks')
    expect(reconnectStatus(14, 15).subtitle).toBe('by 1 day · Goal: every 2 weeks')
  })

  it('is overdue without any contact', () => {
    expect(reconnectStatus(28, null)).toMatchObject({ overdue: true, remaining: null, progress: 1 })
  })
})

describe('dueReconnects', () => {
  it('shows overdue first, then due soon; not far-off ones (fixture)', () => {
    // Mira: 66 days with rhythm 14 · Lena: 21 of 28 · Jonas: 7 of 42 (too far off)
    const due = dueReconnects(db.people, db.activities, SELF, today)
    expect(due.map((r) => [r.person.name, r.status.remaining])).toEqual([
      ['Mira Schulz', -52],
      ['Lena Hoffmann', 7],
    ])
  })

  it('puts people without contact first and leaves you out', () => {
    const people = db.people.map((p) => (p.isSelf ? { ...p, reconnectDays: 7 } : p))
    const neverMet = { ...db.people[1]!, id: 99, name: 'Zoe', reconnectDays: 30 }
    const due = dueReconnects([...people, neverMet], db.activities, SELF, today)
    expect(due[0]?.person.name).toBe('Zoe')
    expect(due.some((r) => r.person.isSelf)).toBe(false)
  })

  it('pauses archived people without touching their rhythm', () => {
    const people = db.people.map((p) => (p.name === 'Mira Schulz' ? { ...p, archivedAt: '2026-10-01T12:00:00Z' } : p))
    const due = dueReconnects(people, db.activities, SELF, today)
    expect(due.map((r) => r.person.name)).toEqual(['Lena Hoffmann'])
  })

  it('pauses people who died without touching their rhythm', () => {
    const people = db.people.map((p) => (p.name === 'Mira Schulz' ? { ...p, deceased: true } : p))
    const due = dueReconnects(people, db.activities, SELF, today)
    expect(due.map((r) => r.person.name)).toEqual(['Lena Hoffmann'])
  })
})

describe('reconnectRowText', () => {
  it('describes overdue, never and soon', () => {
    expect(reconnectRowText(14, 66)).toBe('52 days overdue · every 2 weeks')
    expect(reconnectRowText(14, 15)).toBe('1 day overdue · every 2 weeks')
    expect(reconnectRowText(14, null)).toBe('no contact yet · every 2 weeks')
    expect(reconnectRowText(28, 21)).toBe('last contact 3 weeks ago · every 4 weeks')
  })
})
