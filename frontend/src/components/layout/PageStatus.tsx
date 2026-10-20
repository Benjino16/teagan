import { Link } from 'react-router'

/** Calm loading or error state of a whole page. */
export function PageLoading() {
  return (
    <p role="status" className="px-5 pt-24 text-center text-md text-muted">
      Loading …
    </p>
  )
}

export function PageError({ message, backTo = '/' }: { message: string; backTo?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 px-5 pt-24 text-center">
      <p className="text-base text-ink-2">{message}</p>
      <Link to={backTo} className="text-md font-semibold">
        Back
      </Link>
    </div>
  )
}
