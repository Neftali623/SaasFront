import { useLocation, useNavigate } from 'react-router-dom'
import { APP_ROUTES, getPanelRouteByPath } from '../../app/navigation'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { NavIcon } from '../../components/ui/NavIcon'
import { PageHeader } from '../../components/ui/PageHeader'
import { useDemoOrganization } from '../organizations/DemoOrganizationContext'

export function PendingModulePage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { activeOrganization } = useDemoOrganization()

  const routeItem = getPanelRouteByPath(location.pathname)
  const moduleTitle = routeItem?.title ?? 'Módulo del sistema'
  const moduleDescription =
    routeItem?.shortDescription ??
    'Sección contemplada dentro de la arquitectura de Nedaxoli Control.'

  return (
    <div className="pending-module-page">
      <PageHeader
        title={moduleTitle}
        description={moduleDescription}
        badge={<Badge variant="warning">Módulo en preparación</Badge>}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(APP_ROUTES.summary)}
          >
            Volver a Resumen
          </Button>
        }
      />

      <Card padding="lg">
        <EmptyState
          icon={
            routeItem ? <NavIcon name={routeItem.icon} size={30} /> : undefined
          }
          title={`${moduleTitle} — Módulo en preparación`}
          description={`Esta sección forma parte del mapa de navegación de Nedaxoli Control para ${activeOrganization.name}. En esta primera entrega solo se incluye el módulo de Resumen con datos demostrativos; la funcionalidad operativa de "${moduleTitle}" se implementará e integrará con el backend en las siguientes fases.`}
          action={
            <div className="pending-module-actions">
              <Button
                variant="primary"
                onClick={() => navigate(APP_ROUTES.summary)}
              >
                Ir al Resumen de demostración
              </Button>
              <Button
                variant="secondary"
                onClick={() => navigate(APP_ROUTES.organizations)}
              >
                Cambiar organización activa
              </Button>
            </div>
          }
        />

        {routeItem && routeItem.plannedFeatures.length > 0 ? (
          <div className="pending-module-roadmap">
            <h3 className="pending-module-roadmap__title">
              Alcance previsto para las siguientes entregas de {moduleTitle}:
            </h3>
            <ul className="pending-module-roadmap__list">
              {routeItem.plannedFeatures.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>
    </div>
  )
}

