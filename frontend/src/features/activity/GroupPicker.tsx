import { clsx } from 'clsx'
import { ChevronRight, LayoutGrid, Plus } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import {
  Field,
  IconBadge,
  ImpactDots,
  inputStyles,
  ListCard,
  listRowStyles,
  MediaRow,
  RatingInput,
  TextInput,
} from '../../components/ui'
import { ACTIVITY_IMPACT_LEVELS } from '../../domain/activities'
import { groupPath, isGroupArchived } from '../../domain/groups'
import type { ActivityGroup, Group, Id, Impact } from '../../domain/model'
import { matchesSearch } from '../../domain/search'

const MAX_RESULTS = 6
const IMPACT_LEVELS = Object.values(ACTIVITY_IMPACT_LEVELS)

interface Props {
  groups: Group[]
  links: ActivityGroup[]
  onChange: (links: ActivityGroup[]) => void
  /** Impact of the event – applies to every group without its own value. */
  impact: Impact
}

/**
 * Groups the event belongs to, like the participants: the chevron expands a
 * per-group impact that overrides the event's and a note for this group only.
 */
export function GroupPicker({ groups, links, onChange, impact }: Props) {
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<Id | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const chosen = new Set(links.map((l) => l.groupId))
  // Archived groups can't be added, but stay listed where the event already belongs to them
  const results = query.trim()
    ? groups
        .filter(
          (c) =>
            !chosen.has(c.id) &&
            !isGroupArchived(c, groups) &&
            matchesSearch(query, [c.name, groupPath(c.id, groups)]),
        )
        .slice(0, MAX_RESULTS)
    : []

  function update(groupId: Id, patch: Partial<ActivityGroup>) {
    onChange(links.map((l) => (l.groupId === groupId ? { ...l, ...patch } : l)))
  }

  /** Back into the search afterwards, so the next group is just a few keys away. */
  function add(group: Group) {
    onChange([...links, { groupId: group.id, impact: null, note: null }])
    setQuery('')
    searchRef.current?.focus()
  }

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1.5 text-xs font-medium tracking-wide text-muted uppercase">Groups</legend>

      {links.length > 0 && (
        <ListCard aria-label="Groups">
          {links.map((link) => (
            <GroupRow
              key={link.groupId}
              name={groups.some((c) => c.id === link.groupId) ? groupPath(link.groupId, groups) : 'Unknown'}
              override={link.impact}
              impact={impact}
              note={link.note ?? ''}
              open={expanded === link.groupId}
              onToggle={() => setExpanded(expanded === link.groupId ? null : link.groupId)}
              onImpactChange={(value) => update(link.groupId, { impact: value })}
              onNoteChange={(value) => update(link.groupId, { note: value })}
              onRemove={() => onChange(links.filter((l) => l.groupId !== link.groupId))}
            />
          ))}
        </ListCard>
      )}

      <TextInput
        ref={searchRef}
        type="search"
        aria-label="Add group"
        placeholder="Add group …"
        autoComplete="off"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          // Enter adds the top result – and must never submit the surrounding form
          if (e.key !== 'Enter') return
          e.preventDefault()
          if (results[0]) add(results[0])
        }}
      />

      {query.trim() && (
        <ListCard aria-label="Group search results">
          {results.length === 0 && <li className="px-4 py-3 text-md text-muted">No group found.</li>}
          {results.map((group) => (
            <li key={group.id}>
              <button
                type="button"
                onClick={() => add(group)}
                className={clsx(listRowStyles, 'py-2.5 hover:bg-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent')}
              >
                <MediaRow
                  leading={<IconBadge icon={LayoutGrid} size={44} />}
                  title={groupPath(group.id, groups)}
                  trailing={<Plus aria-hidden="true" size={18} className="flex-none text-accent-ink" />}
                />
              </button>
            </li>
          ))}
        </ListCard>
      )}
    </fieldset>
  )
}

interface RowProps {
  /** With its main group: `University › Freshers 2021`. */
  name: string
  override: Impact | null
  impact: Impact
  /** Raw input – trimmed on submit. */
  note: string
  open: boolean
  onToggle: () => void
  onImpactChange: (value: Impact | null) => void
  onNoteChange: (value: string) => void
  onRemove: () => void
}

function GroupRow({ name, override, impact, note, open, onToggle, onImpactChange, onNoteChange, onRemove }: RowProps) {
  const panelId = useId()

  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className={clsx(
          listRowStyles,
          'hover:bg-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
        )}
      >
        <MediaRow
          leading={<IconBadge icon={LayoutGrid} size={44} />}
          title={name}
          subtitle={
            override !== null ? (
              <ImpactDots value={override} label={`Own impact: ${ACTIVITY_IMPACT_LEVELS[override].label}`} className="py-1" />
            ) : null
          }
          trailing={
            <ChevronRight
              aria-hidden="true"
              size={18}
              className={clsx('flex-none text-muted transition-transform', open && 'rotate-90')}
            />
          }
        >
          {note.trim() && (
            <span className="line-clamp-3 text-sm whitespace-pre-line text-muted wrap-anywhere">{note.trim()}</span>
          )}
        </MediaRow>
      </button>

      {open && (
        <div id={panelId} className="flex flex-col gap-3 px-4 pb-4">
          <RatingInput
            label={`Impact for ${name}`}
            levels={IMPACT_LEVELS}
            value={override ?? impact}
            onChange={(value) => onImpactChange(value as Impact)}
          />
          <Field label={`Note for ${name}`} hint="Only shown on this event and in the group's timeline.">
            {(id) => (
              <textarea
                id={id}
                rows={3}
                className={`${inputStyles} py-3 leading-normal`}
                value={note}
                onChange={(e) => onNoteChange(e.target.value)}
              />
            )}
          </Field>
          <div className="-mx-2 flex flex-wrap gap-1">
            {override !== null && (
              <button type="button" onClick={() => onImpactChange(null)} className={textButton}>
                Same as event
              </button>
            )}
            <button type="button" onClick={onRemove} className={clsx(textButton, 'text-danger')}>
              Remove
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

const textButton =
  'min-h-11 rounded-tile-sm px-2 text-md font-semibold text-accent-ink hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent'
