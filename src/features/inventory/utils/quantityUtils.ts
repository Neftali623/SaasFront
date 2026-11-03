import type {
  DateFormatOption,
  InventoryAlertItem,
  TimezoneOption,
} from '../../../types'
import type {
  Product,
  ProductCategory,
  ProductUnit,
} from '../../products/types'
import { getUnitLabel } from '../../products/utils/validation'
import { formatDateByPreference } from '../../settings/formatters'
import type {
  EnrichedInventoryItem,
  HistoryPeriodFilter,
  InventoryBalance,
  InventoryMovement,
  InventoryMovementType,
  InventoryStockStatus,
} from '../types'

/**
 * Factor de escala entero (3 decimales = milésimas) para aritmética decimal exacta.
 * Evita errores de coma flotante IEEE 754 como `0.1 + 0.2 = 0.30000000000000004`.
 */
export const QUANTITY_SCALE = 1000
export const MAX_INVENTORY_QUANTITY = 999_999

const INTEGER_ONLY_REGEX = /^\d+$/
const DIVISIBLE_DECIMAL_REGEX = /^\d+(\.\d{1,3})?$/
const MORE_THAN_THREE_DECIMALS_REGEX = /^\d+\.\d{4,}$/

const DIVISIBLE_UNITS: ReadonlySet<ProductUnit> = new Set<ProductUnit>([
  'kg',
  'litro',
])

/**
 * Determina si una unidad de medida admite fracciones decimales (hasta 3 decimales)
 * o si exige números enteros exactos.
 * - Divisibles (hasta 3 decimales, ej. 0.001 kg = 1 g, 0.001 L = 1 ml): `kg`, `litro`
 * - Indivisibles (solo enteros): `pieza`, `paquete`, `caja`, `servicio`
 */
export function isDivisibleUnit(unit: ProductUnit): boolean {
  return DIVISIBLE_UNITS.has(unit)
}

export function getUnitPrecisionRuleDescription(unit: ProductUnit): string {
  const label = getUnitLabel(unit)
  if (isDivisibleUnit(unit)) {
    return `Unidad divisible (${label}): admite enteros o decimales con hasta 3 cifras decimales (ej. 1.250).`
  }
  return `Unidad indivisible (${label}): exige cantidades enteras exactas sin decimales (ej. 1, 5, 12).`
}

export function toScaledQuantity(value: number): number {
  return Math.round(value * QUANTITY_SCALE)
}

export function fromScaledQuantity(scaled: number): number {
  return scaled / QUANTITY_SCALE
}

export function normalizeControlledQuantity(value: number): number {
  return fromScaledQuantity(toScaledQuantity(value))
}

export function addControlledQuantities(a: number, b: number): number {
  return fromScaledQuantity(toScaledQuantity(a) + toScaledQuantity(b))
}

export function subtractControlledQuantities(a: number, b: number): number {
  return fromScaledQuantity(toScaledQuantity(a) - toScaledQuantity(b))
}

/**
 * Calcula la diferencia con signo en un conteo físico:
 * `diferencia = cantidadContada - existenciaRegistrada`
 * Ejemplo: registrado 10, contado 8 -> -2
 */
export function calculateCountAdjustmentDelta(
  registeredQuantity: number,
  countedQuantity: number,
): number {
  return fromScaledQuantity(
    toScaledQuantity(countedQuantity) - toScaledQuantity(registeredQuantity),
  )
}

/**
 * Comprueba si un número finito cumple las reglas de la unidad del producto.
 */
export function isQuantityCompatibleWithUnit(
  value: number,
  unit: ProductUnit,
): boolean {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    Math.abs(value) > MAX_INVENTORY_QUANTITY
  ) {
    return false
  }

  const scaled = value * QUANTITY_SCALE
  const roundedScaled = Math.round(scaled)
  if (Math.abs(scaled - roundedScaled) > 1e-6) {
    return false
  }

  if (!isDivisibleUnit(unit)) {
    return roundedScaled % QUANTITY_SCALE === 0
  }

  return true
}

export type QuantityParseResult =
  | {
      ok: true
      value: number | null
    }
  | {
      ok: false
      error: string
    }

export interface ParseQuantityOptions {
  allowZero: boolean
  allowEmptyAsNull?: boolean
  fieldLabel?: string
}

