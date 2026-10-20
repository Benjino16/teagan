import type { Fact, FactLabel } from './model'

/** Key under which labels count as the same: case and surrounding spaces are ignored. */
export function labelKey(label: string): string {
  return label.trim().toLocaleLowerCase()
}

/**
 * All labels used across all people, counted.
 * Shown in the most frequent spelling; most used first, ties alphabetical.
 */
export function countFactLabels(facts: readonly Pick<Fact, 'label'>[]): FactLabel[] {
  const groups = new Map<string, Map<string, number>>()
  for (const { label } of facts) {
    const spelling = label.trim()
    if (!spelling) continue
    const spellings = groups.get(labelKey(spelling)) ?? new Map<string, number>()
    spellings.set(spelling, (spellings.get(spelling) ?? 0) + 1)
    groups.set(labelKey(spelling), spellings)
  }
  return [...groups.values()]
    .map((spellings) => {
      const [label] = [...spellings].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]
      return { label, count: [...spellings.values()].reduce((sum, n) => sum + n, 0) }
    })
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

export const LABEL_SUGGESTION_LIMIT = 6

/**
 * Label suggestions for the knowledge form. `labels` must be sorted by usage
 * (as from `countFactLabels`); `taken` are the labels the person already has.
 */
export function suggestLabels(
  labels: readonly FactLabel[],
  query: string,
  taken: readonly string[],
  limit = LABEL_SUGGESTION_LIMIT,
): string[] {
  const q = labelKey(query)
  const takenKeys = new Set(taken.map(labelKey))
  const candidates = labels.filter(({ label }) => !takenKeys.has(labelKey(label)) && labelKey(label) !== q)
  const ranked = q
    ? [
        ...candidates.filter(({ label }) => labelKey(label).startsWith(q)),
        ...candidates.filter(({ label }) => !labelKey(label).startsWith(q) && labelKey(label).includes(q)),
      ]
    : candidates
  return ranked.slice(0, limit).map(({ label }) => label)
}
