import type { RefObject } from 'react'
import { Link } from 'react-router-dom'
import { APP_ROUTES } from '../../app/navigation'
import { useDemoOrganization } from '../../features/organizations/DemoOrganizationContext'
import { OrganizationSwitcher } from '../../features/organizations/OrganizationSwitcher'
import { Badge } from '../ui/Badge'

export interface HeaderProps {
  currentSectionTitle: string
  isMobileMenuOpen: boolean
  onToggleMobileMenu: () => void
  menuTriggerRef: RefObject<HTMLButtonElement | null>
}

export function Header({
  currentSectionTitle,
  isMobileMenuOpen,
  onToggleMobileMenu,
  menuTriggerRef,
}: HeaderProps) {
  const { activeOrganization, demoUser } = useDemoOrganization()

  return (
    <header className="panel-header">
      <div className="panel-header__left">
        <button
          ref={menuTriggerRef}
          type="button"
          className="panel-header__menu-btn"
          onClick={onToggleMobileMenu}
          aria-expanded={isMobileMenuOpen}
          aria-controls="panel-sidebar"
          aria-label={
            isMobileMenuOpen
              ? 'Cerrar menú de navegación'
              : 'Abrir menú de navegación'
          }
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 6h16" />
            <path d="M4 12h16" />
            <path d="M4 18h16" />
          </svg>
          <span className="panel-header__menu-btn-text">Menú</span>
        </button>

        <div className="panel-header__title-group">
          <div className="panel-header__section-row">
            <span className="panel-header__section-title">
              {currentSectionTitle}
            </span>
            <Badge variant="brand">{activeOrganization.name}</Badge>
          </div>
          <span className="panel-header__org-subtitle">
            {activeOrganization.branchName} · Moneda:{' '}
            {activeOrganization.preferences.currency} · ID:{' '}
            {activeOrganization.id}
          </span>
        </div>
      </div>

      <div className="panel-header__right">
        <OrganizationSwitcher variant="header" />

        <div
          className="panel-header__user"
          aria-label="Usuario de demostración activo"
        >
          <div className="panel-header__user-avatar" aria-hidden="true">
            {demoUser.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="panel-header__user-info">
            <span className="panel-header__user-name">{demoUser.name}</span>
            <span className="panel-header__user-role">{demoUser.role}</span>
          </div>
        </div>

        <Link to={APP_ROUTES.login} className="panel-header__demo-home-link">
          Inicio de la demo
        </Link>
      </div>
    </header>
  )
}
