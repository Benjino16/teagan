import { clsx } from 'clsx'
import type { PhotoUrls } from '../../domain/model'
import { Avatar } from './Avatar'

interface Props {
  people: { name: string; photo?: PhotoUrls | null }[]
  /** At most this many avatars, the rest as “+N”. */
  max?: number
  className?: string
}

/** Small overlapping avatars. Decorative – a count is always shown next to it. */
export function AvatarStack({ people, max = 4, className }: Props) {
  if (people.length === 0) return null
  const shown = people.slice(0, max)
  const rest = people.length - shown.length

  return (
    <span aria-hidden="true" className={clsx('flex flex-none items-center', className)}>
      {shown.map((person, i) => (
        <Avatar
          key={i}
          name={person.name}
          photo={person.photo}
          size="sm"
          className={clsx('ring-2 ring-surface', i > 0 && '-ml-2')}
        />
      ))}
      {rest > 0 && (
        <span className="-ml-2 flex size-7 flex-none items-center justify-center rounded-full bg-subtle text-2xs font-semibold text-muted ring-2 ring-surface">
          +{rest}
        </span>
      )}
    </span>
  )
}
