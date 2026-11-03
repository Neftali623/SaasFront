import { validateProductUnitChangeWithInventory } from '../../inventory/utils/quantityUtils'
import type {
  Product,
  ProductCategory,
  ProductFormDraft,
  ProductFormErrors,
  ProductUnit,
} from '../types'

export interface UnitOption {
  value: ProductUnit
  label: string
  shortLabel: string
}

export const PRODUCT_UNIT_OPTIONS: UnitOption[] = [
  { value: 'pieza', label: 'Pieza (pza)', shortLabel: 'Pieza' },
  { value: 'paquete', label: 'Paquete (paq)', shortLabel: 'Paquete' },
  { value: 'caja', label: 'Caja', shortLabel: 'Caja' },
  { value: 'kg', label: 'Kilogramo (kg)', shortLabel: 'Kg' },
  { value: 'litro', label: 'Litro (L)', shortLabel: 'Litro' },
  { value: 'servicio', label: 'Servicio', shortLabel: 'Servicio' },
]

export function getUnitLabel(unit: ProductUnit): string {
  return (
    PRODUCT_UNIT_OPTIONS.find((opt) => opt.value === unit)?.shortLabel ?? unit
  )
}

const SKU_REGEX = /^[A-Za-z0-9\-_./]{2,40}$/
const BARCODE_REGEX = /^[A-Za-z0-9\-_]{3,32}$/
const STRICT_MONETARY_REGEX = /^\d+(\.\d{1,2})?$/
const MORE_THAN_TWO_DECIMALS_REGEX = /^\d+\.\d{3,}$/
const MAX_MONETARY_AMOUNT = 9_999_999.99

/**
 * Normaliza el nombre de una categoría colapsando espacios repetidos y
 * convirtiendo a minúsculas para impedir duplicados equivalentes en el negocio.
 */
export function normalizeCategoryKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function cleanCategoryName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

export function normalizeSku(sku: string): string {
  return sku.trim().toUpperCase()
}

export function validateCategoryName(
  rawName: string,
  organizationCategories: ProductCategory[],
  editingCategoryId?: string,
): string | undefined {
  const cleaned = cleanCategoryName(rawName)
  if (!cleaned) {
    return 'El nombre de la categoría es obligatorio.'
  }
  if (cleaned.length < 2) {
    return 'El nombre de la categoría debe tener al menos 2 caracteres.'
  }
  if (cleaned.length > 60) {
    return 'El nombre de la categoría no puede exceder 60 caracteres.'
  }

  const targetKey = normalizeCategoryKey(cleaned)
  const duplicate = organizationCategories.find(
    (cat) =>
      cat.id !== editingCategoryId &&
      normalizeCategoryKey(cat.name) === targetKey,
  )

  if (duplicate) {
    return `Ya existe una categoría equivalente en este negocio ("${duplicate.name}").`
  }

  return undefined
}

export type MonetaryParseResult =
  | {
      ok: true
      value: number | null
    }
  | {
      ok: false
      error: string
    }

/**
 * Parsea y valida un importe monetario con precisión máxima de 2 decimales.
 * - No redondea ni corrige entradas inválidas silenciosamente.
 * - Si `allowEmptyAsNull` es true, una cadena vacía produce `null` (costo desconocido),
 *   mientras que `"0"` o `"0.00"` produce `0` (costo cero).
 */
export function parseStrictMonetaryInput(
  rawInput: string,
  fieldLabel: string,
  allowEmptyAsNull: boolean,
): MonetaryParseResult {
  const trimmed = rawInput.trim()

  if (trimmed === '') {
    if (allowEmptyAsNull) {
      return { ok: true, value: null }
    }
    return { ok: false, error: `El ${fieldLabel} es obligatorio.` }
  }

  if (trimmed.startsWith('-')) {
    return {
      ok: false,
      error: `El ${fieldLabel} no puede ser un número negativo.`,
    }
  }

  if (MORE_THAN_TWO_DECIMALS_REGEX.test(trimmed)) {
    return {
      ok: false,
      error: `El ${fieldLabel} admite como máximo 2 decimales de precisión (ejemplo: 125.50). No se redondea automáticamente.`,
    }
  }

  if (!STRICT_MONETARY_REGEX.test(trimmed)) {
    return {
      ok: false,
      error: `Ingresa un ${fieldLabel} válido usando solo dígitos y punto decimal con hasta 2 decimales (ejemplo: 125.50).`,
    }
  }

  const numeric = Number(trimmed)
  if (!Number.isFinite(numeric) || numeric < 0) {
    return {
      ok: false,
      error: `El ${fieldLabel} debe ser un importe válido mayor o igual a 0.`,
    }
  }

  if (numeric > MAX_MONETARY_AMOUNT) {
    return {
      ok: false,
      error: `El ${fieldLabel} no puede superar 9,999,999.99.`,
    }
  }

  const exactTwoDecimals = Math.round(numeric * 100) / 100
  return { ok: true, value: exactTwoDecimals }
}

