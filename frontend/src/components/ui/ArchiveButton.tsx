import { Archive, ArchiveRestore } from 'lucide-react'
import { Button } from './Button'

interface Props {
  archived: boolean
  onChange: (archived: boolean) => void
  disabled?: boolean
  /** What archiving or restoring does, shown below the button. */
  hint: string
  error?: string | null
}

/** Archive or restore below an edit form. Reversible, so no confirmation. */
export function ArchiveButton({ archived, onChange, disabled = false, hint, error }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <Button variant="secondary" onClick={() => onChange(!archived)} disabled={disabled}>
        {archived ? <ArchiveRestore aria-hidden="true" size={18} /> : <Archive aria-hidden="true" size={18} />}
        {archived ? 'Restore from archive' : 'Archive'}
      </Button>
      <p className="text-center text-sm text-muted">{hint}</p>
      {error && (
        <p role="alert" className="text-center text-sm text-alert-text">
          {error}
        </p>
      )}
    </div>
  )
}
