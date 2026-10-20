import type { ReactNode } from 'react'

interface Props {
  title: string
  /** Small extra on the right, e.g. “3 open”. */
  aside?: ReactNode
  id?: string
}

export function SectionHeader({ title, aside, id }: Props) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 id={id} className="font-display text-xl font-bold">
        {title}
      </h2>
      {aside != null && <span className="text-sm text-muted">{aside}</span>}
    </div>
  )
}
