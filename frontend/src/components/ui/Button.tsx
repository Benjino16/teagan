import type { ComponentPropsWithoutRef } from 'react'
import { type ButtonVariant, buttonStyles } from './styles'

type Props = ComponentPropsWithoutRef<'button'> & { variant?: ButtonVariant }

export function Button({ variant, className, type = 'button', ...rest }: Props) {
  return <button type={type} className={buttonStyles(variant, className)} {...rest} />
}
