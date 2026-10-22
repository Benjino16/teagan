import { type FormEvent, useState } from 'react'
import { Button, Field, TextButton, TextInput } from '../../components/ui'
import type { ButtonVariant } from '../../components/ui/styles'

interface Props {
  label: string
  variant?: ButtonVariant
  pending: boolean
  error: string | null
  onConfirm: (password: string) => void
  /** Closing the form, e.g. to clear an old error. */
  onCancel: () => void
}

/** A button that first asks for the password inline, for changes that could lock you out. */
export function PasswordAction({ label, variant, pending, error, onConfirm, onCancel }: Props) {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')

  if (!open) {
    return (
      <Button variant={variant} onClick={() => setOpen(true)}>
        {label}
      </Button>
    )
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    onConfirm(password)
    setPassword('')
  }

  function cancel() {
    setOpen(false)
    setPassword('')
    onCancel()
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-card border border-line bg-surface p-4">
      <Field label="Password">
        {(id) => (
          <TextInput
            id={id}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            autoFocus
          />
        )}
      </Field>
      {error && (
        <p role="alert" className="rounded-tile bg-danger-soft px-4 py-3 text-md text-danger">
          {error}
        </p>
      )}
      <Button type="submit" variant={variant} disabled={pending || !password}>
        {label}
      </Button>
      <TextButton className="self-center" onClick={cancel}>
        Cancel
      </TextButton>
    </form>
  )
}
