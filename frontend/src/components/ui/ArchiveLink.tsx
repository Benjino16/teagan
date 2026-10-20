import { Link } from 'react-router'
import { buttonStyles } from './styles'

interface Props {
  to: string
  count: number
}

/** Ghost-button link below a list to its archived entries – takes no room when there are none. */
export function ArchiveLink({ to, count }: Props) {
  if (count === 0) return null
  return (
    <Link to={to} className={buttonStyles('ghost', 'self-center px-2 no-underline')}>
      Archived ({count})
    </Link>
  )
}
