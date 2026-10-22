import { type FormEvent, type ReactNode, useState } from 'react'
import { Button, ChoiceGroup, ConfirmDelete, Field, TextInput } from '../../components/ui'
import type { Group, GroupInput, Id } from '../../domain/model'

interface Props {
  /** Existing group when editing, otherwise an empty form. */
  initial?: GroupInput
  /** Main groups it can be placed in; empty = it has subgroups and stays a main group. */
  parents: Group[]
  hasSubgroups: boolean
  submitLabel: string
  submitting: boolean
  error: string | null
  onSubmit: (input: GroupInput) => void
  /** Only when editing: shows the delete button. */
  onDelete?: () => void
  deleteQuestion?: string
  deleting?: boolean
  /** Only when editing: archive controls, placed before the more drastic delete. */
  archive?: ReactNode
}

/** Create and edit a group: name + main group. */
export function GroupForm({
  initial,
  parents,
  hasSubgroups,
  submitLabel,
  submitting,
  error,
  onSubmit,
  onDelete,
  deleteQuestion,
  deleting = false,
  archive,
}: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [parentId, setParentId] = useState<Id | null>(initial?.parentId ?? null)
  const busy = submitting || deleting

  function submit(event: FormEvent) {
    event.preventDefault()
    onSubmit({ name: name.trim(), parentId })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <Field label="Name">
        {(id) => (
          <TextInput
            id={id}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="off"
            placeholder="e.g. Work"
          />
        )}
      </Field>

      {hasSubgroups ? (
        <p className="text-sm text-muted">Has subgroups, so it stays a main group.</p>
      ) : (
        parents.length > 0 && (
          <ChoiceGroup
            label="Part of"
            value={parentId}
            onChange={setParentId}
            choices={[{ value: null, label: 'None' }, ...parents.map((p) => ({ value: p.id, label: p.name }))]}
          />
        )
      )}

      {error && (
        <p role="alert" className="rounded-tile bg-danger-soft px-4 py-3 text-md text-danger">
          {error}
        </p>
      )}

      <Button type="submit" disabled={busy || !name.trim()}>
        {submitLabel}
      </Button>

      {archive}

      {onDelete && <ConfirmDelete onConfirm={onDelete} disabled={busy} question={deleteQuestion} />}
    </form>
  )
}
