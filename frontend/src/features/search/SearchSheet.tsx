import { clsx } from 'clsx'
import { BookOpen, ChevronRight, CircleCheck, LayoutGrid, ListTodo, type LucideIcon } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Avatar, BottomSheet, EmptyState, IconBadge, ListCard, listRowStyles, MediaRow, SearchField } from '../../components/ui'
import { usePeople, useGroups, useSearch } from '../../data/queries'
import { formatDateRangeWithYear } from '../../domain/dates'
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
 * where it lives; following one closes the sheet.
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

  const result = search.active ? search.data : undefined
  const total = result ? Object.values(result).reduce((sum, hits: SearchHits<unknown>) => sum + hits.total, 0) : 0
  const cut = result ? Object.values(result).some((hits: SearchHits<unknown>) => hits.total > hits.items.length) : false

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
            <Section title="People" hits={result.people}>
              {(person) => (
                <HitLink
                  to={`/people/${person.id}`}
                  onClose={onClose}
                  leading={<Avatar name={person.name} photo={person.photo} size="md" />}
                  title={person.name}
                  subtitle={join(person.nickname, isArchived(person) && 'Archived')}
                />
              )}
            </Section>
            <Section title="Groups" hits={result.groups}>
              {(group) => (
                <HitLink
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
            <Section title="Events" hits={result.activities}>
              {(activity) => (
                <HitLink
                  to={`/activities/${activity.id}`}
                  onClose={onClose}
                  leading={<Badge icon={activityIcon(activity.icon).Icon} />}
                  title={activity.name}
                  subtitle={join(formatDateRangeWithYear(activity.startDate, activity.endDate), activity.location)}
                />
              )}
            </Section>
            <Section title="Knowledge" hits={result.facts}>
              {(fact) => (
                <HitLink
                  to={`/people/${fact.personId}/knowledge`}
                  onClose={onClose}
                  leading={<Badge icon={BookOpen} />}
                  title={fact.value}
                  subtitle={join(fact.label, personName(fact.personId))}
                />
              )}
            </Section>
            <Section title="Open points" hits={result.openPoints}>
              {(point) => (
                <HitLink
                  to={`/people/${point.personId}`}
                  onClose={onClose}
                  leading={<Badge icon={point.doneAt ? CircleCheck : ListTodo} />}
                  title={point.text}
                  subtitle={join(personName(point.personId), point.doneAt && 'Done')}
                />
              )}
            </Section>
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
  children: (item: T) => ReactNode
}

/** One resource's hits as a card; hidden without any. */
function Section<T extends { id: Id }>({ title, hits, children }: SectionProps<T>) {
  if (hits.total === 0) return null
  const shown = hits.items.length
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <h3 className="flex items-baseline justify-between gap-3 px-1 text-sm font-semibold text-muted">
        {title}
        <span className="font-normal">{shown < hits.total ? `${shown} of ${hits.total}` : hits.total}</span>
      </h3>
      <ListCard>
        {hits.items.map((item) => (
          <li key={item.id}>{children(item)}</li>
        ))}
      </ListCard>
    </section>
  )
}

interface HitLinkProps {
  to: string
  onClose: () => void
  leading: ReactNode
  title: string
  subtitle?: string
}

function HitLink({ to, onClose, leading, title, subtitle }: HitLinkProps) {
  return (
    <Link to={to} onClick={onClose} className={`${listRowStyles} text-ink no-underline hover:bg-hover`}>
      <MediaRow
        leading={leading}
        title={<span className="line-clamp-2 break-words">{title}</span>}
        subtitle={subtitle && <span className="line-clamp-1 break-words">{subtitle}</span>}
        trailing={<ChevronRight aria-hidden="true" size={18} className="flex-none text-muted" />}
      />
    </Link>
  )
}
