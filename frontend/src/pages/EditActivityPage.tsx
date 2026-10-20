import { useParams } from 'react-router'
import { useBack } from '../app/useBack'
import { PageHeader } from '../components/layout/PageHeader'
import { PageError, PageLoading } from '../components/layout/PageStatus'
import { useActivity, useGroups, useOpenPointsForActivity, usePeople, useSelf, useUpdateActivity } from '../data/queries'
import { ActivityForm } from '../features/activity/ActivityForm'

/** Edit an event. */
export function EditActivityPage() {
  const id = Number(useParams().id)
  const activity = useActivity(id)
  const self = useSelf()
  const people = usePeople()
  const groups = useGroups()
  const points = useOpenPointsForActivity(id)
  const updateActivity = useUpdateActivity(id)
  const detail = `/activities/${id}`
  const back = useBack(detail)

  if (activity.isError || self.isError || people.isError || groups.isError || points.isError) {
    return <PageError message="Couldn't load data." backTo={detail} />
  }
  if (activity.data === null) return <PageError message="This event doesn't exist." backTo="/" />

  return (
    <>
      <PageHeader title="Edit event" backTo={detail} />
      {!activity.data || !self.data || !people.data || !groups.data || !points.data ? (
        <PageLoading />
      ) : (
        <div className="px-5 pt-6">
          <ActivityForm
            initial={activity.data}
            self={self.data}
            people={people.data.filter((p) => !p.isSelf)}
            groups={groups.data}
            initialPoints={points.data}
            submitLabel="Save"
            submitting={updateActivity.isPending}
            error={updateActivity.error?.message ?? null}
            onSubmit={(input, drafts) =>
              // Back to the detail page, without a second history entry
              updateActivity.mutate({ activity: input, points: drafts }, { onSuccess: back })
            }
          />
        </div>
      )}
    </>
  )
}