export function formatMonetaryNumberForInput(value: number | null): string {
  if (value === null) {
    return ''
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

/**
 * Valida un código de barras individual antes de agregarlo a la lista del producto.
 * Conserva ceros iniciales tratando el código estrictamente como texto.
 */
export function validateBarcodeCandidate(
  rawBarcode: string,
  currentBarcodes: string[],
  organizationProducts: Product[],
  editingProductId?: string,
): string | undefined {
  const code = rawBarcode.trim()
  if (!code) {
    return 'Escribe un código antes de agregarlo.'
  }

  if (!BARCODE_REGEX.test(code)) {
    return 'El código debe tener entre 3 y 32 caracteres (letras, números o guiones, sin espacios).'
  }

  if (currentBarcodes.includes(code)) {
    return `El código "${code}" ya está incluido en este producto.`
  }

  const conflictingProduct = organizationProducts.find(
    (prod) =>
      prod.id !== editingProductId && prod.barcodes.includes(code),
  )

  if (conflictingProduct) {
    return `El código "${code}" ya pertenece al producto "${conflictingProduct.name}" (SKU: ${conflictingProduct.sku}) en esta organización.`
  }

  return undefined
}

export interface ProductValidationOutcome {
  isValid: boolean
  errors: ProductFormErrors
  parsedSalePrice: number | null
  parsedCost: number | null
}

export function validateProductDraft(
  draft: ProductFormDraft,
  organizationProducts: Product[],
  organizationCategories: ProductCategory[],
  editingProduct?: Product | null,
  hasInventoryMovements = false,
): ProductValidationOutcome {
  const errors: ProductFormErrors = {}

  const cleanName = draft.name.trim()
  if (!cleanName) {
    errors.name = 'El nombre del producto es obligatorio.'
  } else if (cleanName.length < 2) {
    errors.name = 'El nombre del producto debe tener al menos 2 caracteres.'
  } else if (cleanName.length > 120) {
    errors.name = 'El nombre del producto no puede superar 120 caracteres.'
  }

  const cleanDescription = draft.description.trim()
  if (cleanDescription.length > 280) {
    errors.description = 'La descripción no puede superar 280 caracteres.'
  }

  const cleanSku = normalizeSku(draft.sku)
  if (!cleanSku) {
    errors.sku = 'El código SKU es obligatorio.'
  } else if (!SKU_REGEX.test(cleanSku)) {
    errors.sku =
      'El SKU debe tener entre 2 y 40 caracteres (letras, números, guion, punto o diagonal, sin espacios).'
  } else {
    const duplicateSkuProduct = organizationProducts.find(
      (prod) =>
        prod.id !== editingProduct?.id &&
        normalizeSku(prod.sku) === cleanSku,
    )
    if (duplicateSkuProduct) {
      errors.sku = `El SKU "${cleanSku}" ya está reservado por "${duplicateSkuProduct.name}" (${
        duplicateSkuProduct.status === 'active' ? 'activo' : 'inactivo'
      }) en esta organización.`
    }
  }

  if (draft.categoryId) {
    const category = organizationCategories.find(
      (cat) => cat.id === draft.categoryId,
    )
    if (!category) {
      errors.categoryId =
        'La categoría seleccionada no pertenece a esta organización.'
    } else if (
      category.status === 'inactive' &&
      editingProduct?.categoryId !== category.id
    ) {
      errors.categoryId =
        'No se puede asignar una categoría inactiva a un producto nuevo o distinto.'
    }
  }

  const isAllowedUnit = PRODUCT_UNIT_OPTIONS.some(
    (opt) => opt.value === draft.unit,
  )
  if (!isAllowedUnit) {
    errors.unit = 'Selecciona una unidad de medida válida.'
  } else if (editingProduct && hasInventoryMovements) {
    const unitConflictError = validateProductUnitChangeWithInventory(
      editingProduct.unit,
      draft.unit,
      hasInventoryMovements,
    )
    if (unitConflictError) {
      errors.unit = unitConflictError
    }
  }

  const priceResult = parseStrictMonetaryInput(
    draft.salePriceInput,
    'precio de venta',
    false,
  )
  if (!priceResult.ok) {
    errors.salePriceInput = priceResult.error
  }

  const costResult = parseStrictMonetaryInput(
    draft.costInput,
    'costo unitario',
    true,
  )
  if (!costResult.ok) {
    errors.costInput = costResult.error
  }

  const seenBarcodes = new Set<string>()
  for (const rawCode of draft.barcodes) {
    const code = rawCode.trim()
    if (!BARCODE_REGEX.test(code)) {
      errors.barcodes = `El código "${code}" tiene un formato inválido (3 a 32 caracteres sin espacios).`
      break
    }
    if (seenBarcodes.has(code)) {
      errors.barcodes = `El código "${code}" está repetido dentro del mismo producto.`
      break
    }
    seenBarcodes.add(code)

    const conflictingProduct = organizationProducts.find(
      (prod) =>
        prod.id !== editingProduct?.id && prod.barcodes.includes(code),
    )
    if (conflictingProduct) {
      errors.barcodes = `El código "${code}" ya pertenece al producto "${conflictingProduct.name}" (SKU: ${conflictingProduct.sku}).`
      break
    }
  }

  const hasErrors = Boolean(
    errors.name ||
      errors.description ||
      errors.sku ||
      errors.categoryId ||
      errors.unit ||
      errors.salePriceInput ||
      errors.costInput ||
      errors.barcodes,
  )

  return {
    isValid: !hasErrors,
    errors,
    parsedSalePrice: priceResult.ok ? priceResult.value : null,
    parsedCost: costResult.ok ? costResult.value : null,
  }
}

