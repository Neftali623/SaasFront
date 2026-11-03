import { useEffect, useId, useMemo, useState, type FormEvent } from 'react'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { Input } from '../../../components/ui/Input'
import { getUnitLabel } from '../../products/utils/validation'
import { generateInventoryId } from '../services/inventoryRepository'
import type { EnrichedInventoryItem } from '../types'
import {
  formatQuantityWithUnit,
  getUnitPrecisionRuleDescription,
  parseStrictQuantityInput,
} from '../utils/quantityUtils'

export interface InitializeStockPayload {
  productId: string
  initialQuantity: number
  minStock: number | null
  reason: string
  reference: string | null
  operationId: string
}

export interface InitializeStockPanelProps {
  organizationName: string
  branchName: string
  items: EnrichedInventoryItem[]
  preselectedProductId: string | null
  onSubmitInitialize: (payload: InitializeStockPayload) => {
    ok: boolean
    error?: string
  }
  onSwitchToManualEntry: (productId: string) => void
  onSwitchToPhysicalCount: (productId: string) => void
  onCancel: () => void
  onDirtyChange: (isDirty: boolean) => void
}

export function InitializeStockPanel({
  organizationName,
  branchName,
  items,
  preselectedProductId,
  onSubmitInitialize,
  onSwitchToManualEntry,
  onSwitchToPhysicalCount,
  onCancel,
  onDirtyChange,
}: InitializeStockPanelProps) {
  const productSelectId = useId()

  const defaultSelectedId = useMemo(() => {
    if (
      preselectedProductId &&
      items.some((item) => item.productId === preselectedProductId)
    ) {
      return preselectedProductId
    }
    const firstUninitialized = items.find((item) => !item.isInitialized)
    return firstUninitialized?.productId ?? items[0]?.productId ?? ''
  }, [items, preselectedProductId])

  const [selectedProductId, setSelectedProductId] =
    useState<string>(defaultSelectedId)
  const [quantityInput, setQuantityInput] = useState<string>('')
  const [minStockInput, setMinStockInput] = useState<string>('')
  const [reason, setReason] = useState<string>(
    'Registro de existencia inicial en sucursal',
  )
  const [reference, setReference] = useState<string>('')

  const [errors, setErrors] = useState<{
    product?: string
    quantity?: string
    minStock?: string
    reason?: string
  }>({})
  const [bannerError, setBannerError] = useState<string | null>(null)
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    parsedQuantity: number
    parsedMinStock: number | null
    operationId: string
  } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const selectedItem = useMemo(
    () => items.find((item) => item.productId === selectedProductId) ?? null,
    [items, selectedProductId],
  )

  const isDirty =
    quantityInput.trim() !== '' ||
    minStockInput.trim() !== '' ||
    reference.trim() !== '' ||
    reason.trim() !== 'Registro de existencia inicial en sucursal'

  useEffect(() => {
    onDirtyChange(isDirty)
    return () => {
      onDirtyChange(false)
    }
  }, [isDirty, onDirtyChange])

  const validateFields = (): {
    valid: boolean
    parsedQuantity: number | null
    parsedMinStock: number | null
  } => {
    const nextErrors: {
      product?: string
      quantity?: string
      minStock?: string
      reason?: string
    } = {}

    if (!selectedItem) {
      nextErrors.product = 'Selecciona un producto del catálogo.'
      setErrors(nextErrors)
      return { valid: false, parsedQuantity: null, parsedMinStock: null }
    }

    if (selectedItem.isInitialized) {
      nextErrors.product = `El producto "${selectedItem.productName}" ya fue inicializado en ${branchName}. No se permite inicializar dos veces.`
      setErrors(nextErrors)
      return { valid: false, parsedQuantity: null, parsedMinStock: null }
    }

    const qtyResult = parseStrictQuantityInput(
      quantityInput,
      selectedItem.unit,
      {
        allowZero: true,
        allowEmptyAsNull: false,
        fieldLabel: 'cantidad inicial',
      },
    )
    if (!qtyResult.ok) {
      nextErrors.quantity = qtyResult.error
    }

    const minResult = parseStrictQuantityInput(
      minStockInput,
      selectedItem.unit,
      {
        allowZero: true,
        allowEmptyAsNull: true,
        fieldLabel: 'existencia mínima',
      },
    )
    if (!minResult.ok) {
      nextErrors.minStock = minResult.error
    }

    const cleanReason = reason.trim()
    if (!cleanReason) {
      nextErrors.reason = 'El motivo de inicialización es obligatorio.'
    } else if (cleanReason.length < 3) {
      nextErrors.reason = 'El motivo debe tener al menos 3 caracteres.'
    } else if (cleanReason.length > 160) {
      nextErrors.reason = 'El motivo no puede superar 160 caracteres.'
    }

    setErrors(nextErrors)
    const hasErrors = Boolean(
      nextErrors.product ||
        nextErrors.quantity ||
        nextErrors.minStock ||
        nextErrors.reason,
    )

    return {
      valid: !hasErrors,
      parsedQuantity: qtyResult.ok ? qtyResult.value : null,
      parsedMinStock: minResult.ok ? minResult.value : null,
    }
  }

  const handlePrepareConfirmation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBannerError(null)

    const result = validateFields()
    if (!result.valid || result.parsedQuantity === null) {
      setPendingConfirmation(null)
      setBannerError(
        'Revisa los campos marcados antes de continuar a la confirmación.',
      )
      return
    }

    setPendingConfirmation({
      parsedQuantity: result.parsedQuantity,
      parsedMinStock: result.parsedMinStock,
      operationId: generateInventoryId('op'),
    })
  }

  const handleConfirmSave = () => {
    if (!selectedItem || !pendingConfirmation || isSubmitting) {
      return
    }

    setIsSubmitting(true)
    setBannerError(null)

    const outcome = onSubmitInitialize({
      productId: selectedItem.productId,
      initialQuantity: pendingConfirmation.parsedQuantity,
      minStock: pendingConfirmation.parsedMinStock,
      reason: reason.trim(),
      reference: reference.trim() || null,
      operationId: pendingConfirmation.operationId,
    })

    setIsSubmitting(false)

    if (!outcome.ok) {
      setBannerError(
        outcome.error ??
          'No fue posible registrar la existencia inicial. Tus datos se conservaron.',
      )
    }
  }

  return (
    <Card
      as="section"
      padding="lg"
      title="Registrar existencia inicial"
      subtitle={`Apertura por única vez de las existencias físicas de un artículo en ${organizationName} (${branchName}).`}
      headerAction={<Badge variant="brand">Inicialización única</Badge>}
    >
      {bannerError ? (
        <div
          className="settings-feedback settings-feedback--error product-form-banner"
          role="alert"
        >
          {bannerError}
        </div>
      ) : null}

      <form
        onSubmit={handlePrepareConfirmation}
        className="product-form-stack"
        noValidate
      >
        <div className="product-form-section">
          <h3 className="product-form-section__title">
            1. Selección de producto y contexto
          </h3>

          <div className="inventory-context-pills">
            <span className="inventory-context-pill">
              Organización: <strong>{organizationName}</strong>
            </span>
            <span className="inventory-context-pill">
              Sucursal: <strong>{branchName}</strong>
            </span>
            {selectedItem ? (
              <span className="inventory-context-pill">
                Unidad: <strong>{getUnitLabel(selectedItem.unit)}</strong>
              </span>
            ) : null}
          </div>

          <div className="ui-select-field">
            <label htmlFor={productSelectId} className="ui-input__label">
              Producto del catálogo *
            </label>
            <select
              id={productSelectId}
              className="ui-select-field__control"
              value={selectedProductId}
              onChange={(event) => {
                setSelectedProductId(event.target.value)
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
                    ? `Ya inicializado (${formatQuantityWithUnit(item.quantity ?? 0, item.unit)})`
                    : 'Sin inicializar'}
                  {item.productStatus === 'inactive' ? ' [Inactivo]' : ''}
                </option>
              ))}
            </select>
            {errors.product ? (
              <p className="ui-input__error" role="alert">
                {errors.product}
              </p>
            ) : (
              <p className="ui-input__help">
                Solo los productos marcados como &ldquo;Sin inicializar&rdquo;
                pueden abrir su kardex inicial.
              </p>
            )}
          </div>

          {selectedItem && selectedItem.isInitialized ? (
            <div
              className="inventory-already-init-box"
              role="region"
              aria-label="Producto ya inicializado"
            >
              <div className="inventory-already-init-box__content">
                <strong>
                  Este producto ya tiene existencia inicial registrada en{' '}
                  {branchName}.
                </strong>
                <p>
                  Su existencia actual es de{' '}
                  <strong>
                    {formatQuantityWithUnit(
                      selectedItem.quantity ?? 0,
                      selectedItem.unit,
                    )}
                  </strong>{' '}
                  con {selectedItem.movementsCount}{' '}
                  {selectedItem.movementsCount === 1
                    ? 'movimiento registrado'
                    : 'movimientos registrados'}
                  . La inicialización solo se permite una vez por producto y
                  sucursal.
                </p>
              </div>
              <div className="inventory-already-init-box__actions">
                {selectedItem.productStatus === 'active' ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      onSwitchToManualEntry(selectedItem.productId)
                    }
                  >
                    Ir a Entrada manual
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    onSwitchToPhysicalCount(selectedItem.productId)
                  }
                >
                  Ir a Ajuste por conteo
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        {selectedItem && !selectedItem.isInitialized ? (
          <>
            <div className="product-form-section">
              <h3 className="product-form-section__title">
                2. Cantidad inicial y mínimo opcional (
                {getUnitLabel(selectedItem.unit)})
              </h3>

              <p className="inventory-precision-banner">
                {getUnitPrecisionRuleDescription(selectedItem.unit)}
              </p>

              <div className="settings-form-grid">
                <Input
                  label={`Cantidad inicial (${getUnitLabel(selectedItem.unit)}) *`}
                  inputMode="decimal"
                  value={quantityInput}
                  onChange={(event) => {
                    setQuantityInput(event.target.value)
                    setPendingConfirmation(null)
                    if (errors.quantity) {
                      setErrors((prev) => ({ ...prev, quantity: undefined }))
                    }
                  }}
                  placeholder="Ej. 0 o 10"
                  helpText="Admite 0 para dejar constancia explícita de cero existencias confirmadas."
                  error={errors.quantity}
                  disabled={isSubmitting}
                  required
                />

                <Input
                  label={`Stock mínimo de alerta (${getUnitLabel(selectedItem.unit)}, opcional)`}
                  inputMode="decimal"
                  value={minStockInput}
                  onChange={(event) => {
                    setMinStockInput(event.target.value)
                    setPendingConfirmation(null)
                    if (errors.minStock) {
                      setErrors((prev) => ({ ...prev, minStock: undefined }))
                    }
                  }}
                  placeholder="Dejar vacío para Sin mínimo, o ej. 5 / 0"
                  helpText="Dejar vacío guarda 'Sin mínimo'; escribir 0 guarda mínimo en cero."
                  error={errors.minStock}
                  disabled={isSubmitting}
                />

                <Input
                  label="Motivo de inicialización *"
                  value={reason}
                  onChange={(event) => {
                    setReason(event.target.value)
                    setPendingConfirmation(null)
                    if (errors.reason) {
                      setErrors((prev) => ({ ...prev, reason: undefined }))
                    }
                  }}
                  placeholder="Ej. Conteo físico de apertura de sucursal"
                  helpText="Obligatorio para el registro en el historial de movimientos."
                  error={errors.reason}
                  maxLength={160}
                  disabled={isSubmitting}
                  required
                />

                <Input
                  label="Referencia o folio (opcional)"
                  value={reference}
                  onChange={(event) => {
                    setReference(event.target.value)
                    setPendingConfirmation(null)
                  }}
                  placeholder="Ej. ACTA-INI-001"
                  helpText="Opcional. Identificador de acta o documento interno."
                  maxLength={60}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {pendingConfirmation ? (
              <div
                className="inventory-confirm-box"
                role="region"
                aria-label="Confirmación de existencia inicial"
              >
                <h4 className="inventory-confirm-box__title">
                  Confirmar registro de existencia inicial
                </h4>
                <div className="inventory-preview-grid">
                  <div className="inventory-preview-stat">
                    <span className="inventory-preview-stat__label">
                      Estado previo
                    </span>
                    <strong className="inventory-preview-stat__value">
                      Sin inicializar
                    </strong>
                  </div>
                  <div className="inventory-preview-stat">
                    <span className="inventory-preview-stat__label">
                      Cantidad inicial a registrar
                    </span>
                    <strong className="inventory-preview-stat__value inventory-preview-stat__value--highlight">
                      {formatQuantityWithUnit(
                        pendingConfirmation.parsedQuantity,
                        selectedItem.unit,
                      )}
                    </strong>
                  </div>
                  <div className="inventory-preview-stat">
                    <span className="inventory-preview-stat__label">
                      Mínimo configurado
                    </span>
                    <strong className="inventory-preview-stat__value">
                      {pendingConfirmation.parsedMinStock === null
                        ? 'Sin mínimo'
                        : formatQuantityWithUnit(
                            pendingConfirmation.parsedMinStock,
                            selectedItem.unit,
                          )}
                    </strong>
                  </div>
                </div>
                <p className="inventory-confirm-box__note">
                  Se creará el primer movimiento en el historial de{' '}
                  <strong>{selectedItem.productName}</strong> dentro de{' '}
                  <strong>{organizationName}</strong> ({branchName}).
                </p>
                <div className="inventory-confirm-box__actions">
                  <Button
                    type="button"
                    variant="primary"
                    onClick={handleConfirmSave}
                    disabled={isSubmitting}
                  >
                    {isSubmitting
                      ? 'Registrando...'
                      : 'Confirmar y guardar existencia inicial'}
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
              Un producto nuevo permanece sin inicializar hasta que confirmes
              este registro.
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
            {selectedItem && !selectedItem.isInitialized && !pendingConfirmation ? (
              <Button type="submit" variant="primary" disabled={isSubmitting}>
                Revisar y confirmar inicialización
              </Button>
            ) : null}
          </div>
        </div>
      </form>
    </Card>
  )
}

