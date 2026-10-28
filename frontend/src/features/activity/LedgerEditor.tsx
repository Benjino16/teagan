import { Plus, X } from 'lucide-react'
import { Button, IconButton, inputStyles, TextInput } from '../../components/ui'
import { CURRENCY_SYMBOL, type Payer } from '../../domain/ledger'
import type { Id, Person } from '../../domain/model'
import { displayName } from '../../domain/people'

/** A row in the form; `personId` is `null` until chosen, `amount` is the typed text. */
export interface LedgerRow {
  key: string
  /** Existing entry, or `null` for a new one. */
  id: Id | null
  personId: Id | null
  payer: Payer
  amount: string
}

interface Props {
  rows: LedgerRow[]
  onChange: (rows: LedgerRow[]) => void
  /** Participants other than you – the people a new entry can be with. */
  candidates: Person[]
  /** Everyone, for existing entries whose person is no longer a participant. */
  personById: Map<Id, Person>
  newKey: () => string
}

/** Who paid what at the event. Each row is an entry with one person. */
export function LedgerEditor({ rows, onChange, candidates, personById, newKey }: Props) {
  const candidateIds = new Set(candidates.map((p) => p.id))

  function update(key: string, patch: Partial<LedgerRow>) {
    onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  function add() {
    const personId = candidates.length === 1 ? candidates[0]!.id : null
    onChange([...rows, { key: newKey(), id: null, personId, payer: 'you', amount: '' }])
  }

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1.5 text-xs font-medium tracking-wide text-muted uppercase">Money</legend>

      {rows.map((row) => {
        const outsider = row.personId !== null && !candidateIds.has(row.personId) ? personById.get(row.personId) : undefined
        const options = outsider ? [...candidates, outsider] : candidates
        const person = row.personId === null ? undefined : personById.get(row.personId)
        return (
          <div key={row.key} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <TextInput
                aria-label={`Amount (${CURRENCY_SYMBOL})`}
                inputMode="decimal"
                placeholder="0.00"
                autoComplete="off"
                // New rows come from “Add money”
                autoFocus={row.id === null && row.amount === ''}
                className="min-w-0 flex-1"
                value={row.amount}
                onChange={(e) => update(row.key, { amount: e.target.value })}
              />
              <select
                aria-label="Who paid"
                className={`${inputStyles} min-w-0 flex-1`}
                value={row.payer}
                onChange={(e) => update(row.key, { payer: e.target.value as Payer })}
              >
                <option value="you">You paid</option>
                <option value="them">{person ? `${displayName(person)} paid` : 'They paid'}</option>
              </select>
              <IconButton
                icon={X}
                aria-label="Remove money entry"
                onClick={() => onChange(rows.filter((r) => r.key !== row.key))}
              />
            </div>
            {options.length > 1 && (
              <select
                aria-label="With whom"
                className={inputStyles}
                value={row.personId ?? ''}
                onChange={(e) => update(row.key, { personId: Number(e.target.value) })}
              >
                <option value="" disabled>
                  With …
                </option>
                {options.map((p) => (
                  <option key={p.id} value={p.id}>
                    with {displayName(p)}
                  </option>
                ))}
              </select>
            )}
          </div>
        )
      })}

      {candidates.length === 0 ? (
        rows.length === 0 && <p className="text-sm text-muted">Add a participant first to note money.</p>
      ) : (
        <Button variant="ghost" className="self-start px-2" onClick={add}>
          <Plus aria-hidden="true" size={18} />
          Add money
        </Button>
      )}
    </fieldset>
  )
}
