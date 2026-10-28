import { BookOpen, CalendarPlus, HandCoins, LayoutGrid, ListTodo } from 'lucide-react'
import { createBrowserRouter, type Params } from 'react-router'
import { ActivityPage } from '../pages/ActivityPage'
import { AppearancePage } from '../pages/AppearancePage'
import { ArchivedGroupsPage } from '../pages/ArchivedGroupsPage'
import { ArchivedPeoplePage } from '../pages/ArchivedPeoplePage'
import { CurrencyPage } from '../pages/CurrencyPage'
import { EditActivityPage } from '../pages/EditActivityPage'
import { EditFactPage } from '../pages/EditFactPage'
import { EditGroupPage } from '../pages/EditGroupPage'
import { EditLedgerEntryPage } from '../pages/EditLedgerEntryPage'
import { EditOpenPointPage } from '../pages/EditOpenPointPage'
import { GroupPage } from '../pages/GroupPage'
import { GroupTimelinePage } from '../pages/GroupTimelinePage'
import { GroupsPage } from '../pages/GroupsPage'
import { NewActivityPage } from '../pages/NewActivityPage'
import { NewFactPage } from '../pages/NewFactPage'
import { NewGroupPage } from '../pages/NewGroupPage'
import { NewLedgerEntryPage } from '../pages/NewLedgerEntryPage'
import { NewOpenPointPage } from '../pages/NewOpenPointPage'
import { EditPersonPage } from '../pages/EditPersonPage'
import { NewPersonPage } from '../pages/NewPersonPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { PeoplePage } from '../pages/PeoplePage'
import { GroupPagesLayout } from '../features/groups/GroupPagesLayout'
import { PersonPagesLayout } from '../features/people/PersonPagesLayout'
import { PersonKnowledgePage } from '../pages/PersonKnowledgePage'
import { PersonMoneyPage } from '../pages/PersonMoneyPage'
import { PersonPage } from '../pages/PersonPage'
import { PersonTimelinePage } from '../pages/PersonTimelinePage'
import { ChangePasswordPage } from '../pages/ChangePasswordPage'
import { SettingsPage } from '../pages/SettingsPage'
import { TwoFactorPage } from '../pages/TwoFactorPage'
import { TodayPage } from '../pages/TodayPage'
import { AppLayout, type FabAction, type RouteHandle } from './AppLayout'

/** On all person pages: entries for this person. */
const personFab = (params: Params): FabAction => ({
  label: 'Add entry',
  items: [
    { label: 'Event', icon: CalendarPlus, to: `/activities/new?person=${params.id}` },
    { label: 'Open point', icon: ListTodo, to: `/people/${params.id}/open-points/new` },
    { label: 'Knowledge', icon: BookOpen, to: `/people/${params.id}/facts/new` },
    { label: 'Money', icon: HandCoins, to: `/people/${params.id}/money/new` },
  ],
})

/** On the Knowledge tab, knowledge is the obvious entry. */
const knowledgeFab = (params: Params): FabAction => ({ label: 'New knowledge', to: `/people/${params.id}/facts/new` })

/** On the Money tab, a money entry is the obvious entry. */
const moneyFab = (params: Params): FabAction => ({ label: 'New money entry', to: `/people/${params.id}/money/new` })

/** In a group: an event for it, or a new group in it – or, from a subgroup, next to it. */
const groupFab = (params: Params): FabAction => ({
  label: 'Add',
  items: [
    { label: 'Event', icon: CalendarPlus, to: `/activities/new?group=${params.id}` },
    { label: 'Group', icon: LayoutGrid, to: `/groups/new?parent=${params.id}` },
  ],
})

