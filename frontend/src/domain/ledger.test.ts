import { describe, expect, it } from 'vitest'
import {
  amountInputText,
  balanceOf,
  balanceRowText,
  balanceText,
  entryDateFor,
  entryText,
  ledgerChanges,
  overallText,
  parseAmount,
  settlingCents,
  signedCents,
} from './ledger'
import type { LedgerEntry } from './model'

const entry = (id: number, patch: Partial<LedgerEntry> = {}): LedgerEntry => ({
  id,
  personId: 2,
  amountCents: -1000 * id,
  date: '2026-10-27',
  note: null,
  activityId: 9,
  createdAt: '2026-10-27T10:00:00Z',
  updatedAt: '2026-10-27T10:00:00Z',
  ...patch,
})

describe('balance', () => {
  it('sums the entries, below zero they owe you', () => {
    const entries = [entry(1, { amountCents: -2500 }), entry(2, { amountCents: 3000 }), entry(3, { amountCents: -1200 })]
    expect(balanceOf(entries)).toBe(-700)
    expect(balanceOf([])).toBe(0)
  })

  it('says who owes whom, without a sign', () => {
    expect(balanceText(-700, 'Lena')).toBe('Lena owes you 7 €')
    expect(balanceText(550, 'Lena')).toBe('You owe Lena 5.50 €')
    expect(balanceText(0, 'Lena')).toBe('All settled')
  })

  it('names who paid', () => {
    expect(entryText(-2500, 'Lena')).toBe('You paid 25 €')
    expect(entryText(123456, 'Lena')).toBe('Lena paid 1,234.56 €')
    expect(entryText(5, 'Lena')).toBe('Lena paid 0.05 €')
    expect(signedCents(2500, 'you')).toBe(-2500)
    expect(signedCents(2500, 'them')).toBe(2500)
  })
})

describe('overallText', () => {
  const of = (...cents: number[]) => cents.map((balanceCents, i) => ({ personId: i + 1, balanceCents }))

  it('nets everyone into one direction', () => {
    expect(overallText(of(-7000, 3000))).toBe("Overall you're owed 40 €")
    expect(overallText(of(-2000, 3000))).toBe('Overall you owe 10 €')
    expect(overallText(of(-3000, 3000))).toBe('Even overall')
  })

  it('words a row', () => {
    expect(balanceRowText(-700)).toBe('owes you 7 €')
    expect(balanceRowText(550)).toBe('you owe 5.50 €')
  })
})

describe('settlingCents', () => {
  it('lets whoever owes pay it back', () => {
    // Lena owes you 13 €: she pays
    expect(settlingCents(-1300)).toBe(1300)
    // You owe Lena 5 €: you pay
    expect(settlingCents(500)).toBe(-500)
  })
})

describe('parseAmount', () => {
  it('reads dot and comma, up to two decimals', () => {
    expect(parseAmount('12')).toBe(1200)
    expect(parseAmount(' 12.5 ')).toBe(1250)
    expect(parseAmount('12,50')).toBe(1250)
    expect(parseAmount('0,05')).toBe(5)
    expect(parseAmount('12.')).toBe(1200)
    expect(parseAmount('10000000')).toBe(1_000_000_000)
  })

  it('rejects anything else', () => {
    for (const text of ['', '0', '0,00', '-5', '+5', '1.234', '1,234,00', '12.345', 'abc', '10000000.01']) {
      expect(parseAmount(text), text).toBeNull()
    }
  })

  it('round-trips through the input text', () => {
    expect(amountInputText(-1250)).toBe('12.50')
    expect(amountInputText(1200)).toBe('12')
    expect(parseAmount(amountInputText(-5))).toBe(5)
  })
})

describe('entryDateFor', () => {
  it('takes the event day, or today without one', () => {
    expect(entryDateFor('2026-10-27T20:00', '2026-10-28')).toBe('2026-10-27')
    expect(entryDateFor('2026-10-27', '2026-10-28')).toBe('2026-10-27')
    expect(entryDateFor('2026-10', '2026-10-28')).toBe('2026-10-28')
  })
})

describe('ledgerChanges', () => {
  const existing = [entry(1), entry(2), entry(3)]

  it('creates, updates and removes', () => {
    const changes = ledgerChanges(existing, [
      { id: 1, personId: 2, amountCents: -1000 },
      { id: 2, personId: 2, amountCents: 500 },
      { id: null, personId: 4, amountCents: -1500 },
    ])
    expect(changes.create).toEqual([{ personId: 4, amountCents: -1500 }])
    expect(changes.update).toEqual([{ entry: existing[1], amountCents: 500 }])
    expect(changes.remove).toEqual([3])
  })

  it('replaces an entry whose person changed', () => {
    const changes = ledgerChanges(existing, [{ id: 1, personId: 5, amountCents: -1000 }])
    expect(changes.create).toEqual([{ personId: 5, amountCents: -1000 }])
    expect(changes.update).toEqual([])
    expect(changes.remove).toEqual([1, 2, 3])
  })
})
