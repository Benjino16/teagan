import { clsx } from 'clsx'
import { type LucideIcon, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Outlet, ScrollRestoration, useLocation, useMatches, useNavigate, type Params } from 'react-router'
import { NavRail, TabBar } from '../components/layout/TabBar'
import { useBreakpoint } from '../components/layout/useBreakpoint'
import { Fab, FabMenu } from '../components/ui'
import { SearchSheet } from '../features/search/SearchSheet'

/** What the add button does: go straight to a target or open a menu. */
export type FabAction =
  | { label: string; to: string }
  | { label: string; items: { label: string; icon: LucideIcon; /** without a target: disabled */ to?: string }[] }

/** Optional route settings for the layout (`handle` in the route definition). */
export interface RouteHandle {
  /** Add button of this page; `null` hides it. If unset, it doesn't do anything yet. */
  fab?: FabAction | null | ((params: Params) => FabAction)
  /** Full-screen pages (e.g. forms) without tab bar and add button. */
  fullscreen?: boolean
  /** On wide screens the page brings its own side columns and takes the full width (else: one centered column). */
  spread?: boolean
}

export function AppLayout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const wide = useBreakpoint('laptop')
  const matches = useMatches().map((m) => ({ params: m.params, handle: (m.handle ?? {}) as RouteHandle }))
  const fullscreen = matches.some((m) => m.handle.fullscreen)
  const spread = matches.some((m) => m.handle.spread)
  const fabMatch = matches.findLast((m) => m.handle.fab !== undefined)
  const fab = typeof fabMatch?.handle.fab === 'function' ? fabMatch.handle.fab(fabMatch.params) : fabMatch?.handle.fab
  // Phones: above the tab bar. Wide screens: in the bottom right corner, there is no tab bar.
  const fabPosition = wide ? 'fixed right-8 bottom-8' : 'absolute right-5 bottom-[calc(100%+20px)]'
  // Search sits centered above the add button (56 px + 16 px gap), or takes its place on pages without one
  const searchPosition =
    fab === null
      ? wide
        ? 'fixed right-9 bottom-9'
        : 'absolute right-6 bottom-[calc(100%+24px)]'
      : wide
        ? 'fixed right-9 bottom-[calc(2rem+72px)]'
        : 'absolute right-6 bottom-[calc(100%+92px)]'
  const [searching, setSearching] = useState(false)

  // “/” or Ctrl/⌘+K opens the search, as on many sites – not while typing or inside an overlay
  useEffect(() => {
    if (fullscreen) return
    const onKeyDown = (event: KeyboardEvent) => {
      const shortcut = event.key === '/' || (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey))
      if (!shortcut || event.defaultPrevented || event.isComposing) return
      const target = event.target
      if (target instanceof HTMLElement && target.matches('input, textarea, select, [contenteditable="true"]')) return
      if (document.querySelector('dialog[open]')) return
      event.preventDefault()
      setSearching(true)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [fullscreen])

  const searchButton = (
    <button
      type="button"
      aria-label="Search"
      aria-haspopup="dialog"
      onClick={() => setSearching(true)}
      className={clsx(
        searchPosition,
        'flex size-12 items-center justify-center rounded-full border border-line bg-surface text-ink shadow-fab',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
      )}
    >
      <Search aria-hidden="true" size={20} strokeWidth={2.2} />
    </button>
  )

  const addButton =
    fab === null ? null : fab && 'items' in fab ? (
      <FabMenu
        // New page → menu closed
        key={pathname}
        className={fabPosition}
        label={fab.label}
        items={fab.items.map(({ label, icon, to }) => ({
          label,
          icon,
          onSelect: to ? () => navigate(to) : undefined,
        }))}
      />
    ) : (
      <Fab
        className={fabPosition}
        aria-label={fab?.label ?? 'Add entry'}
        onClick={fab ? () => navigate(fab.to) : undefined}
      />
    )

  return (
    <div className={clsx('min-h-dvh bg-canvas', wide && !fullscreen && 'pl-(--container-rail)')}>
      {/* Forms stay a phone-sized column on every screen; other pages get the room the screen offers. */}
      <main
        className={clsx(
          'mx-auto',
          !wide || fullscreen ? 'max-w-app' : !spread && 'max-w-content',
          // Room for tab bar, add and search button. Spread pages scroll in their own columns, which leave room themselves
          fullscreen ? 'pb-10' : !wide ? 'pb-58' : !spread && 'pb-44',
        )}
      >
        <Outlet />
      </main>

      {!fullscreen &&
        (wide ? (
          <>
            <NavRail />
            {/* z-30 as on phones: the add menu's backdrop covers the top bar, side columns and search */}
            <div className="relative z-30">
              {searchButton}
              {addButton}
            </div>
          </>
        ) : (
          // z-30: above the top bar (z-20), so the add menu's backdrop covers everything
          <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-app">
            {searchButton}
            {addButton}
            <TabBar />
          </div>
        ))}

      {searching && <SearchSheet onClose={() => setSearching(false)} />}
      <ScrollRestoration />
    </div>
  )
}
