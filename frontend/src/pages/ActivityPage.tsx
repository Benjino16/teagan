import { clsx } from 'clsx'
import { ChevronRight, LayoutGrid, Pencil } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router'
import { PageError, PageLoading } from '../components/layout/PageStatus'
import { TopBar } from '../components/layout/TopBar'
import { useInView } from '../components/layout/useInView'
import {
  Avatar,
  Card,
  cardStyles,
  CheckRow,
  IconBadge,
  IconButton,
  ImpactDots,
  ListCard,
  listRowStyles,
  MediaRow,
  SectionHeader,
} from '../components/ui'
import type { IconBadgeTone } from '../components/ui/IconBadge'
import {
  useActivities,
  useActivity,
  useGroups,
  useOpenPointsForActivity,
  usePeople,
  useSetOpenPointDone,
} from '../data/queries'
import { ACTIVITY_IMPACT_LEVELS, activitiesDuring, activityStatus, enclosingActivity, maxImpact } from '../domain/activities'
import {
  daysBetween,
  formatDate,
  formatDateRange,
  formatDateRangeWithYear,
  formatRelativeFuture,
  formatRelativePast,
  formatSince,
  normalizeEnd,
  normalizeStart,
  yearOf,
} from '../domain/dates'
import { groupPath } from '../domain/groups'
import type { Activity, Group, Id, Impact, IsoDate, OpenPoint, Person } from '../domain/model'
import { displayName } from '../domain/people'
import { getToday } from '../domain/today'
import { activityIcon, LocationIcon, ReminderIcon } from '../icons/activityIcons'

const bubbleTone: Record<Impact, IconBadgeTone> = { 1: 'subtle', 2: 'subtle', 3: 'surface', 4: 'accent-soft', 5: 'accent' }

/** Everything about an activity: description, participants, groups, what happened meanwhile. */
export function ActivityPage() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const today = getToday()
  const activity = useActivity(id)
  const all = useActivities()
  const people = usePeople()
  const groups = useGroups()
  const points = useOpenPointsForActivity(id)
  const [titleRef, titleInView] = useInView<HTMLHeadingElement>()

  const trailing = (
    <IconButton icon={Pencil} iconSize={18} aria-label="Edit event" onClick={() => navigate(`/activities/${id}/edit`)} />
  )

  if (activity.isError || all.isError || people.isError || groups.isError || points.isError) {
    return (
      <>
        <TopBar backTo="/" />
        <PageError message="Couldn't load data." />
      </>
    )
  }
  if (activity.isSuccess && activity.data === null) {
    return (
      <>
        <TopBar backTo="/" />
        <PageError message="This activity doesn't exist." />
      </>
    )
  }
  if (!activity.data || !all.data || !people.data || !groups.data || !points.data) {
    return (
      <>
        <TopBar backTo="/" />
        <PageLoading />
      </>
    )
  }

  const a = activity.data
  const personById = new Map(people.data.map((p) => [p.id, p]))
  const during = activitiesDuring(a, all.data)
  const partOf = enclosingActivity(a, all.data)

  return (
    <>
      <TopBar backTo="/" title={a.name} showTitle={!titleInView} trailing={trailing} />
      <ActivityHero activity={a} today={today} titleRef={titleRef} />

      <div className="flex flex-col gap-6 px-5 pt-6">
        {a.description && (
          <Card>
            <p className="text-base leading-relaxed whitespace-pre-line text-ink-2">{a.description}</p>
          </Card>
        )}

        <Participants activity={a} personById={personById} />
        <Groups activity={a} groups={groups.data} />

        {partOf && (
          <section aria-labelledby="part-of" className="flex flex-col gap-2.5">
            <SectionHeader id="part-of" title="Part of" />
            <ActivityLinkCard activity={partOf} />
          </section>
        )}

        {during.length > 0 && (
          <section aria-labelledby="during" className="flex flex-col gap-2.5">
            <SectionHeader id="during" title="Meanwhile" aside={during.length} />
            <ListCard>
              {during.map((d) => (
                <li key={d.id}>
                  <ActivityRow
                    activity={d}
                    withYear={yearOf(a.startDate) !== yearOf(a.endDate ?? a.startDate)}
                    nested={activitiesDuring(d, all.data).length}
                  />
                </li>
              ))}
            </ListCard>
          </section>
        )}

        {points.data.length > 0 && <SourcePoints points={points.data} personById={personById} />}
      </div>
    </>
  )
}

