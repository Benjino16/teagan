import { clsx } from 'clsx'
import type { ReactNode } from 'react'
import { EmptyState, IconBadge, cardStyles, moodStyles } from '../../components/ui'
import type { IconBadgeSize, IconBadgeTone } from '../../components/ui/IconBadge'
import { activityStatus, MOOD_LEVELS } from '../../domain/activities'
import { daysBetween, formatDate, formatDateRange, formatDayMonth, formatRelativeFuture, normalizeEnd, timeOf } from '../../domain/dates'
import type { Activity, Impact, IsoDate, Mood } from '../../domain/model'
import { buildTimeline, type ImpactOf, type Lanes, type SameDay, type TimelineEntry } from '../../domain/timeline'
import { Link } from 'react-router'
import { activityIcon, LocationIcon, ReminderIcon } from '../../icons/activityIcons'

/** Look per impact 2–5, for impact 1 see `CompactItem`. Planned entries override the card. */
interface EntryLook {
  card: string
  bubble: { size: IconBadgeSize; tone: IconBadgeTone }
  title: string
  meta: string
  description: string
}

const plain: EntryLook = {
  card: 'flex flex-col gap-0.5 pt-1 pb-0.5',
  bubble: { size: 32, tone: 'subtle' },
  title: 'text-base leading-snug font-medium',
  meta: 'text-muted',
  description: 'text-ink-2',
}

const looks: Record<Impact, EntryLook> = {
  1: plain,
  2: plain,
  3: {
    card: clsx(cardStyles({ padding: 'sm', radius: 'sm' }), 'flex flex-col gap-1'),
    bubble: { size: 40, tone: 'surface' },
    title: 'text-lg leading-snug font-semibold',
    meta: 'text-muted',
    description: 'text-ink-2',
  },
  4: {
    card: clsx(cardStyles({ variant: 'accent' }), 'flex flex-col gap-1.5'),
    bubble: { size: 44, tone: 'accent-soft' },
    title: 'font-display text-xl leading-tight font-bold',
    meta: 'text-muted',
    description: 'text-ink-2',
  },
  5: {
    card: clsx(cardStyles({ variant: 'filled', padding: 'lg' }), 'flex flex-col gap-1.5'),
    bubble: { size: 44, tone: 'accent' },
    title: 'font-display text-2xl leading-tight font-bold',
    meta: 'text-on-accent-muted',
    description: 'text-on-accent-2',
  },
}

/** Title link whose click area covers the whole card (cards themselves contain further links). */
const stretchedLink =
  "text-inherit no-underline after:absolute after:inset-0 after:rounded-card-sm after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-accent"

const plannedCard = clsx(cardStyles({ variant: 'dashed', padding: 'sm', radius: 'sm' }), 'flex flex-col gap-1')

/** Mood as a ring in its color around the icon; the offset hides the rail behind it. */
function moodRing(mood: Mood | null, offset = true): string | undefined {
  if (mood === null) return undefined
  return clsx('ring-2', moodStyles[mood].ring, offset && 'ring-offset-2 ring-offset-canvas')
}

/** The ring is decorative, so screen readers get the mood with the date. */
function MoodText({ mood }: { mood: Mood | null }) {
  return mood !== null ? <span className="sr-only"> · Mood: {MOOD_LEVELS[mood].label}</span> : null
}

/** What an entry shows besides the activity itself. */
export interface EntryDetails {
  /** Who else was there, without “with” (see `participantsText`). */
  others: string | null
  /** A note for the person or group whose timeline this is. */
  note: string | null
}

interface Props {
  activities: Activity[]
  impactOf: ImpactOf
  /** Mood per person or group, `null` = none. */
  moodOf: (activity: Activity) => Mood | null
  details: (activity: Activity) => EntryDetails
  today: IsoDate
}

/** A person's or a group's timeline, for remembering what happened. */
export function ActivityTimeline({ activities, impactOf, moodOf, details, today }: Props) {
  const { rows } = buildTimeline(activities, impactOf)

  if (rows.length === 0) return <EmptyState>No entries yet.</EmptyState>

  return (
    <ol aria-label="Timeline">
      {rows.map((row) => {
        if (row.kind === 'year') {
          return (
            <li key={`year-${row.year}`} className="flex items-stretch">
              <LaneColumns lanes={row.lanes} />
              <h3 className="pt-3.5 pb-2.5 font-display text-base font-bold tracking-wide text-muted">{row.year}</h3>
            </li>
          )
        }
        if (row.kind === 'end') {
          return (
            <EndItem key={`end-${row.activity.id}`} activity={row.activity} impact={row.impact} lanes={row.lanes} today={today} />
          )
        }
        if (row.entry.impact === 1 && activityStatus(row.entry.activity, today) !== 'planned') {
          return (
            <CompactItem
              key={row.entry.activity.id}
              activity={row.entry.activity}
              mood={moodOf(row.entry.activity)}
              lanes={row.lanes}
              sameDay={row.sameDay}
            />
          )
        }
        return (
          <TimelineItem
            key={row.entry.activity.id}
            entry={row.entry}
            moodOf={moodOf}
            lanes={row.lanes}
            sameDay={row.sameDay}
            details={details(row.entry.activity)}
            today={today}
          />
        )
      })}
    </ol>
  )
}

