import { Check } from 'lucide-react'
import { useState } from 'react'
import { readThemePreference, saveThemePreference, THEME_CHOICES } from '../app/theme'
import { PageHeader } from '../components/layout/PageHeader'
import { IconBadge, ListCard, listRowStyles, MediaRow } from '../components/ui'

/** Light, dark or follow the system – per device. */
export function AppearancePage() {
  const [theme, setTheme] = useState(readThemePreference)

  return (
    <>
      <PageHeader title="Appearance" backTo="/settings" />
      <div className="flex flex-col gap-3 px-5 pt-6">
        <ListCard role="radiogroup" aria-label="Theme">
          {THEME_CHOICES.map((choice) => {
            const selected = choice.value === theme
            return (
              <li key={choice.value} role="none">
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    setTheme(choice.value)
                    saveThemePreference(choice.value)
                  }}
                  className={`${listRowStyles} text-ink hover:bg-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent`}
                >
                  <MediaRow
                    leading={<IconBadge icon={choice.icon} size={36} />}
                    title={choice.label}
                    trailing={selected && <Check aria-hidden="true" size={18} className="flex-none text-accent-ink" />}
                  />
                </button>
              </li>
            )
          })}
        </ListCard>
        <p className="px-4 text-sm text-muted">Saved on this device only.</p>
      </div>
    </>
  )
}
