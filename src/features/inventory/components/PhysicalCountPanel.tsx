import { useEffect, useId, useMemo, useState, type FormEvent } from 'react'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { Input } from '../../../components/ui/Input'
import { getUnitLabel } from '../../products/utils/validation'
import { generateInventoryId } from '../services/inventoryRepository'
import type { EnrichedInventoryItem } from '../types'
import {
  calculateCountAdjustmentDelta,
  formatQuantityWithUnit,
  formatSignedQuantityWithUnit,
  getUnitPrecisionRuleDescription,
  parseStrictQuantityInput,
} from '../utils/quantityUtils'

export interface PhysicalCountSubmitPayload {
  productId: string
  countedQuantity: number
  reason: string
  reference: string | null
  operationId: string
  expectedBalanceVersion: number
}

export interface PhysicalCountPanelProps {
  organizationName: string
  branchName: string
  items: EnrichedInventoryItem[]
  preselectedProductId: string | null
  onSubmitCount: (payload: PhysicalCountSubmitPayload) => {
    ok: boolean
    errorCode?: string
    error?: string
  }
  onSwitchToInitialize: (productId: string) => void
  onCancel: () => void
  onDirtyChange: (isDirty: boolean) => void
}

const COUNT_REASON_SUGGESTIONS = [
  'Recuento físico cíclico de anaquel',
  'Conciliación de existencias en cierre de turno',
  'Ajuste verificado tras arqueo de bodega',
]

