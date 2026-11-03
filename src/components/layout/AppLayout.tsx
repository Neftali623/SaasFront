import { useCallback, useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { getPanelRouteByPath } from '../../app/navigation'
import { Header } from './Header'
import { MainContent } from './MainContent'
import { Sidebar } from './Sidebar'

export function AppLayout() {
  const location = useLocation()
  const [openMenuPathname, setOpenMenuPathname] = useState<string | null>(null)
  const isMobileMenuOpen = openMenuPathname === location.pathname

  const menuTriggerRef = useRef<HTMLButtonElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const sidebarRef = useRef<HTMLElement | null>(null)

  const currentRoute = getPanelRouteByPath(location.pathname)
  const currentSectionTitle = currentRoute?.title ?? 'Panel de control'

  const closeMobileMenu = useCallback(() => {
    setOpenMenuPathname(null)
    menuTriggerRef.current?.focus()
  }, [])

  const toggleMobileMenu = useCallback(() => {
    setOpenMenuPathname((prev) =>
      prev === location.pathname ? null : location.pathname,
    )
  }, [location.pathname])

  useEffect(() => {
    if (!isMobileMenuOpen) {
      return
    }

    closeButtonRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeMobileMenu()
        return
      }

      if (event.key === 'Tab' && sidebarRef.current) {
        const focusableElements = sidebarRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), select:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )
        if (focusableElements.length === 0) {
          return
        }

        const firstElement = focusableElements[0]
        const lastElement = focusableElements[focusableElements.length - 1]

        if (event.shiftKey && document.activeElement === firstElement) {
          event.preventDefault()
          lastElement.focus()
        } else if (!event.shiftKey && document.activeElement === lastElement) {
          event.preventDefault()
          firstElement.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isMobileMenuOpen, closeMobileMenu])

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Saltar al contenido principal
      </a>

      <Sidebar
        isOpen={isMobileMenuOpen}
        onClose={() => setOpenMenuPathname(null)}
        closeButtonRef={closeButtonRef}
        sidebarRef={sidebarRef}
      />

      <div className="app-shell__content-area">
        <Header
          currentSectionTitle={currentSectionTitle}
          isMobileMenuOpen={isMobileMenuOpen}
          onToggleMobileMenu={toggleMobileMenu}
          menuTriggerRef={menuTriggerRef}
        />

        <MainContent>
          <Outlet />
        </MainContent>
      </div>
    </div>
  )
}

