import type {
  CurrencyCode,
  DailySalesMetrics,
  DateFormatOption,
  PaymentMethodLabel,
  RecentSaleItem,
  TimezoneOption,
} from '../../../types'
import {
  amountToCents,
  centsToAmount,
  formatCentsWithHistoricalCurrency,
} from '../../cash/utils/moneyUtils'
import type { InventoryBalance } from '../../inventory/types'
import {
  addControlledQuantities,
  formatDateTimeInOrganizationTimezone,
  formatQuantityWithUnit,
  fromScaledQuantity,
  isDivisibleUnit,
  QUANTITY_SCALE,
  resolveInventoryStockStatus,
  subtractControlledQuantities,
  toScaledQuantity,
} from '../../inventory/utils/quantityUtils'
import type {
  Product,
  ProductCategory,
  ProductUnit,
} from '../../products/types'
import { getUnitLabel } from '../../products/utils/validation'
import type {
  PosCartItem,
  PosCatalogProductItem,
  PosPaymentMethod,
  SaleLineItem,
  SaleRecord,
  SaleReturnRecord,
  SaleStatus,
} from '../types'

/**
 * Regla explícita de redondeo monetario por partida:
 * - `unitPriceCents`: Precio unitario entero en centavos (ej. $80.00 -> 8000).
 * - `quantity`: Cantidad controlada (entera o decimal de hasta 3 cifras en escala 1000).
 * - Se multiplica en enteros (`unitPriceCents * scaledQuantity`) y se redondea al
 *   centavo entero más cercano (`Math.round(producto / 1000)`).
 * - Evita errores de coma flotante como `19.99 * 3 = 59.970000000000006`.
 */
export function calculateLineSubtotalCents(
  unitPriceCents: number,
  quantity: number,
): number {
  const cleanUnitPriceCents = Math.round(unitPriceCents)
  const scaledQty = toScaledQuantity(quantity)
  return Math.round((cleanUnitPriceCents * scaledQty) / QUANTITY_SCALE)
}

/**
 * Calcula los totales del carrito sumando únicamente los importes (`lineSubtotalCents`)
 * ya redondeados de cada partida.
 */
export function calculateCartTotals(cartItems: PosCartItem[]): {
  subtotalCents: number
  totalCents: number
  distinctItemsCount: number
} {
  let subtotalCents = 0
  for (const item of cartItems) {
    subtotalCents += Math.round(item.lineSubtotalCents)
  }
  return {
    subtotalCents,
    totalCents: subtotalCents,
    distinctItemsCount: cartItems.length,
  }
}

/**
 * Cantidad por defecto que se agrega al escanear un código de barras según la unidad.
 */
export function getDefaultScanQuantityForUnit(unit: ProductUnit): number {
  return isDivisibleUnit(unit) ? 1 : 1
}

/**
 * Paso de incremento/decremento rápido en los controles +/- del carrito según la unidad.
 */
export function getStepQuantityForUnit(unit: ProductUnit): number {
  return isDivisibleUnit(unit) ? 0.25 : 1
}

/**
 * Construye el listado de productos enriquecido con el estado actual de inventario
 * y la cantidad reservada temporalmente en el carrito en memoria.
 */
