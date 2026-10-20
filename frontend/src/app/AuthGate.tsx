import type { ReactNode } from 'react'
import { PageLoading } from '../components/layout/PageStatus'
import { Button } from '../components/ui'
import { useAuthStatus } from '../data/queries'
import { LoginPage } from '../pages/LoginPage'
import { SetupPage } from '../pages/SetupPage'

/**
 * Shows the app only with a valid login, else the login screen – or, before the
 * first account exists, the setup – at any path. Lives
 * outside the router, so after logging in the same path opens.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const status = useAuthStatus()

  if (status.isPending) return <PageLoading />
  if (status.isError) {
    return (
      <div className="flex flex-col items-center gap-3 px-5 pt-24 text-center">
        <p className="text-base text-ink-2">{status.error.message}</p>
        <Button variant="secondary" onClick={() => status.refetch()}>
          Try again
        </Button>
      </div>
    )
  }
  if (status.data.setupRequired) return <SetupPage />
  return status.data.loggedIn ? children : <LoginPage />
}
