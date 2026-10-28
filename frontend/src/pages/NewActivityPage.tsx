import { useNavigate, useSearchParams } from 'react-router'
import { PageHeader } from '../components/layout/PageHeader'
import { PageError, PageLoading } from '../components/layout/PageStatus'
import { useGroups, useCreateActivity, useMemberships, usePeople, useSelf } from '../data/queries'
import type { ActivityInput } from '../domain/model'
import { getToday } from '../domain/today'
import { ActivityForm } from '../features/activity/ActivityForm'
import { DEFAULT_ACTIVITY_ICON } from '../icons/activityIcons'

/** Create an event, optionally from a person (`?person=<id>`) or a group (`?group=<id>`). */
export function NewActivityPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const self = useSelf()
  const people = usePeople()
  const groups = useGroups()
  const memberships = useMemberships()
  const createActivity = useCreateActivity()

  const personId = Number(params.get('person')) || null
  const groupId = Number(params.get('group')) || null
  const backTo = personId ? `/people/${personId}` : groupId ? `/groups/${groupId}/timeline` : '/'

  if (self.isError || people.isError || groups.isError || memberships.isError) {
    return <PageError message="Couldn't load data." backTo={backTo} />
  }

  return (
    <>
      <PageHeader title="New event" backTo={backTo} />
      {!self.data || !people.data || !groups.data || !memberships.data ? (
        <PageLoading />
      ) : (
        <div className="px-5 pt-6">
          <ActivityForm
            initial={newActivity(
              self.data.id,
              people.data.some((p) => p.id === personId) ? personId : null,
              groups.data.some((c) => c.id === groupId) ? groupId : null,
            )}
            self={self.data}
            people={people.data.filter((p) => !p.isSelf)}
            groups={groups.data}
            memberships={memberships.data}
            submitLabel="Create event"
            submitting={createActivity.isPending}
            error={createActivity.error?.message ?? null}
            onSubmit={(input, points, ledger) =>
              createActivity.mutate({ activity: input, points, ledger }, {
                onSuccess: (activity) => navigate(`/activities/${activity.id}`, { replace: true }),
              })
            }
          />
        </div>
      )}
    </>
  )
}

function newActivity(selfId: number, personId: number | null, groupId: number | null): ActivityInput {
  return {
    name: '',
    icon: DEFAULT_ACTIVITY_ICON,
    startDate: getToday(),
    endDate: null,
    description: null,
    location: null,
    impact: 2,
    reminder: false,
    participants: [
      { personId: selfId, impact: null, note: null },
      ...(personId && personId !== selfId ? [{ personId, impact: null, note: null }] : []),
    ],
    groups: groupId ? [{ groupId: groupId, impact: null, note: null }] : [],
  }
}
