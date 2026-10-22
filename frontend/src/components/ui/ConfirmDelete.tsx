import { useState } from 'react'
import { Button } from './Button'

interface Props {
  onConfirm: () => void
  /** Disables the buttons, e.g. while saving. */
  disabled?: boolean
  question?: string
}

/** Delete button that asks inline before deleting – there is no undo. */
export function ConfirmDelete({ onConfirm, disabled = false, question = 'Delete this entry?' }: Props) {
  const [confirming, setConfirming] = useState(false)

  if (!confirming) {
    return (
      <Button
        variant="ghost"
        className="text-danger hover:bg-danger-soft"
        onClick={() => setConfirming(true)}
        disabled={disabled}
      >
        Delete
      </Button>
    )
  }

  return (
    <div role="group" aria-label="Confirm delete" className="flex flex-col gap-3">
      <p className="text-center text-md text-muted">{question}</p>
      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={() => setConfirming(false)} disabled={disabled}>
          Cancel
        </Button>
        <Button variant="secondary" className="text-danger" onClick={onConfirm} disabled={disabled} autoFocus>
          Delete
        </Button>
      </div>
    </div>
  )
}
