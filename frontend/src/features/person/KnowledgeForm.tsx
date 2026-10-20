import { type FormEvent, useId, useRef, useState } from 'react'
import { Button, Chip, ConfirmDelete, Field, inputStyles, TextInput } from '../../components/ui'
import { suggestLabels } from '../../domain/facts'
import type { FactLabel } from '../../domain/model'

export interface KnowledgeValues {
  label: string
  value: string
}

interface Props {
  /** Existing fact when editing, otherwise an empty form. */
  initial?: KnowledgeValues
  /** Labels used across all people, for the suggestions. */
  labels: readonly FactLabel[]
  /** Labels this person already has – not suggested. */
  taken: readonly string[]
  submitLabel: string
  submitting: boolean
  error: string | null
  onSubmit: (values: KnowledgeValues) => void
  /** Only when editing: shows the delete button. */
  onDelete?: () => void
  deleting?: boolean
}

/** Create and edit a knowledge field: label + value. */
export function KnowledgeForm({
  initial,
  labels,
  taken,
  submitLabel,
  submitting,
  error,
  onSubmit,
  onDelete,
  deleting = false,
}: Props) {
  const [label, setLabel] = useState(initial?.label ?? '')
  const [value, setValue] = useState(initial?.value ?? '')
  const valueRef = useRef<HTMLTextAreaElement>(null)
  const suggestionsId = useId()

  const suggestions = suggestLabels(labels, label, taken)
  const busy = submitting || deleting

  function pick(suggestion: string) {
    setLabel(suggestion)
    valueRef.current?.focus()
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    onSubmit({ label: label.trim(), value: value.trim() })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Field label="Label">
          {(id) => (
            <TextInput
              id={id}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
              autoComplete="off"
              placeholder="e.g. Job"
              aria-describedby={suggestions.length > 0 ? suggestionsId : undefined}
            />
          )}
        </Field>
        {suggestions.length > 0 && (
          <div id={suggestionsId} role="group" aria-label="Suggested labels" className="flex flex-wrap gap-x-1.5">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => pick(suggestion)}
                className="flex min-h-11 items-center rounded-full focus-visible:outline-2 focus-visible:outline-accent"
              >
                <Chip>{suggestion}</Chip>
              </button>
            ))}
          </div>
        )}
      </div>

      <Field label="Value">
        {(id) => (
          <textarea
            id={id}
            ref={valueRef}
            rows={3}
            required
            className={`${inputStyles} py-3 leading-normal`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        )}
      </Field>

      {error && (
        <p role="alert" className="rounded-tile bg-alert-bg px-4 py-3 text-md text-alert-text">
          {error}
        </p>
      )}

      <Button type="submit" disabled={busy || !label.trim() || !value.trim()}>
        {submitLabel}
      </Button>

      {onDelete && <ConfirmDelete onConfirm={onDelete} disabled={busy} />}
    </form>
  )
}
