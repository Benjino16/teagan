import { useState } from 'react'
import { Button } from '../../components/ui'

/** The recovery codes right after creating them – the only time they are shown. */
export function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const [copied, setCopied] = useState(false)
  const text = codes.join('\n') + '\n'

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      // Clipboard blocked (e.g. plain HTTP) – Download still works
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'teagan-recovery-codes.txt'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-base text-ink-2">
        Each code works once, in place of a code from the app. Keep them somewhere safe – they are shown only now.
      </p>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-card border border-line bg-surface p-4 font-mono text-base">
        {codes.map((code) => (
          <li key={code} className="text-center">
            {code}
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </Button>
        <Button variant="secondary" onClick={download}>
          Download
        </Button>
      </div>
      <Button onClick={onDone}>Done</Button>
    </div>
  )
}
