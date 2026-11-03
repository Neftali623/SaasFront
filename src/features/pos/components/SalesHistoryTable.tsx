import { useMemo, useState } from 'react'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { EmptyState } from '../../../components/ui/EmptyState'
import type { Organization, OrganizationPreferences } from '../../../types'
import type { CashSession, CashSessionComputedTotals } from '../../cash/types'
import { formatCentsWithHistoricalCurrency } from '../../cash/utils/moneyUtils'
import {
  formatDateTimeInOrganizationTimezone,
  formatQuantityWithUnit,
} from '../../inventory/utils/quantityUtils'
import { getTimezoneShortLabel } from '../../settings/formatters'
import { TicketModal } from '../../tickets/components/TicketModal'
import { defaultTicketSnapshotService } from '../../tickets/services/ticketSnapshotService'
import type { TicketSnapshot } from '../../tickets/types'
import type {
  PosPaymentMethod,
  SaleRecord,
  SaleReturnRecord,
  SaleStatus,
} from '../types'
import {
  deriveSaleComputedTotals,
  getPaymentMethodPresentation,
  getSaleStatusPresentation,
  isSaleWithinPeriod,
} from '../utils/posMoneyAndQuantityUtils'

export type SalesPeriodFilter = 'all' | 'today' | 'last_7_days' | 'last_30_days'
export type SalesStatusFilter = 'all' | SaleStatus

export interface SalesHistoryTableProps {
  sales: SaleRecord[]
  selectedSaleId: string | null
  onSelectSaleId: (saleId: string | null) => void
  preferences: OrganizationPreferences
  organization: Organization
  openSession: CashSession | null
  openSessionTotals: CashSessionComputedTotals | null
  onOpenCancelModal: (sale: SaleRecord) => void
  onOpenRefundModal: (sale: SaleRecord) => void
  onGoToPos: () => void
}

const PAGE_SIZE = 10

