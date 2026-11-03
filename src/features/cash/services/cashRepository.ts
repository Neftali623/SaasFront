import type { StorageLike } from '../../../services/settings/organizationSettingsRepository'
import type { CurrencyCode } from '../../../types'
import { getBranchForOrganization } from '../../inventory/utils/mockInventory'
import type {
  CashDifferenceKind,
  CashMovement,
  CashMovementDirection,
  CashMovementType,
  CashRegister,
  CashSession,
  CashSessionStatus,
  OrganizationCashData,
} from '../types'
import {
  cloneCashData,
  getRegisterForOrganization,
  INITIAL_CASH_BY_ORG,
} from '../utils/mockCash'
import {
  calculateClosingDifference,
  calculateSessionComputedTotals,
  formatCentsWithHistoricalCurrency,
} from '../utils/moneyUtils'

export const CASH_SCHEMA_VERSION = 1

export interface StoredCashEnvelope {
  schemaVersion: number
  organizationId: string
  branchId: string
  branchName: string
  updatedAt: string
  data: OrganizationCashData
}

export interface LoadCashOutcome {
  cashData: OrganizationCashData
  updatedAt: string | null
  source: 'local-storage' | 'initial-seed'
  warning?: string
}

export type CashErrorCode =
  | 'INVALID_CONTEXT'
  | 'SESSION_ORG_MISMATCH'
  | 'SESSION_NOT_FOUND'
  | 'SESSION_ALREADY_OPEN'
  | 'SESSION_CLOSED'
  | 'INVALID_AMOUNT'
  | 'INSUFFICIENT_CASH_BALANCE'
  | 'REASON_REQUIRED'
  | 'DIFFERENCE_NOTE_REQUIRED'
  | 'DUPLICATE_OPERATION'
  | 'CONCURRENCY_CONFLICT'
  | 'STORAGE_ERROR'

export type CashOperationOutcome =
  | {
      ok: true
      cashData: OrganizationCashData
      session: CashSession
      movement: CashMovement | null
      updatedAt: string
    }
  | {
      ok: false
      errorCode: CashErrorCode
      error: string
      latestCashData?: OrganizationCashData
      latestSession?: CashSession
    }

export interface OpenCashSessionParams {
  organizationId: string
  branchId?: string
  registerId?: string
  openingAmountCents: number
  currency: CurrencyCode
  openingNote?: string | null
  operatorName: string
  operationId: string
  simulateStorageError?: boolean
}

export interface RegisterCashMovementParams {
  organizationId: string
  branchId?: string
  sessionId: string
  type: 'manual_in' | 'manual_out'
  amountCents: number
  reason: string
  reference?: string | null
  isCompensatory?: boolean
  compensatedMovementId?: string | null
  operatorName: string
  operationId: string
  expectedSessionVersion?: number
  simulateStorageError?: boolean
}

export interface CloseCashSessionParams {
  organizationId: string
  branchId?: string
  sessionId: string
  countedAmountCents: number
  closingNote?: string | null
  operatorName: string
  operationId: string
  expectedSessionVersion: number
  expectedBalanceCents?: number
  simulateStorageError?: boolean
}

export interface CashRepository {
  load(organizationId: string, branchId?: string): LoadCashOutcome
  save(
    organizationId: string,
    cashData: OrganizationCashData,
  ): { ok: true; updatedAt: string } | { ok: false; error: string }
  openSession(params: OpenCashSessionParams): CashOperationOutcome
  registerManualMovement(
    params: RegisterCashMovementParams,
  ): CashOperationOutcome
  closeSession(params: CloseCashSessionParams): CashOperationOutcome
}

export function getOrganizationCashStorageKey(
  organizationId: string,
  branchId: string,
): string {
  return `nedaxoli_demo_cash_v${CASH_SCHEMA_VERSION}_${organizationId}_${branchId}`
}

