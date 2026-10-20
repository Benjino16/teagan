import { createContext, useContext } from 'react'

/** Set by `ScrollColumn` for everything inside it. */
export const ScrollRootContext = createContext<HTMLElement | null>(null)

/** The column the page scrolls in – `null` = the window, as on phones. */
export function useScrollRoot(): HTMLElement | null {
  return useContext(ScrollRootContext)
}