/**
 * Parsea y valida estrictamente una cantidad de inventario según la unidad del producto.
 * - Rechaza entradas vacías (salvo `allowEmptyAsNull`), negativas, no finitas o con formato inválido.
 * - No redondea ni trunca silenciosamente decimales no permitidos.
 */
export function parseStrictQuantityInput(
  rawInput: string,
  unit: ProductUnit,
  options: ParseQuantityOptions,
): QuantityParseResult {
  const trimmed = rawInput.trim()
  const fieldLabel = options.fieldLabel ?? 'cantidad'
  const unitLabel = getUnitLabel(unit)

  if (trimmed === '') {
    if (options.allowEmptyAsNull) {
      return { ok: true, value: null }
    }
    return {
      ok: false,
      error: `La ${fieldLabel} es obligatoria.`,
    }
  }

  if (trimmed.startsWith('-')) {
    return {
      ok: false,
      error: `La ${fieldLabel} no puede ser negativa.`,
    }
  }

  if (!isDivisibleUnit(unit)) {
    if (trimmed.includes('.') || trimmed.includes(',')) {
      return {
        ok: false,
        error: `La unidad "${unitLabel}" es indivisible y exige números enteros exactos sin decimales.`,
      }
    }

    if (!INTEGER_ONLY_REGEX.test(trimmed)) {
      return {
        ok: false,
        error: `Ingresa una ${fieldLabel} entera válida para "${unitLabel}" usando únicamente dígitos (ejemplo: 10).`,
      }
    }
  } else {
    if (trimmed.includes(',')) {
      return {
        ok: false,
        error: `Usa punto decimal (.) para la ${fieldLabel} en "${unitLabel}" (ejemplo: 1.5).`,
      }
    }

    if (MORE_THAN_THREE_DECIMALS_REGEX.test(trimmed)) {
      return {
        ok: false,
        error: `La unidad "${unitLabel}" admite como máximo 3 decimales de precisión (ejemplo: 1.250). No se redondea automáticamente.`,
      }
    }

    if (!DIVISIBLE_DECIMAL_REGEX.test(trimmed)) {
      return {
        ok: false,
        error: `Ingresa una ${fieldLabel} válida para "${unitLabel}" con hasta 3 decimales (ejemplo: 2.5).`,
      }
    }
  }

  const numeric = Number(trimmed)
  if (!Number.isFinite(numeric) || numeric < 0) {
    return {
      ok: false,
      error: `La ${fieldLabel} debe ser un número finito válido.`,
    }
  }

  if (numeric > MAX_INVENTORY_QUANTITY) {
    return {
      ok: false,
      error: `La ${fieldLabel} no puede superar ${MAX_INVENTORY_QUANTITY.toLocaleString('es-MX')}.`,
    }
  }

  const normalized = normalizeControlledQuantity(numeric)

  if (!options.allowZero && normalized <= 0) {
    return {
      ok: false,
      error: `La ${fieldLabel} debe ser mayor a 0.`,
    }
  }

  return {
    ok: true,
    value: normalized,
  }
}

/**
 * Valida si es válido cambiar la unidad de un producto que ya cuenta con movimientos
 * registrados en inventario.
 */
export function validateProductUnitChangeWithInventory(
  currentUnit: ProductUnit,
  nextUnit: ProductUnit,
  hasInventoryMovements: boolean,
): string | undefined {
  if (!hasInventoryMovements || currentUnit === nextUnit) {
    return undefined
  }

  const currentLabel = getUnitLabel(currentUnit)
  const nextLabel = getUnitLabel(nextUnit)

  return `Este producto ya tiene movimientos de inventario registrados en "${currentLabel}". No se permite cambiar su unidad a "${nextLabel}" porque las cantidades históricas y el saldo actual no se convierten automáticamente. Para comercializarlo en "${nextLabel}", ajusta o retira el saldo actual en Inventario, desactiva este artículo y crea un nuevo producto (nuevo SKU) con la nueva unidad.`
}

