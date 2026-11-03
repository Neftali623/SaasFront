import type { CurrencyCode } from '../../../types'
import type { InventoryStockStatus } from '../../inventory/types'
import type { Product, ProductUnit } from '../../products/types'

/**
 * Métodos de cobro soportados en la primera fase del Punto de Venta:
 * - `cash`: Efectivo físico (incrementa el saldo esperado de la sesión de caja por el total de la venta).
 * - `card`: Tarjeta con registro manual (verificación externa del operador; no procesa terminal bancaria ni incrementa efectivo).
 * - `transfer`: Transferencia con registro manual (verificación externa del operador; no incrementa efectivo).
 */
export type PosPaymentMethod = 'cash' | 'card' | 'transfer'

/**
 * Partida activa dentro del carrito en memoria del Punto de Venta.
 * - `unitPriceCents`: Precio unitario en centavos enteros capturado al agregar/sincronizar la partida.
 * - `lineSubtotalCents`: Importe de la partida en centavos enteros ya redondeado explícitamente.
 * - `historicalUnitCostCents`: Costo unitario en centavos enteros (`null` si es desconocido), conservado internamente para el registro histórico sin exponerlo innecesariamente al cajero.
 */
export interface PosCartItem {
  productId: string
  productName: string
  sku: string
  barcodeUsed: string | null
  unit: ProductUnit
  unitPriceCents: number
  historicalUnitCostCents: number | null
  quantity: number
  lineSubtotalCents: number
}

/**
 * Producto enriquecido con su disponibilidad de inventario y cantidad en el carrito
 * para la búsqueda y el escaneo en Punto de Venta.
 */
export interface PosCatalogProductItem {
  product: Product
  categoryName: string | null
  unitPriceCents: number
  historicalUnitCostCents: number | null
  isInitialized: boolean
  registeredQuantity: number | null
  inCartQuantity: number
  remainingAvailableQuantity: number | null
  stockStatus: InventoryStockStatus
  balanceVersion: number | null
  canSell: boolean
  blockReason: string | null
}

/**
 * Partida histórica inmutable guardada dentro de una venta confirmada.
 * Conserva nombre, SKU, unidad, precio aplicado e importe del momento de la venta,
 * de modo que cambios posteriores al catálogo no alteren ventas históricas.
 */
export interface SaleLineItem {
  id: string
  productId: string
  productName: string
  sku: string
  barcodeUsed: string | null
  unit: ProductUnit
  quantity: number
  unitPriceCents: number
  lineSubtotalCents: number
  historicalUnitCostCents: number | null
  inventoryMovementId: string
}

/**
 * Información histórica del pago asociado a una venta confirmada.
 * - Para `cash`: `amountCents` es el total de la venta que ingresa a caja,
 *   `cashReceivedCents` es el efectivo entregado por el cliente y
 *   `cashChangeCents = cashReceivedCents - amountCents` es el cambio devuelto.
 * - Para `card` y `transfer`: `externalVerifiedByOperator` deja constancia de que
 *   el cajero verificó el pago externamente y `cashMovementId` es `null`.
 */
export interface SalePaymentRecord {
  id: string
  method: PosPaymentMethod
  currency: CurrencyCode
  amountCents: number
  cashReceivedCents: number | null
  cashChangeCents: number | null
  externalReference: string | null
  externalVerifiedByOperator: boolean
  cashMovementId: string | null
}

/**
 * Estados derivados posibles para una venta:
 * - `completed`: Venta cobrada sin reembolsos registrados.
 * - `partially_refunded`: Al menos una partida o fracción fue devuelta/reembolsada, pero restan cantidades pendientes.
 * - `fully_refunded`: El 100% de los productos cobrados fueron devueltos y su total reembolsado.
 * - `cancelled`: La venta fue cancelada en su totalidad en una sola operación sin devoluciones previas,
 *   con la sesión original de caja abierta y reposición completa a inventario vendible.
 */
export type SaleStatus =
  | 'completed'
  | 'partially_refunded'
  | 'fully_refunded'
  | 'cancelled'

export type SaleReturnType = 'cancelation' | 'return'

export type SaleReturnDestination = 'sellable' | 'unsellable'

export interface SaleReturnLineItem {
  saleLineId: string
  productId: string
  productName: string
  sku: string
  barcodeUsed: string | null
  unit: ProductUnit
  returnedQuantity: number
  unitPriceCents: number
  refundCents: number
  destination: SaleReturnDestination
  inventoryMovementId: string | null
}

export interface SaleRefundRecord {
  id: string
  saleId: string
  returnId: string
  method: PosPaymentMethod
  currency: CurrencyCode
  amountCents: number
  cashSessionId: string | null
  cashMovementId: string | null
  externalReference: string | null
  externalVerifiedByOperator: boolean
  operatorName: string
  createdAt: string
}

export interface SaleAuditEvent {
  id: string
  saleId: string
  eventType: 'sale_created' | 'sale_cancelled' | 'sale_returned'
  actionSummary: string
  operatorName: string
  createdAt: string
  relatedFolio: string | null
  notes: string | null
}

export interface SaleReturnRecord {
  id: string
  returnFolio: string
  returnFolioNumber: number
  organizationId: string
  branchId: string
  branchName: string
  saleId: string
  saleFolio: string
  type: SaleReturnType
  reason: string
  operatorName: string
  createdAt: string
  lines: SaleReturnLineItem[]
  totalRefundCents: number
  refund: SaleRefundRecord
  operationId: string
  sequence: number
}

