import { useNavigate } from 'react-router-dom'
import { APP_ROUTES } from '../../app/navigation'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { NavIcon } from '../../components/ui/NavIcon'

export function QuickActionsPanel() {
  const navigate = useNavigate()

  return (
    <Card
      as="section"
      title="Accesos directos de operación"
      subtitle="Navega directamente a los módulos operativos principales del negocio"
    >
      <div className="quick-actions-grid">
        <div className="quick-action-item">
          <div className="quick-action-item__head">
            <span className="quick-action-item__icon" aria-hidden="true">
              <NavIcon name="pos" size={20} />
            </span>
            <div>
              <h3 className="quick-action-item__title">Punto de venta</h3>
              <p className="quick-action-item__desc">
                Cobro en mostrador y emisión de tickets.
              </p>
            </div>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate(APP_ROUTES.pos)}
          >
            Abrir Punto de venta
          </Button>
        </div>

        <div className="quick-action-item">
          <div className="quick-action-item__head">
            <span className="quick-action-item__icon" aria-hidden="true">
              <NavIcon name="products" size={20} />
            </span>
            <div>
              <h3 className="quick-action-item__title">Productos</h3>
              <p className="quick-action-item__desc">
                Catálogo de precios, categorías y códigos SKU.
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate(APP_ROUTES.products)}
          >
            Ir a Productos
          </Button>
        </div>

        <div className="quick-action-item">
          <div className="quick-action-item__head">
            <span className="quick-action-item__icon" aria-hidden="true">
              <NavIcon name="inventory" size={20} />
            </span>
            <div>
              <h3 className="quick-action-item__title">Inventario</h3>
              <p className="quick-action-item__desc">
                Existencias, entradas, salidas, conteo físico y kardex.
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate(APP_ROUTES.inventory)}
          >
            Ir a Inventario
          </Button>
        </div>

        <div className="quick-action-item">
          <div className="quick-action-item__head">
            <span className="quick-action-item__icon" aria-hidden="true">
              <NavIcon name="cash" size={20} />
            </span>
            <div>
              <h3 className="quick-action-item__title">Caja</h3>
              <p className="quick-action-item__desc">
                Control de turno, fondo fijo y arqueo de efectivo.
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate(APP_ROUTES.cash)}
          >
            Ir a Caja
          </Button>
        </div>

        <div className="quick-action-item">
          <div className="quick-action-item__head">
            <span className="quick-action-item__icon" aria-hidden="true">
              <NavIcon name="expenses" size={20} />
            </span>
            <div>
              <h3 className="quick-action-item__title">Gastos</h3>
              <p className="quick-action-item__desc">
                Egresos clasificados, comprobantes y salidas de caja.
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate(APP_ROUTES.expenses)}
          >
            Ir a Gastos
          </Button>
        </div>

        <div className="quick-action-item">
          <div className="quick-action-item__head">
            <span className="quick-action-item__icon" aria-hidden="true">
              <NavIcon name="reports" size={20} />
            </span>
            <div>
              <h3 className="quick-action-item__title">Reportes</h3>
              <p className="quick-action-item__desc">
                Cortes de venta, productos, gastos y exportación CSV.
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate(APP_ROUTES.reports)}
          >
            Ir a Reportes
          </Button>
        </div>
      </div>
    </Card>
  )
}