export function generateCashId(prefix: 'cses' | 'cmov' | 'op'): string {
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

function isValidCurrency(value: unknown): value is CurrencyCode {
  return (
    value === 'MXN' || value === 'USD' || value === 'COP' || value === 'EUR'
  )
}

function isValidSessionStatus(value: unknown): value is CashSessionStatus {
  return value === 'open' || value === 'closed'
}

function isValidDifferenceKind(
  value: unknown,
): value is CashDifferenceKind | null {
  return (
    value === null ||
    value === 'exact' ||
    value === 'surplus' ||
    value === 'shortage'
  )
}

function isValidMovementType(value: unknown): value is CashMovementType {
  return (
    value === 'opening_float' ||
    value === 'manual_in' ||
    value === 'manual_out' ||
    value === 'cash_sale' ||
    value === 'cash_refund'
  )
}

function isValidDirection(value: unknown): value is CashMovementDirection {
  return value === 'in' || value === 'out'
}

function sanitizeStoredCashData(
  rawData: unknown,
  organizationId: string,
  branchId: string,
  fallbackBranchName: string,
): { cashData: OrganizationCashData; hadInvalidEntries: boolean } | null {
  if (!isObjectRecord(rawData)) {
    return null
  }

  if (!Array.isArray(rawData.sessions) || !Array.isArray(rawData.movements)) {
    return null
  }

  let hadInvalidEntries = false
  const defaultRegister = getRegisterForOrganization(
    organizationId,
    fallbackBranchName,
  )

  let register: CashRegister = defaultRegister
  if (
    isObjectRecord(rawData.register) &&
    typeof rawData.register.id === 'string' &&
    rawData.register.id.trim() &&
    typeof rawData.register.name === 'string' &&
    rawData.register.name.trim()
  ) {
    register = {
      id: rawData.register.id.trim(),
      organizationId,
      branchId,
      branchName: fallbackBranchName,
      name: rawData.register.name.trim(),
      code:
        typeof rawData.register.code === 'string' &&
        rawData.register.code.trim()
          ? rawData.register.code.trim()
          : defaultRegister.code,
    }
  }

  const sessions: CashSession[] = []
  const seenSessionIds = new Set<string>()
  const seenOperationIds = new Set<string>()
  let maxSequence = 0
  let hasOpenSessionOnRegister = false

  for (const rawSes of rawData.sessions) {
    if (
      !isObjectRecord(rawSes) ||
      typeof rawSes.id !== 'string' ||
      !rawSes.id.trim() ||
      !isValidSessionStatus(rawSes.status) ||
      !isValidCurrency(rawSes.currency) ||
      typeof rawSes.openedBy !== 'string' ||
      !rawSes.openedBy.trim() ||
      typeof rawSes.openedAt !== 'string' ||
      typeof rawSes.openingAmountCents !== 'number' ||
      !Number.isFinite(rawSes.openingAmountCents) ||
      rawSes.openingAmountCents < 0
    ) {
      hadInvalidEntries = true
      continue
    }

    if (
      typeof rawSes.organizationId === 'string' &&
      rawSes.organizationId !== organizationId
    ) {
      hadInvalidEntries = true
      continue
    }

    if (seenSessionIds.has(rawSes.id)) {
      hadInvalidEntries = true
      continue
    }

    // Impedir más de una sesión abierta sobre la misma caja
    if (rawSes.status === 'open') {
      if (hasOpenSessionOnRegister) {
        hadInvalidEntries = true
        continue
      }
      hasOpenSessionOnRegister = true
    }

    seenSessionIds.add(rawSes.id)

    const operationId =
      typeof rawSes.operationId === 'string' && rawSes.operationId.trim()
        ? rawSes.operationId.trim()
        : `op-ses-${rawSes.id}`
    seenOperationIds.add(operationId)

    const sequence =
      typeof rawSes.sequence === 'number' &&
      Number.isInteger(rawSes.sequence) &&
      rawSes.sequence >= 1
        ? rawSes.sequence
        : maxSequence + 1
    if (sequence > maxSequence) {
      maxSequence = sequence
    }

    const version =
      typeof rawSes.version === 'number' &&
      Number.isInteger(rawSes.version) &&
      rawSes.version >= 1
        ? rawSes.version
        : 1

    sessions.push({
      id: rawSes.id.trim(),
      organizationId,
      branchId,
      branchName: fallbackBranchName,
      registerId: register.id,
      registerName: register.name,
      status: rawSes.status,
      currency: rawSes.currency,
      openedBy: rawSes.openedBy.trim(),
      openedAt: rawSes.openedAt,
      openingAmountCents: Math.round(rawSes.openingAmountCents),
      openingNote:
        typeof rawSes.openingNote === 'string' && rawSes.openingNote.trim()
          ? rawSes.openingNote.trim()
          : null,
      closedBy:
        typeof rawSes.closedBy === 'string' && rawSes.closedBy.trim()
          ? rawSes.closedBy.trim()
          : null,
      closedAt: typeof rawSes.closedAt === 'string' ? rawSes.closedAt : null,
      expectedClosingAmountCents:
        typeof rawSes.expectedClosingAmountCents === 'number' &&
        Number.isFinite(rawSes.expectedClosingAmountCents)
          ? Math.round(rawSes.expectedClosingAmountCents)
          : null,
      countedAmountCents:
        typeof rawSes.countedAmountCents === 'number' &&
        Number.isFinite(rawSes.countedAmountCents)
          ? Math.round(rawSes.countedAmountCents)
          : null,
      differenceAmountCents:
        typeof rawSes.differenceAmountCents === 'number' &&
        Number.isFinite(rawSes.differenceAmountCents)
          ? Math.round(rawSes.differenceAmountCents)
          : null,
      differenceKind: isValidDifferenceKind(rawSes.differenceKind)
        ? rawSes.differenceKind
        : null,
      closingNote:
        typeof rawSes.closingNote === 'string' && rawSes.closingNote.trim()
          ? rawSes.closingNote.trim()
          : null,
      version,
      sequence,
      operationId,
    })
  }

  const movements: CashMovement[] = []
  const seenMovementIds = new Set<string>()

  for (const rawMov of rawData.movements) {
    if (
      !isObjectRecord(rawMov) ||
      typeof rawMov.id !== 'string' ||
      !rawMov.id.trim() ||
      typeof rawMov.sessionId !== 'string' ||
      !seenSessionIds.has(rawMov.sessionId) ||
      !isValidMovementType(rawMov.type) ||
      !isValidDirection(rawMov.direction) ||
      typeof rawMov.amountCents !== 'number' ||
      !Number.isFinite(rawMov.amountCents) ||
      rawMov.amountCents < 0 ||
      typeof rawMov.balanceAfterCents !== 'number' ||
      !Number.isFinite(rawMov.balanceAfterCents) ||
      !isValidCurrency(rawMov.currency) ||
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
        : `op-mov-${rawMov.id}`

    if (seenOperationIds.has(operationId)) {
      hadInvalidEntries = true
      continue
    }
    seenOperationIds.add(operationId)

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
      registerId: register.id,
      sessionId: rawMov.sessionId.trim(),
      type: rawMov.type,
      direction: rawMov.direction,
      amountCents: Math.round(rawMov.amountCents),
      balanceAfterCents: Math.round(rawMov.balanceAfterCents),
      currency: rawMov.currency,
      reason: rawMov.reason.trim(),
      reference:
        typeof rawMov.reference === 'string' && rawMov.reference.trim()
          ? rawMov.reference.trim()
          : null,
      isCompensatory: Boolean(rawMov.isCompensatory),
      compensatedMovementId:
        typeof rawMov.compensatedMovementId === 'string' &&
        rawMov.compensatedMovementId.trim()
          ? rawMov.compensatedMovementId.trim()
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

  return {
    cashData: {
      organizationId,
      branchId,
      branchName: fallbackBranchName,
      storageRevision,
      lastSequence,
      register,
      sessions,
      movements,
    },
    hadInvalidEntries,
  }
}

export function createLocalCashRepository(
  customStorage?: StorageLike | null,
): CashRepository {
  const resolveStorage = (): StorageLike | null => {
    if (customStorage !== undefined) {
      return customStorage
    }
    return getBrowserLocalStorage()
  }

  const getSeedForOrg = (
    organizationId: string,
    branchId?: string,
  ): OrganizationCashData => {
    const defaultBranch = getBranchForOrganization(organizationId)
    const targetBranchId = branchId ?? defaultBranch.id
    const seed = INITIAL_CASH_BY_ORG[organizationId]

    if (!seed || seed.branchId !== targetBranchId) {
      const register = getRegisterForOrganization(
        organizationId,
        defaultBranch.name,
      )
      return {
        organizationId,
        branchId: targetBranchId,
        branchName: defaultBranch.name,
        storageRevision: 1,
        lastSequence: 0,
        register,
        sessions: [],
        movements: [],
      }
    }

    return cloneCashData(seed)
  }

  const loadInternal = (
    organizationId: string,
    branchId?: string,
  ): LoadCashOutcome => {
    const defaultBranch = getBranchForOrganization(organizationId)
    const targetBranchId = branchId ?? defaultBranch.id
    const storage = resolveStorage()
    const seedCash = getSeedForOrg(organizationId, targetBranchId)

    if (!storage) {
      return {
        cashData: seedCash,
        updatedAt: null,
        source: 'initial-seed',
        warning:
          'El almacenamiento local del navegador no está disponible. El módulo de Caja funcionará únicamente en memoria durante esta sesión.',
      }
    }

    const key = getOrganizationCashStorageKey(organizationId, targetBranchId)
    const txKey = `nedaxoli_demo_branch_tx_v1_${organizationId}_${targetBranchId}`
    let raw: string | null
    let rawTx: string | null

    try {
      raw = storage.getItem(key)
      rawTx = storage.getItem(txKey)
    } catch {
      return {
        cashData: seedCash,
        updatedAt: null,
        source: 'initial-seed',
        warning:
          'No fue posible leer el almacenamiento local. Se cargaron los datos iniciales seguros de Caja.',
      }
    }

    let txCashCandidate: {
      cashData: OrganizationCashData
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
          const sanitizedTxCash = sanitizeStoredCashData(
            parsedTx.data.cashData,
            organizationId,
            targetBranchId,
            defaultBranch.name,
          )
          if (sanitizedTxCash) {
            txCashCandidate = {
              cashData: sanitizedTxCash.cashData,
              updatedAt:
                typeof parsedTx.updatedAt === 'string'
                  ? parsedTx.updatedAt
                  : null,
              warning: sanitizedTxCash.hadInvalidEntries
                ? 'Se omitieron algunos registros locales de Caja con formato inválido.'
                : undefined,
            }
          }
        }
      } catch {
        // Ignorar instantánea transaccional inválida y usar respaldo individual
      }
    }

    // Inicializar semilla solo una vez cuando aún no existe registro en localStorage
    if (raw === null) {
      if (txCashCandidate) {
        return {
          cashData: txCashCandidate.cashData,
          updatedAt: txCashCandidate.updatedAt,
          source: 'local-storage',
          warning: txCashCandidate.warning,
        }
      }
      const now = new Date().toISOString()
      const initialEnvelope: StoredCashEnvelope = {
        schemaVersion: CASH_SCHEMA_VERSION,
        organizationId,
        branchId: targetBranchId,
        branchName: seedCash.branchName,
        updatedAt: now,
        data: seedCash,
      }
      try {
        storage.setItem(key, JSON.stringify(initialEnvelope))
      } catch {
        // Si no se puede escribir la semilla inicial, continuar en memoria
      }
      return {
        cashData: seedCash,
        updatedAt: null,
        source: 'initial-seed',
      }
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      // No sobrescribir silenciosamente datos corruptos al leer
      return {
        cashData: seedCash,
        updatedAt: null,
        source: 'initial-seed',
        warning:
          'Se detectó un formato JSON inválido en los datos locales de Caja. Se cargó una vista segura en memoria sin sobrescribir el almacenamiento hasta que confirmes una nueva operación.',
      }
    }

    if (
      !isObjectRecord(parsed) ||
      parsed.schemaVersion !== CASH_SCHEMA_VERSION ||
      parsed.organizationId !== organizationId ||
      parsed.branchId !== targetBranchId
    ) {
      return {
        cashData: seedCash,
        updatedAt: null,
        source: 'initial-seed',
        warning:
          'El esquema o contexto guardado de Caja no coincide con la versión actual; se cargaron los datos iniciales seguros.',
      }
    }

    const sanitized = sanitizeStoredCashData(
      parsed.data,
      organizationId,
      targetBranchId,
      defaultBranch.name,
    )
    if (!sanitized) {
      return {
        cashData: seedCash,
        updatedAt: null,
        source: 'initial-seed',
        warning:
          'La estructura guardada de Caja estaba incompleta; se cargaron los datos iniciales seguros.',
      }
    }

    if (
      txCashCandidate &&
      txCashCandidate.cashData.storageRevision >=
        sanitized.cashData.storageRevision
    ) {
      return {
        cashData: txCashCandidate.cashData,
        updatedAt: txCashCandidate.updatedAt,
        source: 'local-storage',
        warning: txCashCandidate.warning,
      }
    }

    return {
      cashData: sanitized.cashData,
      updatedAt:
        typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
      source: 'local-storage',
      warning: sanitized.hadInvalidEntries
        ? 'Se omitieron algunos registros locales de Caja con formato inválido.'
        : undefined,
    }
  }

  const saveInternal = (
    organizationId: string,
    cashData: OrganizationCashData,
  ): { ok: true; updatedAt: string } | { ok: false; error: string } => {
    if (
      !organizationId.trim() ||
      cashData.organizationId !== organizationId ||
      !cashData.branchId.trim()
    ) {
      return {
        ok: false,
        error:
          'Contexto de organización o sucursal inválido para guardar los datos de Caja.',
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
    const envelope: StoredCashEnvelope = {
      schemaVersion: CASH_SCHEMA_VERSION,
      organizationId,
      branchId: cashData.branchId,
      branchName: cashData.branchName,
      updatedAt,
      data: cloneCashData(cashData),
    }

    const key = getOrganizationCashStorageKey(
      organizationId,
      cashData.branchId,
    )
    const serialized = JSON.stringify(envelope)

    try {
      storage.setItem(key, serialized)
      const verifyRead = storage.getItem(key)
      if (verifyRead !== serialized) {
        return {
          ok: false,
          error:
            'No se pudo verificar la escritura atómica de la sesión y movimientos en localStorage.',
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
          'Error al guardar en localStorage (espacio insuficiente o almacenamiento bloqueado). La sesión y sus movimientos permanecieron sin cambios.',
      }
    }
  }

  return {
    load: loadInternal,
    save: saveInternal,

    openSession(params: OpenCashSessionParams): CashOperationOutcome {
      const {
        organizationId,
        openingAmountCents,
        currency,
        openingNote,
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

      const cleanOpId = operationId.trim()
      if (!cleanOpId) {
        return {
          ok: false,
          errorCode: 'INVALID_CONTEXT',
          error: 'Se requiere un identificador de operación válido.',
        }
      }

      if (
        !Number.isFinite(openingAmountCents) ||
        !Number.isInteger(openingAmountCents) ||
        openingAmountCents < 0
      ) {
        return {
          ok: false,
          errorCode: 'INVALID_AMOUNT',
          error:
            'El fondo inicial debe ser un importe válido mayor o igual a cero.',
        }
      }

      if (!isValidCurrency(currency)) {
        return {
          ok: false,
          errorCode: 'INVALID_CONTEXT',
          error: 'Moneda de sesión inválida.',
        }
      }

      const currentOutcome = loadInternal(organizationId, params.branchId)
      const currentData = currentOutcome.cashData

      if (
        params.registerId &&
        params.registerId !== currentData.register.id
      ) {
        return {
          ok: false,
          errorCode: 'INVALID_CONTEXT',
          error: 'La caja seleccionada no pertenece a la sucursal activa.',
        }
      }

      // Verificar idempotencia
      if (
        currentData.sessions.some((s) => s.operationId === cleanOpId) ||
        currentData.movements.some((m) => m.operationId === cleanOpId)
      ) {
        return {
          ok: false,
          errorCode: 'DUPLICATE_OPERATION',
          error:
            'Esta solicitud de apertura ya fue procesada. Se evitó duplicar la sesión.',
          latestCashData: currentData,
        }
      }

      // Regla: Una sola sesión abierta por caja
      const existingOpenSession = currentData.sessions.find(
        (s) =>
          s.registerId === currentData.register.id && s.status === 'open',
      )

      if (existingOpenSession) {
        return {
          ok: false,
          errorCode: 'SESSION_ALREADY_OPEN',
          error: `Ya existe una sesión abierta en "${currentData.register.name}" (iniciada por ${existingOpenSession.openedBy}). No se permite abrir dos turnos simultáneos en la misma caja.`,
          latestCashData: currentData,
          latestSession: existingOpenSession,
        }
      }

      if (simulateStorageError) {
        return {
          ok: false,
          errorCode: 'STORAGE_ERROR',
          error:
            'Fallo simulado de almacenamiento: no se pudo abrir la sesión de caja. El estado permaneció cerrado.',
        }
      }

      const now = new Date().toISOString()
      const sessionSeq = currentData.lastSequence + 1
      const movementSeq = currentData.lastSequence + 2
      const sessionId = generateCashId('cses')

      const newSession: CashSession = {
        id: sessionId,
        organizationId,
        branchId: currentData.branchId,
        branchName: currentData.branchName,
        registerId: currentData.register.id,
        registerName: currentData.register.name,
        status: 'open',
        currency,
        openedBy: operatorName.trim() || 'Operador de Demostración',
        openedAt: now,
        openingAmountCents,
        openingNote: openingNote?.trim() ? openingNote.trim() : null,
        closedBy: null,
        closedAt: null,
        expectedClosingAmountCents: null,
        countedAmountCents: null,
        differenceAmountCents: null,
        differenceKind: null,
        closingNote: null,
        version: 1,
        sequence: sessionSeq,
        operationId: cleanOpId,
      }

      const openingMovement: CashMovement = {
        id: generateCashId('cmov'),
        organizationId,
        branchId: currentData.branchId,
        registerId: currentData.register.id,
        sessionId,
        type: 'opening_float',
        direction: 'in',
        amountCents: openingAmountCents,
        balanceAfterCents: openingAmountCents,
        currency,
        reason: openingNote?.trim()
          ? `Apertura de caja (${openingNote.trim()})`
          : 'Fondo inicial de apertura de caja',
        reference: `AP-${sessionSeq}`,
        isCompensatory: false,
        compensatedMovementId: null,
        operatorName: newSession.openedBy,
        createdAt: now,
        sequence: movementSeq,
        operationId: `${cleanOpId}-opening-float`,
      }

      const nextCashData: OrganizationCashData = {
        ...currentData,
        storageRevision: currentData.storageRevision + 1,
        lastSequence: movementSeq,
        sessions: [newSession, ...currentData.sessions],
        movements: [openingMovement, ...currentData.movements],
      }

      const saveResult = saveInternal(organizationId, nextCashData)
      if (!saveResult.ok) {
        return {
          ok: false,
          errorCode: 'STORAGE_ERROR',
          error: saveResult.error,
        }
      }

      return {
        ok: true,
        cashData: nextCashData,
        session: newSession,
        movement: openingMovement,
        updatedAt: saveResult.updatedAt,
      }
    },

    registerManualMovement(
      params: RegisterCashMovementParams,
    ): CashOperationOutcome {
      const {
        organizationId,
        sessionId,
        type,
        amountCents,
        reason,
        reference,
        isCompensatory = false,
        compensatedMovementId = null,
        operatorName,
        operationId,
        expectedSessionVersion,
        simulateStorageError,
      } = params

      if (!organizationId.trim()) {
        return {
          ok: false,
          errorCode: 'INVALID_CONTEXT',
          error: 'Organización activa inválida.',
        }
      }

      const cleanOpId = operationId.trim()
      if (!cleanOpId) {
        return {
          ok: false,
          errorCode: 'INVALID_CONTEXT',
          error: 'Se requiere un identificador de operación válido.',
        }
      }

      if (
        !Number.isFinite(amountCents) ||
        !Number.isInteger(amountCents) ||
        amountCents <= 0
      ) {
        return {
          ok: false,
          errorCode: 'INVALID_AMOUNT',
          error: 'El importe del movimiento debe ser mayor que cero.',
        }
      }

      const cleanReason = reason.trim()
      if (cleanReason.length < 3) {
        return {
          ok: false,
          errorCode: 'REASON_REQUIRED',
          error:
            'El motivo del movimiento de efectivo es obligatorio (mínimo 3 caracteres).',
        }
      }

      const currentOutcome = loadInternal(organizationId, params.branchId)
      const currentData = currentOutcome.cashData

      // Idempotencia por operationId
      if (
        currentData.movements.some((m) => m.operationId === cleanOpId) ||
        currentData.sessions.some((s) => s.operationId === cleanOpId)
      ) {
        return {
          ok: false,
          errorCode: 'DUPLICATE_OPERATION',
          error:
            'Este movimiento ya fue registrado previamente. Se evitó duplicar la operación.',
          latestCashData: currentData,
        }
      }

      const session = currentData.sessions.find((s) => s.id === sessionId)
      if (!session) {
        return {
          ok: false,
          errorCode: 'SESSION_ORG_MISMATCH',
          error:
            'La sesión de caja indicada no existe o no pertenece a la organización activa.',
          latestCashData: currentData,
        }
      }

      if (session.organizationId !== organizationId) {
        return {
          ok: false,
          errorCode: 'SESSION_ORG_MISMATCH',
          error:
            'La sesión de caja no pertenece a la organización activa. Operación rechazada por aislamiento.',
        }
      }

      if (session.status !== 'open') {
        return {
          ok: false,
          errorCode: 'SESSION_CLOSED',
          error:
            'Esta sesión de caja ya se encuentra cerrada. No se permite registrar ni corregir movimientos sobre sesiones cerradas.',
          latestCashData: currentData,
          latestSession: session,
        }
      }

      const totals = calculateSessionComputedTotals(
        session,
        currentData.movements,
      )

      if (
        expectedSessionVersion !== undefined &&
        session.version !== expectedSessionVersion
      ) {
        return {
          ok: false,
          errorCode: 'CONCURRENCY_CONFLICT',
          error: `El saldo esperado de la sesión se actualizó mientras el formulario estaba abierto (saldo actual: ${formatCentsWithHistoricalCurrency(totals.expectedBalanceCents, session.currency)}). Revisa el nuevo saldo antes de confirmar.`,
          latestCashData: currentData,
          latestSession: session,
        }
      }

      if (type === 'manual_out' && amountCents > totals.expectedBalanceCents) {
        return {
          ok: false,
          errorCode: 'INSUFFICIENT_CASH_BALANCE',
          error: `Retiro rechazado: el importe solicitado (${formatCentsWithHistoricalCurrency(amountCents, session.currency)}) supera el saldo esperado disponible en caja (${formatCentsWithHistoricalCurrency(totals.expectedBalanceCents, session.currency)}).`,
          latestCashData: currentData,
          latestSession: session,
        }
      }

      if (simulateStorageError) {
        return {
          ok: false,
          errorCode: 'STORAGE_ERROR',
          error:
            'Fallo simulado de almacenamiento: no se pudo guardar el movimiento. El saldo y la sesión permanecieron sin cambios.',
        }
      }

      const now = new Date().toISOString()
      const nextSequence = currentData.lastSequence + 1
      const balanceAfterCents =
        type === 'manual_in'
          ? totals.expectedBalanceCents + amountCents
          : totals.expectedBalanceCents - amountCents

      const updatedSession: CashSession = {
        ...session,
        version: session.version + 1,
      }

      const newMovement: CashMovement = {
        id: generateCashId('cmov'),
        organizationId,
        branchId: currentData.branchId,
        registerId: session.registerId,
        sessionId: session.id,
        type,
        direction: type === 'manual_in' ? 'in' : 'out',
        amountCents,
        balanceAfterCents,
        currency: session.currency, // Moneda histórica fija de la sesión
        reason: cleanReason,
        reference: reference?.trim() ? reference.trim() : null,
        isCompensatory,
        compensatedMovementId,
        operatorName: operatorName.trim() || 'Operador de Demostración',
        createdAt: now,
        sequence: nextSequence,
        operationId: cleanOpId,
      }

      const nextCashData: OrganizationCashData = {
        ...currentData,
        storageRevision: currentData.storageRevision + 1,
        lastSequence: nextSequence,
        sessions: currentData.sessions.map((s) =>
          s.id === session.id ? updatedSession : s,
        ),
        movements: [newMovement, ...currentData.movements],
      }

      const saveResult = saveInternal(organizationId, nextCashData)
      if (!saveResult.ok) {
        return {
          ok: false,
          errorCode: 'STORAGE_ERROR',
          error: saveResult.error,
        }
      }

      return {
        ok: true,
        cashData: nextCashData,
        session: updatedSession,
        movement: newMovement,
        updatedAt: saveResult.updatedAt,
      }
    },

    closeSession(params: CloseCashSessionParams): CashOperationOutcome {
      const {
        organizationId,
        sessionId,
        countedAmountCents,
        closingNote,
        operatorName,
        operationId,
        expectedSessionVersion,
        expectedBalanceCents,
        simulateStorageError,
      } = params

      if (!organizationId.trim()) {
        return {
          ok: false,
          errorCode: 'INVALID_CONTEXT',
          error: 'Organización activa inválida.',
        }
      }

      const cleanOpId = operationId.trim()
      if (!cleanOpId) {
        return {
          ok: false,
          errorCode: 'INVALID_CONTEXT',
          error: 'Se requiere un identificador de operación válido.',
        }
      }

      if (
        !Number.isFinite(countedAmountCents) ||
        !Number.isInteger(countedAmountCents) ||
        countedAmountCents < 0
      ) {
        return {
          ok: false,
          errorCode: 'INVALID_AMOUNT',
          error:
            'El efectivo contado debe ser un importe válido mayor o igual a cero.',
        }
      }

      const currentOutcome = loadInternal(organizationId, params.branchId)
      const currentData = currentOutcome.cashData

      const session = currentData.sessions.find((s) => s.id === sessionId)
      if (!session || session.organizationId !== organizationId) {
        return {
          ok: false,
          errorCode: 'SESSION_ORG_MISMATCH',
          error:
            'La sesión de caja que intentas cerrar no existe o no pertenece a la organización activa.',
          latestCashData: currentData,
        }
      }

      if (session.status !== 'open') {
        return {
          ok: false,
          errorCode: 'SESSION_CLOSED',
          error: 'Esta sesión de caja ya fue cerrada previamente.',
          latestCashData: currentData,
          latestSession: session,
        }
      }

      const totals = calculateSessionComputedTotals(
        session,
        currentData.movements,
      )

      // Detectar cambios de saldo ocurridos desde que se abrió el formulario de cierre
      if (
        session.version !== expectedSessionVersion ||
        (expectedBalanceCents !== undefined &&
          totals.expectedBalanceCents !== expectedBalanceCents)
      ) {
        return {
          ok: false,
          errorCode: 'CONCURRENCY_CONFLICT',
          error: `El saldo esperado de la sesión cambió mientras el formulario de cierre estaba abierto (nuevo saldo esperado: ${formatCentsWithHistoricalCurrency(totals.expectedBalanceCents, session.currency)}). Revisa la nueva diferencia calculada antes de confirmar el cierre.`,
          latestCashData: currentData,
          latestSession: session,
        }
      }

      const { differenceAmountCents, differenceKind } =
        calculateClosingDifference(
          totals.expectedBalanceCents,
          countedAmountCents,
        )

      const cleanClosingNote = closingNote?.trim() ?? ''
      if (differenceAmountCents !== 0 && cleanClosingNote.length < 3) {
        return {
          ok: false,
          errorCode: 'DIFFERENCE_NOTE_REQUIRED',
          error:
            'Existe una diferencia entre el efectivo contado y el saldo esperado. Es obligatorio ingresar una observación que explique el motivo del sobrante o faltante.',
          latestCashData: currentData,
          latestSession: session,
        }
      }

      if (simulateStorageError) {
        return {
          ok: false,
          errorCode: 'STORAGE_ERROR',
          error:
            'Fallo simulado de almacenamiento: no se pudo guardar el cierre de caja. La sesión permanece abierta.',
        }
      }

      const now = new Date().toISOString()

      const closedSession: CashSession = {
        ...session,
        status: 'closed',
        closedBy: operatorName.trim() || 'Operador de Demostración',
        closedAt: now,
        expectedClosingAmountCents: totals.expectedBalanceCents,
        countedAmountCents,
        differenceAmountCents,
        differenceKind,
        closingNote: cleanClosingNote || null,
        version: session.version + 1,
      }

      const nextCashData: OrganizationCashData = {
        ...currentData,
        storageRevision: currentData.storageRevision + 1,
        sessions: currentData.sessions.map((s) =>
          s.id === session.id ? closedSession : s,
        ),
      }

      const saveResult = saveInternal(organizationId, nextCashData)
      if (!saveResult.ok) {
        return {
          ok: false,
          errorCode: 'STORAGE_ERROR',
          error: saveResult.error,
        }
      }

      return {
        ok: true,
        cashData: nextCashData,
        session: closedSession,
        movement: null,
        updatedAt: saveResult.updatedAt,
      }
    },
  }
}

export const defaultCashRepository = createLocalCashRepository()