export function buildPosCatalogItems(
  products: Product[],
  categories: ProductCategory[],
  balances: InventoryBalance[],
  cartItems: PosCartItem[],
  branchId: string,
): PosCatalogProductItem[] {
  const categoryNameById = new Map<string, string>()
  for (const cat of categories) {
    categoryNameById.set(cat.id, cat.name)
  }

  const balanceByProductId = new Map<string, InventoryBalance>()
  for (const bal of balances) {
    if (bal.branchId === branchId) {
      balanceByProductId.set(bal.productId, bal)
    }
  }

  const cartQtyByProductId = new Map<string, number>()
  for (const line of cartItems) {
    cartQtyByProductId.set(line.productId, line.quantity)
  }

  return products.map((product) => {
    const balance = balanceByProductId.get(product.id)
    const isInitialized = balance !== undefined
    const registeredQuantity = balance ? balance.quantity : null
    const inCartQuantity = cartQtyByProductId.get(product.id) ?? 0

    const remainingAvailableQuantity =
      registeredQuantity !== null
        ? Math.max(
            0,
            subtractControlledQuantities(registeredQuantity, inCartQuantity),
          )
        : null

    const stockStatus = resolveInventoryStockStatus(balance)

    const unitPriceCents = amountToCents(product.salePrice)
    const historicalUnitCostCents =
      product.cost !== null ? amountToCents(product.cost) : null

    let canSell = true
    let blockReason: string | null = null

    if (product.status !== 'active') {
      canSell = false
      blockReason = 'Producto inactivo para nuevas ventas'
    } else if (!isInitialized || registeredQuantity === null) {
      canSell = false
      blockReason = 'Inventario sin inicializar en esta sucursal'
    } else if (registeredQuantity <= 0) {
      canSell = false
      blockReason = 'Sin existencias disponibles (0)'
    } else if (
      remainingAvailableQuantity !== null &&
      toScaledQuantity(remainingAvailableQuantity) <= 0
    ) {
      canSell = false
      blockReason = `Toda la existencia disponible (${formatQuantityWithUnit(registeredQuantity, product.unit)}) ya está en el carrito`
    }

    return {
      product,
      categoryName: product.categoryId
        ? (categoryNameById.get(product.categoryId) ?? null)
        : null,
      unitPriceCents,
      historicalUnitCostCents,
      isInitialized,
      registeredQuantity,
      inCartQuantity,
      remainingAvailableQuantity,
      stockStatus,
      balanceVersion: balance ? balance.version : null,
      canSell,
      blockReason,
    }
  })
}

function normalizeSearchText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Busca un producto por coincidencia exacta de código de barras (como texto,
 * conservando ceros iniciales) dentro de la organización activa.
 */
export function findProductItemByExactBarcode(
  items: PosCatalogProductItem[],
  rawBarcode: string,
): PosCatalogProductItem | null {
  const cleanCode = rawBarcode.trim()
  if (!cleanCode) {
    return null
  }
  for (const item of items) {
    if (item.product.barcodes.some((code) => code === cleanCode)) {
      return item
    }
  }
  return null
}

/**
 * Filtra productos para nuevas ventas en el mostrador:
 * - Solo devuelve productos activos (`status === 'active'`) en la lista de resultados.
 * - Si la búsqueda coincide exactamente con el SKU o código de un producto inactivo,
 *   lo informa en `matchedInactiveProducts` para que la interfaz explique por qué no puede venderse.
 */
export function filterPosProductsForSale(
  items: PosCatalogProductItem[],
  rawSearchQuery: string,
  categoryFilter: string,
): {
  activeResults: PosCatalogProductItem[]
  matchedInactiveProducts: PosCatalogProductItem[]
} {
  const rawTrimmed = rawSearchQuery.trim()
  const normalizedQuery = normalizeSearchText(rawTrimmed)

  const activeResults: PosCatalogProductItem[] = []
  const matchedInactiveProducts: PosCatalogProductItem[] = []

  for (const item of items) {
    const prod = item.product

    // Filtro por categoría
    if (categoryFilter !== 'all') {
      if (categoryFilter === 'uncategorized') {
        if (prod.categoryId !== null) {
          continue
        }
      } else if (prod.categoryId !== categoryFilter) {
        continue
      }
    }

    if (!rawTrimmed) {
      if (prod.status === 'active') {
        activeResults.push(item)
      }
      continue
    }

    const matchesName = normalizeSearchText(prod.name).includes(normalizedQuery)
    const matchesSku = prod.sku.toLowerCase().includes(rawTrimmed.toLowerCase())
    // Los códigos de barras se comparan como texto exacto o subcadena conservando ceros iniciales
    const matchesBarcode = prod.barcodes.some((code) =>
      code.includes(rawTrimmed),
    )

    if (matchesName || matchesSku || matchesBarcode) {
      if (prod.status === 'active') {
        activeResults.push(item)
      } else {
        matchedInactiveProducts.push(item)
      }
    }
  }

  return {
    activeResults,
    matchedInactiveProducts,
  }
}

