import { clsx } from 'clsx'
import { ChevronRight, LayoutGrid, Plus } from 'lucide-react'
import { useId, useState } from 'react'
import {
  Field,
  IconBadge,
  ImpactDots,
  inputStyles,
  ListCard,
  listRowStyles,
  MediaRow,
  RatingInput,
  TextButton,
  TextInput,
  useAddSearch,
  useListNavigation,
} from '../../components/ui'
import { ACTIVITY_IMPACT_LEVELS } from '../../domain/activities'
import { pluralize } from '../../domain/dates'
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
  /** Members not yet taking part, and all of them (subgroups included, without archived or deceased). */
  members: (groupId: Id) => { missing: number; all: number }
  /** The last “Add all members” while it can still be undone. */
  added: { groupId: Id; count: number } | null
  onAddMembers: (groupId: Id) => void
  onUndoAddMembers: () => void
}

/**
 * Groups the event belongs to, like the participants: the chevron expands a
 * per-group impact that overrides the event's and a note for this group only.
 * Below each group, its missing members can be added at once.
 */
export function GroupPicker({ groups, links, onChange, impact, members, added, onAddMembers, onUndoAddMembers }: Props) {
  const [expanded, setExpanded] = useState<Id | null>(null)
  const { query, pick, inputProps } = useAddSearch((group: Group) =>
    onChange([...links, { groupId: group.id, impact: null, note: null }]),
  )

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
  const nav = useListNavigation(results, { key: (c) => c.id, onPick: pick })

  function update(groupId: Id, patch: Partial<ActivityGroup>) {
    onChange(links.map((l) => (l.groupId === groupId ? { ...l, ...patch } : l)))
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
              members={members(link.groupId)}
              added={added?.groupId === link.groupId ? added.count : null}
              onAddMembers={() => onAddMembers(link.groupId)}
              onUndoAddMembers={onUndoAddMembers}
            />
          ))}
        </ListCard>
      )}

      <TextInput aria-label="Add group" placeholder="Add group …" {...inputProps(nav.inputProps)} />

      {query.trim() && (
        <ListCard aria-label="Group search results" {...nav.listProps}>
          {results.length === 0 && (
            <li role="presentation" className="px-4 py-3 text-md text-muted">
              No group found.
            </li>
          )}
          {results.map((group) => (
            <li key={group.id} role="presentation">
              <button
                type="button"
                {...nav.optionProps(group)}
                onClick={() => pick(group)}
                className={clsx(
                  listRowStyles,
                  'py-2.5 hover:bg-hover data-active:bg-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
                )}
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
  members: { missing: number; all: number }
  /** How many the last “Add all members” of this group added, while it can be undone. */
  added: number | null
  onAddMembers: () => void
  onUndoAddMembers: () => void
}

function GroupRow({
  name,
  override,
  impact,
  note,
  open,
  onToggle,
  onImpactChange,
  onNoteChange,
  onRemove,
  members,
  added,
  onAddMembers,
  onUndoAddMembers,
}: RowProps) {
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

      {/* Lined up with the name, past the icon */}
      {added !== null ? (
        <div className="-mt-2 flex items-center gap-1 pr-4 pb-1.5 pl-18">
          <span className="text-sm text-muted">Added {pluralize(added, 'member')}</span>
          <TextButton onClick={onUndoAddMembers}>Undo</TextButton>
        </div>
      ) : (
        members.missing > 0 && (
          <div className="-mt-2 pr-4 pb-1.5 pl-16">
            <TextButton onClick={onAddMembers} className="flex items-center gap-1">
              <Plus aria-hidden="true" size={16} />
              {members.missing === members.all && members.all > 1
                ? `Add all ${members.all} members`
                : `Add ${pluralize(members.missing, 'member')}`}
            </TextButton>
          </div>
        )
      )}

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
