import { useNavigate, useSearchParams } from 'react-router'
import { PageHeader } from '../components/layout/PageHeader'
import { PageError, PageLoading } from '../components/layout/PageStatus'
import { useGroups, useCreateGroup } from '../data/queries'
import { parentOptions } from '../domain/groups'
import { GroupForm } from '../features/groups/GroupForm'

/** Create a group, optionally inside a main group. */
export function NewGroupPage() {
  const navigate = useNavigate()
  const parentParam = Number(useSearchParams()[0].get('parent'))
  const groups = useGroups()
  const createGroup = useCreateGroup()

  if (groups.isError) return <PageError message="Couldn't load groups." backTo="/groups" />

  // From a subgroup, the new group goes next to it, into the same main group.
  const from = groups.data?.find((c) => c.id === parentParam)
  const parentId = from ? (from.parentId ?? from.id) : null
  const backTo = from ? `/groups/${from.id}` : '/groups'

  return (
    <>
      <PageHeader title="New group" backTo={backTo} />
      {!groups.data ? (
        <PageLoading />
      ) : (
        <div className="px-5 pt-6">
          <GroupForm
            initial={{ name: '', parentId }}
            parents={parentOptions(groups.data)}
            hasSubgroups={false}
            submitLabel="Create"
            submitting={createGroup.isPending}
            error={createGroup.error?.message ?? null}
            onSubmit={(input) =>
              createGroup.mutate(input, {
                onSuccess: (created) => navigate(`/groups/${created.id}`, { replace: true }),
              })
            }
          />
        </div>
      )}
    </>
  )
}
