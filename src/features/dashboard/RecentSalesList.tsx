import { Link } from 'react-router-dom'
import { APP_ROUTES } from '../../app/navigation'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import type { OrganizationPreferences, RecentSaleItem } from '../../types'
import {
  formatAmountByCurrency,
  formatDateByPreference,
} from '../settings/formatters'

export interface RecentSalesListProps {
  sales: RecentSaleItem[]
  organizationName: string
  preferences: OrganizationPreferences
}

export function RecentSalesList({
  sales,
  organizationName,
  preferences,
}: RecentSalesListProps) {
  return (
    <Card
      as="section"
      title="Ventas recientes"
      subtitle={`Últimos tickets registrados en memoria para ${organizationName} (${preferences.currency} · sin conversión de divisa)`}
      headerAction={
        <Link to={APP_ROUTES.sales} className="card-inline-link">
          Ir a Ventas
        </Link>
      }
    >
      {sales.length === 0 ? (
        <EmptyState
          title="Sin ventas registradas todavía"
          description="Cuando completes un cobro en el Punto de Venta, las ventas recientes aparecerán listadas aquí."
        />
      ) : (
        <ul className="data-list" aria-label="Lista de ventas recientes">
          {sales.map((sale) => (
            <li key={sale.id} className="data-list__item">
              <div className="data-list__main">
                <div className="data-list__row">
                  <span className="data-list__code">{sale.ticketNumber}</span>
                  <span className="data-list__time">
                    {formatDateByPreference(
                      sale.saleDateIso,
                      preferences.dateFormat,
                    )}{' '}
                    · {sale.time}
                  </span>
                  <Badge variant="neutral">{sale.paymentMethod}</Badge>
                  {sale.statusLabel ? (
                    <Badge variant={sale.statusBadgeVariant ?? 'neutral'}>
                      {sale.statusLabel}
                    </Badge>
                  ) : null}
                </div>
                <p className="data-list__title">{sale.itemsSummary}</p>
                <p className="data-list__sub">
                  {sale.itemsCount}{' '}
                  {sale.itemsCount === 1 ? 'artículo' : 'artículos'} · Atendió:{' '}
                  {sale.cashierName}
                </p>
              </div>
              <div className="data-list__side">
                {sale.netFormatted && sale.netFormatted !== sale.totalFormatted ? (
                  <div className="data-list__amount-group">
                    <span className="data-list__amount data-list__amount--net">
                      {sale.netFormatted}
                    </span>
                    <small className="text-muted line-through">
                      Orig: {sale.totalFormatted}
                    </small>
                  </div>
                ) : (
                  <span className="data-list__amount">
                    {sale.totalFormatted ||
                      formatAmountByCurrency(
                        sale.totalAmount,
                        preferences.currency,
                      )}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
