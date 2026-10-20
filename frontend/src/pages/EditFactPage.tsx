import { useParams } from 'react-router'
import { useBack } from '../app/useBack'
import { PageHeader } from '../components/layout/PageHeader'
import { PageError, PageLoading } from '../components/layout/PageStatus'
import { useDeleteFact, useFactLabels, useFacts, useUpdateFact } from '../data/queries'
import { KnowledgeForm } from '../features/person/KnowledgeForm'

/** Edit or delete a knowledge field. */
export function EditFactPage() {
  const params = useParams()
  const personId = Number(params.id)
  const factId = Number(params.factId)
  const facts = useFacts(personId)
  const labels = useFactLabels()
  const updateFact = useUpdateFact(factId)
  const deleteFact = useDeleteFact(factId)
  const knowledge = `/people/${personId}/knowledge`
  const back = useBack(knowledge)

  const fact = facts.data?.find((f) => f.id === factId)

  if (facts.isError || labels.isError) return <PageError message="Couldn't load data." backTo={knowledge} />
  // Not after deleting: the list refreshes before the form has gone back.
  if (facts.data && !fact && !deleteFact.isSuccess) {
    return <PageError message="This entry doesn't exist." backTo={knowledge} />
  }

  return (
    <>
      <PageHeader title="Edit knowledge" backTo={knowledge} />
      {!fact || !labels.data ? (
        <PageLoading />
      ) : (
        <div className="px-5 pt-6">
          <KnowledgeForm
            initial={fact}
            labels={labels.data}
            taken={facts.data!.filter((f) => f.id !== factId).map((f) => f.label)}
            submitLabel="Save"
            submitting={updateFact.isPending}
            deleting={deleteFact.isPending}
            error={(updateFact.error ?? deleteFact.error)?.message ?? null}
            // Back to the Knowledge tab, without a second history entry
            onSubmit={(values) => updateFact.mutate(values, { onSuccess: back })}
            onDelete={() => deleteFact.mutate(undefined, { onSuccess: back })}
          />
        </div>
      )}
    </>
  )
}
