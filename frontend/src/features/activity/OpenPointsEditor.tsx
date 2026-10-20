import { Plus, X } from 'lucide-react'
import { Button, IconButton, inputStyles, TextInput } from '../../components/ui'
import type { Id, Person } from '../../domain/model'
import { displayName } from '../../domain/people'

/** A row in the form; `personId` is `null` until chosen. */
export interface OpenPointRow {
  key: string
  /** Existing point, or `null` for a new one. */
  id: Id | null
  personId: Id | null
  text: string
}

interface Props {
  rows: OpenPointRow[]
  onChange: (rows: OpenPointRow[]) => void
  /** Participants other than you – the people a new point can be for. */
  candidates: Person[]
  /** Everyone, for existing points whose person is no longer a participant. */
  personById: Map<Id, Person>
  newKey: () => string
}

/** What is still open after the event. */
export function OpenPointsEditor({ rows, onChange, candidates, personById, newKey }: Props) {
  const candidateIds = new Set(candidates.map((p) => p.id))

  function update(key: string, patch: Partial<OpenPointRow>) {
    onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  function add() {
    const personId = candidates.length === 1 ? candidates[0]!.id : null
    onChange([...rows, { key: newKey(), id: null, personId, text: '' }])
  }

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1.5 text-xs font-medium tracking-wide text-muted uppercase">Open points</legend>

      {rows.map((row) => {
        const outsider = row.personId !== null && !candidateIds.has(row.personId) ? personById.get(row.personId) : undefined
        const options = outsider ? [...candidates, outsider] : candidates
        return (
          <div key={row.key} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <TextInput
                aria-label="Open point"
                placeholder="e.g. Ask how the exam went"
                autoComplete="off"
                // New rows come from “Add open point”
                autoFocus={row.id === null && row.text === ''}
                value={row.text}
                onChange={(e) => update(row.key, { text: e.target.value })}
              />
              <IconButton
                icon={X}
                aria-label="Remove open point"
                onClick={() => onChange(rows.filter((r) => r.key !== row.key))}
              />
            </div>
            {options.length > 1 && (
              <select
                aria-label="For whom"
                className={inputStyles}
                value={row.personId ?? ''}
                onChange={(e) => update(row.key, { personId: Number(e.target.value) })}
              >
                <option value="" disabled>
                  For …
                </option>
                {options.map((p) => (
                  <option key={p.id} value={p.id}>
                    for {displayName(p)}
                  </option>
                ))}
              </select>
            )}
          </div>
        )
      })}

      {candidates.length === 0 ? (
        rows.length === 0 && <p className="text-sm text-muted">Add a participant first to note open points.</p>
      ) : (
        <Button variant="ghost" className="self-start px-2" onClick={add}>
          <Plus aria-hidden="true" size={18} />
          Add open point
        </Button>
      )}
    </fieldset>
  )
}
