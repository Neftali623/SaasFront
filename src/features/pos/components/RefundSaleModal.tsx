import { useId, useMemo, useState } from 'react'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import type { CashSession, CashSessionComputedTotals } from '../../cash/types'
import { formatCentsWithHistoricalCurrency } from '../../cash/utils/moneyUtils'
import {
  formatQuantityWithUnit,
  isDivisibleUnit,
  parseStrictQuantityInput,
  toScaledQuantity,
} from '../../inventory/utils/quantityUtils'
import type { ProductUnit } from '../../products/types'
import type {
  RefundSaleItemPayload,
  SaleRecord,
  SaleReturnDestination,
} from '../types'
import {
  calculateReturnLineRefundCents,
  type DerivedSaleSummary,
  getPaymentMethodPresentation,
} from '../utils/posMoneyAndQuantityUtils'

export interface RefundSaleSubmitPayload {
  items: RefundSaleItemPayload[]
  reason: string
  externalReference?: string | null
  externalVerifiedByOperator?: boolean
}

export interface RefundSaleModalProps {
  sale: SaleRecord
  saleComputed: DerivedSaleSummary
  openSession: CashSession | null
  openSessionTotals: CashSessionComputedTotals | null
  operatorName: string
  isSubmitting: boolean
  actionError: string | null
  onConfirmRefund: (payload: RefundSaleSubmitPayload) => void
  onClose: () => void
}

