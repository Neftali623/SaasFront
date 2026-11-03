import type { StorageLike } from '../../../services/settings/organizationSettingsRepository'
import type { Product } from '../../products/types'
import { getUnitLabel } from '../../products/utils/validation'
import type {
  InventoryBalance,
  InventoryMovement,
  InventoryMovementType,
  OrganizationInventoryData,
} from '../types'
import {
  cloneInventoryData,
  getBranchForOrganization,
  INITIAL_INVENTORY_BY_ORG,
} from '../utils/mockInventory'
import {
  addControlledQuantities,
  calculateCountAdjustmentDelta,
  formatQuantityWithUnit,
  isQuantityCompatibleWithUnit,
  normalizeControlledQuantity,
} from '../utils/quantityUtils'

export const INVENTORY_SCHEMA_VERSION = 1

export interface StoredInventoryEnvelope {
  schemaVersion: number
  organizationId: string
  branchId: string
  branchName: string
  updatedAt: string
  data: OrganizationInventoryData
}

export interface LoadInventoryOutcome {
  inventory: OrganizationInventoryData
  updatedAt: string | null
  source: 'local-storage' | 'initial-seed'
  warning?: string
}

export type InventoryErrorCode =
  | 'INVALID_CONTEXT'
  | 'PRODUCT_ORG_MISMATCH'
  | 'ALREADY_INITIALIZED'
  | 'NOT_INITIALIZED'
  | 'INACTIVE_PRODUCT_ENTRY_FORBIDDEN'
  | 'INVALID_QUANTITY'
  | 'INSUFFICIENT_STOCK'
  | 'REASON_REQUIRED'
  | 'NO_DIFFERENCE'
  | 'DUPLICATE_OPERATION'
  | 'CONCURRENCY_CONFLICT'
  | 'STORAGE_ERROR'

export type InventoryOperationOutcome =
  | {
      ok: true
      inventory: OrganizationInventoryData
      balance: InventoryBalance
      movement: InventoryMovement | null
      updatedAt: string
    }
  | {
      ok: false
      errorCode: InventoryErrorCode
      error: string
      latestInventory?: OrganizationInventoryData
      latestBalance?: InventoryBalance
    }

export interface InitializeStockParams {
  organizationId: string
  branchId?: string
  product: Product
  initialQuantity: number
  minStock?: number | null
  reason: string
  reference?: string | null
  operatorName: string
  operationId: string
  simulateStorageError?: boolean
}

export interface ManualMovementParams {
  organizationId: string
  branchId?: string
  product: Product
  type: 'manual_in' | 'manual_out'
  quantity: number
  reason: string
  reference?: string | null
  operatorName: string
  operationId: string
  expectedBalanceVersion?: number
  simulateStorageError?: boolean
}

export interface PhysicalCountParams {
  organizationId: string
  branchId?: string
  product: Product
  countedQuantity: number
  reason: string
  reference?: string | null
  operatorName: string
  operationId: string
  expectedBalanceVersion: number
  simulateStorageError?: boolean
}

export interface UpdateMinStockParams {
  organizationId: string
  branchId?: string
  product: Product
  minStock: number | null
  simulateStorageError?: boolean
}

export interface InventoryRepository {
  load(organizationId: string, branchId?: string): LoadInventoryOutcome
  save(
    organizationId: string,
    inventory: OrganizationInventoryData,
  ): { ok: true; updatedAt: string } | { ok: false; error: string }
  hasProductMovements(
    organizationId: string,
    productId: string,
    branchId?: string,
  ): boolean
  initializeStock(params: InitializeStockParams): InventoryOperationOutcome
  registerManualMovement(params: ManualMovementParams): InventoryOperationOutcome
  registerPhysicalCount(params: PhysicalCountParams): InventoryOperationOutcome
  updateMinStock(params: UpdateMinStockParams): InventoryOperationOutcome
}

export function getOrganizationInventoryStorageKey(
  organizationId: string,
  branchId: string,
): string {
  return `nedaxoli_demo_inventory_v${INVENTORY_SCHEMA_VERSION}_${organizationId}_${branchId}`
}

