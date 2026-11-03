import type { ReactNode } from 'react'

export interface EmptyStateProps {
  title: string
  description: string
  icon?: ReactNode
  action?: ReactNode
}

export function EmptyState({
  title,
  description,
  icon,
  action,
}: EmptyStateProps) {
  return (
    <div className="ui-state-box ui-state-box--empty" role="status">
      <div className="ui-state-box__icon" aria-hidden="true">
        {icon ?? (
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M3 10h18" />
            <path d="M8 15h8" />
          </svg>
        )}
      </div>
      <h2 className="ui-state-box__title">{title}</h2>
      <p className="ui-state-box__description">{description}</p>
      {action ? <div className="ui-state-box__action">{action}</div> : null}
    </div>
  )
}

