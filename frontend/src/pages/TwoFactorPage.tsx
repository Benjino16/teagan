import { useState } from 'react'
import { useNavigate } from 'react-router'
import { PageHeader } from '../components/layout/PageHeader'
import { PageError, PageLoading } from '../components/layout/PageStatus'
import { Button } from '../components/ui'
import { useAccount, useConfirmTotp, useDisableTotp, useRenewRecoveryCodes, useStartTotp } from '../data/queries'
import { PasswordAction } from '../features/settings/PasswordAction'
import { RecoveryCodes } from '../features/settings/RecoveryCodes'
import { TotpSetupForm } from '../features/settings/TotpSetupForm'

/** Turn two-factor login on or off, renew recovery codes. */
export function TwoFactorPage() {
  const navigate = useNavigate()
  const account = useAccount()
  const start = useStartTotp()
  const confirm = useConfirmTotp()
  const disable = useDisableTotp()
  const renew = useRenewRecoveryCodes()
  /** Fresh recovery codes – shown until "Done", then never again. */
  const [codes, setCodes] = useState<string[] | null>(null)

  if (account.isPending) return <PageLoading />
  if (account.isError) return <PageError message="Couldn't load your account." backTo="/settings" />

  function content() {
    if (codes) return <RecoveryCodes codes={codes} onDone={() => navigate('/settings', { replace: true })} />

    if (account.data?.totpEnabled) {
      const left = account.data.recoveryCodesLeft
      return (
        <div className="flex flex-col gap-6">
          <p className="text-base text-ink-2">
            Two-factor login is on. {left === 1 ? '1 recovery code' : `${left} recovery codes`} left.
          </p>
          <PasswordAction
            label="New recovery codes"
            variant="secondary"
            pending={renew.isPending}
            error={renew.error?.message ?? null}
            onConfirm={(password) => renew.mutate(password, { onSuccess: setCodes })}
            onCancel={() => renew.reset()}
          />
          <div className="flex flex-col gap-2">
            <PasswordAction
              label="Turn off"
              variant="secondary"
              pending={disable.isPending}
              error={disable.error?.message ?? null}
              onConfirm={(password) => disable.mutate(password, { onSuccess: () => start.reset() })}
              onCancel={() => disable.reset()}
            />
            <p className="text-sm text-muted">Logging in will only need your password.</p>
          </div>
        </div>
      )
    }

    if (start.data) {
      return (
        <TotpSetupForm
          setup={start.data}
          pending={confirm.isPending}
          error={confirm.error?.message ?? null}
          onConfirm={(code) => confirm.mutate(code, { onSuccess: setCodes })}
        />
      )
    }

    return (
      <div className="flex flex-col gap-6">
        <p className="text-base text-ink-2">
          Besides your password, logging in needs a code from an authenticator app on your phone.
        </p>
        {start.error && (
          <p role="alert" className="rounded-tile bg-alert-bg px-4 py-3 text-md text-alert-text">
            {start.error.message}
          </p>
        )}
        <Button disabled={start.isPending} onClick={() => start.mutate()}>
          Set up
        </Button>
      </div>
    )
  }

  return (
    <>
      <PageHeader title="Two-factor login" backTo="/settings" />
      <div className="px-5 pt-6">{content()}</div>
    </>
  )
}
