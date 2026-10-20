import { dateOfTimestamp, formatDate, formatDateRange } from './dates'
import type { Activity, Id, IsoDate, OpenPoint } from './model'

/** Open ones first, newest first within each group. */
export function sortOpenPoints(points: OpenPoint[]): OpenPoint[] {
  return [...points].sort(
    (a, b) =>
      Number(a.doneAt !== null) - Number(b.doneAt !== null) ||
      b.createdAt.localeCompare(a.createdAt) ||
      b.id - a.id,
  )
}

export function countOpen(points: OpenPoint[]): number {
  return points.filter((p) => p.doneAt === null).length
}

/** Origin: `from Phone call · Sep 21` or `noted on Oct 3`. */
export function openPointSource(point: OpenPoint, source: Activity | undefined): string {
  if (source) return `from ${source.name} · ${formatDateRange(source.startDate, source.endDate)}`
  return `noted on ${formatDate(dateOfTimestamp(point.createdAt))}`
}

/** How many points the person page shows before "Show all". */
export const OPEN_POINTS_PREVIEW = 3

/**
 * Points for the person page: open ones, plus done ones only on the day
 * they were checked. Sorted like `sortOpenPoints`.
 */
export function visibleOpenPoints(points: OpenPoint[], today: IsoDate): OpenPoint[] {
  return sortOpenPoints(points.filter((p) => p.doneAt === null || dateOfTimestamp(p.doneAt) >= today))
}

/** A row in the event form: an existing point (`id`) or a new one (`id: null`). */
export interface OpenPointDraft {
  id: Id | null
  personId: Id
  text: string
}

export interface OpenPointChanges {
  create: { personId: Id; text: string }[]
  update: { id: Id; text: string }[]
  remove: Id[]
}

/**
 * What saving the event form changes in its points: new rows are created,
 * changed rows updated, missing ones removed. Empty text drops a new row and
 * deletes an existing point. A point can't move to another person, so a row
 * whose person changed replaces its point with a new one.
 */
export function openPointChanges(existing: OpenPoint[], drafts: OpenPointDraft[]): OpenPointChanges {
  const changes: OpenPointChanges = { create: [], update: [], remove: [] }
  const kept = new Set<Id>()
  for (const draft of drafts) {
    const text = draft.text.trim()
    const point = draft.id === null ? undefined : existing.find((p) => p.id === draft.id)
    if (!point || draft.personId !== point.personId) {
      if (text) changes.create.push({ personId: draft.personId, text })
      continue
    }
    if (!text) continue
    kept.add(point.id)
    if (text !== point.text) changes.update.push({ id: point.id, text })
  }
  changes.remove = existing.filter((p) => !kept.has(p.id)).map((p) => p.id)
  return changes
}
