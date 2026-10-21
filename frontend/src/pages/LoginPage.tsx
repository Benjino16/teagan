import { type FormEvent, useState } from 'react'
import { Button, Field, TextButton, TextInput } from '../components/ui'
import { useLogin, useLoginWithCode } from '../data/queries'
import { RepositoryError } from '../data/repository'
import type { LoginInput } from '../domain/model'
import { AuthScreen } from '../features/auth/AuthScreen'
import { DemoLogin } from '../features/auth/DemoLogin'

/**
 * The login screen. A wrong login keeps the username. With
 * two-factor login on, the password is followed by the code on the same screen.
 */
export function LoginPage() {
  const login = useLogin()
  const loginWithCode = useLoginWithCode()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [askCode, setAskCode] = useState(false)
  /** Shown on the password step after the code step has ended. */
  const [notice, setNotice] = useState<string | null>(null)

  function submitPassword(event: FormEvent) {
    event.preventDefault()
    logIn({ username, password })
  }

  /** From the form or the demo button – both go on to the code step alike. */
  function logIn(input: LoginInput) {
    setNotice(null)
    login.mutate(input, {
      onSuccess: (result) => {
        setPassword('')
        if (result.totpRequired) setAskCode(true)
      },
      onError: () => setPassword(''),
    })
  }

  function submitCode(event: FormEvent) {
    event.preventDefault()
    loginWithCode.mutate(code, {
      onError: (error) => {
        setCode('')
        // 5 minutes or 5 wrong codes are over – the password is needed again
        if (error instanceof RepositoryError && error.code === 'not_found') backToPassword('Please log in again.')
      },
    })
  }

  function backToPassword(message: string | null) {
    setAskCode(false)
    setCode('')
    setNotice(message)
    loginWithCode.reset()
  }

  if (askCode) {
    return (
      <AuthScreen title="Teagan">
        <form onSubmit={submitCode} className="flex flex-col gap-6">
          <Field label="Code" hint="From your authenticator app – or one of your recovery codes.">
            {(id) => (
              <TextInput
                id={id}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoComplete="one-time-code"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoFocus
              />
            )}
          </Field>

          {loginWithCode.error && <Alert message={loginWithCode.error.message} />}

          <Button type="submit" disabled={loginWithCode.isPending || !code.trim()}>
            Confirm
          </Button>
          <TextButton className="self-center" onClick={() => backToPassword(null)}>
            Back
          </TextButton>
        </form>
      </AuthScreen>
    )
  }

  return (
    <AuthScreen title="Teagan">
      <form onSubmit={submitPassword} className="flex flex-col gap-6">
        <Field label="Username">
          {(id) => (
            <TextInput
              id={id}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
            />
          )}
        </Field>
        <Field label="Password">
          {(id) => (
            <TextInput
              id={id}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          )}
        </Field>

        {(login.error || notice) && <Alert message={login.error?.message ?? notice ?? ''} />}

        <Button type="submit" disabled={login.isPending || !username.trim() || !password}>
          Log in
        </Button>
        <DemoLogin onLogin={logIn} disabled={login.isPending} />
      </form>
    </AuthScreen>
  )
}

function Alert({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-tile bg-alert-bg px-4 py-3 text-md text-alert-text">
      {message}
    </p>
  )
}