/** In a group's timeline, events are the obvious entry. */
const groupTimelineFab = (params: Params): FabAction => ({ label: 'New event', to: `/activities/new?group=${params.id}` })

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      {
        path: '/',
        element: <TodayPage />,
        handle: { fab: { to: '/activities/new', label: 'New event' }, spread: true } satisfies RouteHandle,
      },
      { path: '/people/new', element: <NewPersonPage />, handle: { fullscreen: true } satisfies RouteHandle },
      { path: '/people/archived', element: <ArchivedPeoplePage />, handle: { fab: null } satisfies RouteHandle },
      { path: '/people/:id/edit', element: <EditPersonPage />, handle: { fullscreen: true } satisfies RouteHandle },
      {
        // Large screens: list of people on the left, see `PersonPagesLayout`
        element: <PersonPagesLayout />,
        children: [
          {
            path: '/people',
            element: <PeoplePage />,
            handle: { fab: { to: '/people/new', label: 'New person' } } satisfies RouteHandle,
          },
          { path: '/people/:id', element: <PersonPage />, handle: { fab: personFab, spread: true } satisfies RouteHandle },
          {
            path: '/people/:id/timeline',
            element: <PersonTimelinePage />,
            handle: { fab: personFab, spread: true } satisfies RouteHandle,
          },
          {
            path: '/people/:id/knowledge',
            element: <PersonKnowledgePage />,
            handle: { fab: knowledgeFab, spread: true } satisfies RouteHandle,
          },
          {
            path: '/people/:id/money',
            element: <PersonMoneyPage />,
            handle: { fab: moneyFab, spread: true } satisfies RouteHandle,
          },
        ],
      },
      { path: '/people/:id/facts/new', element: <NewFactPage />, handle: { fullscreen: true } satisfies RouteHandle },
      { path: '/people/:id/facts/:factId/edit', element: <EditFactPage />, handle: { fullscreen: true } satisfies RouteHandle },
      { path: '/people/:id/open-points/new', element: <NewOpenPointPage />, handle: { fullscreen: true } satisfies RouteHandle },
      { path: '/people/:id/open-points/:pointId/edit', element: <EditOpenPointPage />, handle: { fullscreen: true } satisfies RouteHandle },
      { path: '/people/:id/money/new', element: <NewLedgerEntryPage />, handle: { fullscreen: true } satisfies RouteHandle },
      { path: '/people/:id/money/:entryId/edit', element: <EditLedgerEntryPage />, handle: { fullscreen: true } satisfies RouteHandle },
      { path: '/activities/new', element: <NewActivityPage />, handle: { fullscreen: true } satisfies RouteHandle },
      { path: '/activities/:id', element: <ActivityPage />, handle: { fab: null } satisfies RouteHandle },
      { path: '/activities/:id/edit', element: <EditActivityPage />, handle: { fullscreen: true } satisfies RouteHandle },
      { path: '/groups/new', element: <NewGroupPage />, handle: { fullscreen: true } satisfies RouteHandle },
      { path: '/groups/archived', element: <ArchivedGroupsPage />, handle: { fab: null } satisfies RouteHandle },
      {
        // Large screens: list of groups on the left, see `GroupPagesLayout`
        element: <GroupPagesLayout />,
        children: [
          {
            path: '/groups',
            element: <GroupsPage />,
            handle: { fab: { to: '/groups/new', label: 'New group' } } satisfies RouteHandle,
          },
          { path: '/groups/:id', element: <GroupPage />, handle: { fab: groupFab, spread: true } satisfies RouteHandle },
          {
            path: '/groups/:id/timeline',
            element: <GroupTimelinePage />,
            handle: { fab: groupTimelineFab, spread: true } satisfies RouteHandle,
          },
        ],
      },
      { path: '/groups/:id/edit', element: <EditGroupPage />, handle: { fullscreen: true } satisfies RouteHandle },
      { path: '/settings', element: <SettingsPage />, handle: { fab: null } satisfies RouteHandle },
      { path: '/settings/password', element: <ChangePasswordPage />, handle: { fullscreen: true } satisfies RouteHandle },
      { path: '/settings/two-factor', element: <TwoFactorPage />, handle: { fullscreen: true } satisfies RouteHandle },
      { path: '/settings/appearance', element: <AppearancePage />, handle: { fullscreen: true } satisfies RouteHandle },
      { path: '/settings/currency', element: <CurrencyPage />, handle: { fullscreen: true } satisfies RouteHandle },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
