import { describe, expect, it } from 'vitest'
import { matchesSearch, offersSearch, SEARCH_THRESHOLD } from './search'

describe('matchesSearch', () => {
  it('searches case-insensitively in all texts', () => {
    expect(matchesSearch('trEff', ['Treffen'])).toBe(true)
    expect(matchesSearch('kaffee', ['Treffen', 'kaffee'])).toBe(true)
    expect(matchesSearch('reise', ['Treffen', null])).toBe(false)
  })

  it('ignores accents, but not umlauts', () => {
    expect(matchesSearch('cafe', ['Café'])).toBe(true)
    expect(matchesSearch('prüf', ['Prüfung'])).toBe(true)
    expect(matchesSearch('pruf', ['Prüfung'])).toBe(false)
  })

  it('always matches an empty query', () => {
    expect(matchesSearch('  ', ['x'])).toBe(true)
  })
})

describe('offersSearch', () => {
  it('starts at the threshold', () => {
    expect(offersSearch(SEARCH_THRESHOLD - 1)).toBe(false)
    expect(offersSearch(SEARCH_THRESHOLD)).toBe(true)
  })

  it('stays on while a query is entered', () => {
    expect(offersSearch(0, 'a')).toBe(true)
  })
})
