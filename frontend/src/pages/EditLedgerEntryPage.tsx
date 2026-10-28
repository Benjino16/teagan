import { useParams } from 'react-router'
import { useBack } from '../app/useBack'
import { PageHeader } from '../components/layout/PageHeader'
import { PageError, PageLoading } from '../components/layout/PageStatus'
import { useActivity, useDeleteLedgerEntry, useLedgerEntries, usePerson, useUpdateLedgerEntry } from '../data/queries'
import { formatDateRange } from '../domain/dates'
import { getToday } from '../domain/today'
import { displayName } from '../domain/people'
import { LedgerEntryForm } from '../features/person/LedgerEntryForm'

/** Edit or delete a money entry. */
export function EditLedgerEntryPage() {
  const params = useParams()
  const personId = Number(params.id)
  const entryId = Number(params.entryId)
  const person = usePerson(personId)
  const entries = useLedgerEntries(personId)
  const updateEntry = useUpdateLedgerEntry(entryId)
  const deleteEntry = useDeleteLedgerEntry(entryId)
  const money = `/people/${personId}/money`
  const back = useBack(money)

  const entry = entries.data?.find((e) => e.id === entryId)
  // Without an event: id 0 does not exist and resolves to `null`.
  const source = useActivity(entry?.activityId ?? 0)

  if (person.isError || entries.isError || source.isError) return <PageError message="Couldn't load data." backTo={money} />
  if (person.data === null) return <PageError message="This person doesn't exist." backTo="/people" />
  // Not after deleting: the list refreshes before the form has gone back.
  if (entries.data && !entry && !deleteEntry.isSuccess) {
    return <PageError message="This entry doesn't exist." backTo={money} />
  }

  return (
    <>
      <PageHeader title="Edit money entry" backTo={money} />
      {!person.data || !entry || (entry.activityId !== null && source.data === undefined) ? (
        <PageLoading />
      ) : (
        <div className="px-5 pt-6">
          <LedgerEntryForm
            initial={entry}
            name={displayName(person.data)}
            source={
              source.data ? `from ${source.data.name} · ${formatDateRange(source.data.startDate, source.data.endDate, getToday())}` : undefined
            }
            submitLabel="Save"
            submitting={updateEntry.isPending}
            deleting={deleteEntry.isPending}
            error={(updateEntry.error ?? deleteEntry.error)?.message ?? null}
            // Back to where the entry was tapped, without a second history entry
            onSubmit={(input) => updateEntry.mutate(input, { onSuccess: back })}
            onDelete={() => deleteEntry.mutate(undefined, { onSuccess: back })}
          />
        </div>
      )}
    </>
  )
}
