import { useEffect, useId, useMemo, useState, type FormEvent } from 'react'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { Input } from '../../../components/ui/Input'
import { getUnitLabel } from '../../products/utils/validation'
import { generateInventoryId } from '../services/inventoryRepository'
import type { EnrichedInventoryItem } from '../types'
import {
  addControlledQuantities,
  formatQuantityWithUnit,
  formatSignedQuantityWithUnit,
  getUnitPrecisionRuleDescription,
  parseStrictQuantityInput,
} from '../utils/quantityUtils'

export interface ManualMovementSubmitPayload {
  productId: string
  type: 'manual_in' | 'manual_out'
  quantity: number
  reason: string
  reference: string | null
  operationId: string
  expectedBalanceVersion: number
}

export interface ManualMovementPanelProps {
  mode: 'manual_in' | 'manual_out'
  organizationName: string
  branchName: string
  items: EnrichedInventoryItem[]
  preselectedProductId: string | null
  onSubmitMovement: (payload: ManualMovementSubmitPayload) => {
    ok: boolean
    errorCode?: string
    error?: string
  }
  onSwitchToInitialize: (productId: string) => void
  onSwitchMode: (
    nextMode: 'manual_in' | 'manual_out',
    productId: string,
  ) => void
  onSwitchToPhysicalCount: (productId: string) => void
  onCancel: () => void
  onDirtyChange: (isDirty: boolean) => void
}

const ENTRY_REASON_SUGGESTIONS = [
  'Reposición de mercancía en sucursal',
  'Ingreso manual a mostrador',
  'Reintegración de material operativo',
]

const EXIT_REASON_SUGGESTIONS = [
  'Merma o daño en empaque',
  'Uso interno en sucursal',
  'Baja o retiro de existencias residuales',
]

