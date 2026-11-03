import { useEffect, useState } from 'react'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import type { Organization, OrganizationPreferences } from '../../../types'
import { formatCentsWithHistoricalCurrency } from '../../cash/utils/moneyUtils'
import {
  formatDateTimeInOrganizationTimezone,
  formatQuantityWithUnit,
} from '../../inventory/utils/quantityUtils'
import { getTimezoneShortLabel } from '../../settings/formatters'
import { TicketModal } from '../../tickets/components/TicketModal'
import { TicketViewer } from '../../tickets/components/TicketViewer'
import { defaultTicketSnapshotService } from '../../tickets/services/ticketSnapshotService'
import type { TicketSnapshot } from '../../tickets/types'
import type { SaleRecord } from '../types'
import { getPaymentMethodPresentation } from '../utils/posMoneyAndQuantityUtils'

export interface PosSaleConfirmationViewProps {
  sale: SaleRecord
  preferences: OrganizationPreferences
  organization: Organization
  onStartNewSale: () => void
  onViewInSalesModule: (saleId: string) => void
}

export function PosSaleConfirmationView({
  sale,
  preferences,
  organization,
  onStartNewSale,
  onViewInSalesModule,
}: PosSaleConfirmationViewProps) {
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false)
  const [ticketSnapshot, setTicketSnapshot] = useState<TicketSnapshot | null>(
    () => defaultTicketSnapshotService.getSnapshotForSale(organization.id, sale.id),
  )

  useEffect(() => {
    if (!ticketSnapshot) {
      defaultTicketSnapshotService
        .createSaleTicketSnapshot({ sale, organization })
        .then((created) => setTicketSnapshot(created))
    }
  }, [ticketSnapshot, organization, sale])

  const dt = formatDateTimeInOrganizationTimezone(
    sale.createdAt,
    preferences.timezone,
    preferences.dateFormat,
  )
  const tzShort = getTimezoneShortLabel(preferences.timezone)
  const paymentMeta = getPaymentMethodPresentation(sale.payment.method)

  return (
    <Card
      as="section"
      accentTop
      className="pos-receipt-card"
      title={`Venta registrada · Folio ${sale.folio}`}
      subtitle={`Comprobante en pantalla de operación confirmada (${dt.fullLabel} ${tzShort})`}
      headerAction={
        <Badge variant="success">
          Confirmada · {sale.currency}
        </Badge>
      }
    >
      <div className="pos-receipt-layout">
        <div className="pos-receipt-main">
          <div className="pos-receipt-banner" role="status" aria-live="polite">
            <div>
              <strong>
                Venta {sale.folio} registrada e impactada correctamente
              </strong>
              <p>
                Se descontaron las existencias de{' '}
                <strong>{sale.lines.length}</strong> partida(s) en Inventario
                {sale.payment.method === 'cash'
                  ? ` y se sumó el ingreso por ${formatCentsWithHistoricalCurrency(
                      sale.totalCents,
                      sale.currency,
                    )} al efectivo esperado de la sesión de caja activa.`
                  : ` y se registró el pago manual por ${paymentMeta.label.toLowerCase()} sin alterar el efectivo físico de la caja.`}
              </p>
            </div>
          </div>

          <div className="pos-receipt-meta-grid">
            <div className="pos-receipt-meta-item">
              <span className="pos-receipt-meta-item__label">Folio interno</span>
              <strong className="pos-receipt-meta-item__value">
                <code>{sale.folio}</code>
              </strong>
            </div>
            <div className="pos-receipt-meta-item">
              <span className="pos-receipt-meta-item__label">Fecha y hora</span>
              <strong className="pos-receipt-meta-item__value">
                {dt.dateLabel} · {dt.timeLabel} ({tzShort})
              </strong>
            </div>
            <div className="pos-receipt-meta-item">
              <span className="pos-receipt-meta-item__label">
                Organización / Sucursal
              </span>
              <strong className="pos-receipt-meta-item__value">
                {sale.organizationName} · {sale.branchName}
              </strong>
            </div>
            <div className="pos-receipt-meta-item">
              <span className="pos-receipt-meta-item__label">Caja y operador</span>
              <strong className="pos-receipt-meta-item__value">
                {sale.registerName} ({sale.registerCode}) · {sale.operatorName}
              </strong>
            </div>
          </div>

          <div className="table-responsive">
            <table
              className="data-table pos-receipt-table"
              aria-label={`Partidas históricas de la venta ${sale.folio}`}
            >
              <thead>
                <tr>
                  <th>Producto / Código histórico</th>
                  <th>Cantidad</th>
                  <th>Precio unitario</th>
                  <th>Importe</th>
                </tr>
              </thead>
              <tbody>
                {sale.lines.map((line) => (
                  <tr key={line.id}>
                    <td>
                      <div className="pos-receipt-line-product">
                        <strong>{line.productName}</strong>
                        <span className="text-muted">
                          SKU: <code>{line.sku}</code>
                          {line.barcodeUsed ? (
                            <>
                              {' '}
                              · Escaneado: <code>{line.barcodeUsed}</code>
                            </>
                          ) : null}
                        </span>
                      </div>
                    </td>
                    <td>{formatQuantityWithUnit(line.quantity, line.unit)}</td>
                    <td>
                      {formatCentsWithHistoricalCurrency(
                        line.unitPriceCents,
                        sale.currency,
                      )}
                    </td>
                    <td>
                      <strong>
                        {formatCentsWithHistoricalCurrency(
                          line.lineSubtotalCents,
                          sale.currency,
                        )}
                      </strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pos-receipt-totals-box">
            <div className="pos-receipt-totals-box__row">
              <span>Subtotal ({sale.itemsCount} partida(s))</span>
              <strong>
                {formatCentsWithHistoricalCurrency(
                  sale.subtotalCents,
                  sale.currency,
                )}
              </strong>
            </div>
            <div className="pos-receipt-totals-box__row pos-receipt-totals-box__row--grand">
              <span>Total cobrado ({sale.currency})</span>
              <strong>
                {formatCentsWithHistoricalCurrency(sale.totalCents, sale.currency)}
              </strong>
            </div>
            <div className="pos-receipt-totals-box__row">
              <span>Método de pago</span>
              <Badge variant={paymentMeta.badgeVariant}>
                {paymentMeta.fullLabel}
              </Badge>
            </div>

            {sale.payment.method === 'cash' ? (
              <>
                <div className="pos-receipt-totals-box__row">
                  <span>Efectivo recibido del cliente</span>
                  <strong>
                    {formatCentsWithHistoricalCurrency(
                      sale.payment.cashReceivedCents ?? sale.totalCents,
                      sale.currency,
                    )}
                  </strong>
                </div>
                <div className="pos-receipt-totals-box__row">
                  <span>Cambio entregado al cliente</span>
                  <strong>
                    {formatCentsWithHistoricalCurrency(
                      sale.payment.cashChangeCents ?? 0,
                      sale.currency,
                    )}
                  </strong>
                </div>
                <div className="pos-receipt-totals-box__row">
                  <span>Ingreso neto sumado a sesión de caja</span>
                  <strong>
                    {formatCentsWithHistoricalCurrency(
                      sale.totalCents,
                      sale.currency,
                    )}
                  </strong>
                </div>
              </>
            ) : (
              <>
                <div className="pos-receipt-totals-box__row">
                  <span>Referencia externa registrada</span>
                  <strong>
                    {sale.payment.externalReference ? (
                      <code>{sale.payment.externalReference}</code>
                    ) : (
                      'Sin referencia capturada'
                    )}
                  </strong>
                </div>
                <div className="pos-receipt-totals-box__row">
                  <span>Impacto en efectivo físico de caja</span>
                  <span>No incrementa efectivo esperado ($0.00 en billetes/monedas)</span>
                </div>
              </>
            )}
          </div>
        </div>

        <aside
          className="pos-receipt-ticket-preview-box"
          aria-label="Comprobante térmico para impresión"
        >
          <div className="pos-receipt-ticket-preview-box__header">
            <h4>Comprobante térmico</h4>
            <Badge variant="neutral">
              {ticketSnapshot?.configSnapshot.paperWidth || '80mm'} ·{' '}
              {ticketSnapshot?.configSnapshot.templateKind === 'detailed'
                ? 'Detallada'
                : 'Compacta'}
            </Badge>
          </div>

          {ticketSnapshot ? (
            <TicketViewer
              snapshot={ticketSnapshot}
              className="pos-receipt-embedded-ticket"
            />
          ) : (
            <div className="text-muted">Cargando comprobante térmico...</div>
          )}

          <div className="pos-receipt-ticket-preview-box__actions">
            <Button
              type="button"
              variant="primary"
              size="lg"
              onClick={() => setIsTicketModalOpen(true)}
            >
              Imprimir ticket térmico
            </Button>
            <Button type="button" variant="outline" onClick={onStartNewSale}>
              Nueva venta en mostrador
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onViewInSalesModule(sale.id)}
            >
              Ver detalle en Ventas
            </Button>
          </div>
        </aside>
      </div>

      <TicketModal
        isOpen={isTicketModalOpen}
        onClose={() => setIsTicketModalOpen(false)}
        snapshot={ticketSnapshot}
        organizationId={organization.id}
        isReprint={false}
      />
    </Card>
  )
}
