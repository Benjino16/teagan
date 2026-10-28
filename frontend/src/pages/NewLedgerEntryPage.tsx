import { useNavigate, useParams, useSearchParams } from 'react-router'
import { PageHeader } from '../components/layout/PageHeader'
import { PageError, PageLoading } from '../components/layout/PageStatus'
import { useCreateLedgerEntry, usePerson } from '../data/queries'
import { displayName } from '../domain/people'
import { getToday } from '../domain/today'
import { LedgerEntryForm } from '../features/person/LedgerEntryForm'

/** Note money with a person, without an event. `?amount=<cents>&note=…` prefills it, e.g. to settle up. */
export function NewLedgerEntryPage() {
  const personId = Number(useParams().id)
  const [params] = useSearchParams()
  // Only a whole number of cents counts; anything else leaves the field empty
  const amountCents = Number.isSafeInteger(Number(params.get('amount'))) ? Number(params.get('amount')) : 0
  const note = params.get('note')?.trim() || null
  const navigate = useNavigate()
  const person = usePerson(personId)
  const createEntry = useCreateLedgerEntry(personId)
  const money = `/people/${personId}/money`

  if (person.isError) return <PageError message="Couldn't load data." backTo={`/people/${personId}`} />
  if (person.data === null) return <PageError message="This person doesn't exist." backTo="/people" />
  // The person menu offers it everywhere, also on your own page
  if (person.data?.isSelf) return <PageError message="There's no money to note with yourself." backTo={`/people/${personId}`} />

  return (
    <>
      <PageHeader title="New money entry" backTo={money} />
      {!person.data ? (
        <PageLoading />
      ) : (
        <div className="px-5 pt-6">
          <LedgerEntryForm
            initial={{ amountCents, date: getToday(), note, activityId: null }}
            name={displayName(person.data)}
            submitLabel="Add"
            submitting={createEntry.isPending}
            error={createEntry.error?.message ?? null}
            onSubmit={(input) => createEntry.mutate(input, { onSuccess: () => navigate(money, { replace: true }) })}
          />
        </div>
      )}
    </>
  )
}