export function SalesHistoryTable({
  sales,
  selectedSaleId,
  onSelectSaleId,
  preferences,
  organization,
  openSession,
  openSessionTotals,
  onOpenCancelModal,
  onOpenRefundModal,
  onGoToPos,
}: SalesHistoryTableProps) {
  const tzShort = getTimezoneShortLabel(preferences.timezone)

  const [ticketModalSnapshot, setTicketModalSnapshot] =
    useState<TicketSnapshot | null>(null)
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false)
  const [isReprintModal, setIsReprintModal] = useState(false)

  const handleViewSaleTicket = (sale: SaleRecord) => {
    const existing = defaultTicketSnapshotService.getSnapshotForSale(
      organization.id,
      sale.id,
    )
    const snapshot =
      existing ??
      defaultTicketSnapshotService.reconstructLegacyTicketSnapshot(
        sale,
        organization,
      )
    setTicketModalSnapshot(snapshot)
    setIsReprintModal(true)
    setIsTicketModalOpen(true)
  }

  const handleViewReturnTicket = async (
    sale: SaleRecord,
    ret: SaleReturnRecord,
  ) => {
    const existing = defaultTicketSnapshotService.getSnapshotForReturn(
      organization.id,
      ret.id,
    )
    if (existing) {
      setTicketModalSnapshot(existing)
      setIsReprintModal(existing.reprintAuditTrail.length > 0)
      setIsTicketModalOpen(true)
    } else {
      const snapshot =
        await defaultTicketSnapshotService.createReturnTicketSnapshot({
          sale,
          returnRecord: ret,
          organization,
        })
      setTicketModalSnapshot(snapshot)
      setIsReprintModal(snapshot.reprintAuditTrail.length > 0)
      setIsTicketModalOpen(true)
    }
  }

  const [searchQuery, setSearchQuery] = useState<string>('')
  const [periodFilter, setPeriodFilter] = useState<SalesPeriodFilter>('all')
  const [statusFilter, setStatusFilter] = useState<SalesStatusFilter>('all')
  const [methodFilter, setMethodFilter] = useState<'all' | PosPaymentMethod>('all')
  const [currentPage, setCurrentPage] = useState<number>(1)

  // Filtrado compuesto con cálculo derivado de estado por venta
  const filteredSales = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()

    return sales.filter((sale) => {
      // Filtro por método de pago
      if (methodFilter !== 'all' && sale.payment.method !== methodFilter) {
        return false
      }

      // Filtro por periodo en la zona horaria del negocio
      if (
        periodFilter !== 'all' &&
        !isSaleWithinPeriod(sale.createdAt, periodFilter, preferences.timezone)
      ) {
        return false
      }

      // Filtro por estado calculado
      const derived = deriveSaleComputedTotals(sale)
      if (statusFilter !== 'all' && derived.status !== statusFilter) {
        return false
      }

      // Búsqueda textual por folio, operador, referencia o producto
      if (!q) {
        return true
      }

      const matchesFolio = sale.folio.toLowerCase().includes(q)
      const matchesOperator = sale.operatorName.toLowerCase().includes(q)
      const matchesRef =
        sale.payment.externalReference?.toLowerCase().includes(q) ?? false
      const matchesLine = sale.lines.some(
        (line) =>
          line.productName.toLowerCase().includes(q) ||
          line.sku.toLowerCase().includes(q) ||
          (line.barcodeUsed?.toLowerCase().includes(q) ?? false),
      )

      return matchesFolio || matchesOperator || matchesRef || matchesLine
    })
  }, [sales, searchQuery, periodFilter, statusFilter, methodFilter, preferences.timezone])

  // Paginación controlada
  const totalPages = Math.max(1, Math.ceil(filteredSales.length / PAGE_SIZE))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const paginatedSales = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * PAGE_SIZE
    return filteredSales.slice(startIndex, startIndex + PAGE_SIZE)
  }, [filteredSales, safeCurrentPage])

  // Venta seleccionada para detalle
  const selectedSale = useMemo(() => {
    if (selectedSaleId) {
      const found = sales.find((s) => s.id === selectedSaleId)
      if (found) return found
    }
    return paginatedSales[0] ?? filteredSales[0] ?? null
  }, [sales, selectedSaleId, paginatedSales, filteredSales])

  const selectedSaleDerived = useMemo(() => {
    return selectedSale ? deriveSaleComputedTotals(selectedSale) : null
  }, [selectedSale])

  const isOriginalSessionOpen = useMemo(() => {
    if (!selectedSale || !openSession) return false
    return openSession.id === selectedSale.sessionId
  }, [selectedSale, openSession])

  const hasSufficientCashBalanceForFullCancel = useMemo(() => {
    if (!selectedSale || selectedSale.payment.method !== 'cash') return true
    if (!openSessionTotals) return false
    return openSessionTotals.expectedBalanceCents >= selectedSale.totalCents
  }, [selectedSale, openSessionTotals])

  if (sales.length === 0) {
    return (
      <Card
        as="section"
        title="Historial de ventas registradas"
        subtitle="Consulta las ventas generadas desde el Punto de Venta de la organización activa"
      >
        <EmptyState
          title="Aún no se han registrado ventas en esta organización"
          description="Las ventas aparecerán aquí automáticamente en cuanto completes un cobro desde el Punto de Venta con una sesión de caja abierta."
          action={
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={onGoToPos}
            >
              Ir a Punto de Venta
            </Button>
          }
        />
      </Card>
    )
  }

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    periodFilter !== 'all' ||
    statusFilter !== 'all' ||
    methodFilter !== 'all'

  const handleClearFilters = () => {
    setSearchQuery('')
    setPeriodFilter('all')
    setStatusFilter('all')
    setMethodFilter('all')
    setCurrentPage(1)
  }

  return (
    <div className="sales-history-layout">
      <Card
        as="section"
        title="Ventas registradas"
        subtitle={`Mostrando ${filteredSales.length} de ${sales.length} venta(s) registrada(s) en Punto de Venta`}
      >
        <div className="pos-search-filters">
          <div className="pos-search-filters__field pos-search-filters__field--grow">
            <label htmlFor="sales-history-search" className="form-label">
              Buscar por folio, producto, SKU, operador o referencia
            </label>
            <input
              id="sales-history-search"
              type="search"
              className="form-input"
              placeholder="Ej. FOL-0001, Café, AUT-4829..."
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value)
                setCurrentPage(1)
              }}
            />
          </div>

          <div className="pos-search-filters__field">
            <label htmlFor="sales-history-period" className="form-label">
              Periodo
            </label>
            <select
              id="sales-history-period"
              className="form-select"
              value={periodFilter}
              onChange={(event) => {
                setPeriodFilter(event.target.value as SalesPeriodFilter)
                setCurrentPage(1)
              }}
            >
              <option value="all">Todo el historial</option>
              <option value="today">Hoy</option>
              <option value="last_7_days">Últimos 7 días</option>
              <option value="last_30_days">Últimos 30 días</option>
            </select>
          </div>

          <div className="pos-search-filters__field">
            <label htmlFor="sales-history-status" className="form-label">
              Estado
            </label>
            <select
              id="sales-history-status"
              className="form-select"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as SalesStatusFilter)
                setCurrentPage(1)
              }}
            >
              <option value="all">Todos los estados</option>
              <option value="completed">Completada</option>
              <option value="partially_refunded">Devuelta parcialmente</option>
              <option value="fully_refunded">Devuelta totalmente</option>
              <option value="cancelled">Cancelada</option>
            </select>
          </div>

          <div className="pos-search-filters__field">
            <label htmlFor="sales-history-method" className="form-label">
              Método de pago
            </label>
            <select
              id="sales-history-method"
              className="form-select"
              value={methodFilter}
              onChange={(event) => {
                setMethodFilter(event.target.value as 'all' | PosPaymentMethod)
                setCurrentPage(1)
              }}
            >
              <option value="all">Todos los métodos</option>
              <option value="cash">Efectivo</option>
              <option value="card">Tarjeta (manual)</option>
              <option value="transfer">Transferencia (manual)</option>
            </select>
          </div>

          {hasActiveFilters ? (
            <div className="pos-search-filters__meta">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
              >
                Limpiar filtros
              </Button>
            </div>
          ) : null}
        </div>

        {filteredSales.length === 0 ? (
          <EmptyState
            title="Sin ventas que coincidan con los filtros"
            description="Ajusta el término de búsqueda, periodo, estado o método de pago seleccionado."
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClearFilters}
              >
                Ver todas las ventas
              </Button>
            }
          />
        ) : (
          <>
            <div className="table-responsive">
              <table
                className="data-table"
                aria-label="Listado histórico de ventas confirmadas"
              >
                <thead>
                  <tr>
                    <th>Folio</th>
                    <th>Fecha y hora ({tzShort})</th>
                    <th>Caja / Operador</th>
                    <th>Total original</th>
                    <th>Reembolsado</th>
                    <th>Total neto</th>
                    <th>Método</th>
                    <th>Estado</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSales.map((sale) => {
                    const dt = formatDateTimeInOrganizationTimezone(
                      sale.createdAt,
                      preferences.timezone,
                      preferences.dateFormat,
                    )
                    const payMeta = getPaymentMethodPresentation(
                      sale.payment.method,
                    )
                    const isSelected = selectedSale?.id === sale.id
                    const derived = deriveSaleComputedTotals(sale)
                    const statusMeta = getSaleStatusPresentation(derived.status)

                    return (
                      <tr
                        key={sale.id}
                        className={isSelected ? 'data-table__row--selected' : ''}
                      >
                        <td>
                          <strong>
                            <code>{sale.folio}</code>
                          </strong>
                        </td>
                        <td>
                          <div>{dt.dateLabel}</div>
                          <small className="text-muted">{dt.timeLabel}</small>
                        </td>
                        <td>
                          <div>
                            {sale.registerName} (<code>{sale.registerCode}</code>)
                          </div>
                          <small className="text-muted">{sale.operatorName}</small>
                        </td>
                        <td>
                          <span>
                            {formatCentsWithHistoricalCurrency(
                              sale.totalCents,
                              sale.currency,
                            )}
                          </span>
                        </td>
                        <td>
                          {derived.refundedTotalCents > 0 ? (
                            <span className="text-warning">
                              -
                              {formatCentsWithHistoricalCurrency(
                                derived.refundedTotalCents,
                                sale.currency,
                              )}
                            </span>
                          ) : (
                            <span className="text-muted">$0.00</span>
                          )}
                        </td>
                        <td>
                          <strong>
                            {formatCentsWithHistoricalCurrency(
                              derived.netTotalCents,
                              sale.currency,
                            )}
                          </strong>
                        </td>
                        <td>
                          <Badge variant={payMeta.badgeVariant}>
                            {payMeta.label}
                          </Badge>
                        </td>
                        <td>
                          <Badge variant={statusMeta.badgeVariant}>
                            {statusMeta.label}
                          </Badge>
                        </td>
                        <td>
                          <Button
                            type="button"
                            variant={isSelected ? 'primary' : 'outline'}
                            size="sm"
                            onClick={() => onSelectSaleId(sale.id)}
                          >
                            {isSelected ? 'Viendo detalle' : 'Ver detalle'}
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Controles de paginación */}
            <div className="pos-pagination-controls">
              <span className="pos-pagination-info">
                Mostrando{' '}
                <strong>
                  {(safeCurrentPage - 1) * PAGE_SIZE + 1} -{' '}
                  {Math.min(safeCurrentPage * PAGE_SIZE, filteredSales.length)}
                </strong>{' '}
                de <strong>{filteredSales.length}</strong> ventas (Página{' '}
                {safeCurrentPage} de {totalPages})
              </span>
              <div className="pos-pagination-buttons">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  « Anterior
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                >
                  Siguiente »
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      {selectedSale && selectedSaleDerived ? (
        <Card
          as="section"
          accentTop
          title={`Detalle histórico · ${selectedSale.folio}`}
          subtitle="Datos inmutables conservados del momento exacto en que se confirmó la venta, con trazabilidad de devoluciones."
          headerAction={
            <div className="sales-detail-header-badges">
              {(() => {
                const statusMeta = getSaleStatusPresentation(
                  selectedSaleDerived.status,
                )
                return (
                  <Badge variant={statusMeta.badgeVariant}>
                    {statusMeta.label}
                  </Badge>
                )
              })()}
              <Badge variant="brand">Moneda: {selectedSale.currency}</Badge>
            </div>
          }
        >
          {(() => {
            const dt = formatDateTimeInOrganizationTimezone(
              selectedSale.createdAt,
              preferences.timezone,
              preferences.dateFormat,
            )
            const payMeta = getPaymentMethodPresentation(
              selectedSale.payment.method,
            )

            // Evaluación de motivos de bloqueo para cancelación
            let cancelBlockReason: string | null = null
            if (!selectedSaleDerived.canCancel) {
              cancelBlockReason = selectedSaleDerived.cancelBlockReason
            } else if (!isOriginalSessionOpen) {
              cancelBlockReason =
                'La sesión de caja original está cerrada. Las ventas de turnos anteriores deben gestionarse mediante Devolución.'
            } else if (
              selectedSale.payment.method === 'cash' &&
              !hasSufficientCashBalanceForFullCancel
            ) {
              cancelBlockReason = `Saldo insuficiente en la sesión de caja abierta para devolver en efectivo (${formatCentsWithHistoricalCurrency(
                openSessionTotals?.expectedBalanceCents ?? 0,
                selectedSale.currency,
              )} disponible).`
            }

            const canCancelEligible = cancelBlockReason === null
            const canRefundEligible = selectedSaleDerived.canRefund

            return (
              <div className="sales-detail-panel">
                {/* Botones de acción operativos */}
                <div className="sales-detail-actions-bar">
                  <div className="sales-detail-actions-bar__item">
                    <Button
                      type="button"
                      variant="outline"
                      className="ui-btn--danger"
                      size="sm"
                      disabled={!canCancelEligible}
                      onClick={() => onOpenCancelModal(selectedSale)}
                    >
                      Cancelar venta completa
                    </Button>
                    {cancelBlockReason ? (
                      <span className="sales-action-block-reason text-muted">
                        {cancelBlockReason}
                      </span>
                    ) : (
                      <span className="sales-action-block-reason text-muted">
                        Reversión 100% de la venta y reingreso de partidas al
                        inventario vendible.
                      </span>
                    )}
                  </div>

                  <div className="sales-detail-actions-bar__item">
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      disabled={!canRefundEligible}
                      onClick={() => onOpenRefundModal(selectedSale)}
                    >
                      Registrar devolución
                    </Button>
                    {!canRefundEligible ? (
                      <span className="sales-action-block-reason text-muted">
                        {selectedSaleDerived.refundBlockReason ??
                          'Esta venta no admite más devoluciones.'}
                      </span>
                    ) : (
                      <span className="sales-action-block-reason text-muted">
                        Devolución parcial o total de partidas con selección de
                        destino (vendible vs merma).
                      </span>
                    )}
                  </div>

                  <div className="sales-detail-actions-bar__item">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => handleViewSaleTicket(selectedSale)}
                    >
                      Ver ticket / Reimprimir
                    </Button>
                    <span className="sales-action-block-reason text-muted">
                      Comprobante térmico histórico exacto con auditoría de
                      reimpresión.
                    </span>
                  </div>
                </div>

                <div className="pos-receipt-meta-grid">
                  <div className="pos-receipt-meta-item">
                    <span className="pos-receipt-meta-item__label">
                      Folio y fecha
                    </span>
                    <strong className="pos-receipt-meta-item__value">
                      <code>{selectedSale.folio}</code> · {dt.dateLabel}{' '}
                      {dt.timeLabel} ({tzShort})
                    </strong>
                  </div>
                  <div className="pos-receipt-meta-item">
                    <span className="pos-receipt-meta-item__label">
                      Sucursal y caja
                    </span>
                    <strong className="pos-receipt-meta-item__value">
                      {selectedSale.branchName} · {selectedSale.registerName} (
                      {selectedSale.registerCode})
                    </strong>
                  </div>
                  <div className="pos-receipt-meta-item">
                    <span className="pos-receipt-meta-item__label">
                      Operador y sesión original
                    </span>
                    <div className="pos-receipt-meta-item__value">
                      <strong>{selectedSale.operatorName}</strong> · Sesión{' '}
                      <code>{selectedSale.sessionId}</code>{' '}
                      {isOriginalSessionOpen ? (
                        <Badge variant="success">Sesión original abierta</Badge>
                      ) : (
                        <Badge variant="neutral">Sesión original cerrada</Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Tabla de partidas vendidas con estado de devoluciones */}
                <h4 className="sales-detail-subtitle">
                  Partidas vendidas y saldo de devoluciones
                </h4>
                <div className="table-responsive">
                  <table
                    className="data-table"
                    aria-label={`Partidas históricas de ${selectedSale.folio}`}
                  >
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>Cant. original</th>
                        <th>Cant. devuelta</th>
                        <th>Cant. pendiente</th>
                        <th>P. Unitario</th>
                        <th>Subtotal histórico</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSaleDerived.linesSummary.map((ls) => (
                        <tr key={ls.line.id}>
                          <td>
                            <div>
                              <strong>{ls.line.productName}</strong>
                            </div>
                            <small className="text-muted">
                              SKU: <code>{ls.line.sku}</code>
                              {ls.line.barcodeUsed ? (
                                <>
                                  {' '}
                                  · Cód: <code>{ls.line.barcodeUsed}</code>
                                </>
                              ) : null}
                            </small>
                          </td>
                          <td>
                            {formatQuantityWithUnit(
                              ls.line.quantity,
                              ls.line.unit,
                            )}
                          </td>
                          <td>
                            {ls.returnedQuantity > 0 ? (
                              <span className="text-warning">
                                {formatQuantityWithUnit(
                                  ls.returnedQuantity,
                                  ls.line.unit,
                                )}
                              </span>
                            ) : (
                              <span className="text-muted">0</span>
                            )}
                          </td>
                          <td>
                            {ls.isFullyReturned ? (
                              <Badge variant="neutral">Devuelta al 100%</Badge>
                            ) : (
                              <strong>
                                {formatQuantityWithUnit(
                                  ls.remainingReturnableQuantity,
                                  ls.line.unit,
                                )}
                              </strong>
                            )}
                          </td>
                          <td>
                            {formatCentsWithHistoricalCurrency(
                              ls.line.unitPriceCents,
                              selectedSale.currency,
                            )}
                          </td>
                          <td>
                            <strong>
                              {formatCentsWithHistoricalCurrency(
                                ls.line.lineSubtotalCents,
                                selectedSale.currency,
                              )}
                            </strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Resumen de totales financieros */}
                <div className="pos-receipt-totals-box">
                  <div className="pos-receipt-totals-box__row">
                    <span>Total original cobrado</span>
                    <strong>
                      {formatCentsWithHistoricalCurrency(
                        selectedSale.totalCents,
                        selectedSale.currency,
                      )}
                    </strong>
                  </div>

                  <div className="pos-receipt-totals-box__row">
                    <span>Reembolsado acumulado</span>
                    <strong
                      className={
                        selectedSaleDerived.refundedTotalCents > 0
                          ? 'text-warning'
                          : ''
                      }
                    >
                      {selectedSaleDerived.refundedTotalCents > 0 ? '-' : ''}
                      {formatCentsWithHistoricalCurrency(
                        selectedSaleDerived.refundedTotalCents,
                        selectedSale.currency,
                      )}
                    </strong>
                  </div>

                  <div className="pos-receipt-totals-box__row pos-receipt-totals-box__row--grand">
                    <span>Total neto actual</span>
                    <strong>
                      {formatCentsWithHistoricalCurrency(
                        selectedSaleDerived.netTotalCents,
                        selectedSale.currency,
                      )}
                    </strong>
                  </div>

                  <div className="pos-receipt-totals-box__row">
                    <span>Método de pago</span>
                    <Badge variant={payMeta.badgeVariant}>
                      {payMeta.fullLabel}
                    </Badge>
                  </div>

                  {selectedSale.payment.method === 'cash' ? (
                    <>
                      <div className="pos-receipt-totals-box__row">
                        <span>Efectivo original recibido</span>
                        <span>
                          {formatCentsWithHistoricalCurrency(
                            selectedSale.payment.cashReceivedCents ??
                              selectedSale.totalCents,
                            selectedSale.currency,
                          )}
                        </span>
                      </div>
                      <div className="pos-receipt-totals-box__row">
                        <span>Cambio entregado</span>
                        <span>
                          {formatCentsWithHistoricalCurrency(
                            selectedSale.payment.cashChangeCents ?? 0,
                            selectedSale.currency,
                          )}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="pos-receipt-totals-box__row">
                      <span>Referencia de cobro</span>
                      <span>
                        {selectedSale.payment.externalReference ? (
                          <code>{selectedSale.payment.externalReference}</code>
                        ) : (
                          'Sin referencia'
                        )}
                      </span>
                    </div>
                  )}
                </div>

                {/* Historial de Devoluciones y Cancelaciones */}
                <h4 className="sales-detail-subtitle">
                  Historial de cancelaciones y devoluciones
                </h4>
                {selectedSale.returns && selectedSale.returns.length > 0 ? (
                  <div className="sales-returns-list">
                    {selectedSale.returns.map((ret) => {
                      const retDt = formatDateTimeInOrganizationTimezone(
                        ret.createdAt,
                        preferences.timezone,
                        preferences.dateFormat,
                      )
                      const isCancel = ret.type === 'cancelation'

                      return (
                        <div key={ret.id} className="sales-return-card">
                          <div className="sales-return-card__header">
                            <div className="sales-return-card__title">
                              <strong>
                                <code>{ret.returnFolio}</code>
                              </strong>
                              <Badge variant={isCancel ? 'neutral' : 'warning'}>
                                {isCancel ? 'Cancelación total' : 'Devolución'}
                              </Badge>
                            </div>
                            <span className="sales-return-card__date">
                              {retDt.dateLabel} {retDt.timeLabel} ({tzShort})
                            </span>
                          </div>

                          <div className="sales-return-card__body">
                            <p>
                              <strong>Operador:</strong> {ret.operatorName} ·{' '}
                              <strong>Motivo:</strong> &quot;{ret.reason}&quot;
                            </p>
                            <p>
                              <strong>Reembolso:</strong>{' '}
                              <span className="text-warning font-semibold">
                                {formatCentsWithHistoricalCurrency(
                                  ret.totalRefundCents,
                                  ret.refund.currency,
                                )}
                              </span>{' '}
                              ({ret.refund.method === 'cash'
                                ? `Efectivo en caja · Sesión ${ret.refund.cashSessionId ?? 'n/a'} (Movimiento #${ret.refund.cashMovementId ?? 'n/a'})`
                                : `Externo manual (${ret.refund.method}) · Ref: ${ret.refund.externalReference ?? 'sin referencia'} · Verificado por operador`})
                            </p>

                            <div className="sales-return-card__lines">
                              <strong>Partidas procesadas:</strong>
                              <ul>
                                {ret.lines.map((rl) => (
                                  <li key={rl.saleLineId}>
                                    {rl.productName}:{' '}
                                    <strong>
                                      {formatQuantityWithUnit(
                                        rl.returnedQuantity,
                                        rl.unit,
                                      )}
                                    </strong>{' '}
                                    (
                                    {formatCentsWithHistoricalCurrency(
                                      rl.refundCents,
                                      ret.refund.currency,
                                    )}
                                    ) ·{' '}
                                    {rl.destination === 'sellable' ? (
                                      <Badge variant="success">
                                        Reingreso vendible
                                      </Badge>
                                    ) : (
                                      <Badge variant="neutral">
                                        Merma / No apto
                                      </Badge>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </div>

                            <div style={{ marginTop: 'var(--space-3)' }}>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  handleViewReturnTicket(selectedSale, ret)
                                }
                              >
                                Ver ticket de{' '}
                                {isCancel ? 'cancelación' : 'devolución'} (
                                {ret.returnFolio})
                              </Button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-muted sales-returns-empty">
                    Esta venta no cuenta con devoluciones ni cancelaciones
                    registradas.
                  </p>
                )}

                {/* Trazabilidad de Auditoría */}
                {selectedSale.auditEvents &&
                selectedSale.auditEvents.length > 0 ? (
                  <>
                    <h4 className="sales-detail-subtitle">
                      Bitácora de auditoría inmutable
                    </h4>
                    <div className="sales-audit-list">
                      {selectedSale.auditEvents.map((evt) => {
                        const evtDt = formatDateTimeInOrganizationTimezone(
                          evt.createdAt,
                          preferences.timezone,
                          preferences.dateFormat,
                        )
                        return (
                          <div key={evt.id} className="sales-audit-item">
                            <span className="sales-audit-item__date">
                              {evtDt.dateLabel} {evtDt.timeLabel}
                            </span>
                            <span className="sales-audit-item__action">
                              <strong>{evt.actionSummary}</strong>
                            </span>
                            <span className="sales-audit-item__operator">
                              {evt.operatorName}
                            </span>
                            {evt.notes ? (
                              <small className="sales-audit-item__notes text-muted">
                                ({evt.notes})
                              </small>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  </>
                ) : null}

                <p className="pos-receipt-phase-note">
                  Nota de integridad: este registro conserva los nombres, SKUs,
                  precios e importes vigentes en el momento de la venta. Las
                  devoluciones y cancelaciones se conservan como eventos
                  acumulativos inmutables que actualizan de forma transaccional el
                  inventario y la caja activa.
                </p>
              </div>
            )
          })()}
        </Card>
      ) : null}

      <TicketModal
        isOpen={isTicketModalOpen}
        onClose={() => setIsTicketModalOpen(false)}
        snapshot={ticketModalSnapshot}
        organizationId={organization.id}
        isReprint={isReprintModal}
        onReprintLogged={(updated) => setTicketModalSnapshot(updated)}
      />
    </div>
  )
}