export function getPaymentMethodPresentation(method: PosPaymentMethod): {
  label: PaymentMethodLabel
  fullLabel: string
  badgeVariant: 'success' | 'brand' | 'accent'
  affectsPhysicalCash: boolean
} {
  switch (method) {
    case 'cash':
      return {
        label: 'Efectivo',
        fullLabel: 'Efectivo en caja',
        badgeVariant: 'success',
        affectsPhysicalCash: true,
      }
    case 'card':
      return {
        label: 'Tarjeta',
        fullLabel: 'Tarjeta (registro manual verificado)',
        badgeVariant: 'brand',
        affectsPhysicalCash: false,
      }
    case 'transfer':
      return {
        label: 'Transferencia',
        fullLabel: 'Transferencia (registro manual verificado)',
        badgeVariant: 'accent',
        affectsPhysicalCash: false,
      }
  }
}

export function formatSaleFolio(folioNumber: number): string {
  return `FOL-${String(Math.max(1, Math.round(folioNumber))).padStart(4, '0')}`
}

export function formatReturnFolio(returnFolioNumber: number): string {
  return `DEV-${String(Math.max(1, Math.round(returnFolioNumber))).padStart(4, '0')}`
}

export function getSaleStatusPresentation(status: SaleStatus): {
  label: string
  badgeVariant: 'success' | 'warning' | 'danger' | 'neutral'
  description: string
} {
  switch (status) {
    case 'completed':
      return {
        label: 'Completada',
        badgeVariant: 'success',
        description: 'Venta completada sin devoluciones registradas',
      }
    case 'partially_refunded':
      return {
        label: 'Devuelta parcialmente',
        badgeVariant: 'warning',
        description: 'Cuenta con devoluciones parciales y partidas pendientes',
      }
    case 'fully_refunded':
      return {
        label: 'Devuelta totalmente',
        badgeVariant: 'danger',
        description: 'Todas las partidas fueron devueltas y reembolsadas',
      }
    case 'cancelled':
      return {
        label: 'Cancelada',
        badgeVariant: 'neutral',
        description: 'Venta cancelada en su totalidad con reversión completa',
      }
  }
}

/**
 * Calcula con precisión exacta al centavo entero el importe a reembolsar
 * para una partida específica ante una devolución fraccionaria o total.
 * Garantiza que al completar el 100% de la cantidad vendida, la suma de los
 * reembolsos coincida exactamente con el subtotal histórico de la partida.
 */
export function calculateReturnLineRefundCents(
  line: SaleLineItem,
  previousReturnedQty: number,
  previousRefundedCents: number,
  additionalReturnQty: number,
): number {
  if (toScaledQuantity(additionalReturnQty) <= 0) {
    return 0
  }

  const newTotalReturnedQty = addControlledQuantities(
    previousReturnedQty,
    additionalReturnQty,
  )

  // Si completa o supera la cantidad vendida original, devuelve el resto exacto
  if (toScaledQuantity(newTotalReturnedQty) >= toScaledQuantity(line.quantity)) {
    return Math.max(0, line.lineSubtotalCents - previousRefundedCents)
  }

  // Devolución fraccionaria / parcial: importe acumulado proporcional redondeado
  const scaledAccumQty = toScaledQuantity(newTotalReturnedQty)
  const theoreticalAccumulatedRefundCents = Math.round(
    (line.unitPriceCents * scaledAccumQty) / QUANTITY_SCALE,
  )
  const boundedAccumulatedCents = Math.min(
    line.lineSubtotalCents,
    theoreticalAccumulatedRefundCents,
  )

  const currentRefundCents = boundedAccumulatedCents - previousRefundedCents
  return Math.max(0, currentRefundCents)
}

