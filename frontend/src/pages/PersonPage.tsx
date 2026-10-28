import { SidePane } from '../components/layout/SidePane'
import { useBreakpoint } from '../components/layout/useBreakpoint'
import { useInView } from '../components/layout/useInView'
import { daysSinceContact, lastContactDate } from '../domain/contact'
import { PersonArchivedNotice } from '../features/person/Archive'
import { PersonHero } from '../features/person/PersonHero'
import { PersonKnowledge } from '../features/person/PersonKnowledge'
import { PersonOverview } from '../features/person/PersonOverview'
import { PersonPageFrame } from '../features/person/PersonPageFrame'
import { PersonSections } from '../features/person/PersonSections'
import { PersonTimeline } from '../features/person/PersonTimeline'
import { SummaryCards } from '../features/person/SummaryCards'

/**
 * A person's overview: the essentials at a glance. On phones, timeline and knowledge are separate pages;
 * on wide screens, knowledge follows right below and the timeline runs alongside.
 */
export function PersonPage() {
  const [nameRef, nameInView] = useInView<HTMLHeadingElement>()
  const wide = useBreakpoint('laptop')

  return (
    <PersonPageFrame
      showTitle={!nameInView}
      aside={(data) => (
        <SidePane title="Timeline" side="end">
          <PersonTimeline data={data} />
        </SidePane>
      )}
    >
      {(data) => {
        const since = daysSinceContact(
          lastContactDate(data.activities, data.person.id, data.self.id, data.today),
          data.today,
        )
        return (
          <>
            <PersonHero
              person={data.person}
              groups={data.groups}
              daysSinceContact={since}
              today={data.today}
              nameRef={nameRef}
            />
            <PersonArchivedNotice person={data.person} />
            <SummaryCards
              person={data.person}
              activities={data.activities}
              ledger={data.ledger}
              selfId={data.self.id}
              daysSinceContact={since}
              today={data.today}
            />
            <div className="flex flex-col gap-6 px-5 pt-6">
              <PersonOverview data={data} />
              {wide ? (
                <>
                  <PersonKnowledge data={data} />
                  <PersonSections data={data} onlyMoney />
                </>
              ) : (
                <PersonSections data={data} />
              )}
            </div>
          </>
        )
      }}
    </PersonPageFrame>
  )
}
