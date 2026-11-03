import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import type { OrganizationPreferences } from '../../../types'
import { formatCentsWithHistoricalCurrency } from '../../cash/utils/moneyUtils'
import { formatDateTimeInOrganizationTimezone } from '../../inventory/utils/quantityUtils'
import type { ExpensesReportSummary } from '../types'
import {
  buildCsvContent,
  sanitizeCodeCell,
  triggerCsvDownload,
} from '../utils/csvExport'

export interface ExpensesReportViewProps {
  summary: ExpensesReportSummary
  organizationName: string
  branchName: string
  operatorName: string
  preferences: OrganizationPreferences
}

export function ExpensesReportView({
  summary,
  organizationName,
  branchName,
  operatorName,
  preferences,
}: ExpensesReportViewProps) {
  const handleExportCsv = () => {
    const headers = [
      'Folio',
      'Fecha Efectiva',
      'Concepto',
      'Categoría',
      'Método de Pago',
      'Monto',
      'Estado',
      'Registrado por',
      'Referencia Externa',
      'Comprobante Adjunto',
    ]

    const rows = summary.expenses.map((exp) => [
      sanitizeCodeCell(exp.folio),
      exp.expenseDate,
      exp.concept,
      exp.categoryName,
      exp.paymentMethod,
      (exp.amountCents / 100).toFixed(2),
      exp.status,
      exp.registeredBy,
      exp.externalReference || '',
      exp.attachment ? exp.attachment.fileName : 'Sin comprobante',
    ])

    const summaryRows = [
      ['Total gastos registrados:', summary.expensesCount],
      ['Gastos activos vigentes:', summary.activeExpensesCount],
      ['Gastos anulados:', summary.cancelledExpensesCount],
      ['Total Bruto:', (summary.grossTotalCents / 100).toFixed(2)],
      ['Total Anulado:', (summary.cancelledTotalCents / 100).toFixed(2)],
      ['Total Neto de Gastos:', (summary.netTotalCents / 100).toFixed(2)],
    ]

    const csv = buildCsvContent({
      title: 'Reporte Operativo de Gastos y Egresos',
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
    triggerCsvDownload(`reporte_gastos_${cleanDate}.csv`, csv)
  }

  return (
    <div className="report-view-container">
      {/* Toolbar */}
      <div className="report-view__toolbar">
        <div>
          <h2 className="report-view__title">Resumen de gastos y egresos operativos</h2>
          <p className="report-view__subtitle">
            Período: {summary.dateFrom} al {summary.dateTo} &middot;{' '}
            {summary.expensesCount} gasto(s) en el rango
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={handleExportCsv}
          disabled={summary.expenses.length === 0}
        >
          📥 Exportar gastos a CSV
        </Button>
      </div>

      {/* KPI cards de gastos */}
      <div className="stats-grid stats-grid--4">
        <Card className="kpi-card">
          <span className="kpi-card__label">Gastos netos activos</span>
          <strong className="kpi-card__value text-primary">
            {formatCentsWithHistoricalCurrency(
              summary.netTotalCents,
              summary.currency,
            )}
          </strong>
          <span className="kpi-card__subtext">
            {summary.activeExpensesCount} desembolso(s) vigentes
          </span>
        </Card>

        <Card className="kpi-card">
          <span className="kpi-card__label">Gasto total bruto</span>
          <strong className="kpi-card__value">
            {formatCentsWithHistoricalCurrency(
              summary.grossTotalCents,
              summary.currency,
            )}
          </strong>
          <span className="kpi-card__subtext">Antes de cancelaciones</span>
        </Card>

        <Card className="kpi-card">
          <span className="kpi-card__label">Gastos anulados</span>
          <strong className="kpi-card__value text-muted">
            {formatCentsWithHistoricalCurrency(
              summary.cancelledTotalCents,
              summary.currency,
            )}
          </strong>
          <span className="kpi-card__subtext">
            {summary.cancelledExpensesCount} registro(s) revertidos
          </span>
        </Card>

        <Card className="kpi-card">
          <span className="kpi-card__label">Efectivo de caja</span>
          <strong className="kpi-card__value text-warning">
            {formatCentsWithHistoricalCurrency(
              summary.byPaymentMethod.find((m) => m.method === 'cash')?.netCents ??
                0,
              summary.currency,
            )}
          </strong>
          <span className="kpi-card__subtext">Impacto en gaveta de caja</span>
        </Card>
      </div>

      {/* Desglose por categoría y método */}
      <div className="report-breakdowns-grid">
        <Card className="report-breakdown-card">
          <h3 className="report-breakdown-card__title">
            Gastos por categoría
          </h3>
          <div className="report-breakdown-list">
            {summary.byCategory.length === 0 ? (
              <p className="empty-state-text">No hay gastos en categorías activas.</p>
            ) : (
              summary.byCategory.map((cat) => (
                <div key={cat.categoryId} className="report-breakdown-item">
                  <div>
                    <strong className="report-breakdown-item__name">
                      {cat.categoryName}
                    </strong>
                    <span className="report-breakdown-item__count">
                      {cat.count} egreso(s) &middot; {cat.percentage}%
                    </span>
                  </div>
                  <div className="report-breakdown-item__values">
                    <span className="report-breakdown-item__net">
                      {formatCentsWithHistoricalCurrency(
                        cat.netCents,
                        summary.currency,
                      )}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="report-breakdown-card">
          <h3 className="report-breakdown-card__title">
            Desembolsos por método de pago
          </h3>
          <div className="report-breakdown-list">
            {summary.byPaymentMethod.map((m) => (
              <div key={m.method} className="report-breakdown-item">
                <div>
                  <strong className="report-breakdown-item__name">{m.label}</strong>
                  <span className="report-breakdown-item__count">
                    {m.count} gasto(s)
                  </span>
                </div>
                <div className="report-breakdown-item__values">
                  <span className="report-breakdown-item__net">
                    {formatCentsWithHistoricalCurrency(
                      m.netCents,
                      summary.currency,
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Tabla detallada de gastos */}
      <Card className="report-table-card">
        <h3 className="report-table-card__title">
          Listado de gastos en el período
        </h3>
        <div className="ui-table-responsive-wrapper">
          <table className="ui-table">
            <thead>
              <tr>
                <th>Folio</th>
                <th>Fecha Efectiva</th>
                <th>Concepto y Categoría</th>
                <th>Método</th>
                <th className="ui-table__cell--numeric">Monto</th>
                <th>Estado</th>
                <th>Registrado por</th>
              </tr>
            </thead>
            <tbody>
              {summary.expenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="ui-table__empty-cell">
                    No hay gastos registrados en el período seleccionado.
                  </td>
                </tr>
              ) : (
                summary.expenses.map((exp) => {
                  const isCancelled = exp.status === 'cancelled'
                  return (
                    <tr
                      key={exp.id}
                      className={isCancelled ? 'expense-row--cancelled' : ''}
                    >
                      <td>
                        <strong>{exp.folio}</strong>
                      </td>
                      <td>
                        <div className="expense-date-cell">
                          <strong>{exp.expenseDate}</strong>
                          <small className="text-muted">
                            {
                              formatDateTimeInOrganizationTimezone(
                                exp.createdAt,
                                preferences.timezone,
                                preferences.dateFormat,
                              ).fullLabel
                            }
                          </small>
                        </div>
                      </td>
                      <td>
                        <div>
                          <strong>{exp.concept}</strong>
                          <br />
                          <small className="text-muted">{exp.categoryName}</small>
                        </div>
                      </td>
                      <td>
                        <Badge
                          variant={
                            exp.paymentMethod === 'cash' ? 'warning' : 'neutral'
                          }
                        >
                          {exp.paymentMethod === 'cash'
                            ? 'Efectivo en caja'
                            : exp.paymentMethod === 'card'
                              ? 'Tarjeta'
                              : 'Transferencia'}
                        </Badge>
                      </td>
                      <td className="ui-table__cell--numeric">
                        <strong
                          className={isCancelled ? 'text-muted line-through' : ''}
                        >
                          {formatCentsWithHistoricalCurrency(
                            exp.amountCents,
                            exp.currency,
                          )}
                        </strong>
                      </td>
                      <td>
                        <Badge variant={isCancelled ? 'danger' : 'success'}>
                          {isCancelled ? 'Anulado' : 'Activo'}
                        </Badge>
                      </td>
                      <td>
                        <small>{exp.registeredBy}</small>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
