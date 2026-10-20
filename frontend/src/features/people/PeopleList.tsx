import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { NavLink } from 'react-router'
import { PageError, PageLoading } from '../../components/layout/PageStatus'
import { STICKY_SEARCH_HEIGHT, StickyBar } from '../../components/layout/StickyBar'
import { ArchiveLink, Avatar, EmptyState, ListCard, listRowStyles, MediaRow, SearchField } from '../../components/ui'
import { usePeople } from '../../data/queries'
import { isArchived } from '../../domain/people'
import { matchesSearch, offersSearch } from '../../domain/search'
import { PeopleByImpact } from './PeopleByImpact'

/**
 * Everyone active except you, grouped by impact; a link at the bottom leads to the archived ones.
 * Your own profile sits above them as a single row, outside the impact levels.
 * A search field appears once the list is long enough to need one and stays below the top bar while scrolling.
 * The People page on phones, a side column next to the open person on wide screens.
 */
export function PeopleList() {
  const people = usePeople()
  const [query, setQuery] = useState('')

  if (people.isPending) return <PageLoading />
  if (people.isError) return <PageError message="Couldn't load people." />

  const self = people.data.find((p) => p.isSelf)
  const others = people.data.filter((p) => !p.isSelf)
  const active = others.filter((p) => !isArchived(p))
  const shown = active.filter((p) => matchesSearch(query, [p.name, p.nickname]))
  const searchShown = offersSearch(active.length, query)

  return (
    <>
      {self && (
        <ListCard>
          <li>
            <NavLink
              to={`/people/${self.id}`}
              className={`${listRowStyles} text-ink no-underline hover:bg-canvas aria-[current=page]:bg-accent-soft`}
            >
              <MediaRow
                leading={<Avatar name={self.name} photo={self.photo} size="md" />}
                title={self.name}
                subtitle="Your profile"
                trailing={<ChevronRight aria-hidden="true" size={18} className="flex-none text-muted" />}
              />
            </NavLink>
          </li>
        </ListCard>
      )}
      {searchShown && (
        <StickyBar>
          <SearchField label="Search people" value={query} onChange={setQuery} />
        </StickyBar>
      )}
      {active.length === 0 ? (
        <EmptyState>Nobody here yet.</EmptyState>
      ) : shown.length === 0 ? (
        <p className="px-1 text-md text-muted">No one found.</p>
      ) : (
        <PeopleByImpact people={shown} headerOffset={searchShown ? STICKY_SEARCH_HEIGHT : 0} />
      )}
      <ArchiveLink to="/people/archived" count={others.length - active.length} />
    </>
  )
}
