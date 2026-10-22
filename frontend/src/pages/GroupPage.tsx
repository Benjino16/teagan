import { ChevronRight, History, Pencil } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { PageHeader } from '../components/layout/PageHeader'
import { PageError, PageLoading } from '../components/layout/PageStatus'
import { PageWithPane, SidePane } from '../components/layout/SidePane'
import { TopBar } from '../components/layout/TopBar'
import { useBreakpoint, useListBeside } from '../components/layout/useBreakpoint'
import { Avatar, EmptyState, IconBadge, IconButton, ListCard, listRowStyles, MediaRow, SectionHeader } from '../components/ui'
import { useActivitiesForGroup } from '../data/queries'
import { archivedWith, findGroupNode, groupMembers, isGroupArchived } from '../domain/groups'
import { GroupArchivedNotice } from '../features/groups/GroupArchive'
import { GroupTimeline } from '../features/groups/GroupTimeline'
import { MembersSheet } from '../features/groups/MembersSheet'
import { SubgroupRows } from '../features/groups/SubgroupRows'
import { peopleCountText, useGroupsData } from '../features/groups/useGroupsData'

/** A group: its timeline, subgroups and members. On wide screens the timeline runs alongside instead of its own page. */
export function GroupPage() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const groupsData = useGroupsData()
  const activities = useActivitiesForGroup(id)
  const [editing, setEditing] = useState(false)
  const wide = useBreakpoint('laptop')
  // Large screens: the list of groups is already beside a top-level group, nothing to go back to
  const listBeside = useListBeside()

  if (groupsData.status !== 'ready') {
    return (
      <>
        <TopBar backTo="/groups" />
        {groupsData.status === 'loading' ? <PageLoading /> : <PageError message="Couldn't load groups." backTo="/groups" />}
      </>
    )
  }

  const { groups, memberships, people, personById, tree } = groupsData.data
  const node = findGroupNode(tree, id)
  if (!node) {
    return (
      <>
        <TopBar backTo="/groups" />
        <PageError message="This group doesn't exist." backTo="/groups" />
      </>
    )
  }

  const { group, children, personIds } = node
  const parent = groups.find((c) => c.id === group.parentId)
  const nameOf = (groupId: number) => groups.find((c) => c.id === groupId)?.name
  const members = groupMembers(id, groups, memberships, people)
  const count = peopleCountText(personIds.length)

  return (
    <PageWithPane
      pane={
        <SidePane title="Timeline" side="end">
          <GroupTimeline groupId={id} groups={groups} personById={personById} />
        </SidePane>
      }
    >
      <PageHeader
        title={group.name}
        backTo={parent ? `/groups/${parent.id}` : listBeside ? undefined : '/groups'}
        subtitle={parent ? `${parent.name} · ${count}` : count}
        trailing={
          <IconButton
            icon={Pencil}
            iconSize={18}
            aria-label="Edit group"
            onClick={() => navigate(`/groups/${id}/edit`)}
          />
        }
      />
      <div className="mx-auto flex max-w-content flex-col gap-6 px-5 pt-5">
        {isGroupArchived(group, groups) && <GroupArchivedNotice group={group} along={archivedWith(group, groups)} />}

        {!wide && (
          <nav aria-label="More about this group">
            <ListCard>
              <li>
                <Link to={`/groups/${id}/timeline`} className={`${listRowStyles} text-ink no-underline hover:bg-hover`}>
                  <MediaRow
                    leading={<IconBadge icon={History} size={36} />}
                    title="Timeline"
                    subtitle={activities.data ? timelineSummary(activities.data.map((a) => a.startDate)) : undefined}
                    trailing={<ChevronRight aria-hidden="true" size={18} className="flex-none text-muted" />}
                  />
                </Link>
              </li>
            </ListCard>
          </nav>
        )}

        {children.length > 0 && (
          <section aria-labelledby="subgroups" className="flex flex-col gap-2.5">
            <SectionHeader id="subgroups" title="Subgroups" />
            <ListCard>
              <SubgroupRows nodes={children} />
            </ListCard>
          </section>
        )}

        <section aria-labelledby="members" className="flex flex-col gap-2.5">
          <SectionHeader
            id="members"
            title="Members"
            aside={
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="-my-3 -mr-2 min-h-11 rounded-tile-sm px-2 text-md font-semibold text-accent-ink hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-accent"
              >
                Edit
              </button>
            }
          />
          {members.length === 0 ? (
            <EmptyState>No one in this group yet.</EmptyState>
          ) : (
            <ListCard>
              {members.map(({ person, subgroupIds }) => {
                const subtitle = subgroupIds.map(nameOf).join(', ')
                return (
                  <li key={person.id}>
                    <Link to={`/people/${person.id}`} className={`${listRowStyles} text-ink no-underline hover:bg-hover`}>
                      <MediaRow
                        leading={<Avatar name={person.name} photo={person.photo} size="md" />}
                        title={person.name}
                        subtitle={subtitle || undefined}
                        trailing={<ChevronRight aria-hidden="true" size={18} className="flex-none text-muted" />}
                      />
                    </Link>
                  </li>
                )
              })}
            </ListCard>
          )}
        </section>
      </div>

      {editing && (
        <MembersSheet
          group={group}
          groups={groups}
          people={people}
          memberships={memberships}
          onClose={() => setEditing(false)}
        />
      )}
    </PageWithPane>
  )
}

/** `3 entries · since 2019` */
function timelineSummary(startDates: string[]): string {
  const first = startDates.reduce<string | null>((min, d) => (min === null || d < min ? d : min), null)
  const count = `${startDates.length} ${startDates.length === 1 ? 'entry' : 'entries'}`
  return count + (first ? ` · since ${first.slice(0, 4)}` : '')
}
