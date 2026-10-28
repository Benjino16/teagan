import { describe, expect, it } from 'vitest'
import { currencyChoices, matchesCurrency } from './currencies'

describe('currencyChoices', () => {
  const choices = currencyChoices('EUR', 'en')
  const codes = choices.map((c) => c.code)

  it('lists real currencies with name and symbol', () => {
    expect(choices.find((c) => c.code === 'EUR')).toEqual({ code: 'EUR', name: 'Euro', symbol: '€' })
    expect(codes).toContain('JPY')
    expect(codes).toContain('CHF')
  })

  it('leaves out metals, funds and test codes', () => {
    for (const code of ['XAU', 'XXX', 'USN', 'CHE']) expect(codes).not.toContain(code)
  })

  it('is sorted by name', () => {
    const names = choices.map((c) => c.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en')))
  })

  it('always holds the current one', () => {
    expect(currencyChoices('ZZZ', 'en').map((c) => c.code)).toContain('ZZZ')
  })

  it('names them in the given language', () => {
    expect(currencyChoices('EUR', 'de').find((c) => c.code === 'CHF')?.name).toBe('Schweizer Franken')
  })
})

describe('matchesCurrency', () => {
  const franc = { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' }

  it('finds by code, name or symbol, ignoring case', () => {
    expect(matchesCurrency(franc, 'chf')).toBe(true)
    expect(matchesCurrency(franc, ' franc ')).toBe(true)
    expect(matchesCurrency({ code: 'EUR', name: 'Euro', symbol: '€' }, '€')).toBe(true)
    expect(matchesCurrency(franc, 'euro')).toBe(false)
  })
})
