import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import type { OrganizationPreferences } from '../../../types'
import { formatCentsWithHistoricalCurrency } from '../../cash/utils/moneyUtils'
import { formatDateTimeInOrganizationTimezone } from '../../inventory/utils/quantityUtils'
import type { SalesReportSummary } from '../types'
import {
  buildCsvContent,
  sanitizeCodeCell,
  triggerCsvDownload,
} from '../utils/csvExport'

export interface SalesReportViewProps {
  summary: SalesReportSummary
  organizationName: string
  branchName: string
  operatorName: string
  preferences: OrganizationPreferences
}

export function SalesReportView({
  summary,
  organizationName,
  branchName,
  operatorName,
  preferences,
}: SalesReportViewProps) {
  const handleExportCsv = () => {
    const headers = [
      'Folio',
      'Fecha y Hora',
      'Operador',
      'Caja',
      'Partidas',
      'Total Bruto',
      'Reembolsos',
      'Total Neto',
      'Método de Pago',
      'Estado',
    ]

    const rows = summary.sales.map((s) => [
      sanitizeCodeCell(s.folio),
      formatDateTimeInOrganizationTimezone(
        s.createdAt,
        preferences.timezone,
        preferences.dateFormat,
      ).fullLabel,
      s.operatorName,
      s.registerName,
      s.itemsCount,
      (s.totalCents / 100).toFixed(2),
      (s.refundedTotalCents / 100).toFixed(2),
      (s.netTotalCents / 100).toFixed(2),
      s.payment.method,
      s.status,
    ])

    const summaryRows = [
      ['Total ventas registradas:', summary.salesCount],
      ['Total bruto acumulado:', (summary.grossTotalCents / 100).toFixed(2)],
      ['Total reembolsos:', (summary.refundedTotalCents / 100).toFixed(2)],
      ['Total neto acumulado:', (summary.netTotalCents / 100).toFixed(2)],
    ]

    const csv = buildCsvContent({
      title: 'Reporte Operativo de Ventas y Cobranza',
      organizationName,
      branchName,
      periodLabel: `${summary.dateFrom} al ${summary.dateTo}`,
      currency: summary.currency,
      operatorName,
      generatedAt: new Date().toISOString(),
      headers,
      rows,
      summaryRows,
    })

    const cleanDate = summary.dateTo.replace(/-/g, '')
    triggerCsvDownload(`reporte_ventas_${cleanDate}.csv`, csv)
  }

  return (
    <div className="report-view-container">
      {/* Barra de acciones de exportación */}
      <div className="report-view__toolbar">
        <div>
          <h2 className="report-view__title">Resumen de ventas y cobranza</h2>
          <p className="report-view__subtitle">
            Período: {summary.dateFrom} al {summary.dateTo} &middot;{' '}
            {summary.salesCount} ventas en el rango
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={handleExportCsv}
          disabled={summary.sales.length === 0}
        >
          📥 Exportar ventas a CSV
        </Button>
      </div>

      {/* KPI cards de ventas */}
      <div className="stats-grid stats-grid--4">
        <Card className="kpi-card">
          <span className="kpi-card__label">Venta neta acumulada</span>
          <strong className="kpi-card__value text-primary">
            {formatCentsWithHistoricalCurrency(
              summary.netTotalCents,
              summary.currency,
            )}
          </strong>
          <span className="kpi-card__subtext">
            {summary.salesCount} ticket(s) procesados
          </span>
        </Card>

        <Card className="kpi-card">
          <span className="kpi-card__label">Cobrado bruto</span>
          <strong className="kpi-card__value">
            {formatCentsWithHistoricalCurrency(
              summary.grossTotalCents,
              summary.currency,
            )}
          </strong>
          <span className="kpi-card__subtext">Importe inicial cobrado</span>
        </Card>

        <Card className="kpi-card">
          <span className="kpi-card__label">Devoluciones y cancelaciones</span>
          <strong className="kpi-card__value text-warning">
            {formatCentsWithHistoricalCurrency(
              summary.refundedTotalCents,
              summary.currency,
            )}
          </strong>
          <span className="kpi-card__subtext">Reembolsos a clientes</span>
        </Card>

        <Card className="kpi-card">
          <span className="kpi-card__label">Cobrado en efectivo</span>
          <strong className="kpi-card__value">
            {formatCentsWithHistoricalCurrency(
              summary.byPaymentMethod.find((m) => m.method === 'cash')?.netCents ??
                0,
              summary.currency,
            )}
          </strong>
          <span className="kpi-card__subtext">Efectivo neto sumado a caja</span>
        </Card>
      </div>

      {/* Tarjetas de desglose por método y estado */}
      <div className="report-breakdowns-grid">
        <Card className="report-breakdown-card">
          <h3 className="report-breakdown-card__title">
            Cobranza por método de pago
          </h3>
          <div className="report-breakdown-list">
            {summary.byPaymentMethod.map((item) => (
              <div key={item.method} className="report-breakdown-item">
                <div>
                  <strong className="report-breakdown-item__name">
                    {item.label}
                  </strong>
                  <span className="report-breakdown-item__count">
                    {item.salesCount} venta(s)
                  </span>
                </div>
                <div className="report-breakdown-item__values">
                  <span className="report-breakdown-item__net">
                    {formatCentsWithHistoricalCurrency(
                      item.netCents,
                      summary.currency,
                    )}
                  </span>
                  {item.refundedCents > 0 && (
                    <small className="text-muted">
                      (Reembolsado:{' '}
                      {formatCentsWithHistoricalCurrency(
                        item.refundedCents,
                        summary.currency,
                      )}
                      )
                    </small>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="report-breakdown-card">
          <h3 className="report-breakdown-card__title">
            Transacciones por estado
          </h3>
          <div className="report-breakdown-list">
            {summary.byStatus.map((st) => (
              <div key={st.status} className="report-breakdown-item">
                <div>
                  <strong className="report-breakdown-item__name">{st.label}</strong>
                  <span className="report-breakdown-item__count">
                    {st.count} registro(s)
                  </span>
                </div>
                <div className="report-breakdown-item__values">
                  <span className="report-breakdown-item__net">
                    {formatCentsWithHistoricalCurrency(
                      st.netCents,
                      summary.currency,
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Tabla detallada de ventas */}
      <Card className="report-table-card">
        <h3 className="report-table-card__title">
          Listado de operaciones en el período
        </h3>
        <div className="ui-table-responsive-wrapper">
          <table className="ui-table">
            <thead>
              <tr>
                <th>Folio</th>
                <th>Fecha y Hora</th>
                <th>Caja / Operador</th>
                <th>Partidas</th>
                <th className="ui-table__cell--numeric">Total Bruto</th>
                <th className="ui-table__cell--numeric">Reembolsos</th>
                <th className="ui-table__cell--numeric">Total Neto</th>
                <th>Método</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {summary.sales.length === 0 ? (
                <tr>
                  <td colSpan={9} className="ui-table__empty-cell">
                    No hay ventas registradas en el período seleccionado.
                  </td>
                </tr>
              ) : (
                summary.sales.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.folio}</strong>
                    </td>
                    <td>
                      <small>
                        {
                          formatDateTimeInOrganizationTimezone(
                            s.createdAt,
                            preferences.timezone,
                            preferences.dateFormat,
                          ).fullLabel
                        }
                      </small>
                    </td>
                    <td>
                      <div>
                        <strong>{s.registerName}</strong>
                        <br />
                        <small className="text-muted">{s.operatorName}</small>
                      </div>
                    </td>
                    <td>{s.itemsCount}</td>
                    <td className="ui-table__cell--numeric">
                      {formatCentsWithHistoricalCurrency(
                        s.totalCents,
                        s.currency,
                      )}
                    </td>
                    <td className="ui-table__cell--numeric text-muted">
                      {formatCentsWithHistoricalCurrency(
                        s.refundedTotalCents,
                        s.currency,
                      )}
                    </td>
                    <td className="ui-table__cell--numeric">
                      <strong>
                        {formatCentsWithHistoricalCurrency(
                          s.netTotalCents,
                          s.currency,
                        )}
                      </strong>
                    </td>
                    <td>
                      <Badge
                        variant={s.payment.method === 'cash' ? 'warning' : 'neutral'}
                      >
                        {s.payment.method === 'cash'
                          ? 'Efectivo'
                          : s.payment.method === 'card'
                            ? 'Tarjeta'
                            : 'Transferencia'}
                      </Badge>
                    </td>
                    <td>
                      <Badge
                        variant={
                          s.status === 'cancelled'
                            ? 'danger'
                            : s.status === 'fully_refunded'
                              ? 'neutral'
                              : 'success'
                        }
                      >
                        {s.status === 'completed'
                          ? 'Completada'
                          : s.status === 'partially_refunded'
                            ? 'Parcial'
                            : s.status === 'fully_refunded'
                              ? 'Reembolsada'
                              : 'Cancelada'}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
