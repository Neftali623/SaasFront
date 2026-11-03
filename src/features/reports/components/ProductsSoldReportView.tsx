import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { formatCentsWithHistoricalCurrency } from '../../cash/utils/moneyUtils'
import type { ProductUnit } from '../../products/types'
import type { ProductsSoldSummary } from '../types'
import {
  buildCsvContent,
  sanitizeCodeCell,
  triggerCsvDownload,
} from '../utils/csvExport'

export interface ProductsSoldReportViewProps {
  summary: ProductsSoldSummary
  organizationName: string
  branchName: string
  operatorName: string
}

const UNIT_LABELS: Record<ProductUnit, string> = {
  pieza: 'Pieza(s)',
  kg: 'Kilogramo(s)',
  litro: 'Litro(s)',
  servicio: 'Servicio(s)',
  caja: 'Caja(s)',
  paquete: 'Paquete(s)',
}

export function ProductsSoldReportView({
  summary,
  organizationName,
  branchName,
  operatorName,
}: ProductsSoldReportViewProps) {
  const handleExportCsv = () => {
    const headers = [
      'SKU',
      'Producto',
      'Unidad de Medida',
      'Cantidad Bruta Vendida',
      'Cantidad Devuelta',
      'Cantidad Neta',
      'Importe Bruto',
      'Importe Reembolsado',
      'Importe Neto',
    ]

    const rows = summary.items.map((item) => [
      sanitizeCodeCell(item.sku),
      item.productName,
      UNIT_LABELS[item.unit] || item.unit,
      item.grossQuantity,
      item.refundedQuantity,
      item.netQuantity,
      (item.grossAmountCents / 100).toFixed(2),
      (item.refundedAmountCents / 100).toFixed(2),
      (item.netAmountCents / 100).toFixed(2),
    ])

    const summaryRows = [
      ['--- TOTALES MONETARIOS ---', ''],
      ['Total Bruto Ventas:', (summary.totalGrossCents / 100).toFixed(2)],
      ['Total Reembolsos:', (summary.totalRefundedCents / 100).toFixed(2)],
      ['Total Neto Ventas:', (summary.totalNetCents / 100).toFixed(2)],
      ['--- TOTALES DE CANTIDAD POR UNIDAD (NO COMBINABLES) ---', ''],
      ...summary.unitTotals.map((u) => [
        `Cantidad Neta (${UNIT_LABELS[u.unit] || u.unit}):`,
        u.netQuantity,
      ]),
    ]

    const csv = buildCsvContent({
      title: 'Reporte Operativo de Productos Vendidos y Devueltos',
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
    triggerCsvDownload(`reporte_productos_vendidos_${cleanDate}.csv`, csv)
  }

  return (
    <div className="report-view-container">
      {/* Toolbar */}
      <div className="report-view__toolbar">
        <div>
          <h2 className="report-view__title">
            Productos vendidos, devueltos y desplazamiento
          </h2>
          <p className="report-view__subtitle">
            Período: {summary.dateFrom} al {summary.dateTo} &middot;{' '}
            {summary.items.length} artículo(s) con movimiento
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={handleExportCsv}
          disabled={summary.items.length === 0}
        >
          📥 Exportar artículos a CSV
        </Button>
      </div>

      {/* Banner de rigor de unidades */}
      <div className="form-feedback form-feedback--info">
        <strong>Aviso de rigor volumétrico y físico:</strong> Las cantidades se
        computan y agrupan estrictamente por unidad de medida. No se suman
        piezas con kilogramos ni litros para garantizar precisión operativa.
      </div>

      {/* Tarjetas KPI monetarias */}
      <div className="stats-grid stats-grid--3">
        <Card className="kpi-card">
          <span className="kpi-card__label">Ingreso neto por productos</span>
          <strong className="kpi-card__value text-primary">
            {formatCentsWithHistoricalCurrency(
              summary.totalNetCents,
              summary.currency,
            )}
          </strong>
          <span className="kpi-card__subtext">
            {summary.items.length} artículo(s) desplazados
          </span>
        </Card>

        <Card className="kpi-card">
          <span className="kpi-card__label">Venta bruta facturada</span>
          <strong className="kpi-card__value">
            {formatCentsWithHistoricalCurrency(
              summary.totalGrossCents,
              summary.currency,
            )}
          </strong>
          <span className="kpi-card__subtext">Antes de devoluciones</span>
        </Card>

        <Card className="kpi-card">
          <span className="kpi-card__label">Devoluciones en mercancía</span>
          <strong className="kpi-card__value text-warning">
            {formatCentsWithHistoricalCurrency(
              summary.totalRefundedCents,
              summary.currency,
            )}
          </strong>
          <span className="kpi-card__subtext">Reintegrada a inventario o merma</span>
        </Card>
      </div>

      {/* Tarjetas de totales segregados por unidad */}
      <div className="unit-totals-section">
        <h3 className="unit-totals-section__title">
          Cantidades netas vendidas por unidad de medida
        </h3>
        <div className="unit-totals-grid">
          {summary.unitTotals.map((u) => (
            <div key={u.unit} className="unit-total-pill">
              <span className="unit-total-pill__unit">
                {UNIT_LABELS[u.unit] || u.unit}
              </span>
              <strong className="unit-total-pill__qty">{u.netQuantity}</strong>
            </div>
          ))}
        </div>
      </div>

      {/* Tabla detallada de productos */}
      <Card className="report-table-card">
        <h3 className="report-table-card__title">
          Desglose por producto en el período
        </h3>
        <div className="ui-table-responsive-wrapper">
          <table className="ui-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Producto</th>
                <th>Unidad</th>
                <th className="ui-table__cell--numeric">Cant. Bruta</th>
                <th className="ui-table__cell--numeric">Devolución</th>
                <th className="ui-table__cell--numeric">Cant. Neta</th>
                <th className="ui-table__cell--numeric">Importe Bruto</th>
                <th className="ui-table__cell--numeric">Reembolso</th>
                <th className="ui-table__cell--numeric">Importe Neto</th>
              </tr>
            </thead>
            <tbody>
              {summary.items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="ui-table__empty-cell">
                    No se registran ventas de productos en este período.
                  </td>
                </tr>
              ) : (
                summary.items.map((item) => (
                  <tr key={`${item.productId}-${item.unit}`}>
                    <td>
                      <code>{item.sku}</code>
                    </td>
                    <td>
                      <strong>{item.productName}</strong>
                    </td>
                    <td>
                      <Badge variant="neutral">
                        {UNIT_LABELS[item.unit] || item.unit}
                      </Badge>
                    </td>
                    <td className="ui-table__cell--numeric">
                      {item.grossQuantity}
                    </td>
                    <td className="ui-table__cell--numeric text-muted">
                      {item.refundedQuantity > 0 ? `-${item.refundedQuantity}` : '0'}
                    </td>
                    <td className="ui-table__cell--numeric">
                      <strong>{item.netQuantity}</strong>
                    </td>
                    <td className="ui-table__cell--numeric">
                      {formatCentsWithHistoricalCurrency(
                        item.grossAmountCents,
                        summary.currency,
                      )}
                    </td>
                    <td className="ui-table__cell--numeric text-muted">
                      {formatCentsWithHistoricalCurrency(
                        item.refundedAmountCents,
                        summary.currency,
                      )}
                    </td>
                    <td className="ui-table__cell--numeric">
                      <strong>
                        {formatCentsWithHistoricalCurrency(
                          item.netAmountCents,
                          summary.currency,
                        )}
                      </strong>
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