export interface ComputedSaleLineStatus {
  line: SaleLineItem
  returnedQuantity: number
  remainingReturnableQuantity: number
  refundedCents: number
  remainingRefundableCents: number
  isFullyReturned: boolean
}

export interface DerivedSaleSummary {
  status: SaleStatus
  refundedTotalCents: number
  netTotalCents: number
  returnsCount: number
  linesSummary: ComputedSaleLineStatus[]
  canCancel: boolean
  cancelBlockReason: string | null
  canRefund: boolean
  refundBlockReason: string | null
}

/**
 * Calcula el estado derivado, los saldos pendientes de devolución y la elegibilidad
 * de cancelación y devolución a partir de los datos históricos de la venta.
 */
export function deriveSaleComputedTotals(sale: SaleRecord): DerivedSaleSummary {
  const returns = sale.returns ?? []
  const linesSummary: ComputedSaleLineStatus[] = []
  let calculatedRefundedTotalCents = 0

  for (const line of sale.lines) {
    let lineReturnedQty = 0
    let lineRefundedCents = 0

    for (const ret of returns) {
      for (const retLine of ret.lines) {
        if (retLine.saleLineId === line.id) {
          lineReturnedQty = addControlledQuantities(
            lineReturnedQty,
            retLine.returnedQuantity,
          )
          lineRefundedCents += Math.round(retLine.refundCents)
        }
      }
    }

    const remainingReturnableQuantity = Math.max(
      0,
      subtractControlledQuantities(line.quantity, lineReturnedQty),
    )
    const remainingRefundableCents = Math.max(
      0,
      line.lineSubtotalCents - lineRefundedCents,
    )
    const isFullyReturned = toScaledQuantity(remainingReturnableQuantity) <= 0

    calculatedRefundedTotalCents += lineRefundedCents

    linesSummary.push({
      line,
      returnedQuantity: lineReturnedQty,
      remainingReturnableQuantity,
      refundedCents: lineRefundedCents,
      remainingRefundableCents,
      isFullyReturned,
    })
  }

  const refundedTotalCents = Math.max(
    sale.refundedTotalCents ?? 0,
    calculatedRefundedTotalCents,
  )
  const netTotalCents = Math.max(0, sale.totalCents - refundedTotalCents)
  const returnsCount = returns.length

  let status: SaleStatus
  const hasCancelationReturn = returns.some((r) => r.type === 'cancelation')

  if (sale.status === 'cancelled' || hasCancelationReturn) {
    status = 'cancelled'
  } else if (
    linesSummary.length > 0 &&
    linesSummary.every((l) => l.isFullyReturned)
  ) {
    status = 'fully_refunded'
  } else if (returnsCount > 0 || refundedTotalCents > 0) {
    status = 'partially_refunded'
  } else {
    status = 'completed'
  }

  let canCancel = true
  let cancelBlockReason: string | null = null

  if (status === 'cancelled') {
    canCancel = false
    cancelBlockReason = 'La venta ya se encuentra cancelada.'
  } else if (returnsCount > 0 || refundedTotalCents > 0) {
    canCancel = false
    cancelBlockReason =
      'La venta ya cuenta con devoluciones parciales registradas. Si requieres reingresar las partidas pendientes, utiliza el flujo de Devolución.'
  }

  let canRefund = true
  let refundBlockReason: string | null = null

  if (status === 'cancelled') {
    canRefund = false
    refundBlockReason = 'La venta está cancelada; no admite devoluciones.'
  } else if (status === 'fully_refunded') {
    canRefund = false
    refundBlockReason =
      'La venta ya fue devuelta en su totalidad (100% de las partidas reembolsadas).'
  } else if (
    linesSummary.every((l) => toScaledQuantity(l.remainingReturnableQuantity) <= 0)
  ) {
    canRefund = false
    refundBlockReason =
      'No restan partidas con cantidades pendientes para devolver.'
  }

  return {
    status,
    refundedTotalCents,
    netTotalCents,
    returnsCount,
    linesSummary,
    canCancel,
    cancelBlockReason,
    canRefund,
    refundBlockReason,
  }
}

