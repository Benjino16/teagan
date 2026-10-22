import { clsx } from 'clsx'
import { useId, useState } from 'react'
import { BottomSheet } from '../../components/ui'
import { ACTIVITY_ICONS, activityIcon } from '../../icons/activityIcons'

interface Props {
  value: string
  onChange: (key: string) => void
}

/**
 * Icon of an event. Deliberately without names or search:
 * the grid shows the whole catalog, the user decides what an icon stands for.
 * The trigger is a square as tall as a text input, meant to sit beside the title.
 */
export function IconPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const labelId = useId()
  // Unknown keys from older data show the default icon as selected.
  const selected = activityIcon(value)

  return (
    <div className="flex flex-none flex-col gap-1.5">
      <span id={labelId} className="text-xs font-medium tracking-wide text-muted uppercase">
        Icon
      </span>
      <button
        type="button"
        aria-labelledby={labelId}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={clsx(
          'flex size-11 items-center justify-center rounded-tile border border-line bg-accent-soft text-accent-ink',
          'hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        )}
      >
        <selected.Icon aria-hidden="true" size={22} />
      </button>

      {open && (
        <BottomSheet title="Choose icon" onClose={() => setOpen(false)}>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(56px,1fr))] gap-2 py-1">
            {ACTIVITY_ICONS.map(({ key, Icon }, index) => {
              const isSelected = key === selected.key
              return (
                <li key={key} className="flex justify-center">
                  <button
                    type="button"
                    aria-label={`Icon ${index + 1} of ${ACTIVITY_ICONS.length}`}
                    aria-pressed={isSelected}
                    onClick={() => {
                      onChange(key)
                      setOpen(false)
                    }}
                    className={clsx(
                      'flex size-14 items-center justify-center rounded-tile',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                      isSelected ? 'bg-accent-soft text-accent-ink ring-2 ring-accent' : 'bg-subtle text-ink-2 hover:bg-hover',
                    )}
                  >
                    <Icon aria-hidden="true" size={24} />
                  </button>
                </li>
              )
            })}
          </ul>
        </BottomSheet>
      )}
    </div>
  )
}
