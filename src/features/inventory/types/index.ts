import type { ProductStatus, ProductUnit } from '../../products/types'

export type InventoryMovementType =
  | 'initial'
  | 'manual_in'
  | 'manual_out'
  | 'count_adjustment'
  | 'sale_out'
  | 'sale_return_in'

/**
 * Estados de existencia de un producto en una sucursal.
 * Definidos de forma mutuamente excluyente para evitar etiquetas contradictorias:
 * - `uninitialized`: El artículo existe en el catálogo pero aún no tiene registro de existencia inicial.
 * - `out_of_stock`: El artículo fue inicializado y su existencia confirmada actual es exactamente 0.
 * - `low_stock`: El artículo tiene existencia positiva (> 0), cuenta con mínimo configurado y `quantity <= minStock`.
 * - `available`: El artículo tiene existencia positiva (> 0) y (`minStock === null` o `quantity > minStock`).
 */
export type InventoryStockStatus =
  | 'uninitialized'
  | 'out_of_stock'
  | 'low_stock'
  | 'available'

export type InventoryStatusFilterValue =
  | 'all'
  | InventoryStockStatus
  | 'no_min'

export interface BranchInfo {
  id: string
  organizationId: string
  name: string
}

/**
 * Balance de existencias por producto, organización y sucursal.
 * - `minStock`: `null` indica "Sin mínimo configurado"; `0` indica explícitamente "Mínimo configurado en cero".
 * - `version`: Entero incremental para detectar actualizaciones concurrentes o intermedias mientras un formulario está abierto.
 */
export interface InventoryBalance {
  organizationId: string
  branchId: string
  productId: string
  quantity: number
  minStock: number | null
  updatedAt: string
  version: number
}

/**
 * Registro inmutable de movimiento de inventario (Kardex).
 * - `delta`: Variación con signo (+ en entradas, - en salidas, +/- en conteo físico, cantidad inicial en inicialización).
 * - `previousQuantity`: Existencia previa al movimiento (`null` cuando el producto no estaba inicializado).
 * - `newQuantity`: Existencia resultante posterior al movimiento.
 * - `sequence`: Secuencia entera creciente por sucursal para garantizar orden estable aún con la misma marca de tiempo.
 * - `operationId`: Identificador único de operación para garantizar idempotencia y evitar registros duplicados.
 */
export interface InventoryMovement {
  id: string
  organizationId: string
  branchId: string
  productId: string
  type: InventoryMovementType
  delta: number
  previousQuantity: number | null
  newQuantity: number
  reason: string
  reference: string | null
  operatorName: string
  createdAt: string
  sequence: number
  operationId: string
}

export interface OrganizationInventoryData {
  organizationId: string
  branchId: string
  branchName: string
  storageRevision: number
  lastSequence: number
  balances: InventoryBalance[]
  movements: InventoryMovement[]
}

export interface EnrichedInventoryItem {
  productId: string
  organizationId: string
  branchId: string
  productName: string
  sku: string
  description: string
  categoryId: string | null
  categoryName: string | null
  categoryIsInactive: boolean
  unit: ProductUnit
  barcodes: string[]
  productStatus: ProductStatus
  isInitialized: boolean
  quantity: number | null
  minStock: number | null
  stockStatus: InventoryStockStatus
  needsReplenishmentAlert: boolean
  balanceVersion: number | null
  updatedAt: string | null
  movementsCount: number
}

export interface InventoryListFilters {
  searchQuery: string
  categoryFilter: string // 'all' | 'uncategorized' | categoryId
  productStatusFilter: 'all' | ProductStatus
  stockStatusFilter: InventoryStatusFilterValue
}

export type HistoryPeriodFilter = 'all' | 'today' | 'last_7_days' | 'last_30_days'

export interface MovementHistoryFilters {
  productId: string // 'all' | productId
  movementType: 'all' | InventoryMovementType
  period: HistoryPeriodFilter
}

