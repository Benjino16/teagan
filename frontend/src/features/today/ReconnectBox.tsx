import { clsx } from 'clsx'
import { RefreshCw } from 'lucide-react'
import { Link } from 'react-router'
import { Avatar, cardStyles, IconBadge, listRowStyles, MediaRow, ProgressBar, ShowMore, usePreview } from '../../components/ui'
import { type DueReconnect, reconnectRowText } from '../../domain/contact'
import { formatRelativeFuture } from '../../domain/dates'
import { TODAY_PREVIEW } from './preview'

interface Props {
  reconnects: DueReconnect[]
}

/** Overdue and soon-due reconnects on “Today”. */
export function ReconnectBox({ reconnects }: Props) {
  const preview = usePreview(reconnects, TODAY_PREVIEW)
  if (reconnects.length === 0) return null

  return (
    <section
      aria-labelledby="today-reconnect"
      className={clsx(cardStyles({ padding: 'none' }), 'overflow-hidden')}
    >
      <div className="flex items-center gap-3 px-4 pt-3.5 pb-1.5">
        <IconBadge icon={RefreshCw} size={32} />
        <h2 id="today-reconnect" className="font-display text-lg font-bold">
          Reconnect
        </h2>
      </div>
      <ul className="divide-y divide-divider">
        {preview.shown.map(({ person, status, daysSince }) => (
          <li key={person.id}>
            <Link to={`/people/${person.id}`} className={clsx(listRowStyles, 'text-ink no-underline hover:bg-hover')}>
              <MediaRow
                leading={<Avatar name={person.name} photo={person.photo} size="md" />}
                title={person.name}
                subtitle={reconnectRowText(person.reconnectDays!, daysSince)}
                trailing={
                  status.overdue ? (
                    <span className="flex-none rounded-full bg-danger-soft px-2.5 py-1 text-sm font-semibold text-danger">
                      overdue
                    </span>
                  ) : (
                    <span className="flex-none text-sm text-muted">{formatRelativeFuture(status.remaining!)}</span>
                  )
                }
              >
                <ProgressBar value={status.progress} tone={status.overdue ? 'alert' : 'accent'} className="mt-1.5" />
              </MediaRow>
            </Link>
          </li>
        ))}
      </ul>
      {preview.hidden > 0 && (
        <div className="border-t border-divider px-4">
          <ShowMore hidden={preview.hidden} expanded={preview.expanded} onToggle={preview.toggle} />
        </div>
      )}
    </section>
  )
}
