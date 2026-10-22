/*
 * Light/dark preference per device. "system" stores nothing and leaves it to
 * `prefers-color-scheme`; "light"/"dark" set `data-theme` on <html>, which
 * pins `color-scheme` (see theme.css). The inline script in index.html applies
 * the stored value before the first paint, so nothing flashes.
 */

import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react'

export type ThemePreference = 'system' | 'light' | 'dark'

export const THEME_CHOICES = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
] as const satisfies readonly { value: ThemePreference; label: string; icon: LucideIcon }[]

/** Also read by the inline script in index.html. */
const STORAGE_KEY = 'teagan.theme'

export function readThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : 'system'
  } catch {
    // Storage blocked (private mode, site data off): fall back to the system
    return 'system'
  }
}

export function saveThemePreference(preference: ThemePreference) {
  try {
    if (preference === 'system') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, preference)
  } catch {
    // Not stored – it still applies until the page is reloaded
  }
  applyThemePreference(preference)
}

export function applyThemePreference(preference: ThemePreference) {
  const root = document.documentElement
  if (preference === 'system') delete root.dataset.theme
  else root.dataset.theme = preference

  // Each theme-color tag carries its scheme's color; pick by switching its media query
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"][data-scheme]')) {
    const scheme = meta.dataset.scheme
    meta.media =
      preference === 'system' ? `(prefers-color-scheme: ${scheme})` : preference === scheme ? 'all' : 'not all'
  }
}
