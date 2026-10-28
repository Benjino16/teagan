import { clsx } from 'clsx'
import { BookOpen, ChevronRight, CircleCheck, LayoutGrid, ListTodo, type LucideIcon } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  Avatar,
  BottomSheet,
  EmptyState,
  IconBadge,
  ListCard,
  listRowStyles,
  MediaRow,
  type OptionProps,
  SearchField,
  useListNavigation,
} from '../../components/ui'
import { usePeople, useGroups, useSearch } from '../../data/queries'
import { formatDateRangeWithYear } from '../../domain/dates'
import { getToday } from '../../domain/today'
import { groupPath, isGroupArchived } from '../../domain/groups'
import type { Id, SearchHits } from '../../domain/model'
import { isArchived } from '../../domain/people'
import { MIN_QUERY_CHARS } from '../../domain/search'
import { activityIcon } from '../../icons/activityIcons'

/** Hits per resource at first, and once “Show all” was tapped (the backend's maximum). */
const LIMIT = 10
const LIMIT_ALL = 100

/** Only a wait longer than this shows – a quick answer just swaps the hits, without flicker. */
const SLOW_MS = 300

/**
 * Full search over people, groups, events, knowledge and open points. Every hit links to
 * where it lives; following one closes the sheet. The first hit is marked, ↓/↑ move the
 * mark while focus stays in the field, Enter opens it.
 */
