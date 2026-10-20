import type { ReactNode } from 'react'
import { TopBar } from './TopBar'
import { useInView } from './useInView'

interface Props {
  title: string
  /** Shows a back button; target if there is no history. */
  backTo?: string
  subtitle?: ReactNode
  /** Action on the right of the top bar, e.g. edit. */
  trailing?: ReactNode
}

/** Top bar + large heading. The title moves into the top bar once the heading has scrolled away. */
export function PageHeader({ title, backTo, subtitle, trailing }: Props) {
  const [ref, inView] = useInView<HTMLDivElement>()
  return (
    <>
      <TopBar backTo={backTo} title={title} showTitle={!inView} trailing={trailing} />
      <div ref={ref} className="flex flex-col gap-1 px-5 pt-1">
        <h1 className="font-display text-3xl leading-tight font-bold tracking-tight">{title}</h1>
        {subtitle != null && <p className="text-md text-muted">{subtitle}</p>}
      </div>
    </>
  )
}
