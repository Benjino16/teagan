import { Plus, X } from 'lucide-react'
import { type FormEvent, useRef, useState } from 'react'
import { Button, Field, IconButton, inputStyles, RatingInput, Switch, TextButton, TextInput } from '../../components/ui'
import { ACTIVITY_IMPACT_LEVELS } from '../../domain/activities'
import { joinPartialDate, splitPartialDate } from '../../domain/dates'
import type { ActivityGroup, ActivityInput, ActivityParticipant, Group, Impact, OpenPoint, Person } from '../../domain/model'
import type { OpenPointDraft } from '../../domain/openPoints'
import { DateInput } from './DateInput'
import { GroupPicker } from './GroupPicker'
import { IconPicker } from './IconPicker'
import { type OpenPointRow, OpenPointsEditor } from './OpenPointsEditor'
import { ParticipantPicker } from './ParticipantPicker'

const IMPACT_LEVELS = Object.values(ACTIVITY_IMPACT_LEVELS)

interface Props {
  initial: ActivityInput
  self: Person
  /** All people except yourself. */
  people: Person[]
  groups: Group[]
  /** The event's existing open points (when editing). */
  initialPoints?: OpenPoint[]
  submitLabel: string
  submitting: boolean
  error: string | null
  onSubmit: (input: ActivityInput, points: OpenPointDraft[]) => void
}

