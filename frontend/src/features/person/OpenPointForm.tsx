import { type FormEvent, useState } from 'react'
import { Button, ConfirmDelete, Field, inputStyles } from '../../components/ui'

interface Props {
  /** Existing text when editing, otherwise an empty form. */
  initialText?: string
  /** Read-only origin, e.g. “from Phone call · Sep 21” (only when editing). */
  source?: string
  submitLabel: string
  submitting: boolean
  error: string | null
  onSubmit: (text: string) => void
  /** Only when editing: shows the delete button. */
  onDelete?: () => void
  deleting?: boolean
}

/** Create and edit an open point. */
export function OpenPointForm({
  initialText = '',
  source,
  submitLabel,
  submitting,
  error,
  onSubmit,
  onDelete,
  deleting = false,
}: Props) {
  const [text, setText] = useState(initialText)
  const busy = submitting || deleting

  function submit(event: FormEvent) {
    event.preventDefault()
    onSubmit(text.trim())
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <Field label="Text" hint={source}>
        {(id) => (
          <textarea
            id={id}
            rows={3}
            required
            placeholder="e.g. Ask how the exam went"
            className={`${inputStyles} py-3 leading-normal`}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        )}
      </Field>

      {error && (
        <p role="alert" className="rounded-tile bg-alert-bg px-4 py-3 text-md text-alert-text">
          {error}
        </p>
      )}

      <Button type="submit" disabled={busy || !text.trim()}>
        {submitLabel}
      </Button>

      {onDelete && <ConfirmDelete onConfirm={onDelete} disabled={busy} />}
    </form>
  )
}