function ActivityHero({
  activity,
  today,
  titleRef,
}: {
  activity: Activity
  today: IsoDate
  titleRef: (node: HTMLHeadingElement | null) => void
}) {
  const status = activityStatus(activity, today)
  const impact = maxImpact(activity)
  const start = normalizeStart(activity.startDate)

  let relative: string
  if (status === 'planned') relative = formatRelativeFuture(daysBetween(today, start))
  else if (status === 'ongoing')
    relative = `ongoing ${formatSince(daysBetween(start, today))}, until ${formatDate(activity.endDate!)}`
  else relative = formatRelativePast(daysBetween(normalizeEnd(activity.endDate ?? activity.startDate), today))

  return (
    <section aria-labelledby="activity-name" className="flex flex-col gap-3 px-5 pt-1">
      <IconBadge icon={activityIcon(activity.icon).Icon} size={44} shape="circle" tone={bubbleTone[impact]} iconSize={20} />
      <div className="flex flex-col gap-1">
        <p className={clsx('text-sm font-medium', status === 'planned' ? 'text-accent' : 'text-muted')}>
          {formatDateRangeWithYear(activity.startDate, activity.endDate)}
          {status === 'planned' && ' · planned'}
          {status === 'ongoing' && ' · ongoing'}
        </p>
        <h1 id="activity-name" ref={titleRef} className="font-display text-3xl leading-[1.1] font-bold tracking-tight">
          {activity.name}
        </h1>
        {impact >= 3 && activity.location && (
          // Only from impact 3 on
          <p className="flex items-center gap-1.5 text-md text-ink-2">
            <LocationIcon aria-hidden="true" size={15} className="shrink-0" />
            <span className="min-w-0 wrap-anywhere">{activity.location}</span>
          </p>
        )}
        <p className="text-md text-muted">{relative}</p>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <ImpactDots value={activity.impact} />
        {activity.reminder && status === 'planned' && (
          <span className="flex items-center gap-1.5 text-sm font-medium text-accent">
            <ReminderIcon aria-hidden="true" size={14} />
            Reminder on the day
          </span>
        )}
      </div>
    </section>
  )
}

function Participants({ activity, personById }: { activity: Activity; personById: Map<Id, Person> }) {
  // You first, then by closeness and name.
  const participants = activity.participants
    .map((p) => ({ ...p, person: personById.get(p.personId) }))
    .filter((p): p is typeof p & { person: Person } => p.person !== undefined)
    .sort(
      (a, b) =>
        Number(b.person.isSelf) - Number(a.person.isSelf) ||
        b.person.impact - a.person.impact ||
        a.person.name.localeCompare(b.person.name),
    )

  if (participants.length === 0) return null

  return (
    <section aria-labelledby="participants" className="flex flex-col gap-2.5">
      <SectionHeader id="participants" title="Participants" aside={participants.length} />
      <ListCard>
        {participants.map(({ person, impact, note }) => {
          const forName = person.isSelf ? 'you' : displayName(person)
          const row = (
            <MediaRow
              leading={<Avatar name={person.isSelf ? 'You' : person.name} photo={person.photo} size="md" />}
              title={person.isSelf ? 'You' : person.name}
              subtitle={
                impact !== null ? (
                  <ImpactDots
                    value={impact}
                    label={`Impact for ${forName}: ${ACTIVITY_IMPACT_LEVELS[impact].label}`}
                    className="py-1"
                  />
                ) : null
              }
              trailing={
                !person.isSelf && <ChevronRight aria-hidden="true" size={18} className="flex-none text-muted" />
              }
            >
              {/* Note for this person only */}
              {note !== null && <span className="text-sm whitespace-pre-line text-muted wrap-anywhere">{note}</span>}
            </MediaRow>
          )
          return (
            <li key={person.id}>
              {person.isSelf ? (
                <div className={listRowStyles}>{row}</div>
              ) : (
                <Link to={`/people/${person.id}`} className={`${listRowStyles} text-ink no-underline hover:bg-canvas`}>
                  {row}
                </Link>
              )}
            </li>
          )
        })}
      </ListCard>
    </section>
  )
}

