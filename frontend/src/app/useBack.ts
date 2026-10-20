import { useLocation, useNavigate } from 'react-router'

/** Back in history – or to `fallback` if the page was opened directly. */
export function useBack(fallback: string): () => void {
  const navigate = useNavigate()
  const location = useLocation()
  return () => {
    if (location.key === 'default') navigate(fallback)
    else navigate(-1)
  }
}
