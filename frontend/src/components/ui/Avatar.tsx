import { clsx } from 'clsx'
import type { PhotoUrls } from '../../domain/model'
import { initials } from '../../domain/people'

const sizes = {
  lg: 'size-18 text-3xl',
  md: 'size-11 text-lg',
  sm: 'size-7 text-2xs',
}

const tones = {
  accent: 'bg-accent text-on-accent',
  /** On warm background (birthday), matching the birthday card's icon. */
  'on-warm': 'bg-surface text-warm-icon',
}

interface Props {
  name: string
  /** Profile photo; without one the initials are shown. */
  photo?: PhotoUrls | null
  size?: keyof typeof sizes
  tone?: keyof typeof tones
  className?: string
}

/** Photo or initials in a circle. Decorative – the name is always shown next to it. */
export function Avatar({ name, photo, size = 'lg', tone = 'accent', className }: Props) {
  if (photo) {
    return (
      <img
        // 72 px needs the large photo on high-density screens, the small sizes get by with the thumb
        src={size === 'lg' ? photo.large : photo.thumb}
        alt=""
        loading="lazy"
        aria-hidden="true"
        className={clsx('flex-none rounded-full bg-subtle object-cover', sizes[size], className)}
      />
    )
  }

  return (
    <span
      aria-hidden="true"
      className={clsx(
        'flex flex-none items-center justify-center rounded-full font-display font-bold',
        sizes[size],
        tones[tone],
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}
