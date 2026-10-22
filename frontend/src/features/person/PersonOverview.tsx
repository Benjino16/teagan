import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Button, CheckRow, EmptyState, IconBadge, ListCard, MediaRow, SectionHeader, cardStyles } from '../../components/ui'
import { useSetOpenPointDone } from '../../data/queries'
import { contacts } from '../../domain/contact'
import { daysBetween, formatDayMonth, formatRelativePast } from '../../domain/dates'
import { countOpen, OPEN_POINTS_PREVIEW, openPointSource, visibleOpenPoints } from '../../domain/openPoints'
import { participantsText } from '../../domain/people'
import type { Id, OpenPoint, Timestamp } from '../../domain/model'
import { activityIcon } from '../../icons/activityIcons'
import type { PersonViewData } from './usePersonView'

/** Briefing before meeting the person again. */
export function PersonOverview({ data }: { data: PersonViewData }) {
  return (
    <div className="flex flex-col gap-6">
      <OpenPointsSection data={data} />
      <RecentSection data={data} />
    </div>
  )
}

function OpenPointsSection({ data }: { data: PersonViewData }) {
  const { person, openPoints, activities, today } = data
  const setDone = useSetOpenPointDone(person.id)
  const [showAll, setShowAll] = useState(false)
  const settle = useSettling()
  const activityById = new Map(activities.map((a) => [a.id, a]))
  // Sorted with the state from before a recent toggle, so a checked point stays in place briefly.
  const pointById = new Map(openPoints.map((p) => [p.id, p]))
  const visible = visibleOpenPoints(openPoints.map(settle.sortAs), today).map((p) => pointById.get(p.id)!)
  const shown = showAll ? visible : visible.slice(0, OPEN_POINTS_PREVIEW)

  return (
    <section aria-labelledby="open-points" className="flex flex-col gap-2.5">
      <SectionHeader id="open-points" title="Open points" aside={`${countOpen(openPoints)} open`} />
      {visible.length === 0 ? (
        <EmptyState>No open points.</EmptyState>
      ) : (
        <ListCard>
          {shown.map((point) => (
            <li key={point.id}>
              <CheckRow
                checked={point.doneAt !== null}
                onToggle={() => {
                  settle.hold(point)
                  setDone.mutate({ id: point.id, done: point.doneAt === null })
                }}
                label={point.text}
                meta={openPointSource(point, point.activityId === null ? undefined : activityById.get(point.activityId))}
                editTo={`/people/${person.id}/open-points/${point.id}/edit`}
              />
            </li>
          ))}
        </ListCard>
      )}
      {visible.length > OPEN_POINTS_PREVIEW && (
        <Button variant="ghost" aria-expanded={showAll} onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Show less' : `Show all (${visible.length})`}
        </Button>
      )}
    </section>
  )
}

/** How long a toggled point keeps its place before it moves. */
const SETTLE_MS = 1000

/** Remembers the done state of recently toggled points for sorting. */
function useSettling() {
  const [held, setHeld] = useState<ReadonlyMap<Id, Timestamp | null>>(new Map())
  const timers = useRef(new Map<Id, number>())

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach((timer) => window.clearTimeout(timer))
  }, [])

  return {
    /** Toggled again while held: keep the original state, restart the delay. */
    hold(point: OpenPoint) {
      setHeld((current) => new Map(current).set(point.id, current.has(point.id) ? current.get(point.id)! : point.doneAt))
      window.clearTimeout(timers.current.get(point.id))
      timers.current.set(
        point.id,
        window.setTimeout(() => {
          timers.current.delete(point.id)
          setHeld((current) => {
            const next = new Map(current)
            next.delete(point.id)
            return next
          })
        }, SETTLE_MS),
      )
    },
    sortAs: (point: OpenPoint): OpenPoint => (held.has(point.id) ? { ...point, doneAt: held.get(point.id)! } : point),
  }
}

function RecentSection({ data }: { data: PersonViewData }) {
  const { person, self, activities, nameOf, today } = data
  const recent = contacts(activities, person.id, self.id, today).slice(0, 3)

  return (
    <section aria-labelledby="recent" className="flex flex-col gap-2.5">
      <SectionHeader id="recent" title="Recently" />
      {recent.length === 0 ? (
        <EmptyState>No shared experiences yet.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {recent.map((activity) => {
            const others = participantsText(activity, { viewedPersonId: person.id, selfId: self.id, nameOf })
            const meta = [
              formatRelativePast(daysBetween(activity.startDate, today)),
              formatDayMonth(activity.startDate),
              others && `with ${others}`,
            ]
            return (
              <li key={activity.id}>
                <Link
                  to={`/activities/${activity.id}`}
                  className={`${cardStyles({ padding: 'sm', radius: 'sm' })} block no-underline hover:bg-hover`}
                >
                  <MediaRow
                    leading={<IconBadge icon={activityIcon(activity.icon).Icon} size={36} tone="neutral" />}
                    title={activity.name}
                    subtitle={meta.filter(Boolean).join(' · ')}
                  />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
