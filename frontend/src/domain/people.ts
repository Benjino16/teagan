import type { Activity, Id, Impact, ImpactLevel, Person, PersonInput } from './model'

/** Impact levels for people (closeness), with an explanation for the form. */
export const PERSON_IMPACT_LEVELS: Record<Impact, ImpactLevel> = {
  1: { label: 'Side note', description: 'Met once or only heard of – you just note something down.' },
  2: { label: 'Acquaintance', description: 'You know each other, e.g. neighbors or people from a club.' },
  3: { label: 'Friend', description: 'Someone you enjoy spending time with.' },
  4: { label: 'Close', description: 'Close circle of friends.' },
  5: { label: 'Inner circle', description: 'Family, partner, best friends.' },
}

export function isArchived(person: Pick<Person, 'archivedAt'>): boolean {
  return person.archivedAt !== null
}

/** Reconnect rhythm and focus pause while archived or deceased – the values stay. */
export function isContactPaused(person: Pick<Person, 'archivedAt' | 'deceased'>): boolean {
  return isArchived(person) || person.deceased
}

export function displayName(person: Pick<Person, 'name' | 'nickname'>): string {
  return person.nickname?.trim() || person.name
}

/** `Lena Hoffmann` → `LH`, `Mira` → `M` */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  const first = words[0]![0]!
  const last = words.length > 1 ? words.at(-1)![0]! : ''
  return (first + last).toUpperCase()
}

function joinWithAnd(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`
}

/** Up to this many others are named, beyond that they are counted. */
const MAX_NAMED = 3

export interface ParticipantsOptions {
  /** The person whose view is currently open – not mentioned. */
  viewedPersonId?: Id
  selfId: Id
  nameOf: (id: Id) => string
}

/**
 * Other participants of an activity from a person's point of view, without “with”:
 * `Jonas, Mira and you` · `you and 4 others` · `Jonas, Mira and 3 others`.
 * `null` if nobody else besides you took part.
 */
export function participantsText(activity: Activity, options: ParticipantsOptions): string | null {
  const { viewedPersonId, selfId, nameOf } = options
  const ids = activity.participants.map((p) => p.personId)
  const withSelf = ids.includes(selfId)
  const others = ids.filter((id) => id !== selfId && id !== viewedPersonId)

  if (others.length === 0) return null

  if (others.length <= MAX_NAMED) {
    const names = others.map(nameOf)
    return joinWithAnd(withSelf ? [...names, 'you'] : names)
  }

  if (withSelf) return `you and ${others.length} others`
  const named = others.slice(0, 2).map(nameOf)
  return `${named.join(', ')} and ${others.length - 2} others`
}

export interface CompanyOptions {
  selfId: Id
  nameOf: (id: Id) => string
  groupNameOf: (id: Id) => string
}

/**
 * Who an activity is with, from your own point of view (Today page), including “with”:
 * `with Jonas and Mira` if you take part, otherwise just `Jonas and Mira` – “with” would
 * put you there. Without other people, the groups say it. `null` if it's only you.
 */
export function companyText(activity: Activity, options: CompanyOptions): string | null {
  const { selfId, nameOf, groupNameOf } = options
  const withSelf = activity.participants.some((p) => p.personId === selfId)
  const others = activity.participants.map((p) => p.personId).filter((id) => id !== selfId)

  let company: string | null = null
  if (others.length > 0 && others.length <= MAX_NAMED) company = joinWithAnd(others.map(nameOf))
  else if (others.length > 0)
    company = withSelf
      ? `${others.length} others`
      : `${others.slice(0, 2).map(nameOf).join(', ')} and ${others.length - 2} others`
  else if (activity.groups.length > 0) company = activity.groups.map((g) => groupNameOf(g.groupId)).join(', ')

  if (company === null) return null
  return withSelf ? `with ${company}` : company
}

export interface ImpactGroup {
  impact: Impact
  people: Person[]
}

/** People grouped by impact (5 → 1), empty groups dropped, alphabetical within a group. */
export function groupByImpact(people: Person[]): ImpactGroup[] {
  const groups: ImpactGroup[] = ([5, 4, 3, 2, 1] as const).map((impact) => ({ impact, people: [] }))
  for (const person of people) groups[5 - person.impact]!.people.push(person)
  for (const group of groups) group.people.sort((a, b) => a.name.localeCompare(b.name))
  return groups.filter((g) => g.people.length > 0)
}

/** Closest first (impact 5 → 1), then alphabetical – e.g. for avatar stacks. */
export function byImpactThenName(a: Person, b: Person): number {
  return b.impact - a.impact || a.name.localeCompare(b.name)
}

/** The editable fields of a person – the base for an update that changes only some of them. */
export function toPersonInput(person: Person): PersonInput {
  const { name, nickname, birthday, birthdayNote, reconnectDays, impact, focus, deceased, diedOn } = person
  return { name, nickname, birthday, birthdayNote, reconnectDays, impact, focus, deceased, diedOn }
}
