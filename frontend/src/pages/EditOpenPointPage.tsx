import { useParams } from 'react-router'
import { useBack } from '../app/useBack'
import { PageHeader } from '../components/layout/PageHeader'
import { PageError, PageLoading } from '../components/layout/PageStatus'
import { useActivity, useDeleteOpenPoint, useOpenPoints, useUpdateOpenPoint } from '../data/queries'
import { openPointSource } from '../domain/openPoints'
import { OpenPointForm } from '../features/person/OpenPointForm'

/** Edit or delete an open point. */
export function EditOpenPointPage() {
  const params = useParams()
  const personId = Number(params.id)
  const pointId = Number(params.pointId)
  const points = useOpenPoints(personId)
  const updatePoint = useUpdateOpenPoint(pointId)
  const deletePoint = useDeleteOpenPoint(pointId)
  const overview = `/people/${personId}`
  const back = useBack(overview)

  const point = points.data?.find((p) => p.id === pointId)
  // Without a source: id 0 does not exist and resolves to `null`.
  const source = useActivity(point?.activityId ?? 0)

  if (points.isError || source.isError) return <PageError message="Couldn't load data." backTo={overview} />
  // Not after deleting: the list refreshes before the form has gone back.
  if (points.data && !point && !deletePoint.isSuccess) {
    return <PageError message="This open point doesn't exist." backTo={overview} />
  }

  return (
    <>
      <PageHeader title="Edit open point" backTo={overview} />
      {!point || (point.activityId !== null && source.data === undefined) ? (
        <PageLoading />
      ) : (
        <div className="px-5 pt-6">
          <OpenPointForm
            initialText={point.text}
            source={openPointSource(point, source.data ?? undefined)}
            submitLabel="Save"
            submitting={updatePoint.isPending}
            deleting={deletePoint.isPending}
            error={(updatePoint.error ?? deletePoint.error)?.message ?? null}
            // Back to where the point was tapped, without a second history entry
            onSubmit={(text) => updatePoint.mutate({ text }, { onSuccess: back })}
            onDelete={() => deletePoint.mutate(undefined, { onSuccess: back })}
          />
        </div>
      )}
    </>
  )
}