export function ManualMovementPanel({
  mode,
  organizationName,
  branchName,
  items,
  preselectedProductId,
  onSubmitMovement,
  onSwitchToInitialize,
  onSwitchMode,
  onSwitchToPhysicalCount,
  onCancel,
  onDirtyChange,
}: ManualMovementPanelProps) {
  const productSelectId = useId()
  const isEntry = mode === 'manual_in'

  const defaultSelectedId = useMemo(() => {
    if (
      preselectedProductId &&
      items.some((item) => item.productId === preselectedProductId)
    ) {
      return preselectedProductId
    }
    const candidate = items.find(
      (item) =>
        item.isInitialized &&
        (isEntry ? item.productStatus === 'active' : true),
    )
    return candidate?.productId ?? items[0]?.productId ?? ''
  }, [items, preselectedProductId, isEntry])

  const [selectedProductId, setSelectedProductId] =
    useState<string>(defaultSelectedId)
  const [quantityInput, setQuantityInput] = useState<string>('')
  const [reason, setReason] = useState<string>('')
  const [reference, setReference] = useState<string>('')

  const selectedItem = useMemo(
    () => items.find((item) => item.productId === selectedProductId) ?? null,
    [items, selectedProductId],
  )

  // Captura de versión de saldo al abrir/seleccionar producto para detectar cambios concurrentes
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
    quantity?: string
    reason?: string
  }>({})
  const [bannerError, setBannerError] = useState<string | null>(null)
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    parsedQuantity: number
    operationId: string
  } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isDirty =
    quantityInput.trim() !== '' ||
    reason.trim() !== '' ||
    reference.trim() !== ''

  useEffect(() => {
    onDirtyChange(isDirty)
    return () => {
      onDirtyChange(false)
    }
  }, [isDirty, onDirtyChange])

  // Detectar si el saldo del producto seleccionado cambió mientras el formulario estaba abierto
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
    setBannerError(null)
  }

  // Vista previa en tiempo real de la operación
  const livePreview = useMemo(() => {
    if (!selectedItem || !selectedItem.isInitialized || selectedItem.quantity === null) {
      return null
    }
    const parsed = parseStrictQuantityInput(quantityInput, selectedItem.unit, {
      allowZero: false,
      allowEmptyAsNull: false,
      fieldLabel: isEntry ? 'cantidad de entrada' : 'cantidad de salida',
    })
    if (!parsed.ok || parsed.value === null) {
      return null
    }

    const signedDelta = isEntry ? parsed.value : -parsed.value
    const resultingQuantity = addControlledQuantities(
      selectedItem.quantity,
      signedDelta,
    )

    return {
      currentQuantity: selectedItem.quantity,
      delta: signedDelta,
      resultingQuantity,
      isInsufficient: resultingQuantity < 0,
    }
  }, [selectedItem, quantityInput, isEntry])

  const validateForm = (): {
    valid: boolean
    parsedQuantity: number | null
  } => {
    const nextErrors: {
      product?: string
      quantity?: string
      reason?: string
    } = {}

    if (!selectedItem) {
      nextErrors.product = 'Selecciona un producto del catálogo.'
      setErrors(nextErrors)
      return { valid: false, parsedQuantity: null }
    }

    if (!selectedItem.isInitialized || selectedItem.quantity === null) {
      nextErrors.product = `El producto "${selectedItem.productName}" aún está sin inicializar. Registra primero su existencia inicial.`
      setErrors(nextErrors)
      return { valid: false, parsedQuantity: null }
    }

    if (isEntry && selectedItem.productStatus === 'inactive') {
      nextErrors.product =
        'No se permiten nuevas entradas en productos inactivos. Solo se permite salida manual o ajuste por conteo.'
      setErrors(nextErrors)
      return { valid: false, parsedQuantity: null }
    }

    const qtyResult = parseStrictQuantityInput(
      quantityInput,
      selectedItem.unit,
      {
        allowZero: false,
        allowEmptyAsNull: false,
        fieldLabel: isEntry ? 'cantidad que entra' : 'cantidad a retirar',
      },
    )

    if (!qtyResult.ok) {
      nextErrors.quantity = qtyResult.error
    } else if (qtyResult.value === null) {
      nextErrors.quantity = 'Ingresa una cantidad válida.'
    } else if (!isEntry) {
      const resulting = addControlledQuantities(
        selectedItem.quantity,
        -qtyResult.value,
      )
      if (resulting < 0) {
        nextErrors.quantity = `Stock insuficiente. Existencia disponible: ${formatQuantityWithUnit(selectedItem.quantity, selectedItem.unit)}; salida solicitada: ${formatQuantityWithUnit(qtyResult.value, selectedItem.unit)}.`
      }
    }

    const cleanReason = reason.trim()
    if (!cleanReason) {
      nextErrors.reason = 'El motivo del movimiento es obligatorio.'
    } else if (cleanReason.length < 3) {
      nextErrors.reason = 'El motivo debe tener al menos 3 caracteres.'
    } else if (cleanReason.length > 160) {
      nextErrors.reason = 'El motivo no puede superar 160 caracteres.'
    }

    setErrors(nextErrors)
    const hasErrors = Boolean(
      nextErrors.product || nextErrors.quantity || nextErrors.reason,
    )

    return {
      valid: !hasErrors,
      parsedQuantity: qtyResult.ok ? qtyResult.value : null,
    }
  }

  const handlePrepareConfirmation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBannerError(null)

    if (hasConcurrentBalanceChange) {
      setBannerError(
        'El saldo del producto se actualizó mientras el formulario estaba abierto. Revisa y acepta el nuevo saldo antes de continuar.',
      )
      return
    }

    const validation = validateForm()
    if (!validation.valid || validation.parsedQuantity === null) {
      setPendingConfirmation(null)
      setBannerError(
        'Corrige los errores señalados antes de confirmar el movimiento.',
      )
      return
    }

    setPendingConfirmation({
      parsedQuantity: validation.parsedQuantity,
      operationId: generateInventoryId('op'),
    })
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
      setBannerError(
        'El saldo del artículo cambió antes de guardar. Revisa la nueva existencia actual antes de confirmar.',
      )
      return
    }

    setIsSubmitting(true)
    setBannerError(null)

    const outcome = onSubmitMovement({
      productId: selectedItem.productId,
      type: mode,
      quantity: pendingConfirmation.parsedQuantity,
      reason: reason.trim(),
      reference: reference.trim() || null,
      operationId: pendingConfirmation.operationId,
      expectedBalanceVersion:
        capturedSnapshot.version ?? selectedItem.balanceVersion,
    })

    setIsSubmitting(false)

    if (!outcome.ok) {
      if (outcome.errorCode === 'CONCURRENCY_CONFLICT') {
        setPendingConfirmation(null)
      }
      setBannerError(
        outcome.error ??
          'No se pudo guardar el movimiento. El saldo y el historial anteriores se conservaron.',
      )
    }
  }

  const reasonSuggestions = isEntry
    ? ENTRY_REASON_SUGGESTIONS
    : EXIT_REASON_SUGGESTIONS

  return (
    <Card
      as="section"
      padding="lg"
      title={
        isEntry
          ? `Registrar entrada manual · ${organizationName}`
          : `Registrar salida manual · ${organizationName}`
      }
      subtitle={
        isEntry
          ? 'Incrementa existencias físicas de un producto activo con motivo justificado. No representa una compra contable ni registra costos o pagos.'
          : 'Descuenta existencias físicas por merma, daño, uso interno o depuración. No representa una venta ni modifica efectivo en caja.'
      }
      headerAction={
        <Badge variant={isEntry ? 'success' : 'warning'}>
          {isEntry ? 'Entrada (+)' : 'Salida (-)'}
        </Badge>
      }
    >
      {bannerError ? (
        <div
          className="settings-feedback settings-feedback--error product-form-banner"
          role="alert"
        >
          {bannerError}
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
              Atención: El saldo de &ldquo;{selectedItem.productName}&rdquo;
              cambió mientras el formulario estaba abierto.
            </strong>
            <p>
              Saldo al abrir el formulario:{' '}
              <strong>
                {formatQuantityWithUnit(
                  capturedSnapshot.quantity ?? 0,
                  selectedItem.unit,
                )}
              </strong>{' '}
              → Nuevo saldo actual registrado:{' '}
              <strong>
                {formatQuantityWithUnit(
                  selectedItem.quantity ?? 0,
                  selectedItem.unit,
                )}
              </strong>
              . Para evitar sobrescribir cambios intermedios, revisa el nuevo
              saldo antes de confirmar.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleAcknowledgeUpdatedBalance}
          >
            Revisar y usar nuevo saldo
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
            1. Artículo y existencia actual ({branchName})
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
                setBannerError(null)
              }}
              disabled={isSubmitting}
            >
              {items.map((item) => (
                <option key={item.productId} value={item.productId}>
                  {item.productName} (SKU: {item.sku}) —{' '}
                  {item.isInitialized
                    ? `Disponible: ${formatQuantityWithUnit(item.quantity ?? 0, item.unit)}`
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
                  tiene existencia inicial registrada.
                </strong>
                <p>
                  Antes de registrar entradas o salidas manuales, debes
                  registrar su existencia inicial en {branchName}.
                </p>
              </div>
              <div className="inventory-already-init-box__actions">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => onSwitchToInitialize(selectedItem.productId)}
                >
                  Inicializar existencias ahora
                </Button>
              </div>
            </div>
          ) : null}

          {selectedItem &&
          selectedItem.isInitialized &&
          selectedItem.productStatus === 'inactive' ? (
            <div
              className={`inventory-inactive-policy-banner ${
                isEntry ? 'inventory-inactive-policy-banner--blocked' : ''
              }`}
              role="note"
            >
              <div className="inventory-inactive-policy-banner__text">
                <strong>
                  Regla para producto inactivo ({selectedItem.productName}):
                </strong>
                {isEntry ? (
                  <p>
                    Este artículo está <strong>inactivo</strong> en el catálogo.
                    No se permiten nuevas entradas de mercancía para productos
                    inactivos. Solo puedes consultar su saldo e historial, o
                    registrar una <strong>Salida manual</strong> /{' '}
                    <strong>Ajuste por conteo</strong> para depurar existencias
                    residuales.
                  </p>
                ) : (
                  <p>
                    Este artículo está <strong>inactivo</strong> y conserva un
                    saldo residual de{' '}
                    <strong>
                      {formatQuantityWithUnit(
                        selectedItem.quantity ?? 0,
                        selectedItem.unit,
                      )}
                    </strong>
                    . Está permitido registrar esta salida justificada para
                    depurar sus existencias.
                  </p>
                )}
              </div>
              {isEntry ? (
                <div className="inventory-already-init-box__actions">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      onSwitchMode('manual_out', selectedItem.productId)
                    }
                  >
                    Cambiar a Salida manual
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      onSwitchToPhysicalCount(selectedItem.productId)
                    }
                  >
                    Ajustar por conteo
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {selectedItem &&
        selectedItem.isInitialized &&
        !(isEntry && selectedItem.productStatus === 'inactive') ? (
          <>
            <div className="product-form-section">
              <h3 className="product-form-section__title">
                2. Cantidad y motivo ({getUnitLabel(selectedItem.unit)})
              </h3>

              <p className="inventory-precision-banner">
                {getUnitPrecisionRuleDescription(selectedItem.unit)}
              </p>

              <div className="inventory-preview-grid">
                <div className="inventory-preview-stat">
                  <span className="inventory-preview-stat__label">
                    Existencia actual disponible
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
                    {isEntry ? 'Cantidad que entra' : 'Cantidad que sale'}
                  </span>
                  <strong className="inventory-preview-stat__value">
                    {livePreview
                      ? formatSignedQuantityWithUnit(
                          livePreview.delta,
                          selectedItem.unit,
                        )
                      : '—'}
                  </strong>
                </div>
                <div className="inventory-preview-stat">
                  <span className="inventory-preview-stat__label">
                    Existencia resultante
                  </span>
                  <strong
                    className={`inventory-preview-stat__value ${
                      livePreview?.isInsufficient
                        ? 'inventory-preview-stat__value--danger'
                        : 'inventory-preview-stat__value--highlight'
                    }`}
                  >
                    {livePreview
                      ? formatQuantityWithUnit(
                          livePreview.resultingQuantity,
                          selectedItem.unit,
                        )
                      : '—'}
                  </strong>
                </div>
              </div>

              <div className="settings-form-grid">
                <Input
                  label={`${
                    isEntry ? 'Cantidad de entrada' : 'Cantidad de salida'
                  } (${getUnitLabel(selectedItem.unit)}) *`}
                  inputMode="decimal"
                  value={quantityInput}
                  onChange={(event) => {
                    setQuantityInput(event.target.value)
                    setPendingConfirmation(null)
                    if (errors.quantity) {
                      setErrors((prev) => ({ ...prev, quantity: undefined }))
                    }
                  }}
                  placeholder={isEntry ? 'Ej. 5' : 'Ej. 3'}
                  helpText={`Debe ser una cantidad positiva (> 0). El tipo de operación aplica el signo (${
                    isEntry ? '+' : '-'
                  }).`}
                  error={errors.quantity}
                  disabled={isSubmitting}
                  required
                />

                <Input
                  label="Referencia opcional"
                  value={reference}
                  onChange={(event) => {
                    setReference(event.target.value)
                    setPendingConfirmation(null)
                  }}
                  placeholder="Ej. REM-104 o NOTA-INT-02"
                  helpText="Opcional. Folio interno o documento de respaldo."
                  maxLength={60}
                  disabled={isSubmitting}
                />

                <div className="settings-form-grid__full">
                  <Input
                    label="Motivo obligatorio *"
                    value={reason}
                    onChange={(event) => {
                      setReason(event.target.value)
                      setPendingConfirmation(null)
                      if (errors.reason) {
                        setErrors((prev) => ({ ...prev, reason: undefined }))
                      }
                    }}
                    placeholder={
                      isEntry
                        ? 'Ej. Reposición de anaquel principal'
                        : 'Ej. Merma por empaque maltratado o uso interno'
                    }
                    helpText="Obligatorio. Quedará asentado de forma permanente en el historial."
                    error={errors.reason}
                    maxLength={160}
                    disabled={isSubmitting}
                    required
                  />

                  <div
                    className="inventory-reason-chips"
                    aria-label="Motivos frecuentes sugeridos"
                  >
                    <span className="inventory-reason-chips__label">
                      Sugerencias rápidas:
                    </span>
                    {reasonSuggestions.map((suggestion) => (
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

            {pendingConfirmation && livePreview ? (
              <div
                className="inventory-confirm-box"
                role="region"
                aria-label="Confirmar movimiento manual"
              >
                <h4 className="inventory-confirm-box__title">
                  Confirmar{' '}
                  {isEntry ? 'entrada manual (+)' : 'salida manual (-)'}
                </h4>
                <div className="inventory-preview-grid">
                  <div className="inventory-preview-stat">
                    <span className="inventory-preview-stat__label">
                      Existencia actual
                    </span>
                    <strong className="inventory-preview-stat__value">
                      {formatQuantityWithUnit(
                        livePreview.currentQuantity,
                        selectedItem.unit,
                      )}
                    </strong>
                  </div>
                  <div className="inventory-preview-stat">
                    <span className="inventory-preview-stat__label">
                      {isEntry ? 'Cantidad que entra' : 'Cantidad que sale'}
                    </span>
                    <strong className="inventory-preview-stat__value">
                      {formatSignedQuantityWithUnit(
                        livePreview.delta,
                        selectedItem.unit,
                      )}
                    </strong>
                  </div>
                  <div className="inventory-preview-stat">
                    <span className="inventory-preview-stat__label">
                      Existencia resultante
                    </span>
                    <strong className="inventory-preview-stat__value inventory-preview-stat__value--highlight">
                      {formatQuantityWithUnit(
                        livePreview.resultingQuantity,
                        selectedItem.unit,
                      )}
                    </strong>
                  </div>
                </div>
                <p className="inventory-confirm-box__note">
                  Motivo: <strong>{reason.trim()}</strong>
                  {reference.trim() ? (
                    <>
                      {' '}
                      · Referencia: <code>{reference.trim()}</code>
                    </>
                  ) : null}
                </p>
                <div className="inventory-confirm-box__actions">
                  <Button
                    type="button"
                    variant="primary"
                    onClick={handleConfirmSave}
                    disabled={isSubmitting || hasConcurrentBalanceChange}
                  >
                    {isSubmitting
                      ? 'Guardando movimiento...'
                      : isEntry
                        ? 'Confirmar y registrar entrada'
                        : 'Confirmar y registrar salida'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setPendingConfirmation(null)}
                    disabled={isSubmitting}
                  >
                    Modificar datos
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        ) : null}

        <div className="settings-footer-bar">
          <div className="settings-footer-bar__meta">
            <span>
              {isEntry
                ? 'Nota: No registra compras contables, costos ni cuentas por pagar.'
                : 'Nota: No representa una venta ni altera los indicadores de caja.'}
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
            !(isEntry && selectedItem.productStatus === 'inactive') &&
            !pendingConfirmation ? (
              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting || hasConcurrentBalanceChange}
              >
                Revisar y confirmar {isEntry ? 'entrada' : 'salida'}
              </Button>
            ) : null}
          </div>
        </div>
      </form>
    </Card>
  )
}
