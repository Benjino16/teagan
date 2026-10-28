import { type FormEvent, useState } from 'react'
import { Button, ChoiceGroup, ConfirmDelete, Field, inputStyles, TextInput } from '../../components/ui'
import { amountInputText, CURRENCY_SYMBOL, parseAmount, type Payer, payerOf, signedCents } from '../../domain/ledger'
import type { LedgerEntryInput } from '../../domain/model'

interface Props {
  /** Existing entry when editing, otherwise defaults (today, no event) – an amount of `0` leaves the field empty. */
  initial: LedgerEntryInput
  /** The other person's name, for “who paid”. */
  name: string
  /** Read-only origin, e.g. “from Bar night · Oct 27” (only for entries from an event). */
  source?: string
  submitLabel: string
  submitting: boolean
  error: string | null
  onSubmit: (input: LedgerEntryInput) => void
  /** Only when editing: shows the delete button. */
  onDelete?: () => void
  deleting?: boolean
}

/** Create and edit a money entry. The event can only be set in the event form. */
export function LedgerEntryForm({
  initial,
  name,
  source,
  submitLabel,
  submitting,
  error,
  onSubmit,
  onDelete,
  deleting = false,
}: Props) {
  const isNew = !onDelete
  const prefilled = initial.amountCents !== 0
  // Most entries are money you laid out
  const [payer, setPayer] = useState<Payer>(prefilled ? payerOf(initial.amountCents) : 'you')
  const [amount, setAmount] = useState(prefilled ? amountInputText(initial.amountCents) : '')
  const [date, setDate] = useState(initial.date)
  const [note, setNote] = useState(initial.note ?? '')
  const [problem, setProblem] = useState<string | null>(null)
  const busy = submitting || deleting

  function submit(event: FormEvent) {
    event.preventDefault()
    const cents = parseAmount(amount)
    const missing = cents === null ? 'Enter an amount, e.g. 12.50.' : !date ? 'Date is missing.' : null
    setProblem(missing)
    if (missing || cents === null) return
    onSubmit({ amountCents: signedCents(cents, payer), date, note: note.trim() || null, activityId: initial.activityId })
  }

  const message = problem ?? error

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <ChoiceGroup
        label="Who paid"
        choices={[
          { value: 'you', label: 'You' },
          { value: 'them', label: name },
        ]}
        value={payer}
        onChange={setPayer}
        hint={payer === 'you' ? `For ${name}, or back to them.` : `For you, or back to you.`}
      />

      <Field label={`Amount (${CURRENCY_SYMBOL})`} hint={source}>
        {(id) => (
          <TextInput
            id={id}
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            autoFocus={isNew && !prefilled}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        )}
      </Field>

      <Field label="Date">
        {(id) => (
          <input id={id} type="date" required className={inputStyles} value={date} onChange={(e) => setDate(e.target.value)} />
        )}
      </Field>

      <Field label="Note">
        {(id) => (
          <TextInput
            id={id}
            maxLength={1000}
            autoComplete="off"
            placeholder="e.g. Concert tickets"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        )}
      </Field>

      {message && (
        <p role="alert" className="rounded-tile bg-danger-soft px-4 py-3 text-md text-danger">
          {message}
        </p>
      )}

      <Button type="submit" disabled={busy}>
        {submitLabel}
      </Button>

      {onDelete && <ConfirmDelete onConfirm={onDelete} disabled={busy} />}
    </form>
  )
}
