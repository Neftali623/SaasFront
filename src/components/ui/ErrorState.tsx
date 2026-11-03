import { Button } from './Button'

export interface ErrorStateProps {
  title?: string
  description: string
  onRetry?: () => void
  retryLabel?: string
}

export function ErrorState({
  title = 'No se pudo cargar la sección',
  description,
  onRetry,
  retryLabel = 'Reintentar',
}: ErrorStateProps) {
  return (
    <div className="ui-state-box ui-state-box--error" role="alert">
      <div className="ui-state-box__icon ui-state-box__icon--error" aria-hidden="true">
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
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4" />
          <path d="M12 16h.01" />
        </svg>
      </div>
      <h2 className="ui-state-box__title">{title}</h2>
      <p className="ui-state-box__description">{description}</p>
      {onRetry ? (
        <div className="ui-state-box__action">
          <Button variant="outline" size="sm" onClick={onRetry}>
            {retryLabel}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

