import { TextButton } from '../../components/ui'
import { useDemoLogin } from '../../data/queries'
import type { LoginInput } from '../../domain/model'

/**
 * A button that logs in as the demo account – only in a demo build with the
 * demo loaded, else nothing at all. The login itself runs like the form's.
 */
export function DemoLogin({ onLogin, disabled }: { onLogin: (input: LoginInput) => void; disabled: boolean }) {
  const demo = useDemoLogin()
  if (!demo.data) return null
  const input = demo.data

  return (
    <TextButton className="self-center" disabled={disabled} onClick={() => onLogin(input)}>
      Try the demo
    </TextButton>
  )
}
