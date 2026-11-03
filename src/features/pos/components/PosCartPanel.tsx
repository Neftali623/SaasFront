import { useState } from 'react'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { EmptyState } from '../../../components/ui/EmptyState'
import type { CurrencyCode } from '../../../types'
import { formatCentsWithHistoricalCurrency } from '../../cash/utils/moneyUtils'
import {
  addControlledQuantities,
  formatQuantityNumber,
  formatQuantityWithUnit,
  isDivisibleUnit,
  parseStrictQuantityInput,
  subtractControlledQuantities,
  toScaledQuantity,
} from '../../inventory/utils/quantityUtils'
import { getUnitLabel } from '../../products/utils/validation'
import type { PosCartItem } from '../types'
import {
  calculateCartTotals,
  getStepQuantityForUnit,
} from '../utils/posMoneyAndQuantityUtils'

export interface PosCartPanelProps {
  cartItems: PosCartItem[]
  availableStockByProductId: ReadonlyMap<string, number | null>
  currency: CurrencyCode
  hasOpenSession: boolean
  hasCurrencyMismatch: boolean
  onUpdateQuantity: (
    productId: string,
    newQuantity: number,
  ) => { ok: boolean; error?: string }
  onRemoveItem: (productId: string) => void
  onClearCart: () => void
  onOpenCheckout: () => void
  onGoToCash: () => void
}