export function PhysicalCountPanel({
  organizationName,
  branchName,
  items,
  preselectedProductId,
  onSubmitCount,
  onSwitchToInitialize,
  onCancel,
  onDirtyChange,
}: PhysicalCountPanelProps) {
  const productSelectId = useId()

  const defaultSelectedId = useMemo(() => {
    if (
      preselectedProductId &&
      items.some((item) => item.productId === preselectedProductId)
    ) {
      return preselectedProductId
    }
    const firstInitialized = items.find((item) => item.isInitialized)
    return firstInitialized?.productId ?? items[0]?.productId ?? ''
  }, [items, preselectedProductId])

  const [selectedProductId, setSelectedProductId] =
    useState<string>(defaultSelectedId)
  const [countedInput, setCountedInput] = useState<string>('')
  const [reason, setReason] = useState<string>('')
  const [reference, setReference] = useState<string>('')

  const selectedItem = useMemo(
    () => items.find((item) => item.productId === selectedProductId) ?? null,
    [items, selectedProductId],
  )

  const [capturedSnapshot, setCapturedSnapshot] = useState<{
    productId: string
    version: number | null
    quantity: number | null
  }>(() => ({
    productId: defaultSelectedId,
    version: selectedItem?.balanceVersion ?? null,
    quantity: selectedItem?.quantity ?? null,
  }))

  const [errors, setErrors] = useState<{
    product?: string
    counted?: string
    reason?: string
  }>({})
  const [bannerInfo, setBannerInfo] = useState<{
    type: 'error' | 'info'
    message: string
  } | null>(null)
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    parsedCounted: number
    operationId: string
  } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isDirty =
    countedInput.trim() !== '' ||
    reason.trim() !== '' ||
    reference.trim() !== ''

  useEffect(() => {
    onDirtyChange(isDirty)
    return () => {
      onDirtyChange(false)
    }
  }, [isDirty, onDirtyChange])

  // Detectar si el saldo registrado cambió mientras el formulario está abierto
  const hasConcurrentBalanceChange = Boolean(
    selectedItem &&
      selectedItem.isInitialized &&
      capturedSnapshot.productId === selectedItem.productId &&
      capturedSnapshot.version !== null &&
      selectedItem.balanceVersion !== capturedSnapshot.version,
  )

  const handleAcknowledgeUpdatedBalance = () => {
    if (!selectedItem) {
      return
    }
    setCapturedSnapshot({
      productId: selectedItem.productId,
      version: selectedItem.balanceVersion,
      quantity: selectedItem.quantity,
    })
    setPendingConfirmation(null)
    setBannerInfo(null)
  }

  // Cálculo de la diferencia entre cantidad contada y existencia registrada
  const reconciliationPreview = useMemo(() => {
    if (
      !selectedItem ||
      !selectedItem.isInitialized ||
      selectedItem.quantity === null
    ) {
      return null
    }

    const parsed = parseStrictQuantityInput(countedInput, selectedItem.unit, {
      allowZero: true,
      allowEmptyAsNull: false,
      fieldLabel: 'cantidad contada',
    })

    if (!parsed.ok || parsed.value === null) {
      return null
    }

    const registeredQuantity = selectedItem.quantity
    const countedQuantity = parsed.value
    const delta = calculateCountAdjustmentDelta(
      registeredQuantity,
      countedQuantity,
    )

    return {
      registeredQuantity,
      countedQuantity,
      delta,
      resultingQuantity: countedQuantity,
      hasNoDifference: delta === 0,
    }
  }, [selectedItem, countedInput])

  const handlePrepareConfirmation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBannerInfo(null)

    if (hasConcurrentBalanceChange) {
      setBannerInfo({
        type: 'error',
        message:
          'El saldo registrado del producto cambió mientras el formulario estaba abierto. Revisa y acepta la nueva existencia registrada antes de continuar.',
      })
      return
    }

    const nextErrors: {
      product?: string
      counted?: string
      reason?: string
    } = {}

    if (!selectedItem) {
      nextErrors.product = 'Selecciona un producto del catálogo.'
      setErrors(nextErrors)
      return
    }

    if (!selectedItem.isInitialized || selectedItem.quantity === null) {
      nextErrors.product = `El producto "${selectedItem.productName}" aún está sin inicializar.`
      setErrors(nextErrors)
      return
    }

    const countedResult = parseStrictQuantityInput(
      countedInput,
      selectedItem.unit,
      {
        allowZero: true,
        allowEmptyAsNull: false,
        fieldLabel: 'cantidad físicamente contada',
      },
    )

    if (!countedResult.ok) {
      nextErrors.counted = countedResult.error
    } else if (countedResult.value === null) {
      nextErrors.counted = 'Ingresa la cantidad contada.'
    }

    const cleanReason = reason.trim()
    if (!cleanReason) {
      nextErrors.reason = 'El motivo del conteo físico es obligatorio.'
    } else if (cleanReason.length < 3) {
      nextErrors.reason = 'El motivo debe tener al menos 3 caracteres.'
    } else if (cleanReason.length > 160) {
      nextErrors.reason = 'El motivo no puede superar 160 caracteres.'
    }

    setErrors(nextErrors)

    if (nextErrors.product || nextErrors.counted || nextErrors.reason) {
      setPendingConfirmation(null)
      setBannerInfo({
        type: 'error',
        message: 'Revisa los campos marcados con error antes de continuar.',
      })
      return
    }

    if (countedResult.ok && countedResult.value !== null) {
      const delta = calculateCountAdjustmentDelta(
        selectedItem.quantity,
        countedResult.value,
      )
      if (delta === 0) {
        setPendingConfirmation(null)
        setBannerInfo({
          type: 'info',
          message: `La cantidad contada (${formatQuantityWithUnit(countedResult.value, selectedItem.unit)}) coincide exactamente con la existencia registrada. No hay diferencia (0), por lo que no se creará ningún movimiento de ajuste.`,
        })
        return
      }

      setPendingConfirmation({
        parsedCounted: countedResult.value,
        operationId: generateInventoryId('op'),
      })
    }
  }

  const handleConfirmSave = () => {
    if (
      !selectedItem ||
      !pendingConfirmation ||
      selectedItem.balanceVersion === null ||
      isSubmitting
    ) {
      return
    }

    if (hasConcurrentBalanceChange) {
      setBannerInfo({
        type: 'error',
        message:
          'El saldo registrado cambió antes de guardar. Revisa la nueva existencia y diferencia antes de confirmar.',
      })
      return
    }

    setIsSubmitting(true)
    setBannerInfo(null)

    const outcome = onSubmitCount({
      productId: selectedItem.productId,
      countedQuantity: pendingConfirmation.parsedCounted,
      reason: reason.trim(),
      reference: reference.trim() || null,
      operationId: pendingConfirmation.operationId,
      expectedBalanceVersion:
        capturedSnapshot.version ?? selectedItem.balanceVersion,
    })

    setIsSubmitting(false)

    if (!outcome.ok) {
      if (
        outcome.errorCode === 'CONCURRENCY_CONFLICT' ||
        outcome.errorCode === 'NO_DIFFERENCE'
      ) {
        setPendingConfirmation(null)
      }
      setBannerInfo({
        type: outcome.errorCode === 'NO_DIFFERENCE' ? 'info' : 'error',
        message:
          outcome.error ??
          'No fue posible guardar el ajuste por conteo. El saldo e historial se conservaron intactos.',
      })
    }
  }

  return (
    <Card
      as="section"
      padding="lg"
      title={`Ajuste por conteo físico · ${organizationName}`}
      subtitle="Introduce la cantidad realmente contada en anaquel o bodega. El sistema calcula la diferencia con signo y genera el movimiento de ajuste en el historial."
      headerAction={<Badge variant="neutral">Conciliación física</Badge>}
    >
      {bannerInfo ? (
        <div
          className={`settings-feedback settings-feedback--${bannerInfo.type} product-form-banner`}
          role={bannerInfo.type === 'error' ? 'alert' : 'status'}
        >
          {bannerInfo.message}
        </div>
      ) : null}

      {hasConcurrentBalanceChange && selectedItem ? (
        <div
          className="inventory-concurrency-alert"
          role="alert"
          aria-live="assertive"
        >
          <div className="inventory-concurrency-alert__body">
            <strong>
              Cambio intermedio detectado en &ldquo;{selectedItem.productName}
              &rdquo;
            </strong>
            <p>
              Mientras este formulario estaba abierto, el saldo registrado
              cambió de{' '}
              <strong>
                {formatQuantityWithUnit(
                  capturedSnapshot.quantity ?? 0,
                  selectedItem.unit,
                )}
              </strong>{' '}
              a{' '}
              <strong>
                {formatQuantityWithUnit(
                  selectedItem.quantity ?? 0,
                  selectedItem.unit,
                )}
              </strong>
              . Para evitar sobrescribir operaciones intermedias
              silenciosamente, debes revisar el nuevo saldo registrado antes de
              confirmar.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleAcknowledgeUpdatedBalance}
          >
            He revisado el nuevo saldo registrado
          </Button>
        </div>
      ) : null}

      <form
        onSubmit={handlePrepareConfirmation}
        className="product-form-stack"
        noValidate
      >
        <div className="product-form-section">
          <h3 className="product-form-section__title">
            1. Producto a conciliar en {branchName}
          </h3>

          <div className="ui-select-field">
            <label htmlFor={productSelectId} className="ui-input__label">
              Producto *
            </label>
            <select
              id={productSelectId}
              className="ui-select-field__control"
              value={selectedProductId}
              onChange={(event) => {
                const nextId = event.target.value
                const nextItem =
                  items.find((it) => it.productId === nextId) ?? null
                setSelectedProductId(nextId)
                setCapturedSnapshot({
                  productId: nextId,
                  version: nextItem?.balanceVersion ?? null,
                  quantity: nextItem?.quantity ?? null,
                })
                setPendingConfirmation(null)
                setErrors({})
                setBannerInfo(null)
              }}
              disabled={isSubmitting}
            >
              {items.map((item) => (
                <option key={item.productId} value={item.productId}>
                  {item.productName} (SKU: {item.sku}) —{' '}
                  {item.isInitialized
                    ? `Registrado: ${formatQuantityWithUnit(item.quantity ?? 0, item.unit)}`
                    : 'Sin inicializar'}
                  {item.productStatus === 'inactive' ? ' [Inactivo]' : ''}
                </option>
              ))}
            </select>
            {errors.product ? (
              <p className="ui-input__error" role="alert">
                {errors.product}
              </p>
            ) : null}
          </div>

          {selectedItem && !selectedItem.isInitialized ? (
            <div
              className="inventory-already-init-box"
              role="region"
              aria-label="Producto sin inicializar"
            >
              <div className="inventory-already-init-box__content">
                <strong>
                  El artículo &ldquo;{selectedItem.productName}&rdquo; aún no
                  está inicializado.
                </strong>
                <p>
                  Para el primer registro de existencias en {branchName}, usa la
                  opción de Existencia inicial.
                </p>
              </div>
              <div className="inventory-already-init-box__actions">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => onSwitchToInitialize(selectedItem.productId)}
                >
                  Ir a Existencia inicial
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        {selectedItem && selectedItem.isInitialized ? (
          <>
            <div className="product-form-section">
              <h3 className="product-form-section__title">
                2. Conteo físico y cálculo de diferencia (
                {getUnitLabel(selectedItem.unit)})
              </h3>

              <p className="inventory-precision-banner">
                {getUnitPrecisionRuleDescription(selectedItem.unit)}
              </p>

              {/* Tablero de conciliación de 4 indicadores exigido en Sección 8 */}
              <div className="inventory-preview-grid inventory-preview-grid--four">
                <div className="inventory-preview-stat">
                  <span className="inventory-preview-stat__label">
                    Existencia registrada
                  </span>
                  <strong className="inventory-preview-stat__value">
                    {formatQuantityWithUnit(
                      selectedItem.quantity ?? 0,
                      selectedItem.unit,
                    )}
                  </strong>
                </div>

                <div className="inventory-preview-stat">
                  <span className="inventory-preview-stat__label">
                    Cantidad contada
                  </span>
                  <strong className="inventory-preview-stat__value">
                    {reconciliationPreview
                      ? formatQuantityWithUnit(
                          reconciliationPreview.countedQuantity,
                          selectedItem.unit,
                        )
                      : '—'}
                  </strong>
                </div>

                <div className="inventory-preview-stat">
                  <span className="inventory-preview-stat__label">
                    Diferencia calculada
                  </span>
                  <strong
                    className={`inventory-preview-stat__value ${
                      reconciliationPreview
                        ? reconciliationPreview.delta < 0
                          ? 'inventory-preview-stat__value--danger'
                          : reconciliationPreview.delta > 0
                            ? 'inventory-preview-stat__value--highlight'
                            : ''
                        : ''
                    }`}
                  >
                    {reconciliationPreview
                      ? reconciliationPreview.hasNoDifference
                        ? `0 ${getUnitLabel(selectedItem.unit)} (Sin diferencia)`
                        : formatSignedQuantityWithUnit(
                            reconciliationPreview.delta,
                            selectedItem.unit,
                          )
                      : '—'}
                  </strong>
                </div>

                <div className="inventory-preview-stat">
                  <span className="inventory-preview-stat__label">
                    Resultado en inventario
                  </span>
                  <strong className="inventory-preview-stat__value inventory-preview-stat__value--highlight">
                    {reconciliationPreview
                      ? formatQuantityWithUnit(
                          reconciliationPreview.resultingQuantity,
                          selectedItem.unit,
                        )
                      : '—'}
                  </strong>
                </div>
              </div>

              {reconciliationPreview?.hasNoDifference ? (
                <div
                  className="settings-feedback settings-feedback--info"
                  role="status"
                >
                  La cantidad contada coincide con la existencia registrada (
                  <strong>
                    {formatQuantityWithUnit(
                      reconciliationPreview.countedQuantity,
                      selectedItem.unit,
                    )}
                  </strong>
                  ). No existe diferencia que ajustar, por lo que no se creará
                  un movimiento en el historial.
                </div>
              ) : null}

              <div className="settings-form-grid">
                <Input
                  label={`Cantidad físicamente contada (${getUnitLabel(selectedItem.unit)}) *`}
                  inputMode="decimal"
                  value={countedInput}
                  onChange={(event) => {
                    setCountedInput(event.target.value)
                    setPendingConfirmation(null)
                    if (errors.counted) {
                      setErrors((prev) => ({ ...prev, counted: undefined }))
                    }
                    if (bannerInfo) {
                      setBannerInfo(null)
                    }
                  }}
                  placeholder="Ej. 0, 8, 15"
                  helpText="Admite 0 si en el conteo físico se verificó que ya no quedan existencias."
                  error={errors.counted}
                  disabled={isSubmitting}
                  required
                />

                <Input
                  label="Referencia o acta de conteo (opcional)"
                  value={reference}
                  onChange={(event) => {
                    setReference(event.target.value)
                    setPendingConfirmation(null)
                  }}
                  placeholder="Ej. CON-SEM-08"
                  helpText="Opcional. Identificador de hoja de recuento."
                  maxLength={60}
                  disabled={isSubmitting}
                />

                <div className="settings-form-grid__full">
                  <Input
                    label="Motivo del ajuste por conteo *"
                    value={reason}
                    onChange={(event) => {
                      setReason(event.target.value)
                      setPendingConfirmation(null)
                      if (errors.reason) {
                        setErrors((prev) => ({ ...prev, reason: undefined }))
                      }
                    }}
                    placeholder="Ej. Ajuste tras conteo físico de anaquel"
                    helpText="Obligatorio para justificar la diferencia en el historial."
                    error={errors.reason}
                    maxLength={160}
                    disabled={isSubmitting}
                    required
                  />

                  <div
                    className="inventory-reason-chips"
                    aria-label="Motivos frecuentes de conteo"
                  >
                    <span className="inventory-reason-chips__label">
                      Sugerencias rápidas:
                    </span>
                    {COUNT_REASON_SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        className="inventory-reason-chip"
                        onClick={() => {
                          setReason(suggestion)
                          setPendingConfirmation(null)
                          if (errors.reason) {
                            setErrors((prev) => ({
                              ...prev,
                              reason: undefined,
                            }))
                          }
                        }}
                        disabled={isSubmitting}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {pendingConfirmation &&
            reconciliationPreview &&
            !reconciliationPreview.hasNoDifference ? (
              <div
                className="inventory-confirm-box"
                role="region"
                aria-label="Confirmar ajuste por conteo físico"
              >
                <h4 className="inventory-confirm-box__title">
                  Confirmar ajuste por conteo físico
                </h4>
                <p className="inventory-confirm-box__note">
                  Registrado:{' '}
                  <strong>
                    {formatQuantityWithUnit(
                      reconciliationPreview.registeredQuantity,
                      selectedItem.unit,
                    )}
                  </strong>{' '}
                  · Contado:{' '}
                  <strong>
                    {formatQuantityWithUnit(
                      reconciliationPreview.countedQuantity,
                      selectedItem.unit,
                    )}
                  </strong>{' '}
                  → Movimiento de ajuste:{' '}
                  <strong>
                    {formatSignedQuantityWithUnit(
                      reconciliationPreview.delta,
                      selectedItem.unit,
                    )}
                  </strong>{' '}
                  (Nuevo saldo:{' '}
                  <strong>
                    {formatQuantityWithUnit(
                      reconciliationPreview.resultingQuantity,
                      selectedItem.unit,
                    )}
                  </strong>
                  ).
                </p>
                <div className="inventory-confirm-box__actions">
                  <Button
                    type="button"
                    variant="primary"
                    onClick={handleConfirmSave}
                    disabled={isSubmitting || hasConcurrentBalanceChange}
                  >
                    {isSubmitting
                      ? 'Aplicando ajuste...'
                      : 'Confirmar y registrar ajuste por conteo'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setPendingConfirmation(null)}
                    disabled={isSubmitting}
                  >
                    Modificar conteo
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        ) : null}

        <div className="settings-footer-bar">
          <div className="settings-footer-bar__meta">
            <span>
              El conteo físico nunca reemplaza el saldo sin dejar rastro en el
              historial.
            </span>
          </div>
          <div className="settings-footer-bar__actions">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Volver al listado
            </Button>
            {selectedItem &&
            selectedItem.isInitialized &&
            !pendingConfirmation ? (
              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting || hasConcurrentBalanceChange}
              >
                Revisar diferencia y confirmar
              </Button>
            ) : null}
          </div>
        </div>
      </form>
    </Card>
  )
}
