import type { HTMLAttributes, ReactNode } from 'react'

export interface CardProps extends HTMLAttributes<HTMLElement> {
  title?: string
  subtitle?: string
  headerAction?: ReactNode
  accentTop?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
  as?: 'section' | 'article' | 'div'
  children: ReactNode
}

export function Card({
  title,
  subtitle,
  headerAction,
  accentTop = false,
  padding = 'md',
  as: Component = 'div',
  className = '',
  children,
  ...rest
}: CardProps) {
  const classes = [
    'ui-card',
    `ui-card--pad-${padding}`,
    accentTop ? 'ui-card--accent-top' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <Component className={classes} {...rest}>
      {title || subtitle || headerAction ? (
        <div className="ui-card__header">
          <div className="ui-card__header-titles">
            {title ? <h2 className="ui-card__title">{title}</h2> : null}
            {subtitle ? <p className="ui-card__subtitle">{subtitle}</p> : null}
          </div>
          {headerAction ? <div className="ui-card__header-action">{headerAction}</div> : null}
        </div>
      ) : null}
      <div className="ui-card__body">{children}</div>
    </Component>
  )
}

