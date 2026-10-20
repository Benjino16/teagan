import { ArchiveButton, ArchivedNotice, TextButton } from '../../components/ui'
import { useSetPersonArchived } from '../../data/queries'
import { formatArchivedSince } from '../../domain/dates'
import type { Person } from '../../domain/model'
import { isArchived } from '../../domain/people'

interface ButtonProps {
  person: Person
  onDone: () => void
}

/** Below the person form: archive or bring back. */
export function PersonArchiveButton({ person, onDone }: ButtonProps) {
  const setArchived = useSetPersonArchived(person.id)
  const archived = isArchived(person)

  return (
    <ArchiveButton
      archived={archived}
      onChange={(value) => setArchived.mutate(value, { onSuccess: onDone })}
      disabled={setArchived.isPending}
      error={setArchived.error?.message}
      hint={
        archived
          ? 'Back in lists and reminders.'
          : 'Hidden from lists and reminders. Everything stays and you can bring them back anytime.'
      }
    />
  )
}

/** On the person page of an archived person, with a quick way back. */
export function PersonArchivedNotice({ person }: { person: Person }) {
  const setArchived = useSetPersonArchived(person.id)
  if (!person.archivedAt) return null

  return (
    <div className="px-5 pt-4.5">
      <ArchivedNotice
        title={formatArchivedSince(person.archivedAt)}
        subtitle={setArchived.error ? setArchived.error.message : 'Reminders and focus are paused.'}
        action={
          <TextButton onClick={() => setArchived.mutate(false)} disabled={setArchived.isPending}>
            Restore
          </TextButton>
        }
      />
    </div>
  )
}