/** Column with the icon circle and the continuous timeline rail; darker towards the next event of the same day. */
function Rail({ children, sameDay = false }: { children: ReactNode; sameDay?: boolean }) {
  return (
    <div className="flex w-11 flex-none flex-col items-center">
      {children}
      <span aria-hidden="true" className={clsx('min-h-3 w-0.5 flex-auto', sameDay ? 'bg-control' : 'bg-rail')} />
    </div>
  )
}

/** Below another event of the same day only the time is shown. */
function entryDate(activity: Activity, sameDay: SameDay): string {
  if (sameDay.above) return timeOf(activity.startDate) ?? 'Same day'
  return formatDateRange(activity.startDate, activity.endDate)
}

/** Tighter gap towards the next event of the same day. */
function entryGap(sameDay: SameDay): string {
  return sameDay.below ? 'pb-1.5' : 'pb-3.5'
}

const LANE_WIDTH = 12
const RAIL_WIDTH = 44

/**
 * Additional lanes of long ranges to the left of the timeline.
 * `anchor` = height of the icon center where a lane starts or ends.
 */
function LaneColumns({ lanes, anchor = 0, bubble = 0 }: { lanes: Lanes; anchor?: number; bubble?: number }) {
  if (lanes.length === 0) return null
  return (
    <div aria-hidden="true" className="flex flex-none">
      {lanes.map((segment, index) => {
        if (!segment) return <span key={index} className="flex-none" style={{ width: LANE_WIDTH }} />
        const color = segment.impact >= 4 ? 'bg-accent' : 'bg-control'
        // Stub from the lane to the icon circle
        const stub = (lanes.length - 1 - index) * LANE_WIDTH + LANE_WIDTH / 2 + (RAIL_WIDTH - bubble) / 2
        return (
          <span key={index} className="relative flex-none" style={{ width: LANE_WIDTH }}>
            <span
              className={clsx('absolute left-1/2 w-0.5 -translate-x-1/2', color)}
              style={
                segment.part === 'middle'
                  ? { top: 0, bottom: 0 }
                  : segment.part === 'top'
                    ? { top: anchor - 1, bottom: 0 }
                    : { top: 0, height: anchor + 1 }
              }
            />
            {segment.part !== 'middle' && (
              <span
                className={clsx('absolute left-1/2 h-0.5 -translate-x-px', color)}
                style={{ top: anchor - 1, width: stub }}
              />
            )}
          </span>
        )
      })}
    </div>
  )
}

/** Small card at the end of a long range with a lane. */
function EndItem({ activity, impact, lanes, today }: { activity: Activity; impact: Impact; lanes: Lanes; today: IsoDate }) {
  const end = normalizeEnd(activity.endDate!)
  const remaining = daysBetween(today, end)
  const label = formatDate(activity.endDate!) + (remaining >= 0 ? ` · ends ${formatRelativeFuture(remaining)}` : '')
  const emphasis = impact >= 4

  return (
    <li className="flex items-stretch">
      <LaneColumns lanes={lanes} anchor={14} bubble={28} />
      <div className="flex min-w-0 flex-auto gap-3">
        <Rail>
          <IconBadge icon={activityIcon(activity.icon).Icon} size={28} shape="circle" tone={emphasis ? 'accent-soft' : 'neutral'} />
        </Rail>
        <div className="min-w-0 flex-auto pb-3.5">
          <article
            className={clsx(
              cardStyles({ variant: emphasis ? 'accent' : 'default', padding: 'none', radius: 'sm' }),
              'relative flex flex-col px-3.5 py-2',
            )}
          >
            <p className={clsx('text-xs font-medium', remaining >= 0 ? 'text-accent-ink' : 'text-muted')}>{label}</p>
            <h4 className="text-md font-semibold">
              <Link to={`/activities/${activity.id}`} className={stretchedLink}>
                End: {activity.name}
              </Link>
            </h4>
          </article>
        </div>
      </div>
    </li>
  )
}

/** Side note (impact 1): one line with title and date, without description. */
function CompactItem({
  activity,
  mood,
  lanes,
  sameDay,
}: {
  activity: Activity
  mood: Mood | null
  lanes: Lanes
  sameDay: SameDay
}) {
  return (
    <li className="flex items-stretch">
      <LaneColumns lanes={lanes} anchor={14} bubble={28} />
      <div className="flex min-w-0 flex-auto gap-3">
        <Rail sameDay={sameDay.below}>
          <IconBadge
            icon={activityIcon(activity.icon).Icon}
            size={28}
            shape="circle"
            tone="subtle"
            className={moodRing(mood)}
          />
        </Rail>
        <div
          className={clsx(
            'relative flex min-h-7 min-w-0 flex-auto items-center justify-between gap-2 self-start',
            entryGap(sameDay),
          )}
        >
          <h4 className="min-w-0 truncate text-md font-medium text-ink-2">
            <Link to={`/activities/${activity.id}`} className={stretchedLink}>
              {activity.name}
            </Link>
          </h4>
          <span className="text-xs whitespace-nowrap text-muted">
            {entryDate(activity, sameDay)}
            <MoodText mood={mood} />
          </span>
        </div>
      </div>
    </li>
  )
}

