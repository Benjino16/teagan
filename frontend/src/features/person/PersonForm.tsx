import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import {
  Avatar,
  Button,
  ChoiceGroup,
  Field,
  IconButton,
  inputStyles,
  RatingInput,
  Switch,
  TextButton,
  TextInput,
} from '../../components/ui'
import { ageOf, birthYearFromAge, parseBirthday } from '../../domain/birthday'
import { HALF_YEAR_DAYS, MONTH_NAMES, YEAR_DAYS } from '../../domain/dates'
import { PERSON_IMPACT_LEVELS } from '../../domain/people'
import type { Birthday, Impact, IsoDate, PersonInput, PhotoChange, PhotoUrls } from '../../domain/model'
import { resizePhoto } from './resizePhoto'

/*
 * Deliberately minimal: create and edit a person. The actual workflow
 * is planned separately.
 */

type BirthdayMode = 'none' | 'date' | 'dayMonth' | 'age'

const BIRTHDAY_MODES = [
  { value: 'none', label: 'Unknown' },
  { value: 'date', label: 'Date' },
  { value: 'dayMonth', label: 'Without year' },
  { value: 'age', label: 'Age only' },
] as const

const IMPACT_LEVELS = Object.values(PERSON_IMPACT_LEVELS)

const RECONNECT_CHOICES = [
  { value: null, label: 'None' },
  { value: 7, label: '1 week' },
  { value: 14, label: '2 weeks' },
  { value: 28, label: '4 weeks' },
  { value: 56, label: '8 weeks' },
  { value: HALF_YEAR_DAYS, label: '6 months' },
  { value: YEAR_DAYS, label: '1 year' },
] as const

interface Props {
  /** Existing person when editing, otherwise an empty form. */
  initial?: PersonInput
  /** The person's current photo when editing. */
  initialPhoto?: PhotoUrls | null
  /** Your own person can be neither in focus nor deceased. */
  isSelf?: boolean
  submitLabel: string
  today: IsoDate
  submitting: boolean
  error: string | null
  onSubmit: (input: PersonInput, photo: PhotoChange) => void
}

