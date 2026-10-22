import { clsx } from 'clsx'
import { CalendarDays, LayoutGrid, type LucideIcon, Settings, Users } from 'lucide-react'
import { NavLink } from 'react-router'

const tabs: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: '/', label: 'Today', icon: CalendarDays, end: true },
  { to: '/people', label: 'People', icon: Users },
  { to: '/groups', label: 'Groups', icon: LayoutGrid },
  { to: '/settings', label: 'Settings', icon: Settings },
]

function Tabs() {
  return tabs.map(({ to, label, icon: Icon, end }) => (
    <NavLink
      key={to}
      to={to}
      end={end}
      className={({ isActive }) =>
        clsx(
          'flex min-h-17 flex-col items-center justify-center gap-1 text-xs no-underline',
          'focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-accent',
          isActive ? 'font-semibold text-accent-ink' : 'font-medium text-muted',
        )
      }
    >
      <Icon aria-hidden="true" size={22} />
      {label}
    </NavLink>
  ))
}

export function TabBar() {
  return (
    <nav
      aria-label="Main navigation"
      className="grid grid-cols-4 border-t border-line bg-surface pb-[max(8px,env(safe-area-inset-bottom))]"
    >
      <Tabs />
    </nav>
  )
}

/** The same tabs as a column at the left edge, on wide screens. */
export function NavRail() {
  return (
    <nav
      aria-label="Main navigation"
      className="fixed inset-y-0 left-0 z-30 flex w-rail flex-col gap-1 border-r border-line bg-surface pt-3"
    >
      <Tabs />
    </nav>
  )
}
