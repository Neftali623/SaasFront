import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { APP_ROUTES } from '../../app/navigation'
import { Badge } from '../../components/ui/Badge'
import { BrandMark } from '../../components/ui/BrandMark'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { useDemoOrganization } from '../organizations/DemoOrganizationContext'

export function DemoLoginPage() {
  const navigate = useNavigate()
  const { demoUser, updateDemoOperatorName, activeOrganization } =
    useDemoOrganization()
  const [operatorInput, setOperatorInput] = useState(demoUser.name)
  const [inputError, setInputError] = useState<string | undefined>(undefined)

  const handleEnterDemo = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = operatorInput.trim()

    if (trimmed.length > 0 && trimmed.length < 3) {
      setInputError('Ingresa al menos 3 caracteres o deja el nombre por defecto.')
      return
    }

    setInputError(undefined)
    if (trimmed.length >= 3) {
      updateDemoOperatorName(trimmed)
    }
    navigate(APP_ROUTES.organizations)
  }

  return (
    <div className="login-page">
      <a href="#login-main" className="skip-link">
        Saltar al acceso de demostración
      </a>

      <main id="login-main" className="login-layout">
        <section className="login-brand-panel" aria-labelledby="login-brand-heading">
          <div className="login-brand-panel__top">
            <BrandMark variant="light" subtitle="Ventas, inventario, caja y tickets" />
            <Badge variant="accent">Entrega Fase 1 · Frontend</Badge>
          </div>

          <div className="login-brand-panel__hero">
            <h1 id="login-brand-heading" className="login-brand-panel__title">
              Control claro y ágil para el mostrador de tu negocio
            </h1>
            <p className="login-brand-panel__description">
              Nedaxoli Control centraliza el punto de venta, el inventario, los
              turnos de caja y la emisión de tickets para pequeños comercios,
              permitiendo que cada organización trabaje con su propia identidad
              visual.
            </p>

            <ul className="login-feature-list">
              <li>
                <strong>Multi-organización:</strong> colores e identidad visual
                adaptables por negocio.
              </li>
              <li>
                <strong>Operación diaria:</strong> indicadores de ventas del día,
                alertas de stock bajo y estado de caja.
              </li>
              <li>
                <strong>Diseño responsive:</strong> interfaz accesible para
                escritorio, tableta y móvil.
              </li>
            </ul>
          </div>

          <div className="login-brand-panel__footer">
            <span>Equipo Nedaxoli: Neftali (Frontend) · Edwin (Backend) · Haniel (BD)</span>
          </div>
        </section>

        <section className="login-form-panel" aria-labelledby="login-card-heading">
          <Card padding="lg" className="login-card">
            <div className="login-card__header">
              <Badge variant="demo">Modo demostración · Sin autenticación real</Badge>
              <h2 id="login-card-heading" className="login-card__title">
                Acceso a la demostración
              </h2>
              <p className="login-card__subtitle">
                Esta versión presenta la estructura visual y de navegación del
                panel. Aún no existe conexión con el backend ni validación de
                credenciales.
              </p>
            </div>

            <div className="login-demo-notice" role="note">
              <p>
                <strong>Nota de seguridad:</strong> En esta entrega no se
                solicitan contraseñas reales ni se almacenan tokens o sesiones en
                el navegador. La autenticación y protección real de rutas se
                integrarán con el backend en la siguiente fase.
              </p>
            </div>

            <form onSubmit={handleEnterDemo} className="login-form" noValidate>
              <Input
                label="Nombre del operador en la vista previa"
                value={operatorInput}
                onChange={(event) => {
                  setOperatorInput(event.target.value)
                  if (inputError) {
                    setInputError(undefined)
                  }
                }}
                placeholder="Ej. Operador de Demostración"
                helpText="Dato opcional en memoria para personalizar el encabezado durante la prueba."
                error={inputError}
                maxLength={50}
              />

              <div className="login-form__org-preview">
                <span className="login-form__org-preview-label">
                  Negocio preseleccionado en memoria:
                </span>
                <span className="login-form__org-preview-value">
                  <span
                    className="color-swatch__dot"
                    style={{ backgroundColor: activeOrganization.primaryColor }}
                    aria-hidden="true"
                  />
                  {activeOrganization.name}
                </span>
              </div>

              <div className="login-form__actions">
                <Button type="submit" variant="primary" size="lg" fullWidth>
                  Entrar a la demostración
                </Button>
              </div>
            </form>

            <div className="login-card__quick-links">
              <span>Rutas públicas de esta entrega:</span>
              <div className="login-card__quick-links-row">
                <Link to={APP_ROUTES.organizations}>Selector de organización</Link>
                <span aria-hidden="true">·</span>
                <Link to={APP_ROUTES.summary}>Ir directo al Resumen</Link>
              </div>
            </div>
          </Card>
        </section>
      </main>
    </div>
  )
}

