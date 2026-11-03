import { useId } from 'react'
import { Link } from 'react-router-dom'
import { APP_ROUTES } from '../../app/navigation'
import { useDemoOrganization } from './DemoOrganizationContext'
import { OrganizationAvatar } from './OrganizationAvatar'

export interface OrganizationSwitcherProps {
  variant?: 'sidebar' | 'header'
  onSelectCallback?: () => void
}

export function OrganizationSwitcher({
  variant = 'header',
  onSelectCallback,
}: OrganizationSwitcherProps) {
  const selectId = useId()
  const { organizations, activeOrganization, selectOrganization } =
    useDemoOrganization()

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const didSwitch = selectOrganization(event.target.value)
    if (didSwitch) {
      onSelectCallback?.()
    }
  }

  return (
    <div className={`org-switcher org-switcher--${variant}`}>
      <OrganizationAvatar organization={activeOrganization} size="sm" />

      <div className="org-switcher__body">
        <label htmlFor={selectId} className="org-switcher__label">
          Organización activa (Demo)
        </label>
        <div className="org-switcher__select-wrap">
          <select
            id={selectId}
            className="org-switcher__select"
            value={activeOrganization.id}
            onChange={handleChange}
            aria-label="Cambiar organización de demostración"
          >
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name} ({org.initials})
              </option>
            ))}
          </select>
        </div>
        {variant === 'sidebar' ? (
          <div className="org-switcher__meta">
            <span className="org-switcher__branch">
              {activeOrganization.branchName}
            </span>
            <Link
              to={APP_ROUTES.organizations}
              className="org-switcher__link"
              onClick={onSelectCallback}
            >
              Comparar negocios
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  )
}
