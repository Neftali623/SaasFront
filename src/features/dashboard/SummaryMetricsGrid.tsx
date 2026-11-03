import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import type {
  CashRegisterStatus,
  DailySalesMetrics,
  OrganizationPreferences,
} from '../../types'
import {
  formatAmountByCurrency,
  formatDateByPreference,
  getTimezoneShortLabel,
} from '../settings/formatters'

export interface SummaryMetricsGridProps {
  metrics: DailySalesMetrics
  cashRegister: CashRegisterStatus
  preferences: OrganizationPreferences
}

export function SummaryMetricsGrid({
  metrics,
  cashRegister,
  preferences,
}: SummaryMetricsGridProps) {
  const totalSalesDisplay =
    metrics.totalSalesFormatted ||
    formatAmountByCurrency(metrics.totalSalesAmount, preferences.currency)
  const averageTicketDisplay =
    metrics.averageTicketFormatted ||
    formatAmountByCurrency(metrics.averageTicketAmount, preferences.currency)
  const currentCashDisplay =
    cashRegister.currentCashFormatted ||
    formatAmountByCurrency(cashRegister.currentCashAmount, preferences.currency)
  const openingBalanceDisplay =
    cashRegister.openingBalanceFormatted ||
    formatAmountByCurrency(
      cashRegister.openingBalanceAmount,
      preferences.currency,
    )
  const formattedCutoffDate = formatDateByPreference(
    metrics.referenceDateIso,
    preferences.dateFormat,
  )
  const timezoneLabel = getTimezoneShortLabel(preferences.timezone)

  return (
    <section
      className="metrics-grid"
      aria-label="Indicadores principales del día (datos de demostración)"
    >
      <Card as="article" accentTop className="metric-card">
        <div className="metric-card__top">
          <span className="metric-card__label">Ventas del día</span>
          <Badge variant="brand">
            {metrics.refundsAmount && metrics.refundsAmount > 0
              ? `Venta neta (${preferences.currency})`
              : `Hoy (${preferences.currency})`}
          </Badge>
        </div>
        <p className="metric-card__value">{totalSalesDisplay}</p>
        <p className="metric-card__meta">
          {metrics.refundsAmount && metrics.refundsAmount > 0 ? (
            <span>
              Brutas: <strong>{metrics.grossSalesFormatted}</strong> · Reembolsos:{' '}
              <strong className="text-warning">-{metrics.refundsFormatted}</strong>
            </span>
          ) : (
            <span>
              {formattedCutoffDate} · {metrics.cutoffTime24h} ({timezoneLabel})
            </span>
          )}
        </p>
      </Card>

      <Card as="article" accentTop className="metric-card">
        <div className="metric-card__top">
          <span className="metric-card__label">Número de ventas</span>
          <Badge variant="neutral">Tickets</Badge>
        </div>
        <p className="metric-card__value">{metrics.salesCount} ventas</p>
        <p className="metric-card__meta">
          Ticket promedio: <strong>{averageTicketDisplay}</strong>
        </p>
      </Card>

      <Card as="article" accentTop className="metric-card">
        <div className="metric-card__top">
          <span className="metric-card__label">Productos con stock bajo</span>
          <Badge variant={metrics.lowStockCount > 0 ? 'warning' : 'success'}>
            {metrics.lowStockCount > 0 ? 'Requiere atención' : 'Al día'}
          </Badge>
        </div>
        <p className="metric-card__value">
          {metrics.lowStockCount}{' '}
          {metrics.lowStockCount === 1 ? 'producto' : 'productos'}
        </p>
        <p className="metric-card__meta">
          Artículos por debajo del mínimo configurado
        </p>
      </Card>

      <Card as="article" accentTop className="metric-card">
        <div className="metric-card__top">
          <span className="metric-card__label">Estado de caja</span>
          <Badge
            variant={cashRegister.status === 'open' ? 'success' : 'neutral'}
          >
            {cashRegister.status === 'open' ? 'En operación' : 'Cerrada'}
          </Badge>
        </div>
        <p className="metric-card__value metric-card__value--status">
          {cashRegister.statusLabel}
        </p>
        <p className="metric-card__meta">
          {cashRegister.shiftName} · Efectivo:{' '}
          <strong>{currentCashDisplay}</strong> (Fondo: {openingBalanceDisplay})
        </p>
      </Card>
    </section>
  )
}
