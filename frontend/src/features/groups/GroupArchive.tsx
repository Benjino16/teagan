import { Link } from 'react-router'
import { ArchiveButton, ArchivedNotice, TextButton } from '../../components/ui'
import { useSetGroupArchived } from '../../data/queries'
import { formatArchivedSince } from '../../domain/dates'
import type { Group } from '../../domain/model'

interface NoticeProps {
  group: Group
  /** The archived main group this subgroup is archived with, if any. */
  along: Group | undefined
}

/** On an archived group's page: restore it, or go to the main group it comes back with. */
export function GroupArchivedNotice({ group, along }: NoticeProps) {
  const setArchived = useSetGroupArchived(group.id)

  if (along) {
    return (
      <ArchivedNotice
        title={`Archived with ${along.name}`}
        subtitle="Comes back when the main group does."
        action={
          <Link
            to={`/groups/${along.id}`}
            className="flex min-h-11 items-center rounded-tile px-2 text-sm font-medium text-accent-ink no-underline hover:bg-accent-soft"
          >
            Open
          </Link>
        }
      />
    )
  }

  return (
    <ArchivedNotice
      title={formatArchivedSince(group.archivedAt!)}
      subtitle={setArchived.error ? setArchived.error.message : 'Hidden from the group list.'}
      action={
        <TextButton onClick={() => setArchived.mutate(false)} disabled={setArchived.isPending}>
          Restore
        </TextButton>
      }
    />
  )
}

interface ButtonProps {
  group: Group
  hasSubgroups: boolean
  /** The archived main group this subgroup is archived with – then only that one can bring it back. */
  along: Group | undefined
  onDone: () => void
}

/** Below the group form: archive or bring back. */
export function GroupArchiveButton({ group, hasSubgroups, along, onDone }: ButtonProps) {
  const setArchived = useSetGroupArchived(group.id)

  if (along) {
    return <p className="text-center text-sm text-muted">Archived with {along.name} – restore it there.</p>
  }

  const archived = group.archivedAt !== null
  return (
    <ArchiveButton
      archived={archived}
      onChange={(value) => setArchived.mutate(value, { onSuccess: onDone })}
      disabled={setArchived.isPending}
      error={setArchived.error?.message}
      hint={
        archived
          ? 'Back in the group list.'
          : `Hidden from the group list${hasSubgroups ? ' together with its subgroups' : ''}. Members stay.`
      }
    />
  )
}
