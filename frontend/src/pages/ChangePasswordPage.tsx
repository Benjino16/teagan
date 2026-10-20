import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router'
import { PageHeader } from '../components/layout/PageHeader'
import { Button, Field, TextInput } from '../components/ui'
import { useChangePassword } from '../data/queries'

const MIN_PASSWORD_LENGTH = 8

/** New password; this device stays logged in, all others are logged out. */
export function ChangePasswordPage() {
  const navigate = useNavigate()
  const changePassword = useChangePassword()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeated, setRepeated] = useState('')

  const mismatch = repeated !== '' && repeated !== next
  const complete = current !== '' && next.length >= MIN_PASSWORD_LENGTH && repeated === next

  function submit(event: FormEvent) {
    event.preventDefault()
    changePassword.mutate({ currentPassword: current, newPassword: next }, { onError: () => setCurrent('') })
  }

  return (
    <>
      <PageHeader title="Change password" backTo="/settings" />
      <div className="px-5 pt-6">
        {changePassword.isSuccess ? (
          <div className="flex flex-col gap-6">
            <p role="status" className="text-base text-ink-2">
              Password changed. Other devices are logged out.
            </p>
            <Button onClick={() => navigate('/settings', { replace: true })}>Done</Button>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-6">
            <Field label="Current password">
              {(id) => (
                <TextInput
                  id={id}
                  type="password"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  autoComplete="current-password"
                  autoFocus
                />
              )}
            </Field>
            <Field label="New password" hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}>
              {(id) => (
                <TextInput
                  id={id}
                  type="password"
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  autoComplete="new-password"
                />
              )}
            </Field>
            <Field label="Repeat new password" hint={mismatch ? "Doesn't match the new password." : undefined}>
              {(id) => (
                <TextInput
                  id={id}
                  type="password"
                  value={repeated}
                  onChange={(e) => setRepeated(e.target.value)}
                  autoComplete="new-password"
                  aria-invalid={mismatch}
                />
              )}
            </Field>

            {changePassword.error && (
              <p role="alert" className="rounded-tile bg-alert-bg px-4 py-3 text-md text-alert-text">
                {changePassword.error.message}
              </p>
            )}

            <Button type="submit" disabled={changePassword.isPending || !complete}>
              Change password
            </Button>
          </form>
        )}
      </div>
    </>
  )
}
