import { clsx } from 'clsx'
import { PageHeader } from '../components/layout/PageHeader'
import { PageError, PageLoading } from '../components/layout/PageStatus'
import { PageWithPane } from '../components/layout/SidePane'
import { useBreakpoint } from '../components/layout/useBreakpoint'
import { useActivities, useBalances, useGroups, useHideCoveredReconnects, usePeople, useSelf } from '../data/queries'
import { ongoingWithOthers, onThisDay, upcomingWithOthers } from '../domain/activities'
import { upcomingBirthdays } from '../domain/birthday'
import { dueReconnects } from '../domain/contact'
import { formatWeekdayLong } from '../domain/dates'
import type { Id } from '../domain/model'
import { displayName } from '../domain/people'
import { upcomingRemembrances } from '../domain/remembrance'
import { getToday } from '../domain/today'
import { BalancesBox } from '../features/today/BalancesBox'
import { BirthdaysBox } from '../features/today/BirthdaysBox'
import { OngoingFeed } from '../features/today/OngoingFeed'
import { OnThisDayBox } from '../features/today/OnThisDayBox'
import { ReconnectBox } from '../features/today/ReconnectBox'
import { RemembranceBox } from '../features/today/RemembranceBox'
import { UpcomingFeed } from '../features/today/UpcomingFeed'

/**
 * Daily overview as a feed of boxes – being built out step by step.
 * On wide screens two columns: the reminders about people on the left, the days ahead and behind on the right.
 */
export function TodayPage() {
  const people = usePeople()
  const self = useSelf()
  const activities = useActivities()
  const groups = useGroups()
  const balances = useBalances()
  const hideCoveredReconnects = useHideCoveredReconnects()
  const today = getToday()
  const wide = useBreakpoint('laptop')

  if (people.isPending || self.isPending || activities.isPending || groups.isPending || balances.isPending) {
    return <PageLoading />
  }
  if (people.isError || self.isError || activities.isError || groups.isError || balances.isError) {
    return <PageError message="Couldn't load today's overview." />
  }

  const names = new Map(people.data.map((p) => [p.id, displayName(p)]))
  const nameOf = (id: Id) => names.get(id) ?? 'Unknown'
  const personById = new Map(people.data.map((p) => [p.id, p]))
  const groupNames = new Map(groups.data.map((c) => [c.id, c.name]))
  const groupNameOf = (id: Id) => groupNames.get(id) ?? 'Unknown'

  return (
    <PageWithPane>
      <div className="mx-auto max-w-wide">
        <PageHeader title="Today" subtitle={formatWeekdayLong(today)} />
        <div className={clsx('px-5 pt-6', wide ? 'grid grid-cols-2 items-start gap-6' : 'flex flex-col gap-6')}>
          {/* Hidden while there's nothing to remind of, so it leaves no gap */}
          <div className="flex flex-col gap-6 empty:hidden">
            <BirthdaysBox birthdays={upcomingBirthdays(people.data, today)} />
            <RemembranceBox remembrances={upcomingRemembrances(people.data, today)} />
            <ReconnectBox
              reconnects={dueReconnects(people.data, activities.data, self.data.id, today, { hideCovered: hideCoveredReconnects })}
            />
            <BalancesBox balances={balances.data} personById={personById} />
          </div>
          <div className="flex flex-col gap-6 empty:hidden">
            <OngoingFeed
              activities={ongoingWithOthers(activities.data, self.data.id, today)}
              selfId={self.data.id}
              nameOf={nameOf}
              groupNameOf={groupNameOf}
              today={today}
            />
            <UpcomingFeed
              activities={upcomingWithOthers(activities.data, self.data.id, today)}
              selfId={self.data.id}
              nameOf={nameOf}
              groupNameOf={groupNameOf}
              today={today}
            />
            <OnThisDayBox
              memories={onThisDay(activities.data, today)}
              selfId={self.data.id}
              nameOf={nameOf}
              groupNameOf={groupNameOf}
            />
          </div>
        </div>
      </div>
    </PageWithPane>
  )
}
