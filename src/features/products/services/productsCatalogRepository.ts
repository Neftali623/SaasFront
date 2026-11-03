import type { StorageLike } from '../../../services/settings/organizationSettingsRepository'
import type {
  CategoryStatus,
  OrganizationCatalogData,
  Product,
  ProductCategory,
  ProductStatus,
  ProductUnit,
} from '../types'
import { cloneCatalogData, INITIAL_CATALOG_BY_ORG } from '../utils/mockCatalog'
import { PRODUCT_UNIT_OPTIONS } from '../utils/validation'

export const CATALOG_SCHEMA_VERSION = 1

export interface StoredCatalogEnvelope {
  schemaVersion: number
  organizationId: string
  updatedAt: string
  data: OrganizationCatalogData
}

export interface LoadCatalogOutcome {
  catalog: OrganizationCatalogData
  updatedAt: string | null
  source: 'local-storage' | 'initial-seed'
  warning?: string
}

export type SaveCatalogOutcome =
  | {
      ok: true
      updatedAt: string
    }
  | {
      ok: false
      error: string
    }

export interface ProductsCatalogRepository {
  load(organizationId: string): LoadCatalogOutcome
  save(
    organizationId: string,
    catalog: OrganizationCatalogData,
  ): SaveCatalogOutcome
}

export function getOrganizationCatalogStorageKey(
  organizationId: string,
): string {
  return `nedaxoli_demo_catalog_v${CATALOG_SCHEMA_VERSION}_${organizationId}`
}

export function generateStableId(prefix: 'prod' | 'cat'): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return `${prefix}-${crypto.randomUUID()}`
  }
  const randomSuffix = Math.random().toString(36).slice(2, 10)
  return `${prefix}-${Date.now().toString(36)}-${randomSuffix}`
}

