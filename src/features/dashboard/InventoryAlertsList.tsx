import { Link } from 'react-router-dom'
import { APP_ROUTES } from '../../app/navigation'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import type { InventoryAlertItem } from '../../types'

export interface InventoryAlertsListProps {
  alerts: InventoryAlertItem[]
  organizationName: string
}

export function InventoryAlertsList({
  alerts,
  organizationName,
}: InventoryAlertsListProps) {
  return (
    <Card
      as="section"
      title="Alertas de inventario"
      subtitle={`Productos con existencia menor al mínimo en ${organizationName}`}
      headerAction={
        <Link to={APP_ROUTES.inventory} className="card-inline-link">
          Ir a Inventario
        </Link>
      }
    >
      {alerts.length === 0 ? (
        <EmptyState
          title="Sin alertas de stock bajo"
          description="Todos los productos cuentan con existencias por encima del mínimo configurado."
        />
      ) : (
        <ul className="data-list" aria-label="Lista de alertas de inventario">
          {alerts.map((alert) => (
            <li key={alert.id} className="data-list__item">
              <div className="data-list__main">
                <div className="data-list__row">
                  <span className="data-list__code">{alert.sku}</span>
                  <Badge
                    variant={
                      alert.severity === 'critical' ? 'danger' : 'warning'
                    }
                  >
                    {alert.severity === 'critical'
                      ? 'Stock crítico'
                      : 'Reabastecer pronto'}
                  </Badge>
                </div>
                <p className="data-list__title">{alert.productName}</p>
                <p className="data-list__sub">Categoría: {alert.category}</p>
              </div>
              <div className="data-list__side data-list__side--stock">
                <span className="data-list__stock-current">
                  Actual: <strong>{alert.currentStock}</strong> {alert.unit}
                </span>
                <span className="data-list__stock-min">
                  Mínimo: {alert.minStock} {alert.unit}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

