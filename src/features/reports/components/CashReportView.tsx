import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import type { OrganizationPreferences } from '../../../types'
import { formatCentsWithHistoricalCurrency } from '../../cash/utils/moneyUtils'
import { formatDateTimeInOrganizationTimezone } from '../../inventory/utils/quantityUtils'
import type { CashReportSummary } from '../types'
import {
  buildCsvContent,
  sanitizeCodeCell,
  triggerCsvDownload,
} from '../utils/csvExport'

export interface CashReportViewProps {
  summary: CashReportSummary
  organizationName: string
  branchName: string
  operatorName: string
  preferences: OrganizationPreferences
}

export function CashReportView({
  summary,
  organizationName,
  branchName,
  operatorName,
  preferences,
}: CashReportViewProps) {
  const handleExportCsv = () => {
    const headers = [
      'Turno / ID Sesión',
      'Caja',
      'Estado',
      'Apertura',
      'Cierre',
      'Fondo Inicial',
      'Ventas Efectivo',
      'Reembolsos Efectivo',
      'Entradas Manuales',
      'Retiros Manuales',
      'Gastos Efectivo',
      'Reintegros Gastos',
      'Saldo Esperado',
      'Efectivo Contado',
      'Diferencia',
    ]

    const rows = summary.sessions.map((item) => [
      sanitizeCodeCell(item.session.id),
      item.session.registerName,
      item.session.status,
      formatDateTimeInOrganizationTimezone(
        item.session.openedAt,
        preferences.timezone,
        preferences.dateFormat,
      ).fullLabel,
      item.session.closedAt
        ? formatDateTimeInOrganizationTimezone(
            item.session.closedAt,
            preferences.timezone,
            preferences.dateFormat,
          ).fullLabel
        : 'Turno abierto',
      (item.openingFloatCents / 100).toFixed(2),
      (item.cashSalesCents / 100).toFixed(2),
      (item.cashRefundsCents / 100).toFixed(2),
      (item.manualInCents / 100).toFixed(2),
      (item.manualOutCents / 100).toFixed(2),
      (item.expensesOutCents / 100).toFixed(2),
      (item.expensesCancelInCents / 100).toFixed(2),
      (item.expectedBalanceCents / 100).toFixed(2),
      item.countedBalanceCents !== null
        ? (item.countedBalanceCents / 100).toFixed(2)
        : 'N/A',
      item.differenceCents !== null
        ? (item.differenceCents / 100).toFixed(2)
        : 'N/A',
    ])

    const summaryRows = [
      ['Total sesiones en el período:', summary.totalSessions],
      ['Sesiones abiertas:', summary.openSessions],
      ['Sesiones cerradas:', summary.closedSessions],
      ['Total Fondos Iniciales:', (summary.totalOpeningFloatCents / 100).toFixed(2)],
      ['Total Ventas en Efectivo:', (summary.totalCashSalesCents / 100).toFixed(2)],
      ['Total Reembolsos en Efectivo:', (summary.totalCashRefundsCents / 100).toFixed(2)],
      ['Total Entradas Manuales:', (summary.totalManualInCents / 100).toFixed(2)],
      ['Total Retiros Manuales:', (summary.totalManualOutCents / 100).toFixed(2)],
      ['Total Gastos en Efectivo:', (summary.totalExpensesOutCents / 100).toFixed(2)],
      [
        'Total Reintegros Gastos Anulados:',
        (summary.totalExpensesCancelInCents / 100).toFixed(2),
      ],
      ['Saldo Esperado Consolidado:', (summary.netExpectedBalanceCents / 100).toFixed(2)],
      ['Total Contado en Cierres:', (summary.totalCountedCents / 100).toFixed(2)],
      ['Diferencia Acumulada de Arqueo:', (summary.totalDifferenceCents / 100).toFixed(2)],
    ]

    const csv = buildCsvContent({
      title: 'Reporte Operativo de Caja, Turnos y Flujo de Efectivo',
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
    triggerCsvDownload(`reporte_caja_${cleanDate}.csv`, csv)
  }

  const netCashSalesCents = summary.totalCashSalesCents - summary.totalCashRefundsCents
  const netExpensesCashCents =
    summary.totalExpensesOutCents - summary.totalExpensesCancelInCents
  const netManualFlowCents = summary.totalManualInCents - summary.totalManualOutCents

  return (
    <div className="report-view-container">
      {/* Toolbar */}
      <div className="report-view__toolbar">
        <div>
          <h2 className="report-view__title">
            Flujo de efectivo y sesiones de caja
          </h2>
          <p className="report-view__subtitle">
            Período: {summary.dateFrom} al {summary.dateTo} &middot;{' '}
            {summary.totalSessions} sesión(es) en el rango
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={handleExportCsv}
          disabled={summary.sessions.length === 0}
        >
          📥 Exportar corte de caja a CSV
        </Button>
      </div>

      {/* Banner de rigor de arqueo */}
      <div className="form-feedback form-feedback--info">
        <strong>Principio contable de corte:</strong> Los saldos finales de
        sesiones de caja distintas son fotos de balance independientes y nunca se
        acumulan entre sí como si fueran ingresos. El flujo de efectivo neto refleja
        los ingresos y egresos efectivos del período.
      </div>

      {/* KPI cards de caja */}
      <div className="stats-grid stats-grid--4">
        <Card className="kpi-card">
          <span className="kpi-card__label">Saldo esperado neto</span>
          <strong className="kpi-card__value text-primary">
            {formatCentsWithHistoricalCurrency(
              summary.netExpectedBalanceCents,
              summary.currency,
            )}
          </strong>
          <span className="kpi-card__subtext">
            Fondo + Ventas - Devoluciones ± Manuales - Gastos
          </span>
        </Card>

        <Card className="kpi-card">
          <span className="kpi-card__label">Venta neta en efectivo</span>
          <strong className="kpi-card__value text-success">
            {formatCentsWithHistoricalCurrency(
              netCashSalesCents,
              summary.currency,
            )}
          </strong>
          <span className="kpi-card__subtext">
            Cobrado:{' '}
            {formatCentsWithHistoricalCurrency(
              summary.totalCashSalesCents,
              summary.currency,
            )}
          </span>
        </Card>

        <Card className="kpi-card">
          <span className="kpi-card__label">Gastos netos de gaveta</span>
          <strong className="kpi-card__value text-warning">
            {formatCentsWithHistoricalCurrency(
              netExpensesCashCents,
              summary.currency,
            )}
          </strong>
          <span className="kpi-card__subtext">
            Salidas: -
            {formatCentsWithHistoricalCurrency(
              summary.totalExpensesOutCents,
              summary.currency,
            )}
          </span>
        </Card>

        <Card className="kpi-card">
          <span className="kpi-card__label">Flujo manual (Entradas/Retiros)</span>
          <strong className="kpi-card__value">
            {formatCentsWithHistoricalCurrency(
              netManualFlowCents,
              summary.currency,
            )}
          </strong>
          <span className="kpi-card__subtext">
            +{summary.totalManualInCents / 100} / -{summary.totalManualOutCents / 100}
          </span>
        </Card>
      </div>

      {/* Tabla detallada de sesiones */}
      <Card className="report-table-card">
        <h3 className="report-table-card__title">
          Sesiones y turnos de caja en el período
        </h3>
        <div className="ui-table-responsive-wrapper">
          <table className="ui-table">
            <thead>
              <tr>
                <th>Caja y Turno</th>
                <th>Estado</th>
                <th>Apertura / Cierre</th>
                <th className="ui-table__cell--numeric">Fondo</th>
                <th className="ui-table__cell--numeric">Ventas Efectivo</th>
                <th className="ui-table__cell--numeric">Gastos Efectivo</th>
                <th className="ui-table__cell--numeric">Saldo Esperado</th>
                <th className="ui-table__cell--numeric">Contado</th>
                <th className="ui-table__cell--numeric">Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {summary.sessions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="ui-table__empty-cell">
                    No se registran sesiones de caja en el período seleccionado.
                  </td>
                </tr>
              ) : (
                summary.sessions.map((item) => {
                  const isOpen = item.session.status === 'open'
                  const diff = item.differenceCents

                  return (
                    <tr key={item.session.id}>
                      <td>
                        <strong>{item.session.registerName}</strong>
                        <br />
                        <small className="text-muted">{item.session.id}</small>
                      </td>
                      <td>
                        <Badge variant={isOpen ? 'success' : 'neutral'}>
                          {isOpen ? 'Turno abierto' : 'Cerrada'}
                        </Badge>
                      </td>
                      <td>
                        <small>
                          A:{' '}
                          {
                            formatDateTimeInOrganizationTimezone(
                              item.session.openedAt,
                              preferences.timezone,
                              preferences.dateFormat,
                            ).fullLabel
                          }
                          {item.session.closedAt && (
                            <>
                              <br />
                              C:{' '}
                              {
                                formatDateTimeInOrganizationTimezone(
                                  item.session.closedAt,
                                  preferences.timezone,
                                  preferences.dateFormat,
                                ).fullLabel
                              }
                            </>
                          )}
                        </small>
                      </td>
                      <td className="ui-table__cell--numeric">
                        {formatCentsWithHistoricalCurrency(
                          item.openingFloatCents,
                          item.session.currency,
                        )}
                      </td>
                      <td className="ui-table__cell--numeric">
                        {formatCentsWithHistoricalCurrency(
                          item.cashSalesCents - item.cashRefundsCents,
                          item.session.currency,
                        )}
                      </td>
                      <td className="ui-table__cell--numeric text-warning">
                        {formatCentsWithHistoricalCurrency(
                          item.expensesOutCents - item.expensesCancelInCents,
                          item.session.currency,
                        )}
                      </td>
                      <td className="ui-table__cell--numeric">
                        <strong>
                          {formatCentsWithHistoricalCurrency(
                            item.expectedBalanceCents,
                            item.session.currency,
                          )}
                        </strong>
                      </td>
                      <td className="ui-table__cell--numeric">
                        {item.countedBalanceCents !== null
                          ? formatCentsWithHistoricalCurrency(
                              item.countedBalanceCents,
                              item.session.currency,
                            )
                          : '—'}
                      </td>
                      <td className="ui-table__cell--numeric">
                        {diff !== null ? (
                          <strong
                            className={
                              diff === 0
                                ? 'text-success'
                                : diff > 0
                                  ? 'text-primary'
                                  : 'text-danger'
                            }
                          >
                            {diff > 0 ? '+' : ''}
                            {formatCentsWithHistoricalCurrency(
                              diff,
                              item.session.currency,
                            )}
                          </strong>
                        ) : (
                          '—'
                        )}
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
