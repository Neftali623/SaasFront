import type { RefObject } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { APP_ROUTES, PANEL_NAV_ITEMS } from '../../app/navigation'
import { OrganizationSwitcher } from '../../features/organizations/OrganizationSwitcher'
import { Badge } from '../ui/Badge'
import { BrandMark } from '../ui/BrandMark'
import { NavIcon } from '../ui/NavIcon'

export interface SidebarProps {
  isOpen: boolean
  onClose: () => void
  closeButtonRef: RefObject<HTMLButtonElement | null>
  sidebarRef: RefObject<HTMLElement | null>
}

export function Sidebar({
  isOpen,
  onClose,
  closeButtonRef,
  sidebarRef,
}: SidebarProps) {
  return (
    <>
      {isOpen ? (
        <div
          className="sidebar-backdrop"
          onClick={onClose}
          aria-hidden="true"
        />
      ) : null}

      <aside
        id="panel-sidebar"
        ref={sidebarRef}
        className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}
        aria-label="Menú lateral del sistema"
      >
        <div className="sidebar__top">
          <Link
            to={APP_ROUTES.summary}
            className="sidebar__brand-link"
            onClick={onClose}
          >
            <BrandMark variant="light" subtitle="Panel comercial" />
          </Link>

          <button
            ref={closeButtonRef}
            type="button"
            className="sidebar__close-btn"
            onClick={onClose}
            aria-label="Cerrar menú de navegación"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <div className="sidebar__org-box">
          <OrganizationSwitcher variant="sidebar" onSelectCallback={onClose} />
        </div>

        <nav className="sidebar__nav" aria-label="Secciones del panel">
          <p className="sidebar__nav-caption">Navegación del negocio</p>
          <ul className="sidebar__nav-list">
            {PANEL_NAV_ITEMS.map((item) => (
              <li key={item.id} className="sidebar__nav-item">
                <NavLink
                  to={item.path}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
                  }
                >
                  <span className="sidebar__link-main">
                    <NavIcon name={item.icon} size={18} />
                    <span className="sidebar__link-text">{item.title}</span>
                  </span>
                  {item.status === 'active-demo' ? (
                    <span className="sidebar__pill sidebar__pill--active">
                      Demo
                    </span>
                  ) : (
                    <span className="sidebar__pill">En prep.</span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="sidebar__footer" role="region" aria-label="Información del modo demostración">
          <div className="sidebar__demo-box">
            <div className="sidebar__demo-box-head">
              <Badge variant="demo">Modo demostración</Badge>
            </div>
            <p className="sidebar__demo-box-text">
              Datos ficticios en memoria. Sin conexión activa al backend ni base
              de datos.
            </p>
            <div className="sidebar__demo-box-links">
              <Link to={APP_ROUTES.planAndHelp} onClick={onClose}>
                Ayuda de la demo
              </Link>
              <span aria-hidden="true">·</span>
              <Link to={APP_ROUTES.login} onClick={onClose}>
                Portada inicial
              </Link>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}

