import { useNavigate, useParams } from 'react-router'
import { useBack } from '../app/useBack'
import { PageHeader } from '../components/layout/PageHeader'
import { PageError, PageLoading } from '../components/layout/PageStatus'
import { useActivitiesForGroup, useGroups, useDeleteGroup, useUpdateGroup } from '../data/queries'
import { onlyInGroup } from '../domain/activities'
import { archivedWith, parentOptions } from '../domain/groups'
import { pluralize } from '../domain/dates'
import { GroupArchiveButton } from '../features/groups/GroupArchive'
import { GroupForm } from '../features/groups/GroupForm'

/** Rename, move, archive or delete a group. */
export function EditGroupPage() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const groups = useGroups()
  const activities = useActivitiesForGroup(id)
  const updateGroup = useUpdateGroup(id)
  const deleteGroup = useDeleteGroup(id)
  const detail = `/groups/${id}`
  const back = useBack(detail)

  const group = groups.data?.find((c) => c.id === id)

  if (groups.isError) return <PageError message="Couldn't load groups." backTo="/groups" />
  // Not after deleting: the list refreshes before the form has navigated away.
  if (groups.data && !group && !deleteGroup.isSuccess) {
    return <PageError message="This group doesn't exist." backTo="/groups" />
  }

  const subgroups = groups.data?.filter((c) => c.parentId === id).length ?? 0
  const parent = groups.data?.find((c) => c.id === group?.parentId)
  const solo = onlyInGroup(activities.data ?? [], id, groups.data ?? []).length
  // Events with people or another group stay, just without this group
  const soloText = solo > 0 ? ` ${pluralize(solo, 'event')} only in this group ${solo === 1 ? 'goes' : 'go'} too.` : ''
  const deleteQuestion =
    (subgroups > 0
      ? `Delete this group and its ${pluralize(subgroups, 'subgroup')}? People stay.`
      : parent
        ? `Delete this group? People stay in ${parent.name}.`
        : 'Delete this group? People stay.') + soloText

  return (
    <>
      <PageHeader title="Edit group" backTo={detail} />
      {!group ? (
        <PageLoading />
      ) : (
        <div className="px-5 pt-6">
          <GroupForm
            initial={group}
            parents={parentOptions(groups.data!, id)}
            hasSubgroups={subgroups > 0}
            submitLabel="Save"
            submitting={updateGroup.isPending}
            deleting={deleteGroup.isPending}
            error={(updateGroup.error ?? deleteGroup.error)?.message ?? null}
            deleteQuestion={deleteQuestion}
            onSubmit={(input) => updateGroup.mutate(input, { onSuccess: back })}
            onDelete={() =>
              deleteGroup.mutate(undefined, {
                onSuccess: () => navigate(parent ? `/groups/${parent.id}` : '/groups', { replace: true }),
              })
            }
            // Unsaved form changes are dropped – archiving is its own action
            archive={
              <GroupArchiveButton
                group={group}
                hasSubgroups={subgroups > 0}
                along={archivedWith(group, groups.data!)}
                onDone={back}
              />
            }
          />
        </div>
      )}
    </>
  )
}
