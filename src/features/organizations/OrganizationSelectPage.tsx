import { Link, useNavigate } from 'react-router-dom'
import { APP_ROUTES } from '../../app/navigation'
import { Badge } from '../../components/ui/Badge'
import { BrandMark } from '../../components/ui/BrandMark'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { DASHBOARD_MOCK_BY_ORG } from '../../mocks/dashboardData'
import {
  formatAmountByCurrency,
  getTimezoneShortLabel,
} from '../settings/formatters'
import { useDemoOrganization } from './DemoOrganizationContext'
import { OrganizationAvatar } from './OrganizationAvatar'

export function OrganizationSelectPage() {
  const navigate = useNavigate()
  const {
    organizations,
    activeOrganization,
    forceSelectOrganization,
    demoUser,
  } = useDemoOrganization()

  const handleChooseOrganization = (organizationId: string) => {
    forceSelectOrganization(organizationId)
    navigate(APP_ROUTES.summary)
  }

  return (
    <div className="standalone-page">
      <a href="#org-select-main" className="skip-link">
        Saltar a la selección de organización
      </a>

      <header className="standalone-header">
        <div className="standalone-header__inner">
          <BrandMark variant="dark" subtitle="Modo demostración — Configuración y panel" />
          <div className="standalone-header__actions">
            <Badge variant="demo">Datos ficticios en memoria / localStorage</Badge>
            <Link to={APP_ROUTES.login} className="standalone-link">
              Volver a portada de acceso
            </Link>
          </div>
        </div>
      </header>

      <main id="org-select-main" className="standalone-main">
        <div className="standalone-container">
          <div className="org-select-intro">
            <Badge variant="brand">Paso 2 de 2 · Contexto de negocio</Badge>
            <h1 className="org-select-intro__title">
              Selecciona una organización de demostración
            </h1>
            <p className="org-select-intro__subtitle">
              Hola, <strong>{demoUser.name}</strong>. Elige uno de los dos
              negocios de ejemplo para explorar cómo Nedaxoli Control adapta su
              identidad visual (logo, colores e iniciales), sus preferencias de
              formato y sus datos operativos.
            </p>
          </div>

          <div
            className="demo-warning-banner"
            role="note"
            aria-label="Aviso sobre alcance de seguridad en demostración"
          >
            <div className="demo-warning-banner__title">
              Limitación de la demostración (sin aislamiento de seguridad real)
            </div>
            <p className="demo-warning-banner__text">
              El cambio de organización actualiza el tema visual y filtra los
              datos de ejemplo en el navegador. Esta separación es únicamente
              demostrativa y <strong>no equivale a aislamiento multi-tenant real</strong>.
              La validación de permisos y separación de datos por organización se
              aplicará en el backend (Edwin) y la base de datos (Haniel).
            </p>
          </div>

          <div className="org-cards-grid">
            {organizations.map((org) => {
              const isSelected = org.id === activeOrganization.id
              const orgMetrics = DASHBOARD_MOCK_BY_ORG[org.id]?.metrics
              const formattedSales = orgMetrics
                ? formatAmountByCurrency(
                    orgMetrics.totalSalesAmount,
                    org.preferences.currency,
                  )
                : '—'

              return (
                <Card
                  key={org.id}
                  as="article"
                  padding="lg"
                  className={`org-choice-card ${isSelected ? 'org-choice-card--active' : ''}`}
                  style={{
                    borderTop: `4px solid ${org.primaryColor}`,
                  }}
                >
                  <div className="org-choice-card__top">
                    <OrganizationAvatar organization={org} size="lg" />
                    <div className="org-choice-card__heading">
                      <div className="org-choice-card__badges">
                        <span className="org-choice-card__id">ID: {org.id}</span>
                        {isSelected ? (
                          <Badge variant="brand">Seleccionada actualmente</Badge>
                        ) : null}
                        {org.updatedAt ? (
                          <Badge variant="neutral">Personalizada en demo</Badge>
                        ) : null}
                      </div>
                      <h2 className="org-choice-card__name">{org.name}</h2>
                      <p className="org-choice-card__category">{org.category}</p>
                    </div>
                  </div>

                  <dl className="org-choice-card__details">
                    <div className="org-choice-card__detail-item">
                      <dt>Sucursal / Contacto</dt>
                      <dd>
                        {org.branchName}
                        {org.businessProfile.phone
                          ? ` · ${org.businessProfile.phone}`
                          : ''}
                      </dd>
                    </div>
                    <div className="org-choice-card__detail-item">
                      <dt>Ventas del día (mock)</dt>
                      <dd>{formattedSales}</dd>
                    </div>
                    <div className="org-choice-card__detail-item">
                      <dt>Preferencias de vista</dt>
                      <dd>
                        {org.preferences.currency} · {org.preferences.dateFormat} ·{' '}
                        {getTimezoneShortLabel(org.preferences.timezone)}
                      </dd>
                    </div>
                    <div className="org-choice-card__detail-item">
                      <dt>Identidad de color</dt>
                      <dd className="org-choice-card__swatches">
                        <span className="color-swatch">
                          <span
                            className="color-swatch__dot"
                            style={{ backgroundColor: org.primaryColor }}
                            aria-hidden="true"
                          />
                          Principal <code>{org.primaryColor}</code>
                        </span>
                        <span className="color-swatch">
                          <span
                            className="color-swatch__dot"
                            style={{ backgroundColor: org.accentColor }}
                            aria-hidden="true"
                          />
                          Acento <code>{org.accentColor}</code>
                        </span>
                      </dd>
                    </div>
                  </dl>

                  <div className="org-choice-card__footer">
                    <Button
                      variant="primary"
                      fullWidth
                      onClick={() => handleChooseOrganization(org.id)}
                      style={{
                        backgroundColor: org.primaryColor,
                        borderColor: org.primaryColor,
                      }}
                    >
                      Abrir panel de {org.name}
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}
