import type { ReactNode } from 'react'
import { PageLoading } from '../components/layout/PageStatus'
import { Button } from '../components/ui'
import { useAuthStatus, useSettings } from '../data/queries'
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
  if (status.isError) return <LoadError message={status.error.message} onRetry={() => status.refetch()} />
  if (status.data.setupRequired) return <SetupPage />
  return status.data.loggedIn ? <SettingsGate>{children}</SettingsGate> : <LoginPage />
}

/** Waits for the settings, so amounts never show in a currency that isn't yours for a moment. */
function SettingsGate({ children }: { children: ReactNode }) {
  const settings = useSettings()

  // Once loaded, a failed refetch keeps the app – the settings stay as they were
  if (settings.data) return children
  if (settings.isError) return <LoadError message={settings.error.message} onRetry={() => settings.refetch()} />
  return <PageLoading />
}

function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-5 pt-24 text-center">
      <p className="text-base text-ink-2">{message}</p>
      <Button variant="secondary" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}
