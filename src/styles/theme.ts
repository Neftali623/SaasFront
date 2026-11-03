import type { OrganizationTheme } from '../types'

export const NEDAXOLI_BASE_THEME: OrganizationTheme = {
  primaryColor: '#8745E8',
  primaryHoverColor: '#6F32CC',
  primarySoftColor: '#EBDDFB',
  accentColor: '#13C8EE',
  accentSoftColor: '#E0F9FE',
}

/**
 * Aplica los colores de una organización mediante propiedades personalizadas CSS
 * a partir de un objeto de configuración tipado.
 */
export function applyOrganizationTheme(theme: OrganizationTheme = NEDAXOLI_BASE_THEME): void {
  if (typeof document === 'undefined') {
    return
  }

  const root = document.documentElement
  root.style.setProperty('--color-org-primary', theme.primaryColor)
  root.style.setProperty('--color-org-primary-hover', theme.primaryHoverColor)
  root.style.setProperty('--color-org-primary-soft', theme.primarySoftColor)
  root.style.setProperty('--color-org-accent', theme.accentColor)
  root.style.setProperty('--color-org-accent-soft', theme.accentSoftColor)
}

