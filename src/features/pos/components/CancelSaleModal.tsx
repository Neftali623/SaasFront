import { useId, useState } from 'react'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import type { DateFormatOption, TimezoneOption } from '../../../types'
import type { CashSession, CashSessionComputedTotals } from '../../cash/types'
import { formatCentsWithHistoricalCurrency } from '../../cash/utils/moneyUtils'
import {
  formatDateTimeInOrganizationTimezone,
  formatQuantityWithUnit,
} from '../../inventory/utils/quantityUtils'
import type { SaleRecord } from '../types'
import {
  type DerivedSaleSummary,
  getPaymentMethodPresentation,
} from '../utils/posMoneyAndQuantityUtils'

export interface CancelSaleSubmitPayload {
  reason: string
  externalReference?: string | null
  externalVerifiedByOperator?: boolean
}

export interface CancelSaleModalProps {
  sale: SaleRecord
  saleComputed: DerivedSaleSummary
  openSession: CashSession | null
  openSessionTotals: CashSessionComputedTotals | null
  operatorName: string
  isSubmitting: boolean
  actionError: string | null
  timezone: TimezoneOption
  dateFormat: DateFormatOption
  onConfirmCancel: (payload: CancelSaleSubmitPayload) => void
  onClose: () => void
}

export function CancelSaleModal({
  sale,
  saleComputed,
  openSession,
  openSessionTotals,
  operatorName,
  isSubmitting,
  actionError,
  timezone,
  dateFormat,
  onConfirmCancel,
  onClose,
}: CancelSaleModalProps) {
  const titleId = useId()
  const reasonId = useId()
  const refId = useId()
  const verifyId = useId()

  const [reason, setReason] = useState('')
  const [externalReference, setExternalReference] = useState('')
  const [externalVerified, setExternalVerified] = useState(false)
  const [fieldError, setFieldError] = useState<string | null>(null)

  const paymentMeta = getPaymentMethodPresentation(sale.payment.method)
  const isCash = sale.payment.method === 'cash'

  // Reglas de elegibilidad para cancelación:
  // 1. Sesión original de caja debe seguir abierta
  const isOriginalSessionOpen =
    openSession !== null && openSession.id === sale.sessionId

  // 2. Si es efectivo, debe haber saldo suficiente en la sesión original
  const hasSufficientCashBalance =
    isCash &&
    isOriginalSessionOpen &&
    openSessionTotals !== null &&
    openSessionTotals.expectedBalanceCents >= sale.totalCents

  const cannotCancelReason = !saleComputed.canCancel
    ? saleComputed.cancelBlockReason
    : !isOriginalSessionOpen
      ? `La sesión de caja original (${sale.sessionId}) en la que se cobró esta venta ya fue cerrada. Las ventas de turnos cerrados no pueden cancelarse completamente; deben gestionarse mediante Devolución.`
      : isCash && !hasSufficientCashBalance
        ? `Saldo insuficiente en la sesión de caja abierta para reembolsar en efectivo (${formatCentsWithHistoricalCurrency(
            openSessionTotals?.expectedBalanceCents ?? 0,
            sale.currency,
          )} disponible vs ${formatCentsWithHistoricalCurrency(
            sale.totalCents,
            sale.currency,
          )} requerido).`
        : null

  const isEligible = cannotCancelReason === null

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting || !isEligible) {
      return
    }

    const cleanReason = reason.trim()
    if (cleanReason.length < 3) {
      setFieldError(
        'Ingresa un motivo descriptivo para la cancelación (mínimo 3 caracteres).',
      )
      return
    }

    if (!isCash && !externalVerified) {
      setFieldError(
        `Debes marcar la confirmación de que el reembolso externo por ${paymentMeta.label.toLowerCase()} fue verificado y entregado fuera del sistema.`,
      )
      return
    }

    setFieldError(null)
    onConfirmCancel({
      reason: cleanReason,
      externalReference: externalReference.trim() || null,
      externalVerifiedByOperator: !isCash ? externalVerified : true,
    })
  }

  const saleDateFormatted = formatDateTimeInOrganizationTimezone(
    sale.createdAt,
    timezone,
    dateFormat,
  )

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal-dialog pos-cancel-sale-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="pos-checkout-dialog__header">
          <div>
            <h2 id={titleId} className="modal-dialog__title">
              Cancelar venta {sale.folio}
            </h2>
            <p className="modal-dialog__description">
              Reversión completa e inmutable de la operación de venta en Punto
              de Venta.
            </p>
          </div>
          <Badge variant="neutral">{sale.currency}</Badge>
        </div>

        <div className="pos-cancel-warning-banner" role="alert">
          <strong>Advertencia de cancelación completa:</strong>
          <p>
            Esta acción revertirá la venta al 100%. Reingresará todas las
            unidades ({sale.lines.length} partida(s)) a las existencias
            vendibles de inventario y registrará el reembolso íntegro por{' '}
            <strong>
              {formatCentsWithHistoricalCurrency(sale.totalCents, sale.currency)}
            </strong>{' '}
            según el método original ({paymentMeta.label}).
          </p>
        </div>

        {!isEligible ? (
          <div
            className="settings-alert settings-alert--error"
            role="alert"
            aria-live="assertive"
          >
            <div className="settings-alert__content">
              <strong>Cancelación no permitida</strong>
              <p>{cannotCancelReason}</p>
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
              <strong>Error al procesar la cancelación</strong>
              <p>{actionError}</p>
            </div>
          </div>
        ) : null}

        <div className="pos-checkout-context-grid">
          <div>
            <span className="pos-checkout-context-grid__label">
              Folio y fecha original
            </span>
            <strong>
              <code>{sale.folio}</code> · {saleDateFormatted.fullLabel}
            </strong>
          </div>
          <div>
            <span className="pos-checkout-context-grid__label">
              Sucursal y caja
            </span>
            <strong>
              {sale.branchName} · {sale.registerName} ({sale.registerCode})
            </strong>
          </div>
          <div>
            <span className="pos-checkout-context-grid__label">
              Sesión original
            </span>
            <strong>
              Sesión <code>{sale.sessionId}</code>{' '}
              {isOriginalSessionOpen ? (
                <Badge variant="success">Turno abierto</Badge>
              ) : (
                <Badge variant="neutral">Turno cerrado</Badge>
              )}
            </strong>
          </div>
          <div>
            <span className="pos-checkout-context-grid__label">
              Total a reembolsar
            </span>
            <strong className="pos-checkout-context-grid__total">
              {formatCentsWithHistoricalCurrency(sale.totalCents, sale.currency)}{' '}
              ({paymentMeta.label})
            </strong>
          </div>
        </div>

        <div className="pos-checkout-lines-preview">
          <span className="pos-checkout-lines-preview__title">
            Partidas que reingresarán como stock vendible:
          </span>
          <ul className="pos-checkout-lines-list">
            {sale.lines.map((line) => (
              <li key={line.id} className="pos-checkout-lines-list__item">
                <span>
                  <strong>{line.productName}</strong> (<code>{line.sku}</code>) ·{' '}
                  {formatQuantityWithUnit(line.quantity, line.unit)}
                </span>
                <strong>
                  {formatCentsWithHistoricalCurrency(
                    line.lineSubtotalCents,
                    sale.currency,
                  )}
                </strong>
              </li>
            ))}
          </ul>
        </div>

        <form onSubmit={handleSubmit} noValidate className="pos-checkout-form">
          <div className="form-field">
            <label htmlFor={reasonId} className="form-label">
              Motivo obligatorio de la cancelación *
            </label>
            <input
              id={reasonId}
              type="text"
              maxLength={150}
              className={`form-input ${fieldError ? 'form-input--error' : ''}`}
              placeholder="Ej. Error en cobro / Cliente canceló antes del despacho"
              value={reason}
              disabled={isSubmitting || !isEligible}
              onChange={(e) => {
                setReason(e.target.value)
                setFieldError(null)
              }}
            />
          </div>

          {isCash ? (
            <div className="pos-manual-payment-notice" role="note">
              <strong>Reembolso en efectivo desde sesión original</strong>
              <p>
                El dinero en efectivo por{' '}
                <strong>
                  {formatCentsWithHistoricalCurrency(
                    sale.totalCents,
                    sale.currency,
                  )}
                </strong>{' '}
                se descontará del saldo esperado de la sesión de caja activa{' '}
                <code>{sale.sessionId}</code>.
                {openSessionTotals
                  ? ` Saldo en caja tras el reembolso: ${formatCentsWithHistoricalCurrency(
                      openSessionTotals.expectedBalanceCents - sale.totalCents,
                      sale.currency,
                    )}.`
                  : ''}
              </p>
            </div>
          ) : (
            <div className="pos-payment-section">
              <div className="pos-manual-payment-notice" role="note">
                <strong>
                  Reembolso manual externo ({paymentMeta.label}) — Sin pasarela
                </strong>
                <p>
                  Nedaxoli Control no revierte cargos bancarios en automático.
                  Asegúrate de ejecutar la devolución desde tu terminal física o
                  banca electrónica. Esta operación no afectará el efectivo físico
                  de la caja.
                </p>
              </div>

              <div className="form-field">
                <label htmlFor={refId} className="form-label">
                  Referencia externa de devolución (opcional)
                </label>
                <input
                  id={refId}
                  type="text"
                  maxLength={80}
                  className="form-input"
                  placeholder="Ej. REF-DEV-88910 / Voucher de devolución"
                  value={externalReference}
                  disabled={isSubmitting || !isEligible}
                  onChange={(e) => setExternalReference(e.target.value)}
                />
              </div>

              <label htmlFor={verifyId} className="pos-external-verify-checkbox">
                <input
                  id={verifyId}
                  type="checkbox"
                  checked={externalVerified}
                  disabled={isSubmitting || !isEligible}
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
                      sale.totalCents,
                      sale.currency,
                    )}
                  </strong>{' '}
                  fue verificado y entregado fuera del sistema.
                </span>
              </label>
            </div>
          )}

          {fieldError ? (
            <p className="form-error" role="alert">
              {fieldError}
            </p>
          ) : null}

          <div className="modal-dialog__actions">
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting || !isEligible}
            >
              {isSubmitting
                ? 'Cancelando venta...'
                : `Confirmar cancelación (${formatCentsWithHistoricalCurrency(
                    sale.totalCents,
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