export function isSaleWithinPeriod(
  isoTimestamp: string,
  period: 'all' | 'today' | 'last_7_days' | 'last_30_days',
  timezone: TimezoneOption,
  referenceNow: Date = new Date(),
): boolean {
  if (period === 'all') {
    return true
  }

  const saleDate = new Date(isoTimestamp)
  if (Number.isNaN(saleDate.getTime())) {
    return false
  }

  if (period === 'today') {
    return (
      getDateKeyInOrganizationTimezone(isoTimestamp, timezone) ===
      getDateKeyInOrganizationTimezone(referenceNow.toISOString(), timezone)
    )
  }

  const diffMs = referenceNow.getTime() - saleDate.getTime()
  const maxDays = period === 'last_7_days' ? 7 : 30
  const maxMs = maxDays * 24 * 60 * 60 * 1000
  return diffMs <= maxMs && diffMs >= -24 * 60 * 60 * 1000
}

export function sortSalesDeterministically(sales: SaleRecord[]): SaleRecord[] {
  return [...sales].sort((a, b) => {
    const timeA = Date.parse(a.createdAt)
    const timeB = Date.parse(b.createdAt)
    if (Number.isFinite(timeA) && Number.isFinite(timeB) && timeA !== timeB) {
      return timeB - timeA
    }
    if (a.folioNumber !== b.folioNumber) {
      return b.folioNumber - a.folioNumber
    }
    if (a.sequence !== b.sequence) {
      return b.sequence - a.sequence
    }
    return b.id.localeCompare(a.id)
  })
}

export function getDateKeyInOrganizationTimezone(
  isoTimestamp: string,
  timezone: TimezoneOption,
): string {
  const date = new Date(isoTimestamp)
  if (Number.isNaN(date.getTime())) {
    return isoTimestamp.slice(0, 10)
  }
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    return formatter.format(date)
  } catch {
    return date.toISOString().slice(0, 10)
  }
}

/**
 * Construye las métricas de Ventas del Día y el listado de Ventas Recientes
 * del Resumen (`/panel/resumen`) a partir de las ventas reales generadas por el
 * flujo de Punto de Venta, calculando el día según la zona horaria del negocio.
 * Distingue explícitamente entre ventas brutas, reembolsos y ventas netas del periodo.
 */
