import { Plus } from 'lucide-react'
import { useNavigate } from 'react-router'
import { ListDetailLayout } from '../../components/layout/ListDetailLayout'
import { IconButton } from '../../components/ui'
import { useSelf } from '../../data/queries'
import { PeopleList } from './PeopleList'

/** People and the person pages – on large screens a person is always open next to the list, by default you. */
export function PersonPagesLayout() {
  const self = useSelf()
  const navigate = useNavigate()
  return (
    <ListDetailLayout
      title="People"
      list={<PeopleList />}
      action={<IconButton icon={Plus} aria-label="New person" onClick={() => navigate('/people/new')} />}
      initial={self.data && `/people/${self.data.id}`}
    />
  )
}
