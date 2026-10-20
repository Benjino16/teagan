import type { ReactNode } from 'react'

/** Calm hint when a list is empty – without nudging towards completeness. */
export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-card border border-dashed border-line px-4 py-6 text-center text-md text-muted">{children}</p>
}
