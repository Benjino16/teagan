import { useNavigate } from 'react-router'
import { PageHeader } from '../components/layout/PageHeader'
import { useCreatePerson } from '../data/queries'
import { getToday } from '../domain/today'
import { PersonForm } from '../features/person/PersonForm'

export function NewPersonPage() {
  const navigate = useNavigate()
  const createPerson = useCreatePerson()

  return (
    <>
      <PageHeader title="New person" backTo="/people" />
      <div className="px-5 pt-6">
        <PersonForm
          submitLabel="Create person"
          today={getToday()}
          submitting={createPerson.isPending}
          error={createPerson.error?.message ?? null}
          onSubmit={(input, photo) =>
            createPerson.mutate({ input, photo }, {
              onSuccess: (person) => navigate(`/people/${person.id}`, { replace: true }),
            })
          }
        />
      </div>
    </>
  )
}
