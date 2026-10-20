import { useSyncExternalStore } from 'react'

/*
 * Where the layout switches. Both are chosen so the page in the middle keeps at least a phone's width
 * (~390 px) – the width its content is designed for – next to the rail (88 px) and side panes (320 px each).
 * No Tailwind `md:`/`lg:` classes depend on these; layout changes go through this hook.
 */
const breakpoints = {
  /** Laptop, also with a smaller window: navigation moves to the left edge, pages may add a side column. */
  laptop: '(min-width: 50rem)',
  /** Large window: room for a second side column. */
  large: '(min-width: 70rem)',
} as const

export type Breakpoint = keyof typeof breakpoints

function matches(query: string): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(query).matches
}

/**
 * Whether the screen is at least as wide as the breakpoint. For layouts that render different
 * content on wide screens (an extra column) rather than just restyling it – that stays in CSS.
 */
export function useBreakpoint(name: Breakpoint): boolean {
  const query = breakpoints[name]
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== 'function') return () => {}
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () => matches(query),
    () => false,
  )
}

/** Whether a `ListDetailLayout` shows its list beside the detail page – then the detail page needs no way back to it. */
export function useListBeside(): boolean {
  return useBreakpoint('large')
}