export function formatQuantityNumber(
  quantity: number,
  unit: ProductUnit,
): string {
  const normalized = normalizeControlledQuantity(quantity)
  if (!isDivisibleUnit(unit)) {
    return new Intl.NumberFormat('es-MX', {
      maximumFractionDigits: 0,
    }).format(Math.round(normalized))
  }

  return new Intl.NumberFormat('es-MX', {
    minimumFractionDigits: Number.isInteger(normalized) ? 0 : 1,
    maximumFractionDigits: 3,
  }).format(normalized)
}

export function formatQuantityWithUnit(
  quantity: number,
  unit: ProductUnit,
): string {
  return `${formatQuantityNumber(quantity, unit)} ${getUnitLabel(unit)}`
}

export function formatSignedQuantityWithUnit(
  delta: number,
  unit: ProductUnit,
): string {
  const normalized = normalizeControlledQuantity(delta)
  const prefix = normalized > 0 ? '+' : ''
  return `${prefix}${formatQuantityNumber(normalized, unit)} ${getUnitLabel(unit)}`
}

/**
 * Determina el estado de existencias evitando cualquier contradicción:
 * 1. Sin balance registrado -> `uninitialized` ("Sin inicializar")
 * 2. Cantidad igual a 0 -> `out_of_stock` ("Sin existencias")
 * 3. Cantidad > 0 con mínimo configurado y `quantity <= minStock` -> `low_stock` ("Bajo mínimo")
 * 4. Cantidad > 0 y (`minStock === null` o `quantity > minStock`) -> `available` ("Disponible")
 */
export function resolveInventoryStockStatus(
  balance: InventoryBalance | undefined,
): InventoryStockStatus {
  if (!balance) {
    return 'uninitialized'
  }

  const qty = normalizeControlledQuantity(balance.quantity)
  if (qty <= 0) {
    return 'out_of_stock'
  }

  if (balance.minStock !== null) {
    const min = normalizeControlledQuantity(balance.minStock)
    if (qty <= min) {
      return 'low_stock'
    }
  }

  return 'available'
}

/**
 * Determina si un producto activo e inicializado requiere alerta de reabastecimiento:
 * - Está en estado `low_stock` (`0 < quantity <= minStock`), o
 * - Está en `out_of_stock` (`quantity === 0`) y tiene un mínimo requerido positivo (`minStock !== null && minStock > 0`).
 * Nota: Si `minStock === 0` y `quantity === 0`, el mínimo configurado en cero se cumple, por lo que su estado es
 * "Sin existencias" pero no dispara alerta de incumplimiento de mínimo.
 */
export function doesBalanceRequireAlert(
  balance: InventoryBalance | undefined,
  productStatus: 'active' | 'inactive',
): boolean {
  if (!balance || productStatus !== 'active' || balance.minStock === null) {
    return false
  }

  const qty = normalizeControlledQuantity(balance.quantity)
  const min = normalizeControlledQuantity(balance.minStock)

  if (qty <= 0) {
    return min > 0
  }

  return qty <= min
}

export function getStockStatusPresentation(status: InventoryStockStatus): {
  label: string
  badgeVariant: 'neutral' | 'danger' | 'warning' | 'success'
  description: string
} {
  switch (status) {
    case 'uninitialized':
      return {
        label: 'Sin inicializar',
        badgeVariant: 'neutral',
        description: 'Sin conteo o saldo inicial registrado en esta sucursal',
      }
    case 'out_of_stock':
      return {
        label: 'Sin existencias',
        badgeVariant: 'danger',
        description: 'Existencia confirmada en cero (0)',
      }
    case 'low_stock':
      return {
        label: 'Bajo mínimo',
        badgeVariant: 'warning',
        description: 'Existencia positiva igual o menor al mínimo configurado',
      }
    case 'available':
      return {
        label: 'Disponible',
        badgeVariant: 'success',
        description: 'Existencia positiva por encima del mínimo requerido',
      }
  }
}

