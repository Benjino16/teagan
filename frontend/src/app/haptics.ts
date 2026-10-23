/*
 * A short tick on phones. Android has the Vibration API; iOS has none, but
 * toggling a native switch (`<input type="checkbox" switch>`, iOS 18+) through
 * its label plays the system haptic. Elsewhere nothing happens. Browsers only
 * allow either in response to a tap, so call it from a pointer or click handler.
 */

const VIBRATION_MS = 10

export function haptic(): void {
  if (typeof navigator.vibrate === 'function') {
    navigator.vibrate(VIBRATION_MS)
    return
  }
  const label = document.createElement('label')
  label.ariaHidden = 'true'
  label.style.display = 'none'
  const input = document.createElement('input')
  input.type = 'checkbox'
  input.setAttribute('switch', '')
  label.append(input)
  document.head.append(label)
  label.click()
  label.remove()
}
