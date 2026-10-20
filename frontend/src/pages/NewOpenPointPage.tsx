import { useNavigate, useParams } from 'react-router'
import { PageHeader } from '../components/layout/PageHeader'
import { PageError, PageLoading } from '../components/layout/PageStatus'
import { useCreateOpenPoint, usePerson } from '../data/queries'
import { OpenPointForm } from '../features/person/OpenPointForm'

/** Add an open point to a person, without a source. */
export function NewOpenPointPage() {
  const personId = Number(useParams().id)
  const navigate = useNavigate()
  const person = usePerson(personId)
  const createPoint = useCreateOpenPoint(personId)
  const overview = `/people/${personId}`

  if (person.isError) return <PageError message="Couldn't load data." backTo={overview} />
  if (person.data === null) return <PageError message="This person doesn't exist." backTo="/people" />

  return (
    <>
      <PageHeader title="New open point" backTo={overview} />
      {!person.data ? (
        <PageLoading />
      ) : (
        <div className="px-5 pt-6">
          <OpenPointForm
            submitLabel="Add"
            submitting={createPoint.isPending}
            error={createPoint.error?.message ?? null}
            onSubmit={(text) =>
              createPoint.mutate(
                { text, activityId: null },
                { onSuccess: () => navigate(overview, { replace: true }) },
              )
            }
          />
        </div>
      )}
    </>
  )
}
