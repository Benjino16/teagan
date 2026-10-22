import { clsx } from 'clsx'
import { type ComponentProps, type ReactNode, useId } from 'react'
import { inputStyles } from './styles'

interface FieldProps {
  label: string
  hint?: ReactNode
  /** Render prop so the input element gets the right `id`. */
  children: (id: string) => ReactNode
  className?: string
}

/** Label + input + optional hint. */
export function Field({ label, hint, children, className }: FieldProps) {
  const id = useId()
  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-xs font-medium tracking-wide text-muted uppercase">
        {label}
      </label>
      {children(id)}
      {hint != null && <p className="text-sm text-muted">{hint}</p>}
    </div>
  )
}

export function TextInput({ className, ...rest }: ComponentProps<'input'>) {
  return <input className={clsx(inputStyles, className)} {...rest} />
}