export function getMovementTypePresentation(type: InventoryMovementType): {
  label: string
  shortLabel: string
  badgeVariant: 'brand' | 'success' | 'warning' | 'neutral'
} {
  switch (type) {
    case 'initial':
      return {
        label: 'Existencia inicial',
        shortLabel: 'Inicialización',
        badgeVariant: 'brand',
      }
    case 'manual_in':
      return {
        label: 'Entrada manual',
        shortLabel: 'Entrada',
        badgeVariant: 'success',
      }
    case 'manual_out':
      return {
        label: 'Salida manual',
        shortLabel: 'Salida',
        badgeVariant: 'warning',
      }
    case 'count_adjustment':
      return {
        label: 'Ajuste por conteo',
        shortLabel: 'Conteo físico',
        badgeVariant: 'neutral',
      }
    case 'sale_out':
      return {
        label: 'Salida por venta (POS)',
        shortLabel: 'Venta POS',
        badgeVariant: 'warning',
      }
    case 'sale_return_in':
      return {
        label: 'Reingreso por devolución/cancelación (POS)',
        shortLabel: 'Devolución POS',
        badgeVariant: 'success',
      }
  }
}

/**
 * Construye el listado enriquecido cruzando el catálogo de la organización con
 * los balances e historial de la sucursal activa, sin duplicar productos.
 */
export function buildEnrichedInventoryItems(
  products: Product[],
  categories: ProductCategory[],
  balances: InventoryBalance[],
  movements: InventoryMovement[],
  branchId: string,
): EnrichedInventoryItem[] {
  const categoriesById = new Map<string, ProductCategory>()
  for (const cat of categories) {
    categoriesById.set(cat.id, cat)
  }

  const balancesByProductId = new Map<string, InventoryBalance>()
  for (const bal of balances) {
    if (bal.branchId === branchId) {
      balancesByProductId.set(bal.productId, bal)
    }
  }

  const movementCountByProductId = new Map<string, number>()
  for (const mov of movements) {
    if (mov.branchId === branchId) {
      movementCountByProductId.set(
        mov.productId,
        (movementCountByProductId.get(mov.productId) ?? 0) + 1,
      )
    }
  }

  return products.map((product) => {
    const category = product.categoryId
      ? categoriesById.get(product.categoryId)
      : undefined
    const balance = balancesByProductId.get(product.id)
    const stockStatus = resolveInventoryStockStatus(balance)
    const movementsCount = movementCountByProductId.get(product.id) ?? 0

    return {
      productId: product.id,
      organizationId: product.organizationId,
      branchId,
      productName: product.name,
      sku: product.sku,
      description: product.description,
      categoryId: product.categoryId,
      categoryName: category ? category.name : null,
      categoryIsInactive: category ? category.status === 'inactive' : false,
      unit: product.unit,
      barcodes: product.barcodes,
      productStatus: product.status,
      isInitialized: balance !== undefined,
      quantity: balance ? balance.quantity : null,
      minStock: balance ? balance.minStock : null,
      stockStatus,
      needsReplenishmentAlert: doesBalanceRequireAlert(balance, product.status),
      balanceVersion: balance ? balance.version : null,
      updatedAt: balance ? balance.updatedAt : null,
      movementsCount,
    }
  })
}

/**
 * Genera las alertas de inventario para el Resumen (Dashboard) a partir del
 * catálogo e inventario reales de demostración del negocio activo.
 * Evita discrepancias entre el Resumen y la pantalla de Inventario.
 */
export function buildOrganizationInventoryAlerts(
  products: Product[],
  categories: ProductCategory[],
  balances: InventoryBalance[],
): InventoryAlertItem[] {
  const categoriesById = new Map<string, ProductCategory>()
  for (const cat of categories) {
    categoriesById.set(cat.id, cat)
  }

  const balancesByProductId = new Map<string, InventoryBalance>()
  for (const bal of balances) {
    balancesByProductId.set(bal.productId, bal)
  }

  const alerts: InventoryAlertItem[] = []

  for (const product of products) {
    if (product.status !== 'active') {
      continue
    }

    const balance = balancesByProductId.get(product.id)
    if (
      !balance ||
      balance.minStock === null ||
      !doesBalanceRequireAlert(balance, product.status)
    ) {
      continue
    }

    const categoryName = product.categoryId
      ? (categoriesById.get(product.categoryId)?.name ?? 'Sin categoría')
      : 'Sin categoría'

    const isCritical =
      balance.quantity <= 0 || balance.quantity <= balance.minStock * 0.5

    alerts.push({
      id: `alert-${product.id}`,
      sku: product.sku,
      productName: product.name,
      category: categoryName,
      currentStock: balance.quantity,
      minStock: balance.minStock,
      unit: getUnitLabel(product.unit).toLowerCase(),
      severity: isCritical ? 'critical' : 'warning',
    })
  }

  // Ordenar primero las alertas críticas y luego por menor porcentaje respecto al mínimo
  return alerts.sort((a, b) => {
    if (a.severity !== b.severity) {
      return a.severity === 'critical' ? -1 : 1
    }
    const ratioA = a.minStock > 0 ? a.currentStock / a.minStock : 0
    const ratioB = b.minStock > 0 ? b.currentStock / b.minStock : 0
    if (ratioA !== ratioB) {
      return ratioA - ratioB
    }
    return a.sku.localeCompare(b.sku)
  })
}