function TimelineItem({
  entry,
  moodOf,
  lanes,
  sameDay,
  details,
  today,
}: {
  entry: TimelineEntry
  moodOf: (activity: Activity) => Mood | null
  lanes: Lanes
  sameDay: SameDay
  details: EntryDetails
  today: IsoDate
}) {
  const { activity, impact, during } = entry
  const { others, note } = details
  const status = activityStatus(activity, today)
  const planned = status === 'planned'
  const look = looks[impact]
  const inverted = impact === 5 && !planned
  const date =
    entryDate(activity, sameDay) +
    (status === 'planned' ? ' · planned' : status === 'ongoing' ? ' · ongoing' : '')
  const metaColor = planned ? 'text-accent-ink' : look.meta
  const mood = moodOf(activity)

  return (
    <li className="flex items-stretch">
      <LaneColumns lanes={lanes} anchor={look.bubble.size / 2} bubble={look.bubble.size} />
      <div className="flex min-w-0 flex-auto gap-3">
        <Rail sameDay={sameDay.below}>
          <IconBadge
            icon={activityIcon(activity.icon).Icon}
            shape="circle"
            iconSize={18}
            {...look.bubble}
            className={moodRing(mood)}
          />
        </Rail>

        <div className={clsx('min-w-0 flex-auto', entryGap(sameDay))}>
          <article className={clsx('relative', planned ? plannedCard : look.card)}>
            <p className={clsx('text-xs font-medium', metaColor)}>
              {date}
              <MoodText mood={mood} />
            </p>
            <h4 className={planned ? looks[3].title : look.title}>
              <Link to={`/activities/${activity.id}`} className={stretchedLink}>
                {activity.name}
              </Link>
            </h4>
            {(impact >= 2 || planned) && activity.location && (
              // From impact 2 on, and always when planned – where to meet matters then
              <p className={clsx('flex items-center gap-1 text-xs', metaColor)}>
                <LocationIcon aria-hidden="true" size={12} className="shrink-0" />
                <span className="min-w-0 truncate">{activity.location}</span>
              </p>
            )}
            {activity.description && (
              <p className={clsx('text-md leading-normal', planned ? 'text-ink-2' : look.description)}>
                {activity.description}
              </p>
            )}
            {note && (
              // Only for this person or group
              <p
                className={clsx(
                  'border-l-2 pl-2.5 text-md leading-normal whitespace-pre-line wrap-anywhere',
                  inverted ? 'border-on-accent-muted text-on-accent-2' : 'border-accent text-ink-2',
                )}
              >
                {note}
              </p>
            )}
            {others && <p className={clsx('text-xs', metaColor)}>with {others}</p>}
            {planned && activity.reminder && (
              <p className="flex items-center gap-1.5 text-xs font-medium text-accent-ink">
                <ReminderIcon aria-hidden="true" size={14} />
                Reminder on the day
              </p>
            )}
            {during.length > 0 && <During activities={during} moodOf={moodOf} inverted={inverted} />}
          </article>
        </div>
      </div>
    </li>
  )
}

/** Nested events within a range. */
function During({
  activities,
  moodOf,
  inverted,
}: {
  activities: Activity[]
  moodOf: (activity: Activity) => Mood | null
  inverted: boolean
}) {
  return (
    <div className={clsx('mt-2 flex flex-col gap-1 border-t pt-2.5', inverted ? 'border-on-accent-muted' : 'border-line')}>
      <p
        className={clsx(
          'text-2xs font-semibold tracking-wider uppercase',
          inverted ? 'text-on-accent-muted' : 'text-muted',
        )}
      >
        Meanwhile
      </p>
      <ul>
        {activities.map((activity) => {
          const mood = moodOf(activity)
          return (
          <li key={activity.id}>
            <Link
              to={`/activities/${activity.id}`}
              className="relative z-10 flex items-start gap-2.5 rounded-tile-sm py-1.5 text-inherit no-underline focus-visible:outline-2 focus-visible:outline-accent"
            >
              {/* No offset: on a card it would show the canvas color */}
              <IconBadge
                icon={activityIcon(activity.icon).Icon}
                size={28}
                shape="circle"
                tone="neutral"
                className={moodRing(mood, false)}
              />
              <div className="flex min-w-0 flex-auto flex-col gap-0.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-md font-semibold">{activity.name}</span>
                  <span className={clsx('text-xs whitespace-nowrap', inverted ? 'text-on-accent-muted' : 'text-muted')}>
                    {formatDayMonth(activity.startDate)}
                    <MoodText mood={mood} />
                  </span>
                </div>
                {activity.description && (
                  <p className={clsx('text-sm leading-snug', inverted ? 'text-on-accent-2' : 'text-ink-2')}>
                    {activity.description}
                  </p>
                )}
              </div>
            </Link>
          </li>
          )
        })}
      </ul>
    </div>
  )
}
