import type { ReactNode } from 'react'

export interface PageHeaderProps {
  title: string
  description?: string
  badge?: ReactNode
  actions?: ReactNode
}

export function PageHeader({
  title,
  description,
  badge,
  actions,
}: PageHeaderProps) {
  return (
    <div className="ui-page-header">
      <div className="ui-page-header__main">
        <div className="ui-page-header__title-row">
          <h1 className="ui-page-header__title">{title}</h1>
          {badge ? <div className="ui-page-header__badge">{badge}</div> : null}
        </div>
        {description ? (
          <p className="ui-page-header__description">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="ui-page-header__actions">{actions}</div> : null}
    </div>
  )
}

