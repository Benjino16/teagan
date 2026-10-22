import { type FormEvent, useState } from 'react'
import { Button, Field, TextInput } from '../components/ui'
import { RepositoryError } from '../data/repository'
import { useAuthStatus, useSetup } from '../data/queries'
import { AuthScreen } from '../features/auth/AuthScreen'

const MIN_PASSWORD_LENGTH = 8

/** The first account, as long as there is none. */
export function SetupPage() {
  const setup = useSetup()
  const status = useAuthStatus()
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [repeated, setRepeated] = useState('')

  const passwordTooShort = password.length < MIN_PASSWORD_LENGTH
  const mismatch = repeated !== '' && repeated !== password
  const complete = name.trim() !== '' && username.trim() !== '' && !passwordTooShort && repeated === password
  // Someone else was faster – the route is gone
  const alreadySetUp = setup.error instanceof RepositoryError && setup.error.code === 'not_found'

  function submit(event: FormEvent) {
    event.preventDefault()
    setup.mutate({ name: name.trim(), username: username.trim(), password })
  }

  if (alreadySetUp) {
    return (
      <AuthScreen title="Teagan is already set up.">
        <Button onClick={() => status.refetch()}>Go to login</Button>
      </AuthScreen>
    )
  }

  return (
    <AuthScreen
      title="Welcome to Teagan"
      intro="Create your account. More accounts can be added on the server later."
    >
      <form onSubmit={submit} className="flex flex-col gap-6">
        <Field label="Your name">
          {(id) => (
            <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" autoFocus />
          )}
        </Field>
        <Field label="Username" hint="Letters, digits, dot, dash and underscore.">
          {(id) => (
            <TextInput
              id={id}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          )}
        </Field>
        <Field label="Password" hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}>
          {(id) => (
            <TextInput
              id={id}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          )}
        </Field>
        <Field label="Repeat password" hint={mismatch ? "Doesn't match the password." : undefined}>
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

        {setup.error && (
          <p role="alert" className="rounded-tile bg-danger-soft px-4 py-3 text-md text-danger">
            {setup.error.message}
          </p>
        )}

        <Button type="submit" disabled={setup.isPending || !complete}>
          Create account
        </Button>
      </form>
    </AuthScreen>
  )
}
