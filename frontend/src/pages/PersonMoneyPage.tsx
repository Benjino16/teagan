import { PersonMoney } from '../features/person/PersonMoney'
import { PersonPageFrame } from '../features/person/PersonPageFrame'

/** Money with the person, as a separate page. */
export function PersonMoneyPage() {
  return (
    <PersonPageFrame section="Money">
      {(data) => (
        <div className="px-5 pt-4">
          <PersonMoney data={data} />
        </div>
      )}
    </PersonPageFrame>
  )
}
