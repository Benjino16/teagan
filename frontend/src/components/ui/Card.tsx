import { clsx } from 'clsx'
import type { ComponentPropsWithoutRef } from 'react'
import { type CardStyleOptions, cardStyles } from './styles'

type CardProps = CardStyleOptions & ComponentPropsWithoutRef<'div'>

export function Card({ variant, padding, radius, className, ...rest }: CardProps) {
  return <div className={clsx(cardStyles({ variant, padding, radius }), className)} {...rest} />
}
