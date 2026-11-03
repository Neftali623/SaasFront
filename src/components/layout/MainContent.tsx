import type { ReactNode } from 'react'

export interface MainContentProps {
  children: ReactNode
}

export function MainContent({ children }: MainContentProps) {
  return (
    <main id="main-content" className="panel-main" tabIndex={-1}>
      <div className="panel-main__container">{children}</div>
    </main>
  )
}

