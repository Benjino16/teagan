import { useState } from 'react'

/** A list's first `limit` items until expanded, e.g. for a box that shouldn't grow with every entry. */
export function usePreview<T>(items: readonly T[], limit: number) {
  const [expanded, setExpanded] = useState(false)
  return {
    shown: expanded ? items : items.slice(0, limit),
    /** Left out while collapsed – 0 if everything fits. */
    hidden: Math.max(0, items.length - limit),
    expanded,
    toggle: () => setExpanded(!expanded),
  }
}
