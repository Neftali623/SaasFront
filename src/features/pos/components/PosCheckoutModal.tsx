import { useId, useMemo, useState } from 'react'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import type {
  CashRegister,
  CashSession,
} from '../../cash/types'
import {
  centsToAmount,
  formatCentsWithHistoricalCurrency,
  parseStrictCashInputToCents,
} from '../../cash/utils/moneyUtils'
import { formatQuantityWithUnit } from '../../inventory/utils/quantityUtils'
import type {
  PosCartItem,
  PosCheckoutDiscrepancy,
  PosPaymentMethod,
} from '../types'
import {
  calculateCartTotals,
  getPaymentMethodPresentation,
} from '../utils/posMoneyAndQuantityUtils'

export interface PosCheckoutSubmitPayload {
  paymentMethod: PosPaymentMethod
  cashReceivedCents: number | null
  externalReference: string | null
  externalVerifiedByOperator: boolean
}

export interface PosCheckoutModalProps {
  organizationName: string
  branchName: string
  register: CashRegister
  openSession: CashSession
  operatorName: string
  cartItems: PosCartItem[]
  discrepancies: PosCheckoutDiscrepancy[]
  checkoutError: string | null
  isSubmitting: boolean
  onConfirmCheckout: (payload: PosCheckoutSubmitPayload) => void
  onSyncCartWithLiveState: () => void
  onClose: () => void
  onSimulateMidCheckoutChange?: () => void
}

