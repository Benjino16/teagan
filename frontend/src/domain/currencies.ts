import { moneyIn } from './ledger'

/** Codes `Intl` knows that aren't money one lends: metals, funds, test and accounting units. */
const NOT_LENT = new Set([
  'BOV', 'CHE', 'CHW', 'CLF', 'COU', 'MXV', 'USN', 'USS', 'UYI', 'UYW',
  'XAG', 'XAU', 'XBA', 'XBB', 'XBC', 'XBD', 'XDR', 'XPD', 'XPT', 'XSU', 'XTS', 'XUA', 'XXX',
])

export interface CurrencyChoice {
  /** ISO 4217, `EUR`. */
  code: string
  /** In the browser's language: `Euro`, `Schweizer Franken`. */
  name: string
  /** `€`; the code itself if there's no symbol. */
  symbol: string
}

/**
 * Every currency to pick from, by name. `current` is always among them, even
 * if this browser doesn't know it. `locale` only for tests.
 */
export function currencyChoices(current: string, locale?: string): CurrencyChoice[] {
  const codes = new Set(Intl.supportedValuesOf('currency').filter((code) => !NOT_LENT.has(code)))
  codes.add(current)
  return [...codes]
    .map((code) => ({ code, name: currencyName(code, locale), symbol: moneyIn(code, locale).symbol }))
    .sort((a, b) => a.name.localeCompare(b.name, locale))
}

/** `Euro`, `Schweizer Franken` – in the browser's language; `locale` only for tests. */
export function currencyName(code: string, locale?: string): string {
  return new Intl.DisplayNames(locale, { type: 'currency' }).of(code) ?? code
}

/** Code, name or symbol contains the query, case-insensitive: `eur`, `franc`, `$`. */
export function matchesCurrency(choice: CurrencyChoice, query: string): boolean {
  const q = query.trim().toLowerCase()
  return [choice.code, choice.name, choice.symbol].some((text) => text.toLowerCase().includes(q))
}
