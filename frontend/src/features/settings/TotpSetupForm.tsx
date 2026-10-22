import { type FormEvent, useState } from 'react'
import { Button, Field, TextInput } from '../../components/ui'
import type { TotpSetup } from '../../domain/model'

interface Props {
  setup: TotpSetup
  pending: boolean
  error: string | null
  onConfirm: (code: string) => void
}

/** QR code, the key to type in, and the first code that turns it on. */
export function TotpSetupForm({ setup, pending, error, onConfirm }: Props) {
  const [code, setCode] = useState('')
  const qrSrc = `data:image/svg+xml;utf8,${encodeURIComponent(setup.qrSvg)}`
  const groupedSecret = setup.secret.match(/.{1,4}/g)?.join(' ') ?? setup.secret

  function submit(event: FormEvent) {
    event.preventDefault()
    onConfirm(code)
    setCode('')
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <p className="text-base text-ink-2">Scan the code with your authenticator app.</p>
      {/* The SVG brings its own white background – scanners need the contrast in dark mode too */}
      <img src={qrSrc} alt="QR code for your authenticator app" className="size-52 self-center rounded-tile" />
      {/* On the phone itself there is nothing to scan; the app opens from the link */}
      <a href={setup.otpauthUrl} className="self-center text-md font-semibold">
        Open in authenticator app
      </a>
      <div className="flex flex-col gap-1.5">
        <p className="text-sm text-muted">Or type in this key:</p>
        <p className="font-mono text-base break-all select-all">{groupedSecret}</p>
      </div>
      <Field label="Code from the app">
        {(id) => (
          <TextInput
            id={id}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
          />
        )}
      </Field>
      {error && (
        <p role="alert" className="rounded-tile bg-danger-soft px-4 py-3 text-md text-danger">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending || !code.trim()}>
        Turn on
      </Button>
    </form>
  )
}
