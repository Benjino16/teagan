import { type KeyboardEvent, useEffect, useId, useState } from 'react'

/** What the hook spreads on the text field: combobox semantics and the keys. */
export interface ComboboxInputProps {
  role: 'combobox'
  'aria-controls': string
  'aria-expanded': boolean
  'aria-activedescendant': string | undefined
  'aria-autocomplete': 'list'
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
}

/** What the hook spreads on a row. */
export interface OptionProps {
  id: string | undefined
  role: 'option'
  'aria-selected': boolean
  'data-active': true | undefined
}

interface Options<T> {
  /** Stable identity of an item – new items (another query) mark the first again. */
  key: (item: T) => string | number
  onPick: (item: T) => void
  /** `false` while the items are about to change: Enter then waits instead of picking a stale one. */
  ready?: boolean
}

/**
 * Keyboard choice in a list below a text field (combobox pattern): the first item is
 * marked, ↓/↑ move the mark, Enter picks it. Focus stays in the field, so typing goes on.
 * Rows get `optionProps` and show the mark with `data-active:` styles – not `aria-selected`,
 * which a multi-select list needs for its own selection.
 */
export function useListNavigation<T>(items: readonly T[], { key, onPick, ready = true }: Options<T>) {
  const listId = useId()
  const keys = items.map(key).join('\n')
  // The mark belongs to the items it was set on
  const [marked, setMarked] = useState({ keys, index: 0 })
  const index = marked.keys === keys ? marked.index : 0
  const active = items[index] as T | undefined
  const optionId = (i: number) => `${listId}-${i}`
  const activeId = active === undefined ? undefined : optionId(index)

  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView({ block: 'nearest' })
  }, [activeId])

  const inputProps: ComboboxInputProps = {
    role: 'combobox',
    'aria-controls': listId,
    'aria-expanded': items.length > 0,
    'aria-activedescendant': activeId,
    'aria-autocomplete': 'list',
    onKeyDown: (event) => {
      if (event.nativeEvent.isComposing) return
      if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && items.length > 0) {
        event.preventDefault()
        const step = event.key === 'ArrowDown' ? 1 : -1
        setMarked({ keys, index: Math.min(Math.max(index + step, 0), items.length - 1) })
      } else if (event.key === 'Enter' && active !== undefined) {
        event.preventDefault()
        if (ready) onPick(active)
      }
    },
  }

  return {
    /** The item Enter picks. */
    active,
    inputProps,
    listProps: { id: listId, role: 'listbox' as const },
    /** For the row of `item`; rows of items outside `items` (not pickable by key) get `optionProps(null)`. */
    optionProps: (item: T | null): OptionProps => {
      const i = item === null ? -1 : items.findIndex((other) => key(other) === key(item))
      const isActive = i >= 0 && i === index
      return {
        id: i >= 0 ? optionId(i) : undefined,
        role: 'option',
        'aria-selected': isActive,
        'data-active': isActive || undefined,
      }
    },
  }
}