export function PosCheckoutModal({
  organizationName,
  branchName,
  register,
  openSession,
  operatorName,
  cartItems,
  discrepancies,
  checkoutError,
  isSubmitting,
  onConfirmCheckout,
  onSyncCartWithLiveState,
  onClose,
  onSimulateMidCheckoutChange,
}: PosCheckoutModalProps) {
  const titleId = useId()
  const cashInputId = useId()
  const referenceInputId = useId()
  const verifyCheckboxId = useId()

  const totals = useMemo(() => calculateCartTotals(cartItems), [cartItems])
  const currency = openSession.currency

  const [paymentMethod, setPaymentMethod] = useState<PosPaymentMethod>('cash')
  const [cashReceivedInput, setCashReceivedInput] = useState<string>(() =>
    centsToAmount(totals.totalCents).toFixed(2),
  )
  const [externalReference, setExternalReference] = useState<string>('')
  const [externalVerified, setExternalVerified] = useState<boolean>(false)
  const [fieldError, setFieldError] = useState<string | null>(null)

  const parsedCashReceived = useMemo(() => {
    if (paymentMethod !== 'cash') {
      return null
    }
    return parseStrictCashInputToCents(
      cashReceivedInput,
      'efectivo recibido',
      true,
    )
  }, [cashReceivedInput, paymentMethod])

  const changeCents = useMemo(() => {
    if (
      paymentMethod !== 'cash' ||
      !parsedCashReceived ||
      !parsedCashReceived.ok
    ) {
      return null
    }
    return parsedCashReceived.cents - totals.totalCents
  }, [parsedCashReceived, paymentMethod, totals.totalCents])

  const quickCashSuggestionsCents = useMemo(() => {
    const exact = totals.totalCents
    const candidates = new Set<number>([exact])
    const commonBillsCents = [5000, 10000, 20000, 50000, 100000]
    for (const bill of commonBillsCents) {
      if (bill >= exact) {
        candidates.add(bill)
      }
      const roundedUp = Math.ceil(exact / bill) * bill
      if (roundedUp >= exact && roundedUp <= exact + 100000) {
        candidates.add(roundedUp)
      }
    }
    return Array.from(candidates)
      .sort((a, b) => a - b)
      .slice(0, 5)
  }, [totals.totalCents])

  const handleMethodSelect = (method: PosPaymentMethod) => {
    setPaymentMethod(method)
    setFieldError(null)
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting || discrepancies.length > 0) {
      return
    }

    if (paymentMethod === 'cash') {
      const parsed = parseStrictCashInputToCents(
        cashReceivedInput,
        'efectivo recibido',
        false,
      )
      if (!parsed.ok) {
        setFieldError(parsed.error)
        return
      }
      if (parsed.cents < totals.totalCents) {
        setFieldError(
          `El efectivo recibido (${formatCentsWithHistoricalCurrency(
            parsed.cents,
            currency,
          )}) es menor al total a cobrar (${formatCentsWithHistoricalCurrency(
            totals.totalCents,
            currency,
          )}).`,
        )
        return
      }

      setFieldError(null)
      onConfirmCheckout({
        paymentMethod: 'cash',
        cashReceivedCents: parsed.cents,
        externalReference: null,
        externalVerifiedByOperator: false,
      })
      return
    }

    const cleanRef = externalReference.trim()
    if (cleanRef.length > 80) {
      setFieldError('La referencia externa no puede exceder 80 caracteres.')
      return
    }

    if (!externalVerified) {
      setFieldError(
        `Debes marcar la casilla confirmando que el cobro por ${
          paymentMethod === 'card' ? 'tarjeta' : 'transferencia'
        } fue verificado externamente.`,
      )
      return
    }

    setFieldError(null)
    onConfirmCheckout({
      paymentMethod,
      cashReceivedCents: null,
      externalReference: cleanRef ? cleanRef : null,
      externalVerifiedByOperator: true,
    })
  }

  const selectedMethodMeta = getPaymentMethodPresentation(paymentMethod)

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal-dialog pos-checkout-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="pos-checkout-dialog__header">
          <div>
            <h2 id={titleId} className="modal-dialog__title">
              Confirmación de cobro
            </h2>
            <p className="modal-dialog__description">
              Revisa las partidas, selecciona el método de pago y confirma el
              registro de la venta.
            </p>
          </div>
          <Badge variant="brand">Moneda: {currency}</Badge>
        </div>

        <div className="pos-checkout-context-grid">
          <div>
            <span className="pos-checkout-context-grid__label">
              Organización / Sucursal
            </span>
            <strong>
              {organizationName} · {branchName}
            </strong>
          </div>
          <div>
            <span className="pos-checkout-context-grid__label">
              Caja y sesión activa
            </span>
            <strong>
              {register.name} ({register.code}) · Turno abierto
            </strong>
          </div>
          <div>
            <span className="pos-checkout-context-grid__label">
              Operador responsable
            </span>
            <strong>{operatorName}</strong>
          </div>
          <div>
            <span className="pos-checkout-context-grid__label">
              Partidas / Total a cobrar
            </span>
            <strong className="pos-checkout-context-grid__total">
              {totals.distinctItemsCount} partida(s) ·{' '}
              {formatCentsWithHistoricalCurrency(totals.totalCents, currency)}
            </strong>
          </div>
        </div>

        {discrepancies.length > 0 ? (
          <div
            className="settings-alert settings-alert--warning"
            role="alert"
            aria-live="assertive"
          >
            <div className="settings-alert__content">
              <strong>
                El catálogo o las existencias cambiaron antes de confirmar
              </strong>
              <p>
                Por seguridad, no se procesó el cobro automáticamente. Revisa
                las siguientes diferencias detectadas:
              </p>
              <ul className="pos-discrepancy-list">
                {discrepancies.map((disc) => (
                  <li key={`${disc.productId}-${disc.kind}`}>
                    <strong>
                      {disc.productName} (<code>{disc.sku}</code>):
                    </strong>{' '}
                    {disc.message}
                  </li>
                ))}
              </ul>
            </div>
            <div className="settings-alert__actions">
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={onSyncCartWithLiveState}
              >
                Sincronizar carrito y revisar de nuevo
              </Button>
            </div>
          </div>
        ) : null}

        {checkoutError && discrepancies.length === 0 ? (
          <div
            className="settings-alert settings-alert--error"
            role="alert"
            aria-live="assertive"
          >
            <div className="settings-alert__content">
              <strong>No se pudo completar el cobro</strong>
              <p>{checkoutError}</p>
            </div>
          </div>
        ) : null}

        <div className="pos-checkout-lines-preview">
          <span className="pos-checkout-lines-preview__title">
            Resumen de artículos a descontar de inventario
          </span>
          <ul className="pos-checkout-lines-list">
            {cartItems.map((line) => (
              <li key={line.productId} className="pos-checkout-lines-list__item">
                <span>
                  <strong>{line.productName}</strong> (<code>{line.sku}</code>) ·{' '}
                  {formatQuantityWithUnit(line.quantity, line.unit)} ×{' '}
                  {formatCentsWithHistoricalCurrency(
                    line.unitPriceCents,
                    currency,
                  )}
                </span>
                <strong>
                  {formatCentsWithHistoricalCurrency(
                    line.lineSubtotalCents,
                    currency,
                  )}
                </strong>
              </li>
            ))}
          </ul>
        </div>

        <form onSubmit={handleSubmit} noValidate className="pos-checkout-form">
          <fieldset
            className="pos-payment-methods-fieldset"
            disabled={isSubmitting}
          >
            <legend className="form-label">
              Método de pago (un solo método por venta)
            </legend>
            <div className="pos-payment-method-tabs">
              {(['cash', 'card', 'transfer'] as const).map((method) => {
                const meta = getPaymentMethodPresentation(method)
                const isSelected = paymentMethod === method
                return (
                  <button
                    key={method}
                    type="button"
                    className={`pos-payment-method-tab ${
                      isSelected ? 'pos-payment-method-tab--active' : ''
                    }`}
                    aria-pressed={isSelected}
                    onClick={() => handleMethodSelect(method)}
                  >
                    <span className="pos-payment-method-tab__title">
                      {meta.label}
                    </span>
                    <span className="pos-payment-method-tab__sub">
                      {meta.affectsPhysicalCash
                        ? 'Suma efectivo a caja'
                        : 'Registro manual (sin terminal)'}
                    </span>
                  </button>
                )
              })}
            </div>
          </fieldset>

          {paymentMethod === 'cash' ? (
            <div className="pos-payment-section">
              <div className="pos-cash-calculation-grid">
                <div className="pos-cash-field">
                  <label htmlFor={cashInputId} className="form-label">
                    Efectivo recibido del cliente ({currency}) *
                  </label>
                  <input
                    id={cashInputId}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    className={`form-input ${
                      fieldError ? 'form-input--error' : ''
                    }`}
                    value={cashReceivedInput}
                    disabled={isSubmitting}
                    onChange={(event) => {
                      setCashReceivedInput(event.target.value)
                      setFieldError(null)
                    }}
                  />
                  <div className="pos-quick-cash-pills">
                    {quickCashSuggestionsCents.map((suggestionCents) => {
                      const isExact = suggestionCents === totals.totalCents
                      return (
                        <button
                          key={suggestionCents}
                          type="button"
                          className="pos-quick-cash-pill"
                          disabled={isSubmitting}
                          onClick={() => {
                            setCashReceivedInput(
                              centsToAmount(suggestionCents).toFixed(2),
                            )
                            setFieldError(null)
                          }}
                        >
                          {isExact
                            ? `Exacto (${formatCentsWithHistoricalCurrency(
                                suggestionCents,
                                currency,
                              )})`
                            : formatCentsWithHistoricalCurrency(
                                suggestionCents,
                                currency,
                              )}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="pos-cash-change-box">
                  <span className="pos-cash-change-box__label">
                    Cambio a devolver
                  </span>
                  {changeCents !== null && changeCents >= 0 ? (
                    <strong className="pos-cash-change-box__value pos-cash-change-box__value--ok">
                      {formatCentsWithHistoricalCurrency(changeCents, currency)}
                    </strong>
                  ) : (
                    <strong className="pos-cash-change-box__value pos-cash-change-box__value--pending">
                      {changeCents !== null
                        ? `Faltan ${formatCentsWithHistoricalCurrency(
                            Math.abs(changeCents),
                            currency,
                          )}`
                        : 'Ingresa un monto válido'}
                    </strong>
                  )}
                  <span className="pos-cash-change-box__note">
                    Ingreso neto a caja:{' '}
                    <strong>
                      {formatCentsWithHistoricalCurrency(
                        totals.totalCents,
                        currency,
                      )}
                    </strong>{' '}
                    (total de la venta, no el efectivo recibido)
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="pos-payment-section">
              <div className="pos-manual-payment-notice" role="note">
                <strong>
                  {selectedMethodMeta.fullLabel} — Sin terminal integrada
                </strong>
                <p>
                  Nedaxoli Control no procesa ni autoriza cobros bancarios en
                  esta fase. Verifica en tu terminal física o banca electrónica
                  que el pago por{' '}
                  <strong>
                    {formatCentsWithHistoricalCurrency(
                      totals.totalCents,
                      currency,
                    )}
                  </strong>{' '}
                  fue aprobado antes de confirmar. Este registro{' '}
                  <strong>no incrementa el efectivo físico</strong> esperado en
                  la sesión de caja.
                </p>
              </div>

              <div className="form-field">
                <label htmlFor={referenceInputId} className="form-label">
                  Referencia, autorización o últimos dígitos (opcional)
                </label>
                <input
                  id={referenceInputId}
                  type="text"
                  maxLength={80}
                  className="form-input"
                  placeholder={
                    paymentMethod === 'card'
                      ? 'Ej. AUT-482910 / Voucher terminal física'
                      : 'Ej. SPEI-992817 / Clave de rastreo'
                  }
                  value={externalReference}
                  disabled={isSubmitting}
                  onChange={(event) => {
                    setExternalReference(event.target.value)
                    setFieldError(null)
                  }}
                />
              </div>

              <label
                htmlFor={verifyCheckboxId}
                className="pos-external-verify-checkbox"
              >
                <input
                  id={verifyCheckboxId}
                  type="checkbox"
                  checked={externalVerified}
                  disabled={isSubmitting}
                  onChange={(event) => {
                    setExternalVerified(event.target.checked)
                    setFieldError(null)
                  }}
                />
                <span>
                  Confirmo como operador que el pago por{' '}
                  <strong>{selectedMethodMeta.label.toLowerCase()}</strong> de{' '}
                  <strong>
                    {formatCentsWithHistoricalCurrency(
                      totals.totalCents,
                      currency,
                    )}
                  </strong>{' '}
                  fue verificado externamente.
                </span>
              </label>
            </div>
          )}

          {fieldError ? (
            <p className="form-error" role="alert">
              {fieldError}
            </p>
          ) : null}

          {onSimulateMidCheckoutChange ? (
            <div className="pos-checkout-qa-row">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isSubmitting}
                onClick={onSimulateMidCheckoutChange}
              >
                QA: Simular cambio externo de precio/stock antes de confirmar
              </Button>
            </div>
          ) : null}

          <div className="modal-dialog__actions">
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting || discrepancies.length > 0}
            >
              {isSubmitting
                ? 'Procesando venta...'
                : `Confirmar cobro (${formatCentsWithHistoricalCurrency(
                    totals.totalCents,
                    currency,
                  )})`}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={onClose}
            >
              Volver al carrito
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
