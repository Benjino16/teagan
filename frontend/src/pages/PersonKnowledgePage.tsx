import { PersonKnowledge } from '../features/person/PersonKnowledge'
import { PersonPageFrame } from '../features/person/PersonPageFrame'

/** Knowledge and milestones, as a separate page. */
export function PersonKnowledgePage() {
  return (
    <PersonPageFrame section="Knowledge">
      {(data) => (
        <div className="px-5 pt-4">
          <PersonKnowledge data={data} />
        </div>
      )}
    </PersonPageFrame>
  )
}