/**
 * Ordena los movimientos de forma determinista y estable:
 * 1. Por fecha/hora ISO descendente (más reciente primero).
 * 2. En caso de empate exacto de timestamp, por `sequence` descendente.
 * 3. Como desempate final, por `id` descendente.
 */
export function sortMovementsDeterministically(
  movements: InventoryMovement[],
): InventoryMovement[] {
  return [...movements].sort((a, b) => {
    const timeA = Date.parse(a.createdAt)
    const timeB = Date.parse(b.createdAt)
    if (Number.isFinite(timeA) && Number.isFinite(timeB) && timeA !== timeB) {
      return timeB - timeA
    }
    if (a.createdAt !== b.createdAt) {
      return b.createdAt.localeCompare(a.createdAt)
    }
    if (a.sequence !== b.sequence) {
      return b.sequence - a.sequence
    }
    return b.id.localeCompare(a.id)
  })
}

/**
 * Formatea una marca de tiempo ISO en la zona horaria y formato de fecha de la organización.
 */
export function formatDateTimeInOrganizationTimezone(
  isoTimestamp: string,
  timezone: TimezoneOption,
  dateFormat: DateFormatOption,
): { dateLabel: string; timeLabel: string; fullLabel: string } {
  const dateObj = new Date(isoTimestamp)
  if (Number.isNaN(dateObj.getTime())) {
    return {
      dateLabel: isoTimestamp,
      timeLabel: '',
      fullLabel: isoTimestamp,
    }
  }

  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(dateObj)

    const year = parts.find((p) => p.type === 'year')?.value ?? '2026'
    const month = parts.find((p) => p.type === 'month')?.value ?? '01'
    const day = parts.find((p) => p.type === 'day')?.value ?? '01'
    const hourRaw = parts.find((p) => p.type === 'hour')?.value ?? '00'
    const hour = hourRaw === '24' ? '00' : hourRaw
    const minute = parts.find((p) => p.type === 'minute')?.value ?? '00'

    const isoDatePart = `${year}-${month}-${day}`
    const dateLabel = formatDateByPreference(isoDatePart, dateFormat)
    const timeLabel = `${hour}:${minute} h`

    return {
      dateLabel,
      timeLabel,
      fullLabel: `${dateLabel} · ${timeLabel}`,
    }
  } catch {
    const fallbackIsoDate = isoTimestamp.slice(0, 10)
    const dateLabel = formatDateByPreference(fallbackIsoDate, dateFormat)
    const timeLabel = `${isoTimestamp.slice(11, 16)} h`
    return {
      dateLabel,
      timeLabel,
      fullLabel: `${dateLabel} · ${timeLabel}`,
    }
  }
}

export function isMovementWithinPeriod(
  isoTimestamp: string,
  period: HistoryPeriodFilter,
  timezone: TimezoneOption,
  referenceNow: Date = new Date(),
): boolean {
  if (period === 'all') {
    return true
  }

  const movDate = new Date(isoTimestamp)
  if (Number.isNaN(movDate.getTime())) {
    return false
  }

  if (period === 'today') {
    try {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
      return formatter.format(movDate) === formatter.format(referenceNow)
    } catch {
      return isoTimestamp.slice(0, 10) === referenceNow.toISOString().slice(0, 10)
    }
  }

  const diffMs = referenceNow.getTime() - movDate.getTime()
  const maxDays = period === 'last_7_days' ? 7 : 30
  const maxMs = maxDays * 24 * 60 * 60 * 1000
  return diffMs <= maxMs && diffMs >= -24 * 60 * 60 * 1000
}

