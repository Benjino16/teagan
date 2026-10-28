import { dayOf, isFullDate } from './dates'
import type { Balance, Id, IsoDate, LedgerEntry, PartialDate } from './model'

/** Same bound as the backend, either way: 10 million. */
const MAX_AMOUNT_CENTS = 1_000_000_000

/**
 * Amounts in one currency, written the way the locale does. Amounts are
 * hundredths of whatever the currency is, so changing it only relabels them.
 */
export interface Money {
  /** Without sign – the words say who owes whom. Cents only when there are some: `25 €` · `€12.50` · `CHF 7`. */
  format(cents: number): string
  /** `€` for the labels; the code itself if there's no symbol. */
  symbol: string
  /** For the empty amount field: `0.00` · `0,00` · `0` for a currency without cents (JPY). */
  placeholder: string
  /** For hints, in the same shape: `12.50` · `12,50` · `12`. */
  example: string
  /**
   * A typed amount in hundredths: `12`, `12.5`, `12,50` – no cents for a
   * currency without. `null` if it isn't one, is zero or exceeds the bound.
   * No sign – who paid is chosen separately.
   */
  parse(text: string): number | null
  /** The amount for the input field, without sign: `12.50` · `12,50` · `12`. */
  inputText(cents: number): string
}

const moneyByKey = new Map<string, Money>()

/** `locale` only for tests – the app uses the browser's. Built once per currency, `Intl` formats aren't cheap. */
export function moneyIn(currency: string, locale?: string): Money {
  const key = `${currency} ${locale ?? ''}`
  let money = moneyByKey.get(key)
  if (!money) {
    money = createMoney(currency, locale)
    moneyByKey.set(key, money)
  }
  return money
}

function createMoney(currency: string, locale: string | undefined): Money {
  const style = { style: 'currency', currency } as const
  const whole = new Intl.NumberFormat(locale, { ...style, minimumFractionDigits: 0, maximumFractionDigits: 0 })
  // Two even where the currency has three (KWD) or none (JPY, cents from before a switch)
  const withCents = new Intl.NumberFormat(locale, { ...style, minimumFractionDigits: 2, maximumFractionDigits: 2 })
  // Hundredths can't hold a third digit
  const decimals = Math.min(2, new Intl.NumberFormat(locale, style).resolvedOptions().maximumFractionDigits ?? 2)
  const separator = new Intl.NumberFormat(locale).formatToParts(1.5).find((part) => part.type === 'decimal')?.value ?? '.'

  return {
    format(cents) {
      const abs = Math.abs(cents)
      return (abs % 100 === 0 ? whole : withCents).format(abs / 100)
    },
    symbol: whole.formatToParts(0).find((part) => part.type === 'currency')?.value ?? currency,
    placeholder: decimals === 0 ? '0' : `0${separator}00`,
    example: decimals === 0 ? '12' : `12${separator}50`,
    parse(text) {
      const match = /^(\d+)(?:[.,](\d{0,2}))?$/.exec(text.trim())
      if (!match || (match[2] ?? '').length > decimals) return null
      const cents = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
      return cents > 0 && cents <= MAX_AMOUNT_CENTS ? cents : null
    },
    inputText(cents) {
      const abs = Math.abs(cents)
      return abs % 100 === 0 ? String(abs / 100) : (abs / 100).toFixed(2).replace('.', separator)
    },
  }
}

/** Below zero they owe you, above zero you owe them. */
export function balanceOf(entries: LedgerEntry[]): number {
  return entries.reduce((sum, e) => sum + e.amountCents, 0)
}

/** `Lena owes you 7 €` · `You owe Lena 5.50 €` · `All settled`. */
export function balanceText(balance: number, name: string, money: Money): string {
  if (balance < 0) return `${name} owes you ${money.format(balance)}`
  if (balance > 0) return `You owe ${name} ${money.format(balance)}`
  return 'All settled'
}

/**
 * Which way it goes across everyone, the single balances listed below it:
 * `Overall you're owed 40 €` · `Overall you owe 10 €` · `Even overall` – the
 * last isn't “settled”, there is still money open with each of them.
 */
export function overallText(balances: Balance[], money: Money): string {
  const net = balances.reduce((sum, b) => sum + b.balanceCents, 0)
  if (net < 0) return `Overall you're owed ${money.format(net)}`
  if (net > 0) return `Overall you owe ${money.format(net)}`
  return 'Even overall'
}

/** For a row that already names the person: `owes you 7 €` · `you owe 5.50 €`. */
export function balanceRowText(balance: number, money: Money): string {
  return balance < 0 ? `owes you ${money.format(balance)}` : `you owe ${money.format(balance)}`
}

/** Who paid: you (negative amount) or the other person (positive). */
export type Payer = 'you' | 'them'

export function payerOf(cents: number): Payer {
  return cents < 0 ? 'you' : 'them'
}

/** The stored amount for a positive amount paid by `payer`. */
export function signedCents(cents: number, payer: Payer): number {
  return payer === 'you' ? -cents : cents
}

/** `You paid 25 €` · `Lena paid 25 €`. */
export function entryText(cents: number, name: string, money: Money): string {
  return `${payerOf(cents) === 'you' ? 'You' : name} paid ${money.format(cents)}`
}

/** The entry that brings the balance to zero: whoever owes pays it back. */
export function settlingCents(balance: number): number {
  return -balance
}

/** Date for a new entry from an event: its day, or today if the event has no exact day. */
export function entryDateFor(activityStart: PartialDate, today: IsoDate): IsoDate {
  const day = dayOf(activityStart)
  return isFullDate(day) ? day : today
}

/** A row in the event form: an existing entry (`id`) or a new one (`id: null`). Amount signed. */
export interface LedgerDraft {
  id: Id | null
  personId: Id
  amountCents: number
}

export interface LedgerChanges {
  create: { personId: Id; amountCents: number }[]
  /** The whole entry, since an update replaces all fields. */
  update: { entry: LedgerEntry; amountCents: number }[]
  remove: Id[]
}

/**
 * What saving the event form changes in its entries, like `openPointChanges`:
 * new rows are created, changed amounts updated, missing entries removed. An
 * entry can't move to another person, so a row whose person changed replaces
 * its entry with a new one.
 */
export function ledgerChanges(existing: LedgerEntry[], drafts: LedgerDraft[]): LedgerChanges {
  const changes: LedgerChanges = { create: [], update: [], remove: [] }
  const kept = new Set<Id>()
  for (const draft of drafts) {
    const entry = draft.id === null ? undefined : existing.find((e) => e.id === draft.id)
    if (!entry || draft.personId !== entry.personId) {
      changes.create.push({ personId: draft.personId, amountCents: draft.amountCents })
      continue
    }
    kept.add(entry.id)
    if (draft.amountCents !== entry.amountCents) changes.update.push({ entry, amountCents: draft.amountCents })
  }
  changes.remove = existing.filter((e) => !kept.has(e.id)).map((e) => e.id)
  return changes
}
