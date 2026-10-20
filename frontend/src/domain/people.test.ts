import { describe, expect, it } from 'vitest'
import { createTestDatabase } from '../test/fixture'
import type { Activity } from './model'
import { countOpen, openPointSource, sortOpenPoints } from './openPoints'
import { byImpactThenName, displayName, groupByImpact, initials, participantsText } from './people'

const db = createTestDatabase()
const nameOf = (id: number) => displayName(db.people.find((p) => p.id === id)!)
const activity = (id: number) => db.activities.find((a) => a.id === id)!
const opts = { viewedPersonId: 2, selfId: 1, nameOf }

describe('names', () => {
  it('prefers the nickname and builds initials', () => {
    expect(nameOf(2)).toBe('Lena')
    expect(initials('Lena Hoffmann')).toBe('LH')
    expect(initials('Anna Maria Schulz')).toBe('AS')
    expect(initials('Mira')).toBe('M')
  })
})

describe('participantsText', () => {
  it('names up to three others, you last', () => {
    expect(participantsText(activity(5), opts)).toBe('Jonas and you')
    expect(participantsText(activity(7), opts)).toBe('Jonas, Mira, Tim and you')
  })

  it('mentions nothing if only you were there', () => {
    expect(participantsText(activity(3), opts)).toBeNull()
  })

  it('works without you', () => {
    expect(participantsText(activity(1), opts)).toBe('Jonas')
  })

  it('counts from four others on', () => {
    const many: Activity = {
      ...activity(7),
      participants: [1, 2, 3, 4, 5, 6].map((personId) => ({ personId, impact: null, note: null })),
    }
    const names = (id: number) => (id === 6 ? 'Sam' : nameOf(id))
    expect(participantsText(many, { ...opts, nameOf: names })).toBe('you and 4 others')
    const withoutSelf = { ...many, participants: many.participants.filter((p) => p.personId !== 1) }
    expect(participantsText(withoutSelf, { ...opts, nameOf: names })).toBe('Jonas, Mira and 2 others')
  })
})

describe('byImpactThenName', () => {
  it('orders by impact, then name', () => {
    const others = db.people.filter((p) => !p.isSelf)
    expect([...others].sort(byImpactThenName).map((p) => p.name)).toEqual([
      'Lena Hoffmann',
      'Jonas Weber',
      'Tim Krause',
      'Mira Schulz',
    ])
  })
})

describe('open points', () => {
  const lenas = db.openPoints.filter((p) => p.personId === 2)

  it('sorts open ones first, then newest', () => {
    expect(sortOpenPoints(lenas).map((p) => p.id)).toEqual([8, 1, 2, 3, 4])
    expect(countOpen(lenas)).toBe(4)
  })

  it('describes the origin', () => {
    expect(openPointSource(lenas[1]!, activity(4))).toBe('from Phone call · Sep 21')
    expect(openPointSource(lenas[2]!, activity(6))).toBe('from Hiking weekend in the Harz · Aug 8–10')
    expect(openPointSource(lenas[0]!, undefined)).toBe('noted on Oct 3')
  })
})

describe('groupByImpact', () => {
  it('groups descending, alphabetically and without empty groups', () => {
    const others = db.people.filter((p) => !p.isSelf)
    const extra = { ...others[0]!, id: 99, name: 'Anna Zeller', impact: 4 as const }
    expect(groupByImpact([...others, extra]).map((g) => [g.impact, g.people.map((p) => p.name)])).toEqual([
      [5, ['Lena Hoffmann']],
      [4, ['Anna Zeller', 'Jonas Weber', 'Tim Krause']],
      [3, ['Mira Schulz']],
    ])
  })
})
