import { useNavigate, useParams } from 'react-router'
import { useBack } from '../app/useBack'
import { PageHeader } from '../components/layout/PageHeader'
import { PageError, PageLoading } from '../components/layout/PageStatus'
import { ConfirmDelete } from '../components/ui'
import { useActivitiesForPerson, useDeletePerson, usePerson, useUpdatePerson } from '../data/queries'
import { onlyWith } from '../domain/activities'
import { pluralize } from '../domain/dates'
import { getToday } from '../domain/today'
import { PersonArchiveButton } from '../features/person/Archive'
import { PersonForm } from '../features/person/PersonForm'

/** Edit a person – the same minimal form as for creating. */
export function EditPersonPage() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const person = usePerson(id)
  const updatePerson = useUpdatePerson(id)
  const deletePerson = useDeletePerson(id)
  const activities = useActivitiesForPerson(id)
  const detail = `/people/${id}`
  const back = useBack(detail)

  if (person.isError) return <PageError message="Couldn't load data." backTo={detail} />
  // Not after deleting: the person refreshes before the page has navigated away.
  if (person.data === null && !deletePerson.isSuccess) {
    return <PageError message="This person doesn't exist." backTo="/people" />
  }

  const name = person.data?.name
  const solo = onlyWith(activities.data ?? [], id).length
  const soloText = solo > 0 ? [`${pluralize(solo, 'event')} only with them`] : []
  const alsoGoes = ['facts', 'open points', 'photo', ...soloText]
  const deleteQuestion =
    `Delete ${name} for good? Their ${alsoGoes.slice(0, -1).join(', ')} and ${alsoGoes.at(-1)} go too; ` +
    'events with others or a group stay. Archiving keeps everything.'

  return (
    <>
      <PageHeader title="Edit person" backTo={detail} />
      {!person.data ? (
        <PageLoading />
      ) : (
        <div className="flex flex-col gap-8 px-5 pt-6">
          <PersonForm
            initial={person.data}
            initialPhoto={person.data.photo}
            isSelf={person.data.isSelf}
            submitLabel="Save"
            today={getToday()}
            submitting={updatePerson.isPending || deletePerson.isPending}
            error={updatePerson.error?.message ?? null}
            // Back to the person page, without a second history entry
            onSubmit={(input, photo) => updatePerson.mutate({ input, photo }, { onSuccess: back })}
          />
          {/* Unsaved form changes are dropped – archiving and deleting are their own actions */}
          {!person.data.isSelf && (
            <>
              <PersonArchiveButton person={person.data} onDone={back} />
              <div className="flex flex-col gap-2">
                <ConfirmDelete
                  onConfirm={() =>
                    deletePerson.mutate(undefined, { onSuccess: () => navigate('/people', { replace: true }) })
                  }
                  // Wait for the events, so the question names everything that goes
                  disabled={deletePerson.isPending || activities.isPending}
                  question={deleteQuestion}
                />
                {deletePerson.error && (
                  <p role="alert" className="text-center text-sm text-danger">
                    {deletePerson.error.message}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