export function RefundSaleModal({
  sale,
  saleComputed,
  openSession,
  openSessionTotals,
  operatorName,
  isSubmitting,
  actionError,
  onConfirmRefund,
  onClose,
}: RefundSaleModalProps) {
  const titleId = useId()
  const reasonId = useId()
  const refId = useId()
  const verifyId = useId()

  const paymentMeta = getPaymentMethodPresentation(sale.payment.method)
  const isCash = sale.payment.method === 'cash'

  // Estado de cantidades y destinos por línea
  const [quantitiesInput, setQuantitiesInput] = useState<Record<string, string>>({})
  const [destinations, setDestinations] = useState<
    Record<string, SaleReturnDestination>
  >(() => {
    const init: Record<string, SaleReturnDestination> = {}
    for (const ls of saleComputed.linesSummary) {
      init[ls.line.id] = 'sellable'
    }
    return init
  })
  const [reason, setReason] = useState('')
  const [externalReference, setExternalReference] = useState('')
  const [externalVerified, setExternalVerified] = useState(false)
  const [generalError, setFieldError] = useState<string | null>(null)

  // Cálculo en vivo de las partidas seleccionadas
  const computedRefundDraft = useMemo(() => {
    let totalRefundCents = 0
    let totalItemsSelected = 0
    let sellableItemsCount = 0
    let unsellableItemsCount = 0
    const lineDrafts: Array<{
      lineId: string
      lineName: string
      sku: string
      unit: ProductUnit
      maxAvailable: number
      parsedQty: number
      refundCents: number
      destination: SaleReturnDestination
      hasError: boolean
      errorMessage?: string
    }> = []

    for (const ls of saleComputed.linesSummary) {
      const rawInput = quantitiesInput[ls.line.id]?.trim() ?? ''
      const dest = destinations[ls.line.id] ?? 'sellable'

      if (!rawInput) {
        lineDrafts.push({
          lineId: ls.line.id,
          lineName: ls.line.productName,
          sku: ls.line.sku,
          unit: ls.line.unit,
          maxAvailable: ls.remainingReturnableQuantity,
          parsedQty: 0,
          refundCents: 0,
          destination: dest,
          hasError: false,
        })
        continue
      }

      const parsed = parseStrictQuantityInput(rawInput, ls.line.unit, {
        allowZero: true,
        fieldLabel: `cantidad de ${ls.line.productName}`,
      })

      if (!parsed.ok || parsed.value === null) {
        lineDrafts.push({
          lineId: ls.line.id,
          lineName: ls.line.productName,
          sku: ls.line.sku,
          unit: ls.line.unit,
          maxAvailable: ls.remainingReturnableQuantity,
          parsedQty: 0,
          refundCents: 0,
          destination: dest,
          hasError: true,
          errorMessage: parsed.ok ? 'Cantidad inválida' : parsed.error,
        })
        continue
      }

      const qty = parsed.value
      if (toScaledQuantity(qty) <= 0) {
        lineDrafts.push({
          lineId: ls.line.id,
          lineName: ls.line.productName,
          sku: ls.line.sku,
          unit: ls.line.unit,
          maxAvailable: ls.remainingReturnableQuantity,
          parsedQty: 0,
          refundCents: 0,
          destination: dest,
          hasError: false,
        })
        continue
      }

      if (toScaledQuantity(qty) > toScaledQuantity(ls.remainingReturnableQuantity)) {
        lineDrafts.push({
          lineId: ls.line.id,
          lineName: ls.line.productName,
          sku: ls.line.sku,
          unit: ls.line.unit,
          maxAvailable: ls.remainingReturnableQuantity,
          parsedQty: qty,
          refundCents: 0,
          destination: dest,
          hasError: true,
          errorMessage: `Excede lo pendiente (${formatQuantityWithUnit(
            ls.remainingReturnableQuantity,
            ls.line.unit,
          )})`,
        })
        continue
      }

      const refundCents = calculateReturnLineRefundCents(
        ls.line,
        ls.returnedQuantity,
        ls.refundedCents,
        qty,
      )

      totalRefundCents += refundCents
      totalItemsSelected += 1
      if (dest === 'sellable') {
        sellableItemsCount += 1
      } else {
        unsellableItemsCount += 1
      }

      lineDrafts.push({
        lineId: ls.line.id,
        lineName: ls.line.productName,
        sku: ls.line.sku,
        unit: ls.line.unit,
        maxAvailable: ls.remainingReturnableQuantity,
        parsedQty: qty,
        refundCents,
        destination: dest,
        hasError: false,
      })
    }

    return {
      lineDrafts,
      totalRefundCents,
      totalItemsSelected,
      sellableItemsCount,
      unsellableItemsCount,
      hasAnyLineError: lineDrafts.some((ld) => ld.hasError),
    }
  }, [saleComputed.linesSummary, quantitiesInput, destinations])

  // Verificación de caja en efectivo
  const isCurrencyCompatible =
    isCash && openSession ? openSession.currency === sale.currency : true
  const hasSufficientCash =
    isCash && openSession && openSessionTotals
      ? openSessionTotals.expectedBalanceCents >= computedRefundDraft.totalRefundCents
      : true

  let cashBlockReason: string | null = null
  if (isCash) {
    if (!openSession) {
      cashBlockReason =
        'Se requiere una sesión de caja abierta en esta sucursal para entregar el reembolso en efectivo.'
    } else if (!isCurrencyCompatible) {
      cashBlockReason = `La sesión de caja abierta está en ${openSession.currency}, incompatible con la moneda de la venta (${sale.currency}).`
    } else if (
      computedRefundDraft.totalRefundCents > 0 &&
      !hasSufficientCash &&
      openSessionTotals
    ) {
      cashBlockReason = `Saldo en caja insuficiente para el reembolso (${formatCentsWithHistoricalCurrency(
        openSessionTotals.expectedBalanceCents,
        sale.currency,
      )} disponible vs ${formatCentsWithHistoricalCurrency(
        computedRefundDraft.totalRefundCents,
        sale.currency,
      )} requerido).`
    }
  }

  const canConfirm =
    computedRefundDraft.totalItemsSelected > 0 &&
    computedRefundDraft.totalRefundCents > 0 &&
    !computedRefundDraft.hasAnyLineError &&
    cashBlockReason === null

  const handleSetMaxQuantity = (lineId: string, maxQty: number) => {
    setQuantitiesInput((prev) => ({
      ...prev,
      [lineId]: String(maxQty),
    }))
    setFieldError(null)
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting || !canConfirm) {
      return
    }

    const cleanReason = reason.trim()
    if (cleanReason.length < 3) {
      setFieldError('Ingresa un motivo descriptivo para la devolución (mínimo 3 caracteres).')
      return
    }

    if (!isCash && !externalVerified) {
      setFieldError(
        `Debes marcar la confirmación de que el reembolso externo por ${paymentMeta.label.toLowerCase()} fue verificado y entregado fuera del sistema.`,
      )
      return
    }

    const payloadItems: RefundSaleItemPayload[] = []
    for (const ld of computedRefundDraft.lineDrafts) {
      if (ld.parsedQty > 0 && !ld.hasError) {
        payloadItems.push({
          saleLineId: ld.lineId,
          returnedQuantity: ld.parsedQty,
          destination: ld.destination,
        })
      }
    }

    setFieldError(null)
    onConfirmRefund({
      items: payloadItems,
      reason: cleanReason,
      externalReference: externalReference.trim() || null,
      externalVerifiedByOperator: !isCash ? externalVerified : true,
    })
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal-dialog pos-refund-sale-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="pos-checkout-dialog__header">
          <div>
            <h2 id={titleId} className="modal-dialog__title">
              Registrar devolución · Venta {sale.folio}
            </h2>
            <p className="modal-dialog__description">
              Selecciona las cantidades a devolver, el destino de la mercancía y
              el motivo del reembolso.
            </p>
          </div>
          <Badge variant="brand">{sale.currency}</Badge>
        </div>

        {cashBlockReason ? (
          <div
            className="settings-alert settings-alert--warning"
            role="alert"
            aria-live="polite"
          >
            <div className="settings-alert__content">
              <strong>Atención de caja en efectivo</strong>
              <p>{cashBlockReason}</p>
            </div>
          </div>
        ) : null}

        {actionError ? (
          <div
            className="settings-alert settings-alert--error"
            role="alert"
            aria-live="assertive"
          >
            <div className="settings-alert__content">
              <strong>Error al procesar la devolución</strong>
              <p>{actionError}</p>
            </div>
          </div>
        ) : null}

        <div className="pos-checkout-context-grid">
          <div>
            <span className="pos-checkout-context-grid__label">Venta original</span>
            <strong>
              <code>{sale.folio}</code> · {sale.operatorName}
            </strong>
          </div>
          <div>
            <span className="pos-checkout-context-grid__label">Método de reembolso</span>
            <strong>{paymentMeta.fullLabel}</strong>
          </div>
          <div>
            <span className="pos-checkout-context-grid__label">Total original</span>
            <strong>
              {formatCentsWithHistoricalCurrency(sale.totalCents, sale.currency)}
            </strong>
          </div>
          <div>
            <span className="pos-checkout-context-grid__label">Reembolsado a la fecha</span>
            <strong className="text-muted">
              {formatCentsWithHistoricalCurrency(
                saleComputed.refundedTotalCents,
                sale.currency,
              )}
            </strong>
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate className="pos-checkout-form">
          <div className="table-responsive">
            <table
              className="data-table pos-refund-table"
              aria-label="Selección de partidas a devolver"
            >
              <thead>
                <tr>
                  <th>Producto / Código</th>
                  <th>Precio histórico</th>
                  <th>Pendiente</th>
                  <th>Cant. a devolver</th>
                  <th>Destino de mercancía</th>
                  <th>Reembolso partida</th>
                </tr>
              </thead>
              <tbody>
                {saleComputed.linesSummary.map((ls) => {
                  const draft = computedRefundDraft.lineDrafts.find(
                    (d) => d.lineId === ls.line.id,
                  )
                  const isAvailable = toScaledQuantity(ls.remainingReturnableQuantity) > 0
                  const inputValue = quantitiesInput[ls.line.id] ?? ''

                  return (
                    <tr
                      key={ls.line.id}
                      className={!isAvailable ? 'pos-refund-row--disabled' : ''}
                    >
                      <td>
                        <strong>{ls.line.productName}</strong>
                        <div className="text-muted" style={{ fontSize: '0.74rem' }}>
                          SKU: <code>{ls.line.sku}</code> · Vendido:{' '}
                          {formatQuantityWithUnit(ls.line.quantity, ls.line.unit)}
                        </div>
                      </td>
                      <td>
                        {formatCentsWithHistoricalCurrency(
                          ls.line.unitPriceCents,
                          sale.currency,
                        )}
                      </td>
                      <td>
                        <strong>
                          {formatQuantityWithUnit(
                            ls.remainingReturnableQuantity,
                            ls.line.unit,
                          )}
                        </strong>
                      </td>
                      <td>
                        {isAvailable ? (
                          <div className="pos-refund-qty-input-box">
                            <input
                              type="text"
                              inputMode={
                                isDivisibleUnit(ls.line.unit)
                                  ? 'decimal'
                                  : 'numeric'
                              }
                              className={`form-input pos-refund-input ${
                                draft?.hasError ? 'form-input--error' : ''
                              }`}
                              placeholder="0"
                              value={inputValue}
                              disabled={isSubmitting}
                              onChange={(e) => {
                                const val = e.target.value
                                setQuantitiesInput((prev) => ({
                                  ...prev,
                                  [ls.line.id]: val,
                                }))
                                setFieldError(null)
                              }}
                            />
                            <button
                              type="button"
                              className="pos-quick-cash-pill"
                              disabled={isSubmitting}
                              onClick={() =>
                                handleSetMaxQuantity(
                                  ls.line.id,
                                  ls.remainingReturnableQuantity,
                                )
                              }
                            >
                              Todo
                            </button>
                            {draft?.errorMessage ? (
                              <span className="pos-refund-inline-error">
                                {draft.errorMessage}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <Badge variant="neutral">Devuelto al 100%</Badge>
                        )}
                      </td>
                      <td>
                        {isAvailable ? (
                          <select
                            className="form-select pos-refund-dest-select"
                            value={destinations[ls.line.id] ?? 'sellable'}
                            disabled={isSubmitting || draft?.parsedQty === 0}
                            onChange={(e) => {
                              const dest = e.target
                                .value as SaleReturnDestination
                              setDestinations((prev) => ({
                                ...prev,
                                [ls.line.id]: dest,
                              }))
                            }}
                          >
                            <option value="sellable">Vendible (reingresa a stock)</option>
                            <option value="unsellable">No vendible / dañado (merma)</option>
                          </select>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td>
                        <strong>
                          {formatCentsWithHistoricalCurrency(
                            draft?.refundCents ?? 0,
                            sale.currency,
                          )}
                        </strong>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="pos-refund-preconfirmation-card">
            <span className="pos-checkout-lines-preview__title">
              Resumen previo de la devolución:
            </span>
            <div className="pos-refund-summary-grid">
              <div>
                <span>Partidas a devolver:</span>{' '}
                <strong>{computedRefundDraft.totalItemsSelected}</strong>
              </div>
              <div>
                <span>Reingreso a stock vendible:</span>{' '}
                <strong>
                  {computedRefundDraft.sellableItemsCount} partida(s)
                </strong>
              </div>
              <div>
                <span>Artículos no vendibles (merma):</span>{' '}
                <strong>
                  {computedRefundDraft.unsellableItemsCount} partida(s)
                </strong>
              </div>
              <div className="pos-refund-summary-total">
                <span>Total a reembolsar:</span>{' '}
                <strong className="pos-cart-summary__total-amount">
                  {formatCentsWithHistoricalCurrency(
                    computedRefundDraft.totalRefundCents,
                    sale.currency,
                  )}
                </strong>
              </div>
            </div>
          </div>

          <div className="form-field">
            <label htmlFor={reasonId} className="form-label">
              Motivo obligatorio de la devolución *
            </label>
            <input
              id={reasonId}
              type="text"
              maxLength={150}
              className={`form-input ${generalError ? 'form-input--error' : ''}`}
              placeholder="Ej. Mercancía defectuosa / Talla equivocada / Desistimiento"
              value={reason}
              disabled={isSubmitting}
              onChange={(e) => {
                setReason(e.target.value)
                setFieldError(null)
              }}
            />
          </div>

          {isCash ? (
            <div className="pos-manual-payment-notice" role="note">
              <strong>Reembolso en efectivo en mostrador</strong>
              <p>
                El dinero por{' '}
                <strong>
                  {formatCentsWithHistoricalCurrency(
                    computedRefundDraft.totalRefundCents,
                    sale.currency,
                  )}
                </strong>{' '}
                se entregará al cliente desde la sesión de caja abierta actual{' '}
                <code>{openSession?.id ?? 'Sin sesión abierta'}</code> y se
                registrará como salida de efectivo vinculada a la devolución.
              </p>
            </div>
          ) : (
            <div className="pos-payment-section">
              <div className="pos-manual-payment-notice" role="note">
                <strong>
                  Reembolso manual externo ({paymentMeta.label}) — Sin pasarela
                </strong>
                <p>
                  Nedaxoli Control no procesa transferencias ni reintegros
                  bancarios automáticos. Ejecuta la devolución desde tu terminal
                  física o banca electrónica. Esta devolución no afectará el
                  efectivo físico de caja.
                </p>
              </div>

              <div className="form-field">
                <label htmlFor={refId} className="form-label">
                  Referencia externa de reembolso (opcional)
                </label>
                <input
                  id={refId}
                  type="text"
                  maxLength={80}
                  className="form-input"
                  placeholder="Ej. REF-DEV-49910 / Voucher de devolución"
                  value={externalReference}
                  disabled={isSubmitting}
                  onChange={(e) => setExternalReference(e.target.value)}
                />
              </div>

              <label htmlFor={verifyId} className="pos-external-verify-checkbox">
                <input
                  id={verifyId}
                  type="checkbox"
                  checked={externalVerified}
                  disabled={isSubmitting}
                  onChange={(e) => {
                    setExternalVerified(e.target.checked)
                    setFieldError(null)
                  }}
                />
                <span>
                  Confirmo como operador ({operatorName}) que el reembolso
                  externo por{' '}
                  <strong>
                    {formatCentsWithHistoricalCurrency(
                      computedRefundDraft.totalRefundCents,
                      sale.currency,
                    )}
                  </strong>{' '}
                  fue verificado y entregado fuera del sistema.
                </span>
              </label>
            </div>
          )}

          {generalError ? (
            <p className="form-error" role="alert">
              {generalError}
            </p>
          ) : null}

          <div className="modal-dialog__actions">
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting || !canConfirm}
            >
              {isSubmitting
                ? 'Procesando devolución...'
                : `Confirmar devolución (${formatCentsWithHistoricalCurrency(
                    computedRefundDraft.totalRefundCents,
                    sale.currency,
                  )})`}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={onClose}
            >
              Cerrar
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