export function buildDashboardSalesSummaryFromRecords(
  sales: SaleRecord[],
  timezone: TimezoneOption,
  dateFormat: DateFormatOption,
  fallbackCurrency: CurrencyCode,
  lowStockCount: number,
  referenceNow: Date = new Date(),
): {
  metrics: DailySalesMetrics
  recentSales: RecentSaleItem[]
  displayCurrency: CurrencyCode
} {
  const sortedSales = sortSalesDeterministically(sales)
  const todayKey = getDateKeyInOrganizationTimezone(
    referenceNow.toISOString(),
    timezone,
  )

  const todaysSales = sortedSales.filter(
    (s) => getDateKeyInOrganizationTimezone(s.createdAt, timezone) === todayKey,
  )

  // Devoluciones procesadas en el día operativo actual (independientemente de cuándo se emitió la venta original)
  const todaysRefunds: SaleReturnRecord[] = []
  for (const sale of sortedSales) {
    for (const ret of sale.returns ?? []) {
      if (
        getDateKeyInOrganizationTimezone(ret.createdAt, timezone) === todayKey
      ) {
        todaysRefunds.push(ret)
      }
    }
  }

  const displayCurrency =
    todaysSales[0]?.currency ??
    todaysRefunds[0]?.refund.currency ??
    sortedSales[0]?.currency ??
    fallbackCurrency

  let grossSalesCents = 0
  for (const sale of todaysSales) {
    grossSalesCents += Math.round(sale.totalCents)
  }

  let refundsCents = 0
  for (const ret of todaysRefunds) {
    refundsCents += Math.round(ret.totalRefundCents)
  }

  const netSalesCents = grossSalesCents - refundsCents
  const salesCount = todaysSales.length
  const refundsCount = todaysRefunds.length
  const averageTicketCents =
    salesCount > 0 ? Math.round(grossSalesCents / salesCount) : 0

  const nowFormatted = formatDateTimeInOrganizationTimezone(
    referenceNow.toISOString(),
    timezone,
    dateFormat,
  )

  let lastUpdatedLabel = 'Sin ventas registradas hoy'
  if (salesCount > 0 && refundsCount > 0) {
    lastUpdatedLabel = `${salesCount} venta(s) · ${refundsCount} devolución(es) hoy`
  } else if (salesCount > 0) {
    lastUpdatedLabel = `${salesCount} venta(s) registrada(s) hoy`
  } else if (refundsCount > 0) {
    lastUpdatedLabel = `${refundsCount} devolución(es) procesada(s) hoy`
  }

  const metrics: DailySalesMetrics = {
    totalSalesAmount: centsToAmount(netSalesCents),
    totalSalesFormatted: formatCentsWithHistoricalCurrency(
      netSalesCents,
      displayCurrency,
    ),
    grossSalesAmount: centsToAmount(grossSalesCents),
    grossSalesFormatted: formatCentsWithHistoricalCurrency(
      grossSalesCents,
      displayCurrency,
    ),
    refundsAmount: centsToAmount(refundsCents),
    refundsFormatted: formatCentsWithHistoricalCurrency(
      refundsCents,
      displayCurrency,
    ),
    refundsCount,
    netSalesAmount: centsToAmount(netSalesCents),
    netSalesFormatted: formatCentsWithHistoricalCurrency(
      netSalesCents,
      displayCurrency,
    ),
    salesCount,
    averageTicketAmount: centsToAmount(averageTicketCents),
    averageTicketFormatted: formatCentsWithHistoricalCurrency(
      averageTicketCents,
      displayCurrency,
    ),
    referenceDateIso: todayKey,
    cutoffTime24h: nowFormatted.timeLabel,
    lastUpdatedLabel,
    lowStockCount,
  }

  const recentSales: RecentSaleItem[] = sortedSales.slice(0, 8).map((sale) => {
    const dt = formatDateTimeInOrganizationTimezone(
      sale.createdAt,
      timezone,
      dateFormat,
    )
    const payMeta = getPaymentMethodPresentation(sale.payment.method)
    const derived = deriveSaleComputedTotals(sale)
    const statusMeta = getSaleStatusPresentation(derived.status)

    const summaryParts = sale.lines.map(
      (line) =>
        `${line.productName} (${formatQuantityWithUnit(line.quantity, line.unit)})`,
    )

    return {
      id: sale.id,
      ticketNumber: sale.folio,
      saleDateIso: getDateKeyInOrganizationTimezone(sale.createdAt, timezone),
      time: dt.timeLabel,
      itemsSummary: summaryParts.join(', '),
      itemsCount: sale.lines.length,
      paymentMethod: payMeta.label,
      totalAmount: centsToAmount(sale.totalCents),
      totalFormatted: formatCentsWithHistoricalCurrency(
        sale.totalCents,
        sale.currency,
      ),
      cashierName: sale.operatorName,
      statusLabel: statusMeta.label,
      statusBadgeVariant: statusMeta.badgeVariant,
      netAmount: centsToAmount(derived.netTotalCents),
      netFormatted: formatCentsWithHistoricalCurrency(
        derived.netTotalCents,
        sale.currency,
      ),
    }
  })

  return {
    metrics,
    recentSales,
    displayCurrency,
  }
}

export {
  fromScaledQuantity,
  getUnitLabel,
  isDivisibleUnit,
  toScaledQuantity,
}