/** Create or edit an event. */
export function ActivityForm({
  initial,
  self,
  people,
  groups,
  initialPoints = [],
  submitLabel,
  submitting,
  error,
  onSubmit,
}: Props) {
  const [name, setName] = useState(initial.name)
  const [icon, setIcon] = useState(initial.icon)
  const [start, setStart] = useState(() => splitPartialDate(initial.startDate))
  const [isRange, setIsRange] = useState(initial.endDate !== null)
  const [end, setEnd] = useState(() => splitPartialDate(initial.endDate ?? initial.startDate))
  const [description, setDescription] = useState(initial.description ?? '')
  // `null` = no field yet, only “Add location”
  const [location, setLocation] = useState(initial.location)
  const [impact, setImpact] = useState<Impact>(initial.impact)
  // You first, as in the detail view
  const [participants, setParticipants] = useState<ActivityParticipant[]>(() => [
    ...initial.participants.filter((p) => p.personId === self.id),
    ...initial.participants.filter((p) => p.personId !== self.id),
  ])
  const [groupLinks, setGroupLinks] = useState<ActivityGroup[]>(initial.groups)
  const [points, setPoints] = useState<OpenPointRow[]>(() =>
    [...initialPoints]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id)
      .map((p) => ({ key: `point-${p.id}`, id: p.id, personId: p.personId, text: p.text })),
  )
  const nextKey = useRef(0)
  const [reminder, setReminder] = useState(initial.reminder)
  const [problem, setProblem] = useState<string | null>(null)

  const reminderPossible = start.precision === 'day'
  const personById = new Map([self, ...people].map((p) => [p.id, p]))
  const candidates = participants.flatMap((p) => {
    const person = p.personId === self.id ? undefined : personById.get(p.personId)
    return person ? [person] : []
  })

  /** Removing a participant drops their new points; existing ones stay with the person. */
  function changeParticipants(next: ActivityParticipant[]) {
    const ids = new Set(next.map((p) => p.personId))
    setParticipants(next)
    setPoints((rows) => rows.filter((r) => r.id !== null || r.personId === null || ids.has(r.personId)))
  }

  /** The sole other participant is the default for points without a person. */
  function drafts(): OpenPointDraft[] | null {
    const fallback = candidates.length === 1 ? candidates[0]!.id : null
    const result: OpenPointDraft[] = []
    for (const row of points) {
      const personId = row.personId ?? fallback
      if (personId === null) {
        if (row.text.trim()) return null
        continue
      }
      result.push({ id: row.id, personId, text: row.text })
    }
    return result
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    // Only a point in time has a time
    const startDate = joinPartialDate(isRange ? { ...start, time: '' } : start)
    const endDate = isRange ? joinPartialDate({ ...end, time: '' }) : null

    const missing = !name.trim()
      ? 'Title is missing.'
      : startDate === null
        ? 'Date is incomplete.'
        : isRange && endDate === null
          ? 'End is incomplete.'
          : participants.length === 0 && groupLinks.length === 0
            ? 'Choose at least one participant or group.'
            : drafts() === null
              ? 'Choose who each open point is for.'
              : null
    setProblem(missing)
    const pointDrafts = drafts()
    if (missing || startDate === null || pointDrafts === null) return

    onSubmit({
      name: name.trim(),
      icon,
      startDate,
      endDate,
      description: description.trim() || null,
      location: location?.trim() || null,
      impact,
      reminder: reminderPossible && reminder,
      participants: participants.map((p) => ({ ...p, note: p.note?.trim() || null })),
      groups: groupLinks.map((g) => ({ ...g, note: g.note?.trim() || null })),
    }, pointDrafts)
  }

  const message = problem ?? error

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-7">
      <div className="flex flex-col gap-3">
        <div className="flex items-end gap-2">
          <IconPicker value={icon} onChange={setIcon} />
          <Field label="Title" className="flex-auto">
            {(id) => <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />}
          </Field>
        </div>
        {location === null ? (
          <Button variant="ghost" className="self-start px-2" onClick={() => setLocation('')}>
            <Plus aria-hidden="true" size={18} />
            Add location
          </Button>
        ) : (
          <Field label="Location">
            {(id) => (
              <div className="flex items-center gap-2">
                <TextInput
                  id={id}
                  placeholder="e.g. Café Fritz"
                  autoComplete="off"
                  maxLength={200}
                  // Only right after “Add location”, not when editing an existing one
                  autoFocus={location === ''}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
                <IconButton icon={X} aria-label="Remove location" onClick={() => setLocation(null)} />
              </div>
            )}
          </Field>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <DateInput label={isRange ? 'Start' : 'Date'} value={start} onChange={setStart} withTime={!isRange} />
        {isRange && <DateInput label="End" value={end} onChange={setEnd} />}
        {/* Stays the same element when the end appears, so focus stays on it */}
        <TextButton
          className="-mt-3 -ml-2 self-start"
          onClick={() => {
            // The end starts at the start, with the same precision
            if (!isRange) setEnd({ ...start, time: '' })
            setIsRange(!isRange)
          }}
        >
          {isRange ? 'Only a point in time?' : 'Is it a time span?'}
        </TextButton>
      </div>

      <Field label="Description">
        {(id) => (
          <textarea
            id={id}
            rows={4}
            className={`${inputStyles} py-3 leading-normal`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        )}
      </Field>

      <RatingInput label="Impact" levels={IMPACT_LEVELS} value={impact} onChange={(v) => setImpact(v as Impact)} />

      <ParticipantPicker
        self={self}
        people={people}
        participants={participants}
        onChange={changeParticipants}
        impact={impact}
      />

      <GroupPicker groups={groups} links={groupLinks} onChange={setGroupLinks} impact={impact} />

      <OpenPointsEditor
        rows={points}
        onChange={setPoints}
        candidates={candidates}
        personById={personById}
        newKey={() => `new-${nextKey.current++}`}
      />

      <Switch
        label="Reminder on the day"
        hint={reminderPossible ? undefined : 'Only possible with an exact date (day).'}
        checked={reminderPossible && reminder}
        disabled={!reminderPossible}
        onChange={setReminder}
      />

      {message && (
        <p role="alert" className="rounded-tile bg-danger-soft px-4 py-3 text-md text-danger">
          {message}
        </p>
      )}

      <Button type="submit" disabled={submitting}>
        {submitLabel}
      </Button>
    </form>
  )
}