export function PersonForm({
  initial,
  initialPhoto = null,
  isSelf = false,
  submitLabel,
  today,
  submitting,
  error,
  onSubmit,
}: Props) {
  const start = birthdayFields(initial?.birthday ?? null, today)
  const [name, setName] = useState(initial?.name ?? '')
  const [nickname, setNickname] = useState(initial?.nickname ?? '')
  const [impact, setImpact] = useState<Impact>(initial?.impact ?? 3)
  const [reconnectDays, setReconnectDays] = useState<number | null>(initial?.reconnectDays ?? null)
  const [focus, setFocus] = useState(initial?.focus ?? false)
  const [deceased, setDeceased] = useState(initial?.deceased ?? false)
  const [diedOn, setDiedOn] = useState(initial?.diedOn ?? '')
  const [photo, setPhoto] = useState<PhotoChange>('keep')
  const [birthdayMode, setBirthdayMode] = useState<BirthdayMode>(start.mode)
  const [date, setDate] = useState(start.date)
  const [day, setDay] = useState(start.day)
  const [month, setMonth] = useState(start.month)
  const [age, setAge] = useState(start.age)

  function birthday(): Birthday | null {
    switch (birthdayMode) {
      case 'none':
        return null
      case 'date':
        return date || null
      case 'dayMonth':
        return day ? `--${month.padStart(2, '0')}-${day.padStart(2, '0')}` : null
      case 'age':
        return age ? birthYearFromAge(Number(age), today) : null
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const nextBirthday = birthday()
    onSubmit({
      name: name.trim(),
      nickname: nickname.trim() || null,
      birthday: nextBirthday,
      // Edited via the birthday card; dropped without a birthday.
      birthdayNote: nextBirthday ? (initial?.birthdayNote ?? null) : null,
      reconnectDays,
      impact,
      focus,
      deceased,
      diedOn: deceased ? diedOn || null : null,
    }, photo)
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <PhotoPicker name={name} current={initialPhoto} change={photo} onChange={setPhoto} />

      <Field label="Name">
        {(id) => (
          <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} required autoComplete="off" />
        )}
      </Field>

      <Field label="Nickname" hint="Used instead of the name in texts.">
        {(id) => <TextInput id={id} value={nickname} onChange={(e) => setNickname(e.target.value)} autoComplete="off" />}
      </Field>

      <RatingInput label="Impact" levels={IMPACT_LEVELS} value={impact} onChange={(v) => setImpact(v as Impact)} />

      <ChoiceGroup label="Reconnect" choices={RECONNECT_CHOICES} value={reconnectDays} onChange={setReconnectDays} />

      {/* Focus pauses while deceased, the value stays */}
      {!isSelf && !deceased && (
        <Switch
          label="In focus"
          hint="I want to deliberately strengthen this relationship."
          checked={focus}
          onChange={setFocus}
        />
      )}

      <div className="flex flex-col gap-3">
        <ChoiceGroup label="Birthday" choices={BIRTHDAY_MODES} value={birthdayMode} onChange={setBirthdayMode} />

        {birthdayMode === 'date' && (
          <Field label="Date">
            {(id) => <TextInput id={id} type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />}
          </Field>
        )}

        {birthdayMode === 'dayMonth' && (
          <div className="grid grid-cols-[5rem_1fr] gap-3">
            <Field label="Day">
              {(id) => (
                <TextInput
                  id={id}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={31}
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                />
              )}
            </Field>
            <Field label="Month">
              {(id) => (
                <select id={id} className={inputStyles} value={month} onChange={(e) => setMonth(e.target.value)}>
                  {MONTH_NAMES.map((m, i) => (
                    <option key={m} value={i + 1}>
                      {m}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>
        )}

        {birthdayMode === 'age' && (
          <Field label="Approximate age" hint="Only the birth year is stored, shown as “about N years”.">
            {(id) => (
              <TextInput
                id={id}
                type="number"
                inputMode="numeric"
                min={0}
                max={130}
                value={age}
                onChange={(e) => setAge(e.target.value)}
              />
            )}
          </Field>
        )}

        {!isSelf && !deceased && (
          <TextButton className="-mt-3 -ml-2 self-start" onClick={() => setDeceased(true)}>
            Has this person died?
          </TextButton>
        )}
      </div>

      {!isSelf && deceased && (
        <Field label="Date of death" hint="Optional. Reconnect and focus pause, birthdays become remembrance days.">
          {(id) => (
            <div className="flex items-center gap-2">
              <TextInput
                id={id}
                type="date"
                // Only right after “Has this person died?”, not when editing someone already deceased
                autoFocus={!initial?.deceased}
                min={earliestDeath(birthday())}
                max={today}
                value={diedOn}
                onChange={(e) => setDiedOn(e.target.value)}
              />
              <IconButton icon={X} aria-label="Not deceased" onClick={() => setDeceased(false)} />
            </div>
          )}
        </Field>
      )}

      {error && (
        <p role="alert" className="rounded-tile bg-danger-soft px-4 py-3 text-md text-danger">
          {error}
        </p>
      )}

      <Button type="submit" disabled={submitting || !name.trim()}>
        {submitLabel}
      </Button>
    </form>
  )
}

interface PhotoPickerProps {
  name: string
  current: PhotoUrls | null
  change: PhotoChange
  onChange: (change: PhotoChange) => void
}

/** Optional profile photo, scaled down in the browser before the upload. */
function PhotoPicker({ name, current, change, onChange }: PhotoPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const preview = useObjectUrl(change instanceof Blob ? change : null)
  const shown = preview ? { thumb: preview, large: preview } : change === 'remove' ? null : current

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Reset so choosing the same file again fires `change` again.
    event.target.value = ''
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      onChange(await resizePhoto(file))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read this image.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4">
        <Avatar name={name.trim() || '?'} photo={shown} />
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => inputRef.current?.click()}>
            {shown ? 'Change photo' : 'Add photo'}
          </Button>
          {shown && (
            <Button variant="ghost" onClick={() => onChange(current ? 'remove' : 'keep')}>
              Remove
            </Button>
          )}
        </div>
        <input ref={inputRef} type="file" accept="image/*" hidden onChange={choose} />
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

/** A temporary URL for showing a blob in `<img>`, released again when it changes or on unmount. */
function useObjectUrl(blob: Blob | null): string | null {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob])
  useEffect(() => {
    if (url) return () => URL.revokeObjectURL(url)
  }, [url])
  return url
}

/** Earliest date of death the birthday allows: the day itself, or January 1 of a birth year. */
function earliestDeath(birthday: Birthday | null): IsoDate | undefined {
  const parsed = birthday ? parseBirthday(birthday) : null
  if (!parsed || parsed.year === null) return undefined
  return parsed.kind === 'year' ? `${parsed.year}-01-01` : (birthday ?? undefined)
}

/** Splits a stored birthday into the form fields. */
function birthdayFields(birthday: Birthday | null, today: IsoDate) {
  const fields = { mode: 'none' as BirthdayMode, date: '', day: '', month: '1', age: '' }
  const parsed = birthday ? parseBirthday(birthday) : null
  if (!birthday || !parsed) return fields
  if (parsed.kind === 'year') return { ...fields, mode: 'age' as const, age: String(ageOf(birthday, today)?.years ?? '') }
  if (parsed.year !== null) return { ...fields, mode: 'date' as const, date: birthday }
  return { ...fields, mode: 'dayMonth' as const, day: String(parsed.day), month: String(parsed.month) }
}
