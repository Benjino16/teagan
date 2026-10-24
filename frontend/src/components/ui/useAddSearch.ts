import { useRef, useState } from 'react'
import type { ComboboxInputProps } from './useListNavigation'

/**
 * A search for adding entries one after another: picking one clears the query
 * and puts the cursor back, so the next one is just a few keys away. The keys
 * come from `useListNavigation` (Enter picks the marked result) – and Enter
 * never submits a surrounding form.
 */
export function useAddSearch<T>(add: (item: T) => void) {
  const [query, setQuery] = useState('')
  const input = useRef<HTMLInputElement>(null)

  function pick(item: T) {
    add(item)
    setQuery('')
    input.current?.focus()
  }

  return {
    query,
    pick,
    /** For the `TextInput`, given the results' `useListNavigation` (with `pick` as `onPick`). */
    inputProps: (combobox: ComboboxInputProps) => ({
      ...combobox,
      ref: input,
      type: 'search',
      autoComplete: 'off',
      value: query,
      onChange: (e: { target: { value: string } }) => setQuery(e.target.value),
      onKeyDown: (e: Parameters<ComboboxInputProps['onKeyDown']>[0]) => {
        combobox.onKeyDown(e)
        if (e.key === 'Enter') e.preventDefault()
      },
    }),
  }
}
