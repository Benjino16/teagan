import { clsx } from 'clsx'
import { CalendarHeart } from 'lucide-react'
import { Link } from 'react-router'
import { cardStyles, IconBadge, listRowStyles, MediaRow, ShowMore, usePreview } from '../../components/ui'
import type { Memory } from '../../domain/activities'
import { pluralize } from '../../domain/dates'
import type { Id } from '../../domain/model'
import { participantsText } from '../../domain/people'
import { activityIcon } from '../../icons/activityIcons'
import { TODAY_PREVIEW } from './preview'

interface Props {
  memories: Memory[]
  selfId: Id
  nameOf: (id: Id) => string
  groupNameOf: (groupId: Id) => string
}

/** “On this day” on Today: what happened on this date in earlier years. */
export function OnThisDayBox({ memories, selfId, nameOf, groupNameOf }: Props) {
  const preview = usePreview(memories, TODAY_PREVIEW)
  if (memories.length === 0) return null

  return (
    <section aria-labelledby="today-on-this-day" className={clsx(cardStyles({ padding: 'none' }), 'overflow-hidden')}>
      <div className="flex items-center gap-3 px-4 pt-3.5 pb-1.5">
        <IconBadge icon={CalendarHeart} size={32} />
        <h2 id="today-on-this-day" className="font-display text-lg font-bold">
          On this day
        </h2>
      </div>
      <ul className="divide-y divide-divider">
        {preview.shown.map(({ activity, yearsAgo }) => {
          // Without other people, the groups say who it was with
          const others =
            participantsText(activity, { selfId, nameOf }) ??
            (activity.groups.map((g) => groupNameOf(g.groupId)).join(', ') || null)
          return (
            <li key={activity.id}>
              <Link
                to={`/activities/${activity.id}`}
                className={clsx(listRowStyles, 'text-ink no-underline hover:bg-hover')}
              >
                <MediaRow
                  leading={<IconBadge icon={activityIcon(activity.icon).Icon} size={36} tone="neutral" />}
                  title={activity.name}
                  subtitle={others ? `with ${others}` : undefined}
                  trailing={<span className="flex-none text-sm text-muted">{pluralize(yearsAgo, 'year')} ago</span>}
                />
              </Link>
            </li>
          )
        })}
      </ul>
      {preview.hidden > 0 && (
        <div className="border-t border-divider px-4">
          <ShowMore hidden={preview.hidden} expanded={preview.expanded} onToggle={preview.toggle} />
        </div>
      )}
    </section>
  )
}
