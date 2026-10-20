import { createContext, useContext } from 'react'
import type { Repository } from './repository'

export const RepositoryContext = createContext<Repository | null>(null)

/** The only way for components to reach the repository – usually indirectly via the hooks in `queries.ts`. */
export function useRepository(): Repository {
  const repo = useContext(RepositoryContext)
  if (!repo) throw new Error('useRepository() outside of <RepositoryProvider>')
  return repo
}
