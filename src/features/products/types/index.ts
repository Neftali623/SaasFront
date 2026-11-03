import type { CurrencyCode } from '../../../types'

export type ProductStatus = 'active' | 'inactive'

export type CategoryStatus = 'active' | 'inactive'

export type ProductUnit =
  | 'pieza'
  | 'paquete'
  | 'caja'
  | 'kg'
  | 'litro'
  | 'servicio'

export interface ProductCategory {
  id: string
  organizationId: string
  name: string
  status: CategoryStatus
  createdAt: string
  updatedAt: string
}

/**
 * Modelo de producto por organización.
 * - `barcodes`: Arreglo de cadenas de texto que conserva ceros iniciales.
 * - `salePrice`: Número no negativo con precisión monetaria de hasta 2 decimales.
 * - `cost`: `null` representa costo desconocido/no capturado; `0` representa costo cero (0.00).
 * - No incluye existencias editables (corresponde al módulo de Inventario).
 */
export interface Product {
  id: string
  organizationId: string
  name: string
  description: string
  sku: string
  categoryId: string | null
  unit: ProductUnit
  salePrice: number
  cost: number | null
  barcodes: string[]
  status: ProductStatus
  createdAt: string
  updatedAt: string
}

export interface OrganizationCatalogData {
  baseCurrency?: CurrencyCode
  categories: ProductCategory[]
  products: Product[]
}

export type StatusFilterValue = 'all' | 'active' | 'inactive'

export interface ProductCatalogFilters {
  searchQuery: string
  categoryFilter: string // 'all' | 'uncategorized' | categoryId
  statusFilter: StatusFilterValue
}

export interface ProductFormDraft {
  name: string
  description: string
  sku: string
  categoryId: string // '' para Sin categoría, o ID de categoría
  unit: ProductUnit
  salePriceInput: string
  costInput: string // '' para costo desconocido (null), '0' para costo cero (0)
  barcodes: string[]
  status: ProductStatus
}

export interface ProductFormErrors {
  name?: string
  description?: string
  sku?: string
  categoryId?: string
  unit?: string
  salePriceInput?: string
  costInput?: string
  barcodes?: string
}

