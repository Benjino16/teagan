import { clsx } from 'clsx'
import { Cake, Pencil } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { BottomSheet, Button, cardStyles, Field, IconBadge, inputStyles, MediaRow } from '../../components/ui'
import { useUpdatePerson } from '../../data/queries'
import type { Person } from '../../domain/model'
import { toPersonInput } from '../../domain/people'

interface Props {
  person: Person
  title: string
  subtitle: string
}

/** Birthday card with note; a tap opens the note editor. */
export function BirthdayCard({ person, title, subtitle }: Props) {
  const [editing, setEditing] = useState(false)
  const note = person.birthdayNote

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setEditing(true)}
        className={clsx(
          cardStyles({ variant: 'warm' }),
          'w-full text-left hover:bg-warm-line/50',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        )}
      >
        <MediaRow
          tone="warm"
          leading={<IconBadge icon={Cake} tone="on-warm" />}
          title={title}
          subtitle={subtitle}
          trailing={
            note ? undefined : (
              <Pencil role="img" aria-label="Add note" size={18} className="flex-none text-warm-icon" />
            )
          }
        >
          {note && <span className="mt-1.5 text-md whitespace-pre-line text-warm-text">{note}</span>}
        </MediaRow>
      </button>

      {editing && <BirthdayNoteSheet person={person} onClose={() => setEditing(false)} />}
    </>
  )
}

function BirthdayNoteSheet({ person, onClose }: { person: Person; onClose: () => void }) {
  const [text, setText] = useState(person.birthdayNote ?? '')
  const updatePerson = useUpdatePerson(person.id)

  function submit(event: FormEvent) {
    event.preventDefault()
    updatePerson.mutate({ input: { ...toPersonInput(person), birthdayNote: text.trim() || null } }, { onSuccess: onClose })
  }

  return (
    <BottomSheet title="Birthday note" size="fit" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4 pt-1 pb-2">
        <Field label="Note" hint="Gift ideas, for example. Leave empty to remove the note.">
          {(id) => (
            <textarea
              id={id}
              rows={4}
              data-autofocus
              className={`${inputStyles} py-3 leading-normal`}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          )}
        </Field>

        {updatePerson.error && (
          <p role="alert" className="rounded-tile bg-alert-bg px-4 py-3 text-md text-alert-text">
            {updatePerson.error.message}
          </p>
        )}

        <Button type="submit" disabled={updatePerson.isPending}>
          Save
        </Button>
      </form>
    </BottomSheet>
  )
}
