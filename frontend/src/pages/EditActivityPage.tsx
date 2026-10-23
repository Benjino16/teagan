import { useNavigate, useParams } from 'react-router'
import { useBack } from '../app/useBack'
import { PageHeader } from '../components/layout/PageHeader'
import { PageError, PageLoading } from '../components/layout/PageStatus'
import { ConfirmDelete } from '../components/ui'
import {
  useActivity,
  useDeleteActivity,
  useGroups,
  useOpenPointsForActivity,
  usePeople,
  useSelf,
  useUpdateActivity,
} from '../data/queries'
import { pluralize } from '../domain/dates'
import { ActivityForm } from '../features/activity/ActivityForm'

/** Edit or delete an event. */
export function EditActivityPage() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const activity = useActivity(id)
  const self = useSelf()
  const people = usePeople()
  const groups = useGroups()
  const points = useOpenPointsForActivity(id)
  const updateActivity = useUpdateActivity(id)
  const deleteActivity = useDeleteActivity(id)
  const detail = `/activities/${id}`
  const back = useBack(detail)

  if (activity.isError || self.isError || people.isError || groups.isError || points.isError) {
    return <PageError message="Couldn't load data." backTo={detail} />
  }
  // Not after deleting: the event refreshes before the page has navigated away.
  if (activity.data === null && !deleteActivity.isSuccess) {
    return <PageError message="This event doesn't exist." backTo="/" />
  }

  const pointCount = points.data?.length ?? 0
  const deleteQuestion =
    pointCount > 0
      ? `Delete this event for good? Its ${pluralize(pointCount, 'open point')} ${pointCount === 1 ? 'stays' : 'stay'}, just without the event.`
      : 'Delete this event for good?'

  return (
    <>
      <PageHeader title="Edit event" backTo={detail} />
      {!activity.data || !self.data || !people.data || !groups.data || !points.data ? (
        <PageLoading />
      ) : (
        <div className="flex flex-col gap-8 px-5 pt-6">
          <ActivityForm
            initial={activity.data}
            self={self.data}
            people={people.data.filter((p) => !p.isSelf)}
            groups={groups.data}
            initialPoints={points.data}
            submitLabel="Save"
            submitting={updateActivity.isPending || deleteActivity.isPending}
            error={updateActivity.error?.message ?? null}
            onSubmit={(input, drafts) =>
              // Back to the detail page, without a second history entry
              updateActivity.mutate({ activity: input, points: drafts }, { onSuccess: back })
            }
          />
          {/* Unsaved form changes are dropped – deleting is its own action */}
          <div className="flex flex-col gap-2">
            <ConfirmDelete
              onConfirm={() => deleteActivity.mutate(undefined, { onSuccess: () => navigate('/', { replace: true }) })}
              disabled={deleteActivity.isPending}
              question={deleteQuestion}
            />
            {deleteActivity.error && (
              <p role="alert" className="text-center text-sm text-danger">
                {deleteActivity.error.message}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  )
}
