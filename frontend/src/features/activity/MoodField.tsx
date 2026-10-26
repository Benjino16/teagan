import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import { Button, IconButton, moodStyles, RatingInput } from '../../components/ui'
import { MOOD_LEVELS } from '../../domain/activities'
import type { Mood } from '../../domain/model'

const MOOD_LEVEL_LIST = Object.values(MOOD_LEVELS)

interface Props {
  /** “Mood” / “Mood for Lena” */
  label: string
  /** “Add mood” – the link while there is none. */
  addLabel: string
  removeLabel: string
  value: Mood | null
  onChange: (value: Mood | null) => void
  /** Below the link, e.g. which mood applies without an own one. */
  hint?: string
}

/** Optional mood: only a link until wanted, the dots fill in its color, removable again. */
export function MoodField({ label, addLabel, removeLabel, value, onChange, hint }: Props) {
  // Open without a value = just added, nothing chosen yet
  const [open, setOpen] = useState(false)

  if (value === null && !open) {
    return (
      <div className="flex flex-col items-start">
        <Button variant="ghost" className="px-2" onClick={() => setOpen(true)}>
          <Plus aria-hidden="true" size={18} />
          {addLabel}
        </Button>
        {hint && <p className="px-2 text-sm text-muted">{hint}</p>}
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2">
      <RatingInput
        label={label}
        levels={MOOD_LEVEL_LIST}
        value={value ?? 0}
        onChange={(next) => onChange(next as Mood)}
        fill={value !== null ? moodStyles[value].input : undefined}
        // Only right after the link, not when editing an existing mood
        autoFocus={value === null}
        className="flex-auto"
      />
      <IconButton
        icon={X}
        aria-label={removeLabel}
        onClick={() => {
          onChange(null)
          setOpen(false)
        }}
      />
    </div>
  )
}
