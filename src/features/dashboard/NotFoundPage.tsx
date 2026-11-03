import { useLocation, useNavigate } from 'react-router-dom'
import { APP_ROUTES } from '../../app/navigation'
import { Badge } from '../../components/ui/Badge'
import { BrandMark } from '../../components/ui/BrandMark'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'

export function NotFoundPage() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <div className="standalone-page">
      <header className="standalone-header">
        <div className="standalone-header__inner">
          <BrandMark variant="dark" subtitle="Navegación del sistema" />
          <Badge variant="demo">Error 404 · Ruta no encontrada</Badge>
        </div>
      </header>

      <main className="standalone-main">
        <div className="standalone-container standalone-container--narrow">
          <Card padding="lg">
            <EmptyState
              title="No encontramos la ruta solicitada"
              description={`La dirección "${location.pathname}" no corresponde a ninguna pantalla activa de Nedaxoli Control.`}
              action={
                <div className="pending-module-actions">
                  <Button
                    variant="primary"
                    onClick={() => navigate(APP_ROUTES.summary)}
                  >
                    Ir al Resumen del panel
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate(APP_ROUTES.login)}
                  >
                    Ir al inicio de la demo
                  </Button>
                </div>
              }
            />
          </Card>
        </div>
      </main>
    </div>
  )
}