function Groups({ activity, groups }: { activity: Activity; groups: Group[] }) {
  const rows = activity.groups
    .filter((link) => groups.some((c) => c.id === link.groupId))
    .map((link) => ({ ...link, name: groupPath(link.groupId, groups) }))
    .sort((a, b) => a.name.localeCompare(b.name))

  if (rows.length === 0) return null

  return (
    <section aria-labelledby="groups" className="flex flex-col gap-2.5">
      <SectionHeader id="groups" title="Groups" aside={rows.length} />
      <ListCard>
        {rows.map(({ groupId, impact, note, name }) => (
          <li key={groupId}>
            <Link to={`/groups/${groupId}`} className={`${listRowStyles} text-ink no-underline hover:bg-canvas`}>
              <MediaRow
                leading={<IconBadge icon={LayoutGrid} size={44} />}
                title={name}
                subtitle={
                  impact !== null ? (
                    <ImpactDots
                      value={impact}
                      label={`Impact for ${name}: ${ACTIVITY_IMPACT_LEVELS[impact].label}`}
                      className="py-1"
                    />
                  ) : null
                }
                trailing={<ChevronRight aria-hidden="true" size={18} className="flex-none text-muted" />}
              >
                {/* Note for this group only */}
                {note !== null && <span className="text-sm whitespace-pre-line text-muted wrap-anywhere">{note}</span>}
              </MediaRow>
            </Link>
          </li>
        ))}
      </ListCard>
    </section>
  )
}

/** Row in lists: icon, title, date – leads to the activity. */
function ActivityRow({ activity, withYear, nested }: { activity: Activity; withYear: boolean; nested: number }) {
  const date = (withYear ? formatDateRangeWithYear : formatDateRange)(activity.startDate, activity.endDate)
  return (
    <Link to={`/activities/${activity.id}`} className={`${listRowStyles} text-ink no-underline hover:bg-canvas`}>
      <MediaRow
        leading={<IconBadge icon={activityIcon(activity.icon).Icon} size={36} shape="circle" tone="canvas" />}
        title={activity.name}
        subtitle={nested > 0 ? `${date} · ${nested} ${nested === 1 ? 'event' : 'events'}` : date}
        trailing={<ChevronRight aria-hidden="true" size={18} className="flex-none text-muted" />}
      />
    </Link>
  )
}

function ActivityLinkCard({ activity }: { activity: Activity }) {
  return (
    <Link
      to={`/activities/${activity.id}`}
      className={clsx(cardStyles({ variant: 'accent', padding: 'sm', radius: 'sm' }), 'block no-underline hover:bg-canvas')}
    >
      <MediaRow
        leading={<IconBadge icon={activityIcon(activity.icon).Icon} size={36} shape="circle" tone="accent-soft" />}
        title={activity.name}
        subtitle={formatDateRangeWithYear(activity.startDate, activity.endDate)}
        trailing={<ChevronRight aria-hidden="true" size={18} className="flex-none text-muted" />}
      />
    </Link>
  )
}

function SourcePoints({ points, personById }: { points: OpenPoint[]; personById: Map<Id, Person> }) {
  return (
    <section aria-labelledby="source-points" className="flex flex-col gap-2.5">
      <SectionHeader id="source-points" title="Open points from this" />
      <ListCard>
        {points.map((point) => (
          <li key={point.id}>
            <SourcePoint point={point} person={personById.get(point.personId)} />
          </li>
        ))}
      </ListCard>
    </section>
  )
}

function SourcePoint({ point, person }: { point: OpenPoint; person: Person | undefined }) {
  const setDone = useSetOpenPointDone(point.personId)
  return (
    <CheckRow
      checked={point.doneAt !== null}
      onToggle={() => setDone.mutate({ id: point.id, done: point.doneAt === null })}
      label={point.text}
      meta={person ? `for ${displayName(person)}` : undefined}
      editTo={`/people/${point.personId}/open-points/${point.id}/edit`}
    />
  )
}