export function SearchSheet({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(LIMIT)
  const search = useSearch(query, limit)
  const slow = useLasting(search.waiting, SLOW_MS)
  // For the names next to knowledge and open points, and the paths of subgroups
  const people = usePeople().data ?? []
  const groups = useGroups().data ?? []
  const personName = (id: Id) => people.find((p) => p.id === id)?.name ?? ''
  const navigate = useNavigate()

  const result = search.active ? search.data : undefined
  const total = result ? Object.values(result).reduce((sum, hits: SearchHits<unknown>) => sum + hits.total, 0) : 0
  const cut = result ? Object.values(result).some((hits: SearchHits<unknown>) => hits.total > hits.items.length) : false

  // Where each hit leads, in the order shown – the arrow keys walk through this
  const targets: Target[] = result
    ? [
        ...result.people.items.map((p) => ({ key: `person-${p.id}`, to: `/people/${p.id}` })),
        ...result.groups.items.map((g) => ({ key: `group-${g.id}`, to: `/groups/${g.id}` })),
        ...result.activities.items.map((a) => ({ key: `activity-${a.id}`, to: `/activities/${a.id}` })),
        ...result.facts.items.map((f) => ({ key: `fact-${f.id}`, to: `/people/${f.personId}/knowledge` })),
        ...result.openPoints.items.map((p) => ({ key: `point-${p.id}`, to: `/people/${p.personId}` })),
      ]
    : []
  // Position of each section's first hit in `targets`
  const shown = (hits: SearchHits<unknown> | undefined) => hits?.items.length ?? 0
  const start = { people: 0, groups: shown(result?.people), activities: 0, facts: 0, openPoints: 0 }
  start.activities = start.groups + shown(result?.groups)
  start.facts = start.activities + shown(result?.activities)
  start.openPoints = start.facts + shown(result?.facts)
  const nav = useListNavigation(targets, {
    key: (target) => target.key,
    onPick: (target) => {
      onClose()
      navigate(target.to)
    },
    // Never open a hit from the previous query
    ready: !search.waiting,
  })
  const option = (index: number) => nav.optionProps(targets[index])

  return (
    <BottomSheet title="Search" onClose={onClose}>
      <div className="flex flex-col gap-5 pt-1 pb-4">
        <SearchField
          autoFocus
          value={query}
          onChange={(value) => {
            setQuery(value)
            setLimit(LIMIT)
          }}
          label="Search everything"
          placeholder="People, events, knowledge …"
          combobox={nav.inputProps}
        />

        {!search.active ? (
          <p className="px-1 text-md text-muted">
            Searches people, groups, events, knowledge and open points – from {MIN_QUERY_CHARS} letters on.
          </p>
        ) : search.isError ? (
          <p role="alert" className="px-1 text-md text-danger">
            The search failed. Try again in a moment.
          </p>
        ) : !result || (total === 0 && search.waiting) ? (
          slow && (
            <p role="status" className="px-1 text-md text-muted">
              Searching …
            </p>
          )
        ) : total === 0 ? (
          <EmptyState>Nothing found for “{query.trim()}”.</EmptyState>
        ) : (
          // Old hits stay while the next ones load, faded only if that takes a while
          <div className={clsx('flex flex-col gap-5 transition-opacity', slow && 'opacity-60')}>
            <div {...nav.listProps} aria-label="Search results" className="flex flex-col gap-5">
              <Section title="People" hits={result.people} start={start.people}>
                {(person, index) => (
                  <HitLink
                    option={option(index)}
                    to={`/people/${person.id}`}
                    onClose={onClose}
                    leading={<Avatar name={person.name} photo={person.photo} size="md" />}
                    title={person.name}
                    subtitle={join(person.nickname, isArchived(person) && 'Archived')}
                  />
                )}
              </Section>
              <Section title="Groups" hits={result.groups} start={start.groups}>
                {(group, index) => (
                  <HitLink
                    option={option(index)}
                    to={`/groups/${group.id}`}
                    onClose={onClose}
                    leading={<Badge icon={LayoutGrid} />}
                    title={group.name}
                    subtitle={join(
                      group.parentId !== null && groupPath(group.parentId, groups),
                      isGroupArchived(group, groups) && 'Archived',
                    )}
                  />
                )}
              </Section>
              <Section title="Events" hits={result.activities} start={start.activities}>
                {(activity, index) => (
                  <HitLink
                    option={option(index)}
                    to={`/activities/${activity.id}`}
                    onClose={onClose}
                    leading={<Badge icon={activityIcon(activity.icon).Icon} />}
                    title={activity.name}
                    subtitle={join(formatDateRangeWithYear(activity.startDate, activity.endDate, getToday()), activity.location)}
                  />
                )}
              </Section>
              <Section title="Knowledge" hits={result.facts} start={start.facts}>
                {(fact, index) => (
                  <HitLink
                    option={option(index)}
                    to={`/people/${fact.personId}/knowledge`}
                    onClose={onClose}
                    leading={<Badge icon={BookOpen} />}
                    title={fact.value}
                    subtitle={join(fact.label, personName(fact.personId))}
                  />
                )}
              </Section>
              <Section title="Open points" hits={result.openPoints} start={start.openPoints}>
                {(point, index) => (
                  <HitLink
                    option={option(index)}
                    to={`/people/${point.personId}`}
                    onClose={onClose}
                    leading={<Badge icon={point.doneAt ? CircleCheck : ListTodo} />}
                    title={point.text}
                    subtitle={join(personName(point.personId), point.doneAt && 'Done')}
                  />
                )}
              </Section>
            </div>
            {cut && limit < LIMIT_ALL && (
              <button
                type="button"
                onClick={() => setLimit(LIMIT_ALL)}
                className="min-h-11 self-start px-1 text-sm font-semibold text-accent-ink hover:text-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Show all hits
              </button>
            )}
          </div>
        )}
      </div>
    </BottomSheet>
  )
}

/** A hit as the arrow keys see it. */
interface Target {
  key: string
  to: string
}

/** Whether `value` has been true for at least `ms` – false again as soon as it is. */
function useLasting(value: boolean, ms: number): boolean {
  const [lasting, setLasting] = useState(false)
  useEffect(() => {
    if (!value) return
    const timer = setTimeout(() => setLasting(true), ms)
    return () => {
      clearTimeout(timer)
      setLasting(false)
    }
  }, [value, ms])
  return value && lasting
}

/** The non-empty parts, joined by a dot: `Lena · Done`. */
function join(...parts: (string | false | null | undefined)[]): string | undefined {
  const shown = parts.filter((part): part is string => !!part)
  return shown.length ? shown.join(' · ') : undefined
}

function Badge({ icon }: { icon: LucideIcon }) {
  return <IconBadge icon={icon} size={44} tone="neutral" />
}

interface SectionProps<T> {
  title: string
  hits: SearchHits<T>
  /** Position of the first hit among all shown hits. */
  start: number
  children: (item: T, index: number) => ReactNode
}

/** One resource's hits as a card, a group of options in the listbox; hidden without any. */
function Section<T extends { id: Id }>({ title, hits, start, children }: SectionProps<T>) {
  if (hits.total === 0) return null
  const shown = hits.items.length
  const count = shown < hits.total ? `${shown} of ${hits.total}` : String(hits.total)
  return (
    <div role="group" aria-label={`${title}, ${count}`} className="flex flex-col gap-2">
      <h3 aria-hidden="true" className="flex items-baseline justify-between gap-3 px-1 text-sm font-semibold text-muted">
        {title}
        <span className="font-normal">{count}</span>
      </h3>
      <ListCard role="presentation">
        {hits.items.map((item, i) => (
          <li key={item.id} role="presentation">
            {children(item, start + i)}
          </li>
        ))}
      </ListCard>
    </div>
  )
}

interface HitLinkProps {
  /** From `useListNavigation`: id, role and the mark. */
  option: OptionProps
  to: string
  onClose: () => void
  leading: ReactNode
  title: string
  subtitle?: string
}

function HitLink({ option, to, onClose, leading, title, subtitle }: HitLinkProps) {
  return (
    <Link
      {...option}
      to={to}
      onClick={onClose}
      className={clsx(listRowStyles, 'text-ink no-underline hover:bg-hover data-active:bg-hover')}
    >
      <MediaRow
        leading={leading}
        title={<span className="line-clamp-2 break-words">{title}</span>}
        subtitle={subtitle && <span className="line-clamp-1 break-words">{subtitle}</span>}
        trailing={<ChevronRight aria-hidden="true" size={18} className="flex-none text-muted" />}
      />
    </Link>
  )
}
