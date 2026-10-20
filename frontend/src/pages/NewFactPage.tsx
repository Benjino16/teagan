import { useNavigate, useParams } from 'react-router'
import { PageHeader } from '../components/layout/PageHeader'
import { PageError, PageLoading } from '../components/layout/PageStatus'
import { useCreateFact, useFactLabels, useFacts, usePerson } from '../data/queries'
import { KnowledgeForm } from '../features/person/KnowledgeForm'

/** Add a knowledge field to a person. */
export function NewFactPage() {
  const personId = Number(useParams().id)
  const navigate = useNavigate()
  const person = usePerson(personId)
  const facts = useFacts(personId)
  const labels = useFactLabels()
  const createFact = useCreateFact(personId)
  const knowledge = `/people/${personId}/knowledge`

  if (person.isError || facts.isError || labels.isError) {
    return <PageError message="Couldn't load data." backTo={`/people/${personId}`} />
  }
  if (person.data === null) return <PageError message="This person doesn't exist." backTo="/people" />

  return (
    <>
      <PageHeader title="New knowledge" backTo={`/people/${personId}`} />
      {!person.data || !facts.data || !labels.data ? (
        <PageLoading />
      ) : (
        <div className="px-5 pt-6">
          <KnowledgeForm
            labels={labels.data}
            taken={facts.data.map((f) => f.label)}
            submitLabel="Add"
            submitting={createFact.isPending}
            error={createFact.error?.message ?? null}
            onSubmit={(values) =>
              // The backend puts new facts at the bottom
              createFact.mutate(values, { onSuccess: () => navigate(knowledge, { replace: true }) })
            }
          />
        </div>
      )}
    </>
  )
}
