import { type RefCallback, useCallback, useState } from 'react'

/** Height of the sticky top bar – whatever disappears beneath it counts as no longer visible. */
export const TOP_BAR_HEIGHT = 48

/**
 * Observes whether an element is (still) visible below the top bar.
 * Used to show the page title in the top bar once the large heading has
 * scrolled away.
 */
export function useInView<T extends Element>(): [RefCallback<T>, boolean] {
  const [inView, setInView] = useState(true)

  const ref = useCallback<RefCallback<T>>((node) => {
    if (!node) return
    const observer = new IntersectionObserver(([entry]) => setInView(entry!.isIntersecting), {
      rootMargin: `-${TOP_BAR_HEIGHT}px 0px 0px 0px`,
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return [ref, inView]
}
