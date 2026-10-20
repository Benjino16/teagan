import { toIsoDate } from './dates'
import type { IsoDate } from './model'

/**
 * The only source of “today” (local time zone).
 * Domain functions always receive “today” as a parameter.
 */
export function getToday(): IsoDate {
  const now = new Date()
  return toIsoDate(now.getFullYear(), now.getMonth() + 1, now.getDate())
}
