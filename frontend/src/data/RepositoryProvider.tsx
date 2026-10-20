import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode, useState } from 'react'
import { handleUnauthorized } from './queries'
import type { Repository } from './repository'
import { RepositoryContext } from './RepositoryContext'

interface Props {
  repository: Repository
  children: ReactNode
}

export function RepositoryProvider({ repository, children }: Props) {
  const [queryClient] = useState(() => {
    const client: QueryClient = new QueryClient({
      defaultOptions: { queries: { staleTime: 30_000, retry: false } },
      queryCache: new QueryCache({ onError: (error) => handleUnauthorized(client, error) }),
      mutationCache: new MutationCache({ onError: (error) => handleUnauthorized(client, error) }),
    })
    return client
  })

  return (
    <RepositoryContext.Provider value={repository}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </RepositoryContext.Provider>
  )
}
