import {
  useEffect,
  useId,
  useMemo,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { Input } from '../../../components/ui/Input'
import type { CurrencyCode } from '../../../types'
import type {
  Product,
  ProductCategory,
  ProductFormDraft,
  ProductFormErrors,
  ProductStatus,
  ProductUnit,
} from '../types'
import {
  formatMonetaryNumberForInput,
  getUnitLabel,
  normalizeSku,
  PRODUCT_UNIT_OPTIONS,
  validateBarcodeCandidate,
  validateProductDraft,
} from '../utils/validation'

export interface ProductSavePayload {
  name: string
  description: string
  sku: string
  categoryId: string | null
  unit: ProductUnit
  salePrice: number
  cost: number | null
  barcodes: string[]
  status: ProductStatus
}

export interface ProductFormPanelProps {
  organizationName: string
  currency: CurrencyCode
  editingProduct: Product | null
  hasInventoryMovements?: boolean
  organizationProducts: Product[]
  organizationCategories: ProductCategory[]
  onSaveProduct: (
    payload: ProductSavePayload,
    editingProductId?: string,
  ) => { ok: boolean; error?: string }
  onCancel: () => void
  onDirtyChange: (isDirty: boolean) => void
  registerExternalSaveHandler: (handler: (() => boolean) | null) => void
}

function createInitialDraft(product: Product | null): ProductFormDraft {
  if (!product) {
    return {
      name: '',
      description: '',
      sku: '',
      categoryId: '',
      unit: 'pieza',
      salePriceInput: '',
      costInput: '',
      barcodes: [],
      status: 'active',
    }
  }

  return {
    name: product.name,
    description: product.description,
    sku: product.sku,
    categoryId: product.categoryId ?? '',
    unit: product.unit,
    salePriceInput: formatMonetaryNumberForInput(product.salePrice),
    costInput: formatMonetaryNumberForInput(product.cost),
    barcodes: [...product.barcodes],
    status: product.status,
  }
}

export function ProductFormPanel({
  organizationName,
  currency,
  editingProduct,
  hasInventoryMovements = false,
  organizationProducts,
  organizationCategories,
  onSaveProduct,
  onCancel,
  onDirtyChange,
  registerExternalSaveHandler,
}: ProductFormPanelProps) {
  const descriptionId = useId()
  const categorySelectId = useId()
  const unitSelectId = useId()
  const statusSelectId = useId()
  const barcodeInputId = useId()

  const [initialDraft] = useState<ProductFormDraft>(() =>
    createInitialDraft(editingProduct),
  )
  const [draft, setDraft] = useState<ProductFormDraft>(() =>
    createInitialDraft(editingProduct),
  )
  const [errors, setErrors] = useState<ProductFormErrors>({})
  const [barcodeCandidate, setBarcodeCandidate] = useState('')
  const [barcodeCandidateError, setBarcodeCandidateError] = useState<
    string | undefined
  >(undefined)
  const [formErrorBanner, setFormErrorBanner] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  const isDirty = useMemo(() => {
    const sameBarcodes =
      draft.barcodes.length === initialDraft.barcodes.length &&
      draft.barcodes.every(
        (code, index) => code === initialDraft.barcodes[index],
      )

    return (
      draft.name !== initialDraft.name ||
      draft.description !== initialDraft.description ||
      draft.sku !== initialDraft.sku ||
      draft.categoryId !== initialDraft.categoryId ||
      draft.unit !== initialDraft.unit ||
      draft.salePriceInput !== initialDraft.salePriceInput ||
      draft.costInput !== initialDraft.costInput ||
      draft.status !== initialDraft.status ||
      barcodeCandidate.trim() !== '' ||
      !sameBarcodes
    )
  }, [draft, initialDraft, barcodeCandidate])

  useEffect(() => {
    onDirtyChange(isDirty)
    return () => {
      onDirtyChange(false)
    }
  }, [isDirty, onDirtyChange])

  // Categorías disponibles: activas + la categoría inactiva histórica si el producto editado ya la tenía
  const selectableCategories = useMemo(() => {
    return organizationCategories.filter(
      (cat) =>
        cat.status === 'active' ||
        (editingProduct !== null && editingProduct.categoryId === cat.id),
    )
  }, [organizationCategories, editingProduct])

  const selectedCategoryObj = useMemo(() => {
    if (!draft.categoryId) {
      return undefined
    }
    return organizationCategories.find((cat) => cat.id === draft.categoryId)
  }, [draft.categoryId, organizationCategories])

  const updateField = <K extends keyof ProductFormDraft>(
    field: K,
    value: ProductFormDraft[K],
  ) => {
    setDraft((prev) => ({
      ...prev,
      [field]: value,
    }))
    if (field in errors) {
      setErrors((prev) => ({
        ...prev,
        [field]: undefined,
      }))
    }
    if (formErrorBanner) {
      setFormErrorBanner(null)
    }
  }

  const handleAddBarcode = () => {
    const candidateError = validateBarcodeCandidate(
      barcodeCandidate,
      draft.barcodes,
      organizationProducts,
      editingProduct?.id,
    )

    if (candidateError) {
      setBarcodeCandidateError(candidateError)
      return
    }

    const cleanCode = barcodeCandidate.trim()
    setDraft((prev) => ({
      ...prev,
      barcodes: [...prev.barcodes, cleanCode],
    }))
    setBarcodeCandidate('')
    setBarcodeCandidateError(undefined)
    setErrors((prev) => ({ ...prev, barcodes: undefined }))
  }

  const handleBarcodeKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      handleAddBarcode()
    }
  }

  const handleRemoveBarcode = (codeToRemove: string) => {
    setDraft((prev) => ({
      ...prev,
      barcodes: prev.barcodes.filter((code) => code !== codeToRemove),
    }))
    setErrors((prev) => ({ ...prev, barcodes: undefined }))
  }

  const executeValidationAndSave = (): boolean => {
    if (isSaving) {
      return false
    }

    // Si el usuario dejó un código escrito en la caja sin pulsar "Agregar código", advertirle para no perderlo
    if (barcodeCandidate.trim() !== '') {
      setBarcodeCandidateError(
        'Haz clic en "Agregar código" para incorporar este código a la lista o borra el texto antes de guardar.',
      )
      setFormErrorBanner(
        'Tienes un código de barras escrito pendiente de agregar a la lista.',
      )
      return false
    }

    const validation = validateProductDraft(
      draft,
      organizationProducts,
      organizationCategories,
      editingProduct,
      hasInventoryMovements,
    )

    setErrors(validation.errors)

    if (!validation.isValid || validation.parsedSalePrice === null) {
      setFormErrorBanner(
        'Revisa los campos marcados con error. Tus datos ingresados se han conservado.',
      )
      return false
    }

    setIsSaving(true)
    const outcome = onSaveProduct(
      {
        name: draft.name.trim(),
        description: draft.description.trim(),
        sku: normalizeSku(draft.sku),
        categoryId: draft.categoryId || null,
        unit: draft.unit,
        salePrice: validation.parsedSalePrice,
        cost: validation.parsedCost,
        barcodes: draft.barcodes.map((code) => code.trim()),
        status: draft.status,
      },
      editingProduct?.id,
    )
    setIsSaving(false)

    if (!outcome.ok) {
      setFormErrorBanner(
        outcome.error ??
          'No fue posible guardar el producto. Tus datos en el formulario se conservaron intactos.',
      )
      return false
    }

    return true
  }

  useEffect(() => {
    registerExternalSaveHandler(() => executeValidationAndSave())
    return () => {
      registerExternalSaveHandler(null)
    }
  })

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    executeValidationAndSave()
  }

  const handleCancelRequest = () => {
    if (isDirty) {
      setShowCancelConfirm(true)
      return
    }
    onCancel()
  }

  return (
    <Card
      as="section"
      padding="lg"
      title={
        editingProduct
          ? `Editar producto: ${editingProduct.name}`
          : `Nuevo producto en ${organizationName}`
      }
      subtitle="Completa los datos comerciales, precios y códigos del artículo. Las existencias se administrarán en el módulo de Inventario."
      headerAction={
        isDirty ? (
          <Badge variant="warning">Cambios sin guardar</Badge>
        ) : (
          <Badge variant="neutral">
            {editingProduct ? 'Sin cambios pendientes' : 'Formulario nuevo'}
          </Badge>
        )
      }
    >
      {formErrorBanner ? (
        <div
          className="settings-feedback settings-feedback--error product-form-banner"
          role="alert"
        >
          {formErrorBanner}
        </div>
      ) : null}

      <form
        onSubmit={handleSubmit}
        className="product-form-stack"
        noValidate
      >
        {/* 1. Datos generales y SKU */}
        <div className="product-form-section">
          <h3 className="product-form-section__title">
            1. Identificación del producto
          </h3>

          <div className="settings-form-grid">
            <Input
              label="Nombre del producto *"
              value={draft.name}
              onChange={(event) => updateField('name', event.target.value)}
              placeholder="Ej. Paquete hojas blancas bond carta (500 hojas)"
              helpText="Obligatorio (2 a 120 caracteres)."
              error={errors.name}
              maxLength={125}
              disabled={isSaving}
              required
            />

            <Input
              label="Código SKU *"
              value={draft.sku}
              onChange={(event) => updateField('sku', event.target.value)}
              placeholder="Ej. PAP-BON-500"
              helpText="Obligatorio y único dentro de esta organización (2 a 40 caracteres)."
              error={errors.sku}
              maxLength={45}
              disabled={isSaving}
              required
            />

            <div className="settings-form-grid__full">
              <div className="ui-input">
                <label htmlFor={descriptionId} className="ui-input__label">
                  Descripción opcional
                </label>
                <textarea
                  id={descriptionId}
                  className={`ui-textarea__control ${
                    errors.description ? 'ui-input__control--error' : ''
                  }`}
                  rows={2}
                  value={draft.description}
                  onChange={(event) =>
                    updateField('description', event.target.value)
                  }
                  placeholder="Detalles breves de presentación, marca o especificaciones (máximo 280 caracteres)"
                  maxLength={290}
                  disabled={isSaving}
                />
                {errors.description ? (
                  <p className="ui-input__error" role="alert">
                    {errors.description}
                  </p>
                ) : (
                  <p className="ui-input__help">
                    Opcional. Ayuda a identificar el artículo en el catálogo.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 2. Categoría, Unidad y Estado */}
        <div className="product-form-section">
          <h3 className="product-form-section__title">
            2. Clasificación, unidad y estado
          </h3>

          <div className="settings-select-grid">
            <div className="ui-select-field">
              <label htmlFor={categorySelectId} className="ui-input__label">
                Categoría
              </label>
              <select
                id={categorySelectId}
                className="ui-select-field__control"
                value={draft.categoryId}
                onChange={(event) =>
                  updateField('categoryId', event.target.value)
                }
                disabled={isSaving}
              >
                <option value="">Sin categoría asignada</option>
                {selectableCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                    {cat.status === 'inactive'
                      ? ' (Categoría inactiva — conservada por historial)'
                      : ''}
                  </option>
                ))}
              </select>
              {selectedCategoryObj?.status === 'inactive' ? (
                <p className="product-form-warning-note" role="note">
                  Esta categoría está <strong>inactiva</strong>. Se conserva en
                  este producto por historial; si la cambias por otra, ya no
                  podrá volver a seleccionarse mientras siga inactiva.
                </p>
              ) : (
                <p className="ui-input__help">
                  Opcional. Solo se listan categorías activas para nuevas
                  asignaciones.
                </p>
              )}
              {errors.categoryId ? (
                <p className="ui-input__error" role="alert">
                  {errors.categoryId}
                </p>
              ) : null}
            </div>

            <div className="ui-select-field">
              <label htmlFor={unitSelectId} className="ui-input__label">
                Unidad de medida *
              </label>
              <select
                id={unitSelectId}
                className="ui-select-field__control"
                value={draft.unit}
                onChange={(event) =>
                  updateField('unit', event.target.value as ProductUnit)
                }
                disabled={isSaving}
              >
                {PRODUCT_UNIT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {editingProduct && hasInventoryMovements ? (
                <p className="product-form-warning-note" role="note">
                  Este producto ya tiene movimientos de inventario en{' '}
                  <strong>{getUnitLabel(editingProduct.unit)}</strong>. No se
                  permite cambiar su unidad a una incompatible porque las
                  existencias no se convierten automáticamente; para usar otra
                  presentación, liquida su saldo en Inventario, desactívalo y
                  crea un nuevo SKU.
                </p>
              ) : (
                <p className="ui-input__help">
                  Presentación en que se vende y contabiliza el artículo.
                </p>
              )}
              {errors.unit ? (
                <p className="ui-input__error" role="alert">
                  {errors.unit}
                </p>
              ) : null}
            </div>

            <div className="ui-select-field">
              <label htmlFor={statusSelectId} className="ui-input__label">
                Estado en el catálogo *
              </label>
              <select
                id={statusSelectId}
                className="ui-select-field__control"
                value={draft.status}
                onChange={(event) =>
                  updateField('status', event.target.value as ProductStatus)
                }
                disabled={isSaving}
              >
                <option value="active">Activo (disponible para venta)</option>
                <option value="inactive">
                  Inactivo (no disponible en nuevas operaciones)
                </option>
              </select>
              <p className="ui-input__help">
                Un producto inactivo conserva su SKU y códigos reservados.
              </p>
            </div>
          </div>
        </div>

        {/* 3. Precio de venta y Costo */}
        <div className="product-form-section">
          <h3 className="product-form-section__title">
            3. Precio de venta y costo ({currency})
          </h3>

          <div className="settings-form-grid">
            <Input
              label={`Precio de venta (${currency}) *`}
              inputMode="decimal"
              value={draft.salePriceInput}
              onChange={(event) =>
                updateField('salePriceInput', event.target.value)
              }
              placeholder="Ej. 145.00"
              helpText="Obligatorio. Número no negativo con máximo 2 decimales (sin redondeo automático)."
              error={errors.salePriceInput}
              disabled={isSaving}
              required
            />

            <Input
              label={`Costo unitario (${currency}, opcional)`}
              inputMode="decimal"
              value={draft.costInput}
              onChange={(event) => updateField('costInput', event.target.value)}
              placeholder="Dejar vacío si se desconoce, o ej. 98.50 / 0"
              helpText="Dejar vacío registra 'Costo no registrado'; escribir 0 registra explícitamente costo cero ($0.00)."
              error={errors.costInput}
              disabled={isSaving}
            />
          </div>
        </div>

        {/* 4. Códigos de barras asociados */}
        <div className="product-form-section">
          <h3 className="product-form-section__title">
            4. Códigos asociados (código de barras / interno)
          </h3>

          <div className="barcode-builder">
            <div className="barcode-builder__input-row">
              <div className="barcode-builder__field">
                <label htmlFor={barcodeInputId} className="ui-input__label">
                  Agregar código al producto
                </label>
                <input
                  id={barcodeInputId}
                  type="text"
                  className={`ui-input__control ${
                    barcodeCandidateError ? 'ui-input__control--error' : ''
                  }`}
                  value={barcodeCandidate}
                  onChange={(event) => {
                    setBarcodeCandidate(event.target.value)
                    if (barcodeCandidateError) {
                      setBarcodeCandidateError(undefined)
                    }
                  }}
                  onKeyDown={handleBarcodeKeyDown}
                  placeholder="Ej. 0075010553108 (conserva ceros iniciales)"
                  maxLength={32}
                  disabled={isSaving}
                />
                <p className="ui-input__help">
                  Se guarda como texto exacto conservando ceros iniciales. No
                  puede repetirse en este producto ni en otro de{' '}
                  {organizationName}.
                </p>
                {barcodeCandidateError ? (
                  <p className="ui-input__error" role="alert">
                    {barcodeCandidateError}
                  </p>
                ) : null}
              </div>

              <div className="barcode-builder__btn">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleAddBarcode}
                  disabled={isSaving}
                >
                  Agregar código
                </Button>
              </div>
            </div>

            {errors.barcodes ? (
              <p className="ui-input__error" role="alert">
                {errors.barcodes}
              </p>
            ) : null}

            {draft.barcodes.length === 0 ? (
              <p className="barcode-builder__empty">
                Este producto aún no tiene códigos de barras asociados. Puedes
                guardarlo solo con su SKU o agregar uno o más códigos arriba.
              </p>
            ) : (
              <ul
                className="barcode-tags-list"
                aria-label="Códigos asociados al producto"
              >
                {draft.barcodes.map((code, index) => (
                  <li key={code} className="barcode-tag">
                    <span className="barcode-tag__code">
                      <code>{code}</code>
                      {index === 0 ? (
                        <span className="barcode-tag__primary">Principal</span>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      className="barcode-tag__remove"
                      onClick={() => handleRemoveBarcode(code)}
                      aria-label={`Quitar código ${code}`}
                      disabled={isSaving}
                    >
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Confirmación antes de salir con cambios sin guardar */}
        {showCancelConfirm ? (
          <div
            className="settings-unsaved-bar"
            role="region"
            aria-label="Confirmar salida con cambios pendientes"
          >
            <div className="settings-unsaved-bar__text">
              <strong>Tienes cambios sin guardar en este formulario.</strong>{' '}
              ¿Deseas descartarlos y volver al listado de productos?
            </div>
            <div className="settings-unsaved-bar__actions">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setShowCancelConfirm(false)
                  onCancel()
                }}
              >
                Sí, descartar y salir
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowCancelConfirm(false)}
              >
                Seguir editando
              </Button>
            </div>
          </div>
        ) : null}

        {/* Barra de acciones del formulario */}
        <div className="settings-footer-bar">
          <div className="settings-footer-bar__meta">
            <span>
              Negocio destino: <strong>{organizationName}</strong> · Las
              existencias de inventario no se modifican desde este formulario.
            </span>
          </div>

          <div className="settings-footer-bar__actions">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancelRequest}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={isSaving}>
              {isSaving
                ? 'Guardando...'
                : editingProduct
                  ? 'Guardar cambios del producto'
                  : 'Registrar producto'}
            </Button>
          </div>
        </div>
      </form>
    </Card>
  )
}

