import { clsx } from 'clsx'
import { Search, X } from 'lucide-react'
import { useRef } from 'react'
import { inputStyles } from './styles'

interface Props {
  value: string
  onChange: (value: string) => void
  /** Accessible name, e.g. "Search people". */
  label: string
  placeholder?: string
  className?: string
}

/** Search input with a leading icon and a clear button; Escape clears as well. */
export function SearchField({ value, onChange, label, placeholder = 'Search …', className }: Props) {
  const input = useRef<HTMLInputElement>(null)

  return (
    <div className={clsx('relative', className)}>
      <Search aria-hidden="true" size={18} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
      <input
        ref={input}
        type="search"
        aria-label={label}
        placeholder={placeholder}
        autoComplete="off"
        enterKeyHint="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && value) {
            e.preventDefault()
            onChange('')
          }
        }}
        // Own clear button instead of the browser's, which differs per platform
        className={clsx(inputStyles, 'pr-11 pl-10 [&::-webkit-search-cancel-button]:appearance-none')}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            onChange('')
            input.current?.focus()
          }}
          className={clsx(
            'absolute top-0 right-0 flex size-11 items-center justify-center rounded-tile text-muted hover:text-ink',
            'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
          )}
        >
          <X aria-hidden="true" size={18} />
        </button>
      )}
    </div>
  )
}
