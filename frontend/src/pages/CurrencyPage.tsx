import { Check } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useBack } from '../app/useBack'
import { PageHeader } from '../components/layout/PageHeader'
import { EmptyState, ListCard, listRowStyles, MediaRow, SearchField } from '../components/ui'
import { useSettings, useUpdateSettings } from '../data/queries'
import { currencyChoices, matchesCurrency } from '../domain/currencies'

/** The currency amounts are shown in – for the whole account. Only relabels, nothing is converted. */
export function CurrencyPage() {
  const settings = useSettings()
  const update = useUpdateSettings()
  const back = useBack('/settings')
  const [query, setQuery] = useState('')
  // `AuthGate` waits for the settings
  const current = settings.data?.currency ?? 'EUR'
  // The current one on top
  const choices = useMemo(() => {
    const all = currencyChoices(current)
    return [...all.filter((c) => c.code === current), ...all.filter((c) => c.code !== current)]
  }, [current])
  const shown = query.trim() ? choices.filter((c) => matchesCurrency(c, query)) : choices

  return (
    <>
      <PageHeader title="Currency" backTo="/settings" />
      <div className="flex flex-col gap-3 px-5 pt-6">
        <p className="px-4 text-sm text-muted">Amounts aren't converted – they're only shown in the new currency.</p>
        <SearchField value={query} onChange={setQuery} label="Search currencies" placeholder="Name or code …" />
        {update.error && (
          <p role="alert" className="rounded-tile bg-danger-soft px-4 py-3 text-md text-danger">
            {update.error.message}
          </p>
        )}
        {shown.length === 0 ? (
          <EmptyState>No currency found.</EmptyState>
        ) : (
          <ListCard role="radiogroup" aria-label="Currency">
            {shown.map((choice) => {
              const selected = choice.code === current
              return (
                <li key={choice.code} role="none">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={update.isPending}
                    onClick={() => (selected ? back() : update.mutate({ currency: choice.code }, { onSuccess: back }))}
                    className={`${listRowStyles} text-ink hover:bg-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent`}
                  >
                    <MediaRow
                      title={choice.name}
                      subtitle={choice.symbol === choice.code ? choice.code : `${choice.code} · ${choice.symbol}`}
                      trailing={selected && <Check aria-hidden="true" size={18} className="flex-none text-accent-ink" />}
                    />
                  </button>
                </li>
              )
            })}
          </ListCard>
        )}
      </div>
    </>
  )
}