function getBrowserLocalStorage(): StorageLike | null {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isValidUnit(value: unknown): value is ProductUnit {
  return (
    typeof value === 'string' &&
    PRODUCT_UNIT_OPTIONS.some((opt) => opt.value === value)
  )
}

function isValidStatus(value: unknown): value is ProductStatus & CategoryStatus {
  return value === 'active' || value === 'inactive'
}

function sanitizeStoredCatalog(
  rawData: unknown,
  organizationId: string,
): { catalog: OrganizationCatalogData; hadInvalidEntries: boolean } | null {
  if (!isObjectRecord(rawData)) {
    return null
  }

  if (
    !Array.isArray(rawData.categories) ||
    !Array.isArray(rawData.products)
  ) {
    return null
  }

  let hadInvalidEntries = false
  const categories: ProductCategory[] = []
  const seenCategoryIds = new Set<string>()

  for (const rawCat of rawData.categories) {
    if (
      !isObjectRecord(rawCat) ||
      typeof rawCat.id !== 'string' ||
      !rawCat.id.trim() ||
      typeof rawCat.name !== 'string' ||
      !rawCat.name.trim() ||
      !isValidStatus(rawCat.status)
    ) {
      hadInvalidEntries = true
      continue
    }

    if (seenCategoryIds.has(rawCat.id)) {
      hadInvalidEntries = true
      continue
    }
    seenCategoryIds.add(rawCat.id)

    categories.push({
      id: rawCat.id,
      organizationId,
      name: rawCat.name.trim(),
      status: rawCat.status,
      createdAt:
        typeof rawCat.createdAt === 'string'
          ? rawCat.createdAt
          : new Date().toISOString(),
      updatedAt:
        typeof rawCat.updatedAt === 'string'
          ? rawCat.updatedAt
          : new Date().toISOString(),
    })
  }

  const products: Product[] = []
  const seenProductIds = new Set<string>()

  for (const rawProd of rawData.products) {
    if (
      !isObjectRecord(rawProd) ||
      typeof rawProd.id !== 'string' ||
      !rawProd.id.trim() ||
      typeof rawProd.name !== 'string' ||
      !rawProd.name.trim() ||
      typeof rawProd.sku !== 'string' ||
      !rawProd.sku.trim() ||
      !isValidUnit(rawProd.unit) ||
      typeof rawProd.salePrice !== 'number' ||
      !Number.isFinite(rawProd.salePrice) ||
      rawProd.salePrice < 0 ||
      !isValidStatus(rawProd.status) ||
      !Array.isArray(rawProd.barcodes)
    ) {
      hadInvalidEntries = true
      continue
    }

    if (seenProductIds.has(rawProd.id)) {
      hadInvalidEntries = true
      continue
    }
    seenProductIds.add(rawProd.id)

    let cost: number | null = null
    if (rawProd.cost !== null && rawProd.cost !== undefined) {
      if (
        typeof rawProd.cost === 'number' &&
        Number.isFinite(rawProd.cost) &&
        rawProd.cost >= 0
      ) {
        cost = Math.round(rawProd.cost * 100) / 100
      } else {
        hadInvalidEntries = true
      }
    }

    const barcodes: string[] = []
    for (const rawBarcode of rawProd.barcodes) {
      if (typeof rawBarcode === 'string' && rawBarcode.trim().length > 0) {
        barcodes.push(rawBarcode.trim())
      } else {
        hadInvalidEntries = true
      }
    }

    const categoryId =
      typeof rawProd.categoryId === 'string' &&
      seenCategoryIds.has(rawProd.categoryId)
        ? rawProd.categoryId
        : null

    products.push({
      id: rawProd.id,
      organizationId,
      name: rawProd.name.trim(),
      description:
        typeof rawProd.description === 'string'
          ? rawProd.description.trim()
          : '',
      sku: rawProd.sku.trim().toUpperCase(),
      categoryId,
      unit: rawProd.unit,
      salePrice: Math.round(rawProd.salePrice * 100) / 100,
      cost,
      barcodes,
      status: rawProd.status,
      createdAt:
        typeof rawProd.createdAt === 'string'
          ? rawProd.createdAt
          : new Date().toISOString(),
      updatedAt:
        typeof rawProd.updatedAt === 'string'
          ? rawProd.updatedAt
          : new Date().toISOString(),
    })
  }

  const baseCurrency =
    rawData.baseCurrency === 'MXN' ||
    rawData.baseCurrency === 'USD' ||
    rawData.baseCurrency === 'COP' ||
    rawData.baseCurrency === 'EUR'
      ? rawData.baseCurrency
      : 'MXN'

  return {
    catalog: { baseCurrency, categories, products },
    hadInvalidEntries,
  }
}

export function createLocalProductsCatalogRepository(
  customStorage?: StorageLike | null,
): ProductsCatalogRepository {
  const resolveStorage = (): StorageLike | null => {
    if (customStorage !== undefined) {
      return customStorage
    }
    return getBrowserLocalStorage()
  }

  const getSeedForOrg = (organizationId: string): OrganizationCatalogData => {
    const seed = INITIAL_CATALOG_BY_ORG[organizationId]
    if (!seed) {
      return { baseCurrency: 'MXN', categories: [], products: [] }
    }
    return cloneCatalogData(seed)
  }

  return {
    load(organizationId: string): LoadCatalogOutcome {
      const storage = resolveStorage()
      const seedCatalog = getSeedForOrg(organizationId)

      if (!storage) {
        return {
          catalog: seedCatalog,
          updatedAt: null,
          source: 'initial-seed',
          warning:
            'El almacenamiento local del navegador no está disponible. El catálogo funcionará únicamente en memoria durante esta sesión.',
        }
      }

      const key = getOrganizationCatalogStorageKey(organizationId)
      let raw: string | null

      try {
        raw = storage.getItem(key)
      } catch {
        return {
          catalog: seedCatalog,
          updatedAt: null,
          source: 'initial-seed',
          warning:
            'No fue posible leer el almacenamiento local. Se cargó el catálogo de demostración inicial.',
        }
      }

      // Inicializar los datos de ejemplo solo cuando no exista información guardada
      if (raw === null) {
        const now = new Date().toISOString()
        const initialEnvelope: StoredCatalogEnvelope = {
          schemaVersion: CATALOG_SCHEMA_VERSION,
          organizationId,
          updatedAt: now,
          data: seedCatalog,
        }
        try {
          storage.setItem(key, JSON.stringify(initialEnvelope))
        } catch {
          // Si no se puede escribir la semilla inicial, continuar en memoria
        }
        return {
          catalog: seedCatalog,
          updatedAt: null,
          source: 'initial-seed',
        }
      }

      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch {
        return {
          catalog: seedCatalog,
          updatedAt: null,
          source: 'initial-seed',
          warning:
            'Se detectó un formato JSON inválido en el catálogo local; se restauraron los datos iniciales seguros de la organización.',
        }
      }

      if (
        !isObjectRecord(parsed) ||
        parsed.schemaVersion !== CATALOG_SCHEMA_VERSION ||
        parsed.organizationId !== organizationId
      ) {
        return {
          catalog: seedCatalog,
          updatedAt: null,
          source: 'initial-seed',
          warning:
            'El esquema guardado del catálogo no coincide con la versión actual; se restauraron los datos iniciales.',
        }
      }

      const sanitized = sanitizeStoredCatalog(parsed.data, organizationId)
      if (!sanitized) {
        return {
          catalog: seedCatalog,
          updatedAt: null,
          source: 'initial-seed',
          warning:
            'La estructura guardada del catálogo estaba incompleta; se restauraron los datos iniciales.',
        }
      }

      return {
        catalog: sanitized.catalog,
        updatedAt:
          typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
        source: 'local-storage',
        warning: sanitized.hadInvalidEntries
          ? 'Se omitieron o repararon algunos registros locales con formato inválido.'
          : undefined,
      }
    },

    save(
      organizationId: string,
      catalog: OrganizationCatalogData,
    ): SaveCatalogOutcome {
      if (!organizationId.trim()) {
        return {
          ok: false,
          error: 'Identificador de organización inválido para guardar el catálogo.',
        }
      }

      const storage = resolveStorage()
      if (!storage) {
        return {
          ok: false,
          error:
            'El almacenamiento local del navegador no está disponible o está bloqueado. No se pudieron persistir los cambios.',
        }
      }

      const updatedAt = new Date().toISOString()
      const envelope: StoredCatalogEnvelope = {
        schemaVersion: CATALOG_SCHEMA_VERSION,
        organizationId,
        updatedAt,
        data: cloneCatalogData(catalog),
      }

      const key = getOrganizationCatalogStorageKey(organizationId)
      const serialized = JSON.stringify(envelope)

      try {
        storage.setItem(key, serialized)
        const verifyRead = storage.getItem(key)
        if (verifyRead !== serialized) {
          return {
            ok: false,
            error:
              'No se pudo confirmar la escritura del catálogo en el almacenamiento local.',
          }
        }
        return {
          ok: true,
          updatedAt,
        }
      } catch {
        return {
          ok: false,
          error:
            'Error al guardar en localStorage (espacio insuficiente o almacenamiento bloqueado). Tus datos en pantalla se conservaron.',
        }
      }
    },
  }
}

export const defaultProductsCatalogRepository =
  createLocalProductsCatalogRepository()

