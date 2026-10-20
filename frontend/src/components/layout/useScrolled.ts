import { useEffect, useState } from 'react'
import { useScrollRoot } from './useScrollRoot'

/** `true` once the page – the window or its `ScrollColumn` – has been scrolled a bit. */
export function useScrolled(threshold = 4): boolean {
  const root = useScrollRoot()
  const [scrolled, setScrolled] = useState(() => typeof window !== 'undefined' && window.scrollY > threshold)

  useEffect(() => {
    const target = root ?? window
    const update = () => setScrolled((root ? root.scrollTop : window.scrollY) > threshold)
    update()
    target.addEventListener('scroll', update, { passive: true })
    return () => target.removeEventListener('scroll', update)
  }, [root, threshold])

  return scrolled
}
