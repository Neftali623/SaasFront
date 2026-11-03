export interface LoadingStateProps {
  title?: string
  description?: string
}

export function LoadingState({
  title = 'Cargando información...',
  description = 'Preparando los datos de la vista actual.',
}: LoadingStateProps) {
  return (
    <div
      className="ui-state-box ui-state-box--loading"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="ui-spinner" aria-hidden="true" />
      <h2 className="ui-state-box__title">{title}</h2>
      <p className="ui-state-box__description">{description}</p>
    </div>
  )
}

