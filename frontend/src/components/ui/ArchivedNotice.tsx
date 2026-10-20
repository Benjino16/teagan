import { Archive } from 'lucide-react'
import type { ReactNode } from 'react'
import { IconBadge } from './IconBadge'
import { MediaRow } from './MediaRow'
import { cardStyles } from './styles'

interface Props {
  title: string
  subtitle: ReactNode
  /** E.g. a restore button or a link to what it is archived with. */
  action?: ReactNode
}

/** Card at the top of an archived entry's page. */
export function ArchivedNotice({ title, subtitle, action }: Props) {
  return (
    <section aria-label="Archived" className={cardStyles({ padding: 'sm' })}>
      <MediaRow
        leading={<IconBadge icon={Archive} size={32} tone="subtle" />}
        title={title}
        subtitle={subtitle}
        trailing={action}
      />
    </section>
  )
}