export function generateInventoryId(prefix: 'mov' | 'op'): string {
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

function isValidMovementType(value: unknown): value is InventoryMovementType {
  return (
    value === 'initial' ||
    value === 'manual_in' ||
    value === 'manual_out' ||
    value === 'count_adjustment' ||
    value === 'sale_out'
  )
}

function sanitizeStoredInventory(
  rawData: unknown,
  organizationId: string,
  branchId: string,
  fallbackBranchName: string,
): { inventory: OrganizationInventoryData; hadInvalidEntries: boolean } | null {
  if (!isObjectRecord(rawData)) {
    return null
  }

  if (
    !Array.isArray(rawData.balances) ||
    !Array.isArray(rawData.movements)
  ) {
    return null
  }

  let hadInvalidEntries = false
  const balances: InventoryBalance[] = []
  const seenBalanceProducts = new Set<string>()

  for (const rawBal of rawData.balances) {
    if (
      !isObjectRecord(rawBal) ||
      typeof rawBal.productId !== 'string' ||
      !rawBal.productId.trim() ||
      typeof rawBal.quantity !== 'number' ||
      !Number.isFinite(rawBal.quantity) ||
      rawBal.quantity < 0
    ) {
      hadInvalidEntries = true
      continue
    }

    if (
      typeof rawBal.organizationId === 'string' &&
      rawBal.organizationId !== organizationId
    ) {
      hadInvalidEntries = true
      continue
    }

    if (seenBalanceProducts.has(rawBal.productId)) {
      hadInvalidEntries = true
      continue
    }
    seenBalanceProducts.add(rawBal.productId)

    let minStock: number | null = null
    if (rawBal.minStock !== null && rawBal.minStock !== undefined) {
      if (
        typeof rawBal.minStock === 'number' &&
        Number.isFinite(rawBal.minStock) &&
        rawBal.minStock >= 0
      ) {
        minStock = normalizeControlledQuantity(rawBal.minStock)
      } else {
        hadInvalidEntries = true
      }
    }

    const version =
      typeof rawBal.version === 'number' &&
      Number.isInteger(rawBal.version) &&
      rawBal.version >= 1
        ? rawBal.version
        : 1

    balances.push({
      organizationId,
      branchId,
      productId: rawBal.productId.trim(),
      quantity: normalizeControlledQuantity(rawBal.quantity),
      minStock,
      updatedAt:
        typeof rawBal.updatedAt === 'string'
          ? rawBal.updatedAt
          : new Date().toISOString(),
      version,
    })
  }

  const movements: InventoryMovement[] = []
  const seenMovementIds = new Set<string>()
  const seenOperationIds = new Set<string>()
  let maxSequence = 0

  for (const rawMov of rawData.movements) {
    if (
      !isObjectRecord(rawMov) ||
      typeof rawMov.id !== 'string' ||
      !rawMov.id.trim() ||
      typeof rawMov.productId !== 'string' ||
      !rawMov.productId.trim() ||
      !isValidMovementType(rawMov.type) ||
      typeof rawMov.delta !== 'number' ||
      !Number.isFinite(rawMov.delta) ||
      typeof rawMov.newQuantity !== 'number' ||
      !Number.isFinite(rawMov.newQuantity) ||
      rawMov.newQuantity < 0 ||
      typeof rawMov.reason !== 'string' ||
      !rawMov.reason.trim()
    ) {
      hadInvalidEntries = true
      continue
    }

    if (
      typeof rawMov.organizationId === 'string' &&
      rawMov.organizationId !== organizationId
    ) {
      hadInvalidEntries = true
      continue
    }

    if (seenMovementIds.has(rawMov.id)) {
      hadInvalidEntries = true
      continue
    }
    seenMovementIds.add(rawMov.id)

    const operationId =
      typeof rawMov.operationId === 'string' && rawMov.operationId.trim()
        ? rawMov.operationId.trim()
        : `op-${rawMov.id}`

    if (seenOperationIds.has(operationId)) {
      hadInvalidEntries = true
      continue
    }
    seenOperationIds.add(operationId)

    let previousQuantity: number | null = null
    if (
      rawMov.previousQuantity !== null &&
      rawMov.previousQuantity !== undefined
    ) {
      if (
        typeof rawMov.previousQuantity === 'number' &&
        Number.isFinite(rawMov.previousQuantity) &&
        rawMov.previousQuantity >= 0
      ) {
        previousQuantity = normalizeControlledQuantity(rawMov.previousQuantity)
      } else {
        hadInvalidEntries = true
      }
    }

    const sequence =
      typeof rawMov.sequence === 'number' &&
      Number.isInteger(rawMov.sequence) &&
      rawMov.sequence >= 1
        ? rawMov.sequence
        : maxSequence + 1

    if (sequence > maxSequence) {
      maxSequence = sequence
    }

    movements.push({
      id: rawMov.id.trim(),
      organizationId,
      branchId,
      productId: rawMov.productId.trim(),
      type: rawMov.type,
      delta: normalizeControlledQuantity(rawMov.delta),
      previousQuantity,
      newQuantity: normalizeControlledQuantity(rawMov.newQuantity),
      reason: rawMov.reason.trim(),
      reference:
        typeof rawMov.reference === 'string' && rawMov.reference.trim()
          ? rawMov.reference.trim()
          : null,
      operatorName:
        typeof rawMov.operatorName === 'string' && rawMov.operatorName.trim()
          ? rawMov.operatorName.trim()
          : 'Operador de Demostración',
      createdAt:
        typeof rawMov.createdAt === 'string'
          ? rawMov.createdAt
          : new Date().toISOString(),
      sequence,
      operationId,
    })
  }

  const storageRevision =
    typeof rawData.storageRevision === 'number' &&
    Number.isInteger(rawData.storageRevision) &&
    rawData.storageRevision >= 1
      ? rawData.storageRevision
      : 1

  const lastSequence =
    typeof rawData.lastSequence === 'number' &&
    Number.isInteger(rawData.lastSequence) &&
    rawData.lastSequence >= maxSequence
      ? rawData.lastSequence
      : maxSequence

  const branchName =
    typeof rawData.branchName === 'string' && rawData.branchName.trim()
      ? rawData.branchName.trim()
      : fallbackBranchName

  return {
    inventory: {
      organizationId,
      branchId,
      branchName,
      storageRevision,
      lastSequence,
      balances,
      movements,
    },
    hadInvalidEntries,
  }
}

export function createLocalInventoryRepository(
  customStorage?: StorageLike | null,
): InventoryRepository {
  const resolveStorage = (): StorageLike | null => {
    if (customStorage !== undefined) {
      return customStorage
    }
    return getBrowserLocalStorage()
  }

  const getSeedForOrg = (
    organizationId: string,
    branchId?: string,
  ): OrganizationInventoryData => {
    const defaultBranch = getBranchForOrganization(organizationId)
    const targetBranchId = branchId ?? defaultBranch.id
    const seed = INITIAL_INVENTORY_BY_ORG[organizationId]

    if (!seed || seed.branchId !== targetBranchId) {
      return {
        organizationId,
        branchId: targetBranchId,
        branchName: defaultBranch.name,
        storageRevision: 1,
        lastSequence: 0,
        balances: [],
        movements: [],
      }
    }

    return cloneInventoryData(seed)
  }

  const loadInternal = (
    organizationId: string,
    branchId?: string,
  ): LoadInventoryOutcome => {
    const defaultBranch = getBranchForOrganization(organizationId)
    const targetBranchId = branchId ?? defaultBranch.id
    const storage = resolveStorage()
    const seedInventory = getSeedForOrg(organizationId, targetBranchId)

    if (!storage) {
      return {
        inventory: seedInventory,
        updatedAt: null,
        source: 'initial-seed',
        warning:
          'El almacenamiento local del navegador no está disponible. El inventario funcionará únicamente en memoria durante esta sesión.',
      }
    }

    const key = getOrganizationInventoryStorageKey(
      organizationId,
      targetBranchId,
    )
    const txKey = `nedaxoli_demo_branch_tx_v1_${organizationId}_${targetBranchId}`
    let raw: string | null
    let rawTx: string | null

    try {
      raw = storage.getItem(key)
      rawTx = storage.getItem(txKey)
    } catch {
      return {
        inventory: seedInventory,
        updatedAt: null,
        source: 'initial-seed',
        warning:
          'No fue posible leer el almacenamiento local. Se cargó el inventario de demostración inicial.',
      }
    }

    let txInventoryCandidate: {
      inventory: OrganizationInventoryData
      updatedAt: string | null
      warning?: string
    } | null = null

    if (rawTx !== null) {
      try {
        const parsedTx: unknown = JSON.parse(rawTx)
        if (
          isObjectRecord(parsedTx) &&
          parsedTx.schemaVersion === 1 &&
          parsedTx.organizationId === organizationId &&
          parsedTx.branchId === targetBranchId &&
          isObjectRecord(parsedTx.data)
        ) {
          const sanitizedTxInv = sanitizeStoredInventory(
            parsedTx.data.inventory,
            organizationId,
            targetBranchId,
            defaultBranch.name,
          )
          if (sanitizedTxInv) {
            txInventoryCandidate = {
              inventory: sanitizedTxInv.inventory,
              updatedAt:
                typeof parsedTx.updatedAt === 'string'
                  ? parsedTx.updatedAt
                  : null,
              warning: sanitizedTxInv.hadInvalidEntries
                ? 'Se omitieron algunos registros locales de inventario con formato inválido.'
                : undefined,
            }
          }
        }
      } catch {
        // Ignorar instantánea transaccional inválida y usar respaldo individual
      }
    }

    // Poblar semillas solo una vez cuando aún no existe registro para la organización/sucursal
    if (raw === null) {
      if (txInventoryCandidate) {
        return {
          inventory: txInventoryCandidate.inventory,
          updatedAt: txInventoryCandidate.updatedAt,
          source: 'local-storage',
          warning: txInventoryCandidate.warning,
        }
      }
      const now = new Date().toISOString()
      const initialEnvelope: StoredInventoryEnvelope = {
        schemaVersion: INVENTORY_SCHEMA_VERSION,
        organizationId,
        branchId: targetBranchId,
        branchName: seedInventory.branchName,
        updatedAt: now,
        data: seedInventory,
      }
      try {
        storage.setItem(key, JSON.stringify(initialEnvelope))
      } catch {
        // Si no se puede escribir la semilla, continuar con la copia en memoria
      }
      return {
        inventory: seedInventory,
        updatedAt: null,
        source: 'initial-seed',
      }
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      // No sobrescribir silenciosamente datos corruptos al cargar
      return {
        inventory: seedInventory,
        updatedAt: null,
        source: 'initial-seed',
        warning:
          'Se detectó un formato JSON corrupto en el inventario local. Se cargó una vista segura en memoria sin sobrescribir el almacenamiento hasta que confirmes una nueva operación.',
      }
    }

    if (
      !isObjectRecord(parsed) ||
      parsed.schemaVersion !== INVENTORY_SCHEMA_VERSION ||
      parsed.organizationId !== organizationId ||
      parsed.branchId !== targetBranchId
    ) {
      return {
        inventory: seedInventory,
        updatedAt: null,
        source: 'initial-seed',
        warning:
          'El esquema o contexto del inventario guardado no coincide con la versión actual; se cargaron los datos iniciales seguros.',
      }
    }

    const sanitized = sanitizeStoredInventory(
      parsed.data,
      organizationId,
      targetBranchId,
      defaultBranch.name,
    )
    if (!sanitized) {
      return {
        inventory: seedInventory,
        updatedAt: null,
        source: 'initial-seed',
        warning:
          'La estructura del inventario local estaba incompleta; se cargaron los datos iniciales seguros.',
      }
    }

    if (
      txInventoryCandidate &&
      txInventoryCandidate.inventory.storageRevision >=
        sanitized.inventory.storageRevision
    ) {
      return {
        inventory: txInventoryCandidate.inventory,
        updatedAt: txInventoryCandidate.updatedAt,
        source: 'local-storage',
        warning: txInventoryCandidate.warning,
      }
    }

    return {
      inventory: sanitized.inventory,
      updatedAt:
        typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
      source: 'local-storage',
      warning: sanitized.hadInvalidEntries
        ? 'Se omitieron algunos registros locales de inventario con formato inválido.'
        : undefined,
    }
  }

  const saveInternal = (
    organizationId: string,
    inventory: OrganizationInventoryData,
  ): { ok: true; updatedAt: string } | { ok: false; error: string } => {
    if (
      !organizationId.trim() ||
      inventory.organizationId !== organizationId ||
      !inventory.branchId.trim()
    ) {
      return {
        ok: false,
        error:
          'Contexto de organización o sucursal inválido para guardar el inventario.',
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
    const envelope: StoredInventoryEnvelope = {
      schemaVersion: INVENTORY_SCHEMA_VERSION,
      organizationId,
      branchId: inventory.branchId,
      branchName: inventory.branchName,
      updatedAt,
      data: cloneInventoryData(inventory),
    }

    const key = getOrganizationInventoryStorageKey(
      organizationId,
      inventory.branchId,
    )
    const serialized = JSON.stringify(envelope)

    try {
      storage.setItem(key, serialized)
      const verifyRead = storage.getItem(key)
      if (verifyRead !== serialized) {
        return {
          ok: false,
          error:
            'No se pudo verificar la escritura atómica de balance e historial en localStorage.',
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
          'Error al guardar en localStorage (espacio insuficiente o almacenamiento bloqueado). El balance y el historial anteriores se conservaron intactos.',
      }
    }
  }

  return {
    load: loadInternal,
    save: saveInternal,

    hasProductMovements(
      organizationId: string,
      productId: string,
      branchId?: string,
    ): boolean {
      const { inventory } = loadInternal(organizationId, branchId)
      return (
        inventory.balances.some((b) => b.productId === productId) ||
        inventory.movements.some((m) => m.productId === productId)
      )
    },

    initializeStock(params: InitializeStockParams): InventoryOperationOutcome {
      const {
        organizationId,
        product,
        initialQuantity,
        minStock = null,
        reason,
        reference,
        operatorName,
        operationId,
        simulateStorageError,
      } = params

      if (!organizationId.trim()) {
        return {
          ok: false,
          errorCode: 'INVALID_CONTEXT',
          error: 'Organización activa inválida.',
        }
      }

      if (product.organizationId !== organizationId) {
        return {
          ok: false,
          errorCode: 'PRODUCT_ORG_MISMATCH',
          error: `El producto "${product.name}" no pertenece a la organización activa (${organizationId}). Operación rechazada por aislamiento de negocio.`,
        }
      }

      const cleanOperationId = operationId.trim()
      if (!cleanOperationId) {
        return {
          ok: false,
          errorCode: 'INVALID_CONTEXT',
          error: 'Se requiere un identificador de operación válido.',
        }
      }

      const cleanReason = reason.trim()
      if (cleanReason.length < 3) {
        return {
          ok: false,
          errorCode: 'REASON_REQUIRED',
          error:
            'El motivo de inicialización es obligatorio (mínimo 3 caracteres).',
        }
      }

      if (
        !Number.isFinite(initialQuantity) ||
        initialQuantity < 0 ||
        !isQuantityCompatibleWithUnit(initialQuantity, product.unit)
      ) {
        return {
          ok: false,
          errorCode: 'INVALID_QUANTITY',
          error: `La cantidad inicial no es válida para la unidad "${getUnitLabel(product.unit)}".`,
        }
      }

      if (
        minStock !== null &&
        (!Number.isFinite(minStock) ||
          minStock < 0 ||
          !isQuantityCompatibleWithUnit(minStock, product.unit))
      ) {
        return {
          ok: false,
          errorCode: 'INVALID_QUANTITY',
          error: `El stock mínimo no es válido para la unidad "${getUnitLabel(product.unit)}".`,
        }
      }

      const currentOutcome = loadInternal(organizationId, params.branchId)
      const currentInventory = currentOutcome.inventory

      if (
        currentInventory.movements.some(
          (mov) => mov.operationId === cleanOperationId,
        )
      ) {
        return {
          ok: false,
          errorCode: 'DUPLICATE_OPERATION',
          error:
            'Esta operación ya fue registrada previamente. Se evitó duplicar el movimiento.',
          latestInventory: currentInventory,
        }
      }

      const existingBalance = currentInventory.balances.find(
        (bal) => bal.productId === product.id,
      )
      const hasExistingMovements = currentInventory.movements.some(
        (mov) => mov.productId === product.id,
      )

      if (existingBalance || hasExistingMovements) {
        return {
          ok: false,
          errorCode: 'ALREADY_INITIALIZED',
          error: `El producto "${product.name}" ya cuenta con existencia inicial registrada en ${currentInventory.branchName}. Usa Entrada manual o Ajuste por conteo físico.`,
          latestInventory: currentInventory,
          latestBalance: existingBalance,
        }
      }

      if (simulateStorageError) {
        return {
          ok: false,
          errorCode: 'STORAGE_ERROR',
          error:
            'Fallo simulado de almacenamiento: no se pudo guardar la inicialización. El balance e historial permanecieron sin cambios.',
        }
      }

      const now = new Date().toISOString()
      const normalizedQty = normalizeControlledQuantity(initialQuantity)
      const normalizedMin =
        minStock !== null ? normalizeControlledQuantity(minStock) : null
      const nextSequence = currentInventory.lastSequence + 1

      const newBalance: InventoryBalance = {
        organizationId,
        branchId: currentInventory.branchId,
        productId: product.id,
        quantity: normalizedQty,
        minStock: normalizedMin,
        updatedAt: now,
        version: 1,
      }

      const newMovement: InventoryMovement = {
        id: generateInventoryId('mov'),
        organizationId,
        branchId: currentInventory.branchId,
        productId: product.id,
        type: 'initial',
        delta: normalizedQty,
        previousQuantity: null,
        newQuantity: normalizedQty,
        reason: cleanReason,
        reference: reference?.trim() ? reference.trim() : null,
        operatorName: operatorName.trim() || 'Operador de Demostración',
        createdAt: now,
        sequence: nextSequence,
        operationId: cleanOperationId,
      }

      const nextInventory: OrganizationInventoryData = {
        ...currentInventory,
        storageRevision: currentInventory.storageRevision + 1,
        lastSequence: nextSequence,
        balances: [...currentInventory.balances, newBalance],
        movements: [newMovement, ...currentInventory.movements],
      }

      const saveResult = saveInternal(organizationId, nextInventory)
      if (!saveResult.ok) {
        return {
          ok: false,
          errorCode: 'STORAGE_ERROR',
          error: saveResult.error,
        }
      }

      return {
        ok: true,
        inventory: nextInventory,
        balance: newBalance,
        movement: newMovement,
        updatedAt: saveResult.updatedAt,
      }
    },

    registerManualMovement(
      params: ManualMovementParams,
    ): InventoryOperationOutcome {
      const {
        organizationId,
        product,
        type,
        quantity,
        reason,
        reference,
        operatorName,
        operationId,
        expectedBalanceVersion,
        simulateStorageError,
      } = params

      if (!organizationId.trim()) {
        return {
          ok: false,
          errorCode: 'INVALID_CONTEXT',
          error: 'Organización activa inválida.',
        }
      }

      if (product.organizationId !== organizationId) {
        return {
          ok: false,
          errorCode: 'PRODUCT_ORG_MISMATCH',
          error: `El producto "${product.name}" no pertenece a la organización activa (${organizationId}).`,
        }
      }

      if (type === 'manual_in' && product.status === 'inactive') {
        return {
          ok: false,
          errorCode: 'INACTIVE_PRODUCT_ENTRY_FORBIDDEN',
          error: `El producto "${product.name}" está inactivo en el catálogo. No se permiten nuevas entradas para artículos inactivos; solo puedes consultar su historial, registrar una salida manual o ajustar por conteo físico sus existencias residuales.`,
        }
      }

      const cleanOperationId = operationId.trim()
      if (!cleanOperationId) {
        return {
          ok: false,
          errorCode: 'INVALID_CONTEXT',
          error: 'Se requiere un identificador de operación válido.',
        }
      }

      const cleanReason = reason.trim()
      if (cleanReason.length < 3) {
        return {
          ok: false,
          errorCode: 'REASON_REQUIRED',
          error: 'El motivo del movimiento es obligatorio (mínimo 3 caracteres).',
        }
      }

      if (
        !Number.isFinite(quantity) ||
        quantity <= 0 ||
        !isQuantityCompatibleWithUnit(quantity, product.unit)
      ) {
        return {
          ok: false,
          errorCode: 'INVALID_QUANTITY',
          error: `La cantidad debe ser positiva y cumplir la precisión de la unidad "${getUnitLabel(product.unit)}".`,
        }
      }

      const currentOutcome = loadInternal(organizationId, params.branchId)
      const currentInventory = currentOutcome.inventory

      if (
        currentInventory.movements.some(
          (mov) => mov.operationId === cleanOperationId,
        )
      ) {
        return {
          ok: false,
          errorCode: 'DUPLICATE_OPERATION',
          error:
            'Esta operación ya fue registrada previamente. Se evitó duplicar el movimiento.',
          latestInventory: currentInventory,
        }
      }

      const existingBalance = currentInventory.balances.find(
        (bal) => bal.productId === product.id,
      )

      if (!existingBalance) {
        return {
          ok: false,
          errorCode: 'NOT_INITIALIZED',
          error: `El producto "${product.name}" aún está sin inicializar en ${currentInventory.branchName}. Registra primero su existencia inicial.`,
          latestInventory: currentInventory,
        }
      }

      if (
        expectedBalanceVersion !== undefined &&
        existingBalance.version !== expectedBalanceVersion
      ) {
        return {
          ok: false,
          errorCode: 'CONCURRENCY_CONFLICT',
          error: `El saldo de "${product.name}" se actualizó mientras el formulario estaba abierto (saldo actual: ${formatQuantityWithUnit(existingBalance.quantity, product.unit)}). Revisa el nuevo saldo antes de confirmar.`,
          latestInventory: currentInventory,
          latestBalance: existingBalance,
        }
      }

      const normalizedQty = normalizeControlledQuantity(quantity)
      const signedDelta =
        type === 'manual_in' ? normalizedQty : -normalizedQty
      const resultingQuantity = addControlledQuantities(
        existingBalance.quantity,
        signedDelta,
      )

      if (resultingQuantity < 0) {
        return {
          ok: false,
          errorCode: 'INSUFFICIENT_STOCK',
          error: `Stock insuficiente para realizar la salida. Existencia disponible: ${formatQuantityWithUnit(existingBalance.quantity, product.unit)}; salida solicitada: ${formatQuantityWithUnit(normalizedQty, product.unit)}. No se permite stock negativo.`,
          latestInventory: currentInventory,
          latestBalance: existingBalance,
        }
      }

      if (simulateStorageError) {
        return {
          ok: false,
          errorCode: 'STORAGE_ERROR',
          error:
            'Fallo simulado de almacenamiento: no se pudo guardar el movimiento. El balance y el historial anteriores se conservaron intactos.',
        }
      }

      const now = new Date().toISOString()
      const nextSequence = currentInventory.lastSequence + 1

      const updatedBalance: InventoryBalance = {
        ...existingBalance,
        quantity: resultingQuantity,
        updatedAt: now,
        version: existingBalance.version + 1,
      }

      const newMovement: InventoryMovement = {
        id: generateInventoryId('mov'),
        organizationId,
        branchId: currentInventory.branchId,
        productId: product.id,
        type,
        delta: signedDelta,
        previousQuantity: existingBalance.quantity,
        newQuantity: resultingQuantity,
        reason: cleanReason,
        reference: reference?.trim() ? reference.trim() : null,
        operatorName: operatorName.trim() || 'Operador de Demostración',
        createdAt: now,
        sequence: nextSequence,
        operationId: cleanOperationId,
      }

      const nextInventory: OrganizationInventoryData = {
        ...currentInventory,
        storageRevision: currentInventory.storageRevision + 1,
        lastSequence: nextSequence,
        balances: currentInventory.balances.map((bal) =>
          bal.productId === product.id ? updatedBalance : bal,
        ),
        movements: [newMovement, ...currentInventory.movements],
      }

      const saveResult = saveInternal(organizationId, nextInventory)
      if (!saveResult.ok) {
        return {
          ok: false,
          errorCode: 'STORAGE_ERROR',
          error: saveResult.error,
        }
      }

      return {
        ok: true,
        inventory: nextInventory,
        balance: updatedBalance,
        movement: newMovement,
        updatedAt: saveResult.updatedAt,
      }
    },

    registerPhysicalCount(
      params: PhysicalCountParams,
    ): InventoryOperationOutcome {
      const {
        organizationId,
        product,
        countedQuantity,
        reason,
        reference,
        operatorName,
        operationId,
        expectedBalanceVersion,
        simulateStorageError,
      } = params

      if (!organizationId.trim()) {
        return {
          ok: false,
          errorCode: 'INVALID_CONTEXT',
          error: 'Organización activa inválida.',
        }
      }

      if (product.organizationId !== organizationId) {
        return {
          ok: false,
          errorCode: 'PRODUCT_ORG_MISMATCH',
          error: `El producto "${product.name}" no pertenece a la organización activa (${organizationId}).`,
        }
      }

      const cleanOperationId = operationId.trim()
      if (!cleanOperationId) {
        return {
          ok: false,
          errorCode: 'INVALID_CONTEXT',
          error: 'Se requiere un identificador de operación válido.',
        }
      }

      const cleanReason = reason.trim()
      if (cleanReason.length < 3) {
        return {
          ok: false,
          errorCode: 'REASON_REQUIRED',
          error:
            'El motivo del ajuste por conteo es obligatorio (mínimo 3 caracteres).',
        }
      }

      if (
        !Number.isFinite(countedQuantity) ||
        countedQuantity < 0 ||
        !isQuantityCompatibleWithUnit(countedQuantity, product.unit)
      ) {
        return {
          ok: false,
          errorCode: 'INVALID_QUANTITY',
          error: `La cantidad contada no es válida para la unidad "${getUnitLabel(product.unit)}".`,
        }
      }

      const currentOutcome = loadInternal(organizationId, params.branchId)
      const currentInventory = currentOutcome.inventory

      if (
        currentInventory.movements.some(
          (mov) => mov.operationId === cleanOperationId,
        )
      ) {
        return {
          ok: false,
          errorCode: 'DUPLICATE_OPERATION',
          error:
            'Esta operación de conteo ya fue registrada previamente. Se evitó duplicar el ajuste.',
          latestInventory: currentInventory,
        }
      }

      const existingBalance = currentInventory.balances.find(
        (bal) => bal.productId === product.id,
      )

      if (!existingBalance) {
        return {
          ok: false,
          errorCode: 'NOT_INITIALIZED',
          error: `El producto "${product.name}" aún está sin inicializar. Registra primero su existencia inicial.`,
          latestInventory: currentInventory,
        }
      }

      if (existingBalance.version !== expectedBalanceVersion) {
        return {
          ok: false,
          errorCode: 'CONCURRENCY_CONFLICT',
          error: `El saldo registrado de "${product.name}" cambió mientras el formulario estaba abierto (nuevo saldo registrado: ${formatQuantityWithUnit(existingBalance.quantity, product.unit)}). Revisa la nueva diferencia calculada antes de confirmar el ajuste.`,
          latestInventory: currentInventory,
          latestBalance: existingBalance,
        }
      }

      const normalizedCounted = normalizeControlledQuantity(countedQuantity)
      const delta = calculateCountAdjustmentDelta(
        existingBalance.quantity,
        normalizedCounted,
      )

      if (delta === 0) {
        return {
          ok: false,
          errorCode: 'NO_DIFFERENCE',
          error: `La cantidad contada (${formatQuantityWithUnit(normalizedCounted, product.unit)}) coincide exactamente con la existencia registrada. No hay diferencia y no se creó ningún movimiento.`,
          latestInventory: currentInventory,
          latestBalance: existingBalance,
        }
      }

      if (simulateStorageError) {
        return {
          ok: false,
          errorCode: 'STORAGE_ERROR',
          error:
            'Fallo simulado de almacenamiento: no se pudo guardar el ajuste por conteo. El balance y el historial permanecieron sin cambios.',
        }
      }

      const now = new Date().toISOString()
      const nextSequence = currentInventory.lastSequence + 1

      const updatedBalance: InventoryBalance = {
        ...existingBalance,
        quantity: normalizedCounted,
        updatedAt: now,
        version: existingBalance.version + 1,
      }

      const newMovement: InventoryMovement = {
        id: generateInventoryId('mov'),
        organizationId,
        branchId: currentInventory.branchId,
        productId: product.id,
        type: 'count_adjustment',
        delta,
        previousQuantity: existingBalance.quantity,
        newQuantity: normalizedCounted,
        reason: cleanReason,
        reference: reference?.trim() ? reference.trim() : null,
        operatorName: operatorName.trim() || 'Operador de Demostración',
        createdAt: now,
        sequence: nextSequence,
        operationId: cleanOperationId,
      }

      const nextInventory: OrganizationInventoryData = {
        ...currentInventory,
        storageRevision: currentInventory.storageRevision + 1,
        lastSequence: nextSequence,
        balances: currentInventory.balances.map((bal) =>
          bal.productId === product.id ? updatedBalance : bal,
        ),
        movements: [newMovement, ...currentInventory.movements],
      }

      const saveResult = saveInternal(organizationId, nextInventory)
      if (!saveResult.ok) {
        return {
          ok: false,
          errorCode: 'STORAGE_ERROR',
          error: saveResult.error,
        }
      }

      return {
        ok: true,
        inventory: nextInventory,
        balance: updatedBalance,
        movement: newMovement,
        updatedAt: saveResult.updatedAt,
      }
    },

    updateMinStock(params: UpdateMinStockParams): InventoryOperationOutcome {
      const {
        organizationId,
        product,
        minStock,
        simulateStorageError,
      } = params

      if (!organizationId.trim()) {
        return {
          ok: false,
          errorCode: 'INVALID_CONTEXT',
          error: 'Organización activa inválida.',
        }
      }

      if (product.organizationId !== organizationId) {
        return {
          ok: false,
          errorCode: 'PRODUCT_ORG_MISMATCH',
          error: `El producto "${product.name}" no pertenece a la organización activa (${organizationId}).`,
        }
      }

      if (
        minStock !== null &&
        (!Number.isFinite(minStock) ||
          minStock < 0 ||
          !isQuantityCompatibleWithUnit(minStock, product.unit))
      ) {
        return {
          ok: false,
          errorCode: 'INVALID_QUANTITY',
          error: `El stock mínimo no es válido para la unidad "${getUnitLabel(product.unit)}".`,
        }
      }

      const currentOutcome = loadInternal(organizationId, params.branchId)
      const currentInventory = currentOutcome.inventory

      const existingBalance = currentInventory.balances.find(
        (bal) => bal.productId === product.id,
      )

      if (!existingBalance) {
        return {
          ok: false,
          errorCode: 'NOT_INITIALIZED',
          error: `El producto "${product.name}" aún está sin inicializar. Inicializa primero su existencia antes de configurar un mínimo.`,
          latestInventory: currentInventory,
        }
      }

      if (simulateStorageError) {
        return {
          ok: false,
          errorCode: 'STORAGE_ERROR',
          error:
            'Fallo simulado de almacenamiento: no se pudo guardar el stock mínimo. El balance permaneció sin cambios.',
        }
      }

      const now = new Date().toISOString()
      const normalizedMin =
        minStock !== null ? normalizeControlledQuantity(minStock) : null

      // Cambiar un mínimo NO crea un movimiento de existencias ni altera la versión de saldo de conteo
      const updatedBalance: InventoryBalance = {
        ...existingBalance,
        minStock: normalizedMin,
        updatedAt: now,
      }

      const nextInventory: OrganizationInventoryData = {
        ...currentInventory,
        storageRevision: currentInventory.storageRevision + 1,
        balances: currentInventory.balances.map((bal) =>
          bal.productId === product.id ? updatedBalance : bal,
        ),
      }

      const saveResult = saveInternal(organizationId, nextInventory)
      if (!saveResult.ok) {
        return {
          ok: false,
          errorCode: 'STORAGE_ERROR',
          error: saveResult.error,
        }
      }

      return {
        ok: true,
        inventory: nextInventory,
        balance: updatedBalance,
        movement: null,
        updatedAt: saveResult.updatedAt,
      }
    },
  }
}

export const defaultInventoryRepository = createLocalInventoryRepository()