export function PosCartPanel({
  cartItems,
  availableStockByProductId,
  currency,
  hasOpenSession,
  hasCurrencyMismatch,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onOpenCheckout,
  onGoToCash,
}: PosCartPanelProps) {
  const [confirmingClear, setConfirmingClear] = useState(false)
  const [draftQuantities, setDraftQuantities] = useState<
    Record<string, string>
  >({})
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({})

  const totals = calculateCartTotals(cartItems)

  const commitDraftQuantity = (item: PosCartItem, rawInput: string) => {
    const parsed = parseStrictQuantityInput(rawInput, item.unit, {
      allowZero: false,
    })

    if (!parsed.ok || parsed.value === null) {
      setLineErrors((prev) => ({
        ...prev,
        [item.productId]: parsed.ok
          ? 'La cantidad es obligatoria.'
          : parsed.error,
      }))
      return
    }

    const result = onUpdateQuantity(item.productId, parsed.value)
    if (!result.ok) {
      setLineErrors((prev) => ({
        ...prev,
        [item.productId]:
          result.error ?? 'No fue posible actualizar la cantidad.',
      }))
      return
    }

    setLineErrors((prev) => {
      const next = { ...prev }
      delete next[item.productId]
      return next
    })
    setDraftQuantities((prev) => {
      const next = { ...prev }
      delete next[item.productId]
      return next
    })
  }

  const handleStepQuantity = (item: PosCartItem, deltaDirection: -1 | 1) => {
    const step = getStepQuantityForUnit(item.unit)
    const nextQty =
      deltaDirection === 1
        ? addControlledQuantities(item.quantity, step)
        : subtractControlledQuantities(item.quantity, step)

    if (toScaledQuantity(nextQty) <= 0) {
      setLineErrors((prev) => ({
        ...prev,
        [item.productId]:
          'La cantidad debe ser mayor a cero. Usa "Quitar" para eliminar la partida.',
      }))
      return
    }

    const result = onUpdateQuantity(item.productId, nextQty)
    if (!result.ok) {
      setLineErrors((prev) => ({
        ...prev,
        [item.productId]:
          result.error ?? 'No fue posible actualizar la cantidad.',
      }))
      return
    }

    setLineErrors((prev) => {
      const next = { ...prev }
      delete next[item.productId]
      return next
    })
    setDraftQuantities((prev) => {
      const next = { ...prev }
      delete next[item.productId]
      return next
    })
  }

  const canProceedToCheckout =
    cartItems.length > 0 && hasOpenSession && !hasCurrencyMismatch

  return (
    <Card
      as="section"
      className="pos-cart-card"
      title="Carrito de venta"
      subtitle={`Partidas en memoria del negocio activo · Moneda ${currency}`}
      headerAction={
        cartItems.length > 0 ? (
          confirmingClear ? (
            <div className="pos-cart-clear-confirm">
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => {
                  onClearCart()
                  setConfirmingClear(false)
                  setDraftQuantities({})
                  setLineErrors({})
                }}
              >
                Confirmar vaciado
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirmingClear(false)}
              >
                Cancelar
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setConfirmingClear(true)}
            >
              Vaciar carrito
            </Button>
          )
        ) : (
          <Badge variant="neutral">0 partidas</Badge>
        )
      }
    >
      {cartItems.length === 0 ? (
        <EmptyState
          title="Carrito vacío"
          description="Busca un artículo por nombre, SKU o escanea su código de barras para agregarlo a la cuenta actual."
        />
      ) : (
        <ul className="pos-cart-list" aria-label="Partidas en el carrito">
          {cartItems.map((item) => {
            const maxAvailable =
              availableStockByProductId.get(item.productId) ?? null
            const step = getStepQuantityForUnit(item.unit)
            const canDecrement =
              toScaledQuantity(subtractControlledQuantities(item.quantity, step)) >
              0
            const canIncrement =
              maxAvailable !== null &&
              toScaledQuantity(addControlledQuantities(item.quantity, step)) <=
                toScaledQuantity(maxAvailable)

            const inputValue =
              draftQuantities[item.productId] ??
              formatQuantityNumber(item.quantity, item.unit)
            const lineError = lineErrors[item.productId]

            return (
              <li key={item.productId} className="pos-cart-item">
                <div className="pos-cart-item__top">
                  <div className="pos-cart-item__info">
                    <span className="pos-cart-item__name">
                      {item.productName}
                    </span>
                    <span className="pos-cart-item__meta">
                      SKU: <code>{item.sku}</code>
                      {item.barcodeUsed ? (
                        <>
                          {' '}
                          · Cód: <code>{item.barcodeUsed}</code>
                        </>
                      ) : null}{' '}
                      · Unidad: {getUnitLabel(item.unit)}
                    </span>
                    <span className="pos-cart-item__unit-price">
                      Precio unitario fijo:{' '}
                      <strong>
                        {formatCentsWithHistoricalCurrency(
                          item.unitPriceCents,
                          currency,
                        )}
                      </strong>
                      {maxAvailable !== null ? (
                        <>
                          {' '}
                          · Stock máx:{' '}
                          {formatQuantityWithUnit(maxAvailable, item.unit)}
                        </>
                      ) : null}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="pos-cart-item__remove"
                    onClick={() => {
                      onRemoveItem(item.productId)
                      setDraftQuantities((prev) => {
                        const next = { ...prev }
                        delete next[item.productId]
                        return next
                      })
                      setLineErrors((prev) => {
                        const next = { ...prev }
                        delete next[item.productId]
                        return next
                      })
                    }}
                    aria-label={`Quitar ${item.productName} del carrito`}
                  >
                    Quitar
                  </button>
                </div>

                <div className="pos-cart-item__controls-row">
                  <div className="pos-cart-qty-control">
                    <button
                      type="button"
                      className="pos-cart-qty-btn"
                      disabled={!canDecrement}
                      onClick={() => handleStepQuantity(item, -1)}
                      aria-label={`Disminuir cantidad de ${item.productName}`}
                    >
                      −
                    </button>
                    <input
                      type="text"
                      inputMode={isDivisibleUnit(item.unit) ? 'decimal' : 'numeric'}
                      className={`form-input pos-cart-qty-input ${
                        lineError ? 'form-input--error' : ''
                      }`}
                      aria-label={`Cantidad de ${item.productName} (${getUnitLabel(
                        item.unit,
                      )})`}
                      value={inputValue}
                      onChange={(event) => {
                        const val = event.target.value
                        setDraftQuantities((prev) => ({
                          ...prev,
                          [item.productId]: val,
                        }))
                      }}
                      onBlur={(event) =>
                        commitDraftQuantity(item, event.target.value)
                      }
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          commitDraftQuantity(item, event.currentTarget.value)
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="pos-cart-qty-btn"
                      disabled={!canIncrement}
                      onClick={() => handleStepQuantity(item, 1)}
                      aria-label={`Aumentar cantidad de ${item.productName}`}
                    >
                      +
                    </button>
                  </div>

                  <div className="pos-cart-item__subtotal">
                    <span className="pos-cart-item__subtotal-label">
                      Importe partida
                    </span>
                    <strong className="pos-cart-item__subtotal-value">
                      {formatCentsWithHistoricalCurrency(
                        item.lineSubtotalCents,
                        currency,
                      )}
                    </strong>
                  </div>
                </div>

                {lineError ? (
                  <p className="form-error" role="alert">
                    {lineError}
                  </p>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}

      <div className="pos-cart-summary" aria-label="Resumen de importes de la venta">
        <div className="pos-cart-summary__row">
          <span>Partidas distintas</span>
          <strong>{totals.distinctItemsCount}</strong>
        </div>
        <div className="pos-cart-summary__row">
          <span>Subtotal de partidas</span>
          <strong>
            {formatCentsWithHistoricalCurrency(totals.subtotalCents, currency)}
          </strong>
        </div>
        <div className="pos-cart-summary__row pos-cart-summary__row--total">
          <span>Total a cobrar ({currency})</span>
          <strong className="pos-cart-summary__total-amount">
            {formatCentsWithHistoricalCurrency(totals.totalCents, currency)}
          </strong>
        </div>

        <p className="pos-cart-summary__backend-note">
          Sin descuentos ni pagos divididos en esta fase. Al conectarse el
          backend con Edwin, el servidor validará precios e importes definitivos.
        </p>

        {!hasOpenSession ? (
          <div className="pos-cart-blocked-box" role="note">
            <p>
              <strong>Cobro bloqueado:</strong> Abre una sesión de caja para
              procesar el cobro de esta cuenta.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onGoToCash}
            >
              Ir a Caja para abrir turno
            </Button>
          </div>
        ) : null}

        <Button
          type="button"
          variant="primary"
          fullWidth
          disabled={!canProceedToCheckout}
          onClick={onOpenCheckout}
        >
          Proceder al cobro (
          {formatCentsWithHistoricalCurrency(totals.totalCents, currency)})
        </Button>
      </div>
    </Card>
  )
}
