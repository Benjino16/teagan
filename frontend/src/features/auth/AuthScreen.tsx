import type { ReactNode } from 'react'

/** Centered frame of the screens before the app: login and setup. */
export function AuthScreen({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-app flex-col justify-center bg-canvas px-5 py-12">
      <div className="mb-8 flex flex-col gap-2 text-center">
        <h1 className="font-display text-3xl leading-tight font-bold tracking-tight">{title}</h1>
        {intro && <p className="text-md text-muted">{intro}</p>}
      </div>
      {children}
    </main>
  )
}