/**
 * Registro completo e inmutable de una venta generada en el Punto de Venta.
 */
export interface SaleRecord {
  id: string
  folio: string
  folioNumber: number
  organizationId: string
  organizationName: string
  branchId: string
  branchName: string
  registerId: string
  registerName: string
  registerCode: string
  sessionId: string
  operatorName: string
  createdAt: string
  currency: CurrencyCode
  subtotalCents: number
  totalCents: number
  itemsCount: number
  lines: SaleLineItem[]
  payment: SalePaymentRecord
  inventoryMovementIds: string[]
  cashMovementId: string | null
  sequence: number
  operationId: string
  status: SaleStatus
  refundedTotalCents: number
  netTotalCents: number
  returnsCount: number
  returns: SaleReturnRecord[]
  auditEvents: SaleAuditEvent[]
}

export interface OrganizationSalesData {
  organizationId: string
  branchId: string
  branchName: string
  storageRevision: number
  lastFolioNumber: number
  lastReturnFolioNumber: number
  lastSequence: number
  sales: SaleRecord[]
}

export interface RefundSaleItemPayload {
  saleLineId: string
  returnedQuantity: number
  destination: SaleReturnDestination
}

export interface CancelSaleParams {
  organizationId: string
  branchId?: string
  saleId: string
  reason: string
  operatorName: string
  operationId: string
  externalReference?: string | null
  externalVerifiedByOperator?: boolean
  simulateStorageError?: boolean
}

export type CancelSaleOutcome =
  | {
      ok: true
      idempotentReplay: boolean
      sale: SaleRecord
      returnRecord: SaleReturnRecord
      updatedAt: string
    }
  | {
      ok: false
      errorCode:
        | 'SALE_NOT_FOUND'
        | 'INVALID_CONTEXT'
        | 'SALE_ALREADY_CANCELLED'
        | 'SALE_HAS_PREVIOUS_RETURNS'
        | 'ORIGINAL_SESSION_CLOSED'
        | 'NO_OPEN_CASH_SESSION'
        | 'INCOMPATIBLE_CURRENCY'
        | 'INSUFFICIENT_CASH_BALANCE'
        | 'EXTERNAL_VERIFICATION_REQUIRED'
        | 'STORAGE_ERROR'
      error: string
    }

export interface RefundSaleParams {
  organizationId: string
  branchId?: string
  saleId: string
  items: RefundSaleItemPayload[]
  reason: string
  operatorName: string
  operationId: string
  externalReference?: string | null
  externalVerifiedByOperator?: boolean
  simulateStorageError?: boolean
}

export type RefundSaleOutcome =
  | {
      ok: true
      idempotentReplay: boolean
      sale: SaleRecord
      returnRecord: SaleReturnRecord
      updatedAt: string
    }
  | {
      ok: false
      errorCode:
        | 'SALE_NOT_FOUND'
        | 'INVALID_CONTEXT'
        | 'SALE_ALREADY_CANCELLED'
        | 'SALE_ALREADY_FULLY_REFUNDED'
        | 'EMPTY_REFUND_ITEMS'
        | 'INVALID_REFUND_ITEMS'
        | 'QUANTITY_EXCEEDS_PENDING'
        | 'INVALID_REFUND_QUANTITY'
        | 'INVALID_REFUND_AMOUNT'
        | 'NO_OPEN_CASH_SESSION'
        | 'INCOMPATIBLE_CURRENCY'
        | 'INSUFFICIENT_CASH_BALANCE'
        | 'EXTERNAL_VERIFICATION_REQUIRED'
        | 'STORAGE_ERROR'
      error: string
    }

export type PosDiscrepancyKind =
  | 'price_changed'
  | 'insufficient_stock'
  | 'uninitialized_stock'
  | 'product_inactive'
  | 'product_not_found'
  | 'unit_changed'

export interface PosCheckoutDiscrepancy {
  productId: string
  productName: string
  sku: string
  kind: PosDiscrepancyKind
  message: string
  previousUnitPriceCents?: number
  currentUnitPriceCents?: number
  requestedQuantity?: number
  availableQuantity?: number | null
}

export type PosCheckoutErrorCode =
  | 'INVALID_CONTEXT'
  | 'ORG_MISMATCH'
  | 'NO_OPEN_CASH_SESSION'
  | 'INCOMPATIBLE_CURRENCY'
  | 'EMPTY_CART'
  | 'INVALID_CART_QUANTITY'
  | 'INVALID_PAYMENT'
  | 'INSUFFICIENT_CASH_RECEIVED'
  | 'EXTERNAL_VERIFICATION_REQUIRED'
  | 'CATALOG_OR_STOCK_DISCREPANCY'
  | 'STORAGE_ERROR'

export type BarcodeScanResult =
  | {
      ok: true
      code: string
      productName: string
      sku: string
      addedQuantity: number
      newCartQuantity: number
      unit: ProductUnit
    }
  | {
      ok: false
      code: string
      reasonKind:
        | 'empty'
        | 'not_found'
        | 'inactive'
        | 'uninitialized'
        | 'insufficient_stock'
      message: string
    }

