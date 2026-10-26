import { clsx } from 'clsx'
import { ChevronRight, Plus } from 'lucide-react'
import { useId, useState } from 'react'
import {
  Avatar,
  Field,
  ImpactDots,
  inputStyles,
  ListCard,
  listRowStyles,
  MediaRow,
  MoodDots,
  RatingInput,
  Switch,
  TextInput,
  useAddSearch,
  useListNavigation,
} from '../../components/ui'
import { ACTIVITY_IMPACT_LEVELS, MOOD_LEVELS } from '../../domain/activities'
import type { ActivityParticipant, Id, Impact, Mood, Person, PhotoUrls } from '../../domain/model'
import { displayName, isArchived } from '../../domain/people'
import { matchesSearch } from '../../domain/search'
import { MoodField } from './MoodField'

const MAX_RESULTS = 6
const IMPACT_LEVELS = Object.values(ACTIVITY_IMPACT_LEVELS)

interface Props {
  self: Person
  /** All people except yourself. */
  people: Person[]
  participants: ActivityParticipant[]
  onChange: (participants: ActivityParticipant[]) => void
  /** Impact of the event – applies to everyone without their own value. */
  impact: Impact
  /** Mood of the event, `null` = none – applies to everyone without their own. */
  mood: Mood | null
}

/**
 * Participants as a list like in the detail view. The chevron expands a
 * per-person impact and mood that override the event's and a note for this person only.
 */
export function ParticipantPicker({ self, people, participants, onChange, impact, mood }: Props) {
  const [expanded, setExpanded] = useState<Id | null>(null)
  const { query, pick, inputProps } = useAddSearch((person: Person) =>
    onChange([...participants, { personId: person.id, impact: null, mood: null, note: null }]),
  )
  const byId = new Map([self, ...people].map((p) => [p.id, p]))
  const withSelf = participants.some((p) => p.personId === self.id)

  const chosen = new Set(participants.map((p) => p.personId))
  // Archived people can't be added, but stay listed where they already take part
  const results = query.trim()
    ? people
        .filter((p) => !chosen.has(p.id) && !isArchived(p) && matchesSearch(query, [p.name, p.nickname]))
        .slice(0, MAX_RESULTS)
    : []
  const nav = useListNavigation(results, { key: (p) => p.id, onPick: pick })

  function update(personId: Id, patch: Partial<ActivityParticipant>) {
    onChange(participants.map((p) => (p.personId === personId ? { ...p, ...patch } : p)))
  }

  function remove(personId: Id) {
    onChange(participants.filter((p) => p.personId !== personId))
  }

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1.5 text-xs font-medium tracking-wide text-muted uppercase">Participants</legend>

      <Switch
        label="I was there"
        checked={withSelf}
        onChange={(on) => (on ? onChange([{ personId: self.id, impact: null, mood: null, note: null }, ...participants]) : remove(self.id))}
      />

      {participants.length > 0 && (
        <ListCard aria-label="Participants">
          {participants.map((participant) => {
            const person = byId.get(participant.personId)
            const isSelf = participant.personId === self.id
            const name = isSelf ? 'You' : person ? person.name : 'Unknown'
            return (
              <ParticipantRow
                key={participant.personId}
                name={name}
                photo={person?.photo ?? null}
                forName={isSelf ? 'you' : person ? displayName(person) : name}
                override={participant.impact}
                impact={impact}
                ownMood={participant.mood}
                mood={mood}
                note={participant.note ?? ''}
                open={expanded === participant.personId}
                onToggle={() => setExpanded(expanded === participant.personId ? null : participant.personId)}
                onImpactChange={(value) => update(participant.personId, { impact: value })}
                onMoodChange={(value) => update(participant.personId, { mood: value })}
                onNoteChange={(value) => update(participant.personId, { note: value })}
                onRemove={() => remove(participant.personId)}
              />
            )
          })}
        </ListCard>
      )}

      <TextInput aria-label="Add person" placeholder="Add person …" {...inputProps(nav.inputProps)} />

      {query.trim() && (
        <ListCard aria-label="Search results" {...nav.listProps}>
          {results.length === 0 && (
            <li role="presentation" className="px-4 py-3 text-md text-muted">
              No one found.
            </li>
          )}
          {results.map((person) => (
            <li key={person.id} role="presentation">
              <button
                type="button"
                {...nav.optionProps(person)}
                onClick={() => pick(person)}
                className={clsx(
                  listRowStyles,
                  'py-2.5 hover:bg-hover data-active:bg-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
                )}
              >
                <MediaRow
                  leading={<Avatar name={person.name} photo={person.photo} size="md" />}
                  title={person.name}
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
  name: string
  photo: PhotoUrls | null
  /** “for Lena” / “for you” */
  forName: string
  override: Impact | null
  impact: Impact
  ownMood: Mood | null
  /** The event's mood, `null` = none. */
  mood: Mood | null
  /** Raw input – trimmed on submit. */
  note: string
  open: boolean
  onToggle: () => void
  onImpactChange: (value: Impact | null) => void
  onMoodChange: (value: Mood | null) => void
  onNoteChange: (value: string) => void
  onRemove: () => void
}

function ParticipantRow({
  name,
  photo,
  forName,
  override,
  impact,
  ownMood,
  mood,
  note,
  open,
  onToggle,
  onImpactChange,
  onMoodChange,
  onNoteChange,
  onRemove,
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
          leading={<Avatar name={name} photo={photo} size="md" />}
          title={name}
          subtitle={
            override !== null || ownMood !== null ? (
              <span className="flex items-center gap-3 py-1">
                {override !== null && (
                  <ImpactDots value={override} label={`Own impact: ${ACTIVITY_IMPACT_LEVELS[override].label}`} />
                )}
                {ownMood !== null && <MoodDots value={ownMood} label={`Own mood: ${MOOD_LEVELS[ownMood].label}`} />}
              </span>
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
            label={`Impact for ${forName}`}
            levels={IMPACT_LEVELS}
            value={override ?? impact}
            onChange={(value) => onImpactChange(value as Impact)}
          />
          <MoodField
            label={`Mood for ${forName}`}
            addLabel={`${mood !== null ? 'Own' : 'Add'} mood for ${forName}`}
            removeLabel={`Remove mood for ${forName}`}
            value={ownMood}
            onChange={onMoodChange}
            hint={mood !== null ? `Otherwise as the event: ${MOOD_LEVELS[mood].label}` : undefined}
          />
          <Field label={`Note for ${forName}`} hint={`Only shown on this event and in ${forName === 'you' ? 'your' : `${forName}'s`} timeline.`}>
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
                Same impact as event
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
