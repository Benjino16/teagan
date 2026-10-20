import { describe, expect, it } from 'vitest'
import type { OpenPoint } from './model'
import { openPointChanges, visibleOpenPoints } from './openPoints'

const point = (id: number, patch: Partial<OpenPoint> = {}): OpenPoint => ({
  id,
  personId: 2,
  text: `Point ${id}`,
  activityId: 9,
  doneAt: null,
  createdAt: `2026-10-0${id}T10:00:00Z`,
  updatedAt: `2026-10-0${id}T10:00:00Z`,
  ...patch,
})

describe('visibleOpenPoints', () => {
  it('keeps done points only on the day they were checked', () => {
    const points = [
      point(1, { doneAt: '2026-10-12T23:00:00Z' }),
      point(2, { doneAt: '2026-10-13T08:00:00Z' }),
      point(3),
    ]
    expect(visibleOpenPoints(points, '2026-10-13').map((p) => p.id)).toEqual([3, 2])
  })
})

describe('openPointChanges', () => {
  const existing = [point(1), point(2), point(3)]

  it('creates, updates and removes', () => {
    const changes = openPointChanges(existing, [
      { id: 1, personId: 2, text: 'Point 1' },
      { id: 2, personId: 2, text: ' Changed ' },
      { id: null, personId: 3, text: 'New' },
    ])
    expect(changes).toEqual({
      create: [{ personId: 3, text: 'New' }],
      update: [{ id: 2, text: 'Changed' }],
      remove: [3],
    })
  })

  it('replaces a point whose person changed', () => {
    const changes = openPointChanges(existing, [
      { id: 1, personId: 2, text: 'Point 1' },
      { id: 2, personId: 3, text: 'Point 2' },
      { id: 3, personId: 2, text: 'Point 3' },
    ])
    expect(changes).toEqual({ create: [{ personId: 3, text: 'Point 2' }], update: [], remove: [2] })
  })

  it('ignores empty new rows and deletes cleared points', () => {
    const changes = openPointChanges(existing, [
      { id: 1, personId: 2, text: '  ' },
      { id: 2, personId: 2, text: 'Point 2' },
      { id: 3, personId: 2, text: 'Point 3' },
      { id: null, personId: 2, text: '' },
    ])
    expect(changes).toEqual({ create: [], update: [], remove: [1] })
  })
})
