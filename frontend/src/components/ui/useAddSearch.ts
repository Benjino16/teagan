import { useRef, useState, type KeyboardEvent } from 'react'

/**
 * A search for adding entries one after another: picking one clears the query
 * and puts the cursor back, so the next one is just a few keys away. Enter
 * picks the top result – and never submits a surrounding form.
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
    /** For the `TextInput`, given the result Enter would pick. */
    inputProps: (top: T | undefined) => ({
      ref: input,
      type: 'search',
      autoComplete: 'off',
      value: query,
      onChange: (e: { target: { value: string } }) => setQuery(e.target.value),
      onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== 'Enter') return
        e.preventDefault()
        if (top !== undefined) pick(top)
      },
    }),
  }
}
