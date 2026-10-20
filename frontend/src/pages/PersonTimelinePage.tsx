import { PersonPageFrame } from '../features/person/PersonPageFrame'
import { PersonTimeline } from '../features/person/PersonTimeline'

/** The person's timeline, as a separate page. */
export function PersonTimelinePage() {
  return (
    <PersonPageFrame section="Timeline">
      {(data) => (
        <div className="px-5 pt-2">
          <PersonTimeline data={data} />
        </div>
      )}
    </PersonPageFrame>
  )
}
