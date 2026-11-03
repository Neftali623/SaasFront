import { defaultCashRepository } from '../../cash/services/cashRepository'
import type { CashMovement, OrganizationCashData } from '../../cash/types'
import {
  calculateSessionComputedTotals,
  formatCentsWithHistoricalCurrency,
} from '../../cash/utils/moneyUtils'
import type {
  CancelExpensePayload,
  CreateExpensePayload,
  ExpenseCategory,
  ExpenseRecord,
  OrganizationExpensesData,
} from '../types'

export const EXPENSES_STORAGE_SCHEMA_VERSION = 1

export function getOrganizationExpensesStorageKey(
  organizationId: string,
  branchId: string,
): string {
  return `nedaxoli_expenses_data_v1_${organizationId}_${branchId}`
}

export function generateExpenseId(prefix = 'exp'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function getDefaultExpenseCategories(organizationId: string): ExpenseCategory[] {
  const now = '2026-11-01T00:00:00.000Z'
  return [
    {
      id: `cat-${organizationId}-servicios`,
      organizationId,
      name: 'Servicios',
      isActive: true,
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `cat-${organizationId}-renta`,
      organizationId,
      name: 'Renta',
      isActive: true,
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `cat-${organizationId}-transporte`,
      organizationId,
      name: 'Transporte',
      isActive: true,
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `cat-${organizationId}-material`,
      organizationId,
      name: 'Material de oficina',
      isActive: true,
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `cat-${organizationId}-otros`,
      organizationId,
      name: 'Otros',
      isActive: true,
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    },
  ]
}

export function getDefaultExpensesData(
  organizationId: string,
  branchId: string,
): OrganizationExpensesData {
  const categories = getDefaultExpenseCategories(organizationId)
  const isLuna = organizationId.includes('luna')

  const expenses: ExpenseRecord[] = isLuna
    ? [
        {
          id: `exp-${organizationId}-001`,
          folio: 'GAS-0001',
          organizationId,
          branchId,
          branchName: 'Sucursal Matriz Centro',
          categoryId: categories[0].id, // Servicios
          categoryName: 'Servicios',
          concept: 'Pago bimestral de energía eléctrica CFE (mostrador)',
          amountCents: 85000, // $850.00
          currency: 'MXN',
          paymentMethod: 'transfer',
          expenseDate: '2026-11-01',
          createdAt: '2026-11-01T10:30:00.000Z',
          registeredBy: 'Operador de Demostración',
          externalReference: 'SPEI-CFE-982189',
          attachment: null,
          cashSessionId: null,
          cashMovementId: null,
          status: 'active',
          cancellation: null,
          operationId: `init-op-${organizationId}-001`,
        },
        {
          id: `exp-${organizationId}-002`,
          folio: 'GAS-0002',
          organizationId,
          branchId,
          branchName: 'Sucursal Matriz Centro',
          categoryId: categories[3].id, // Material de oficina
          categoryName: 'Material de oficina',
          concept: 'Cinta canela, marcadores y etiquetas para mostrador',
          amountCents: 12000, // $120.00
          currency: 'MXN',
          paymentMethod: 'cash',
          expenseDate: '2026-11-02',
          createdAt: '2026-11-02T12:00:00.000Z',
          registeredBy: 'Operador de Demostración',
          externalReference: null,
          attachment: null,
          cashSessionId: 'sess-luna-001',
          cashMovementId: 'mov-exp-luna-002',
          status: 'active',
          cancellation: null,
          operationId: `init-op-${organizationId}-002`,
        },
      ]
    : [
        {
          id: `exp-${organizationId}-001`,
          folio: 'GAS-0001',
          organizationId,
          branchId,
          branchName: 'Sucursal Alameda',
          categoryId: categories[0].id, // Servicios
          categoryName: 'Servicios',
          concept: 'Mantenimiento preventivo de molino de café espresso',
          amountCents: 120000, // $1,200.00
          currency: 'MXN',
          paymentMethod: 'card',
          expenseDate: '2026-11-01',
          createdAt: '2026-11-01T15:00:00.000Z',
          registeredBy: 'Operador de Demostración',
          externalReference: 'VOUCHER-T0912',
          attachment: null,
          cashSessionId: null,
          cashMovementId: null,
          status: 'active',
          cancellation: null,
          operationId: `init-op-${organizationId}-001`,
        },
        {
          id: `exp-${organizationId}-002`,
          folio: 'GAS-0002',
          organizationId,
          branchId,
          branchName: 'Sucursal Alameda',
          categoryId: categories[3].id, // Material de oficina
          categoryName: 'Material de oficina',
          concept: 'Compra de filtros de papel para cafetera V60 y servilletas',
          amountCents: 34000, // $340.00
          currency: 'MXN',
          paymentMethod: 'cash',
          expenseDate: '2026-11-02',
          createdAt: '2026-11-02T16:30:00.000Z',
          registeredBy: 'Operador de Demostración',
          externalReference: null,
          attachment: null,
          cashSessionId: 'sess-faro-001',
          cashMovementId: 'mov-exp-faro-002',
          status: 'active',
          cancellation: null,
          operationId: `init-op-${organizationId}-002`,
        },
      ]

  return {
    organizationId,
    branchId,
    categories,
    expenses,
    lastSequence: 2,
    storageRevision: 1,
  }
}

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem?(key: string): void
}

function getBrowserLocalStorage(): StorageLike | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage
  }
  return null
}

export class ExpensesRepository {
  private storage: StorageLike | null

  constructor(storage: StorageLike | null = getBrowserLocalStorage()) {
    this.storage = storage
  }

  load(organizationId: string, branchId: string): OrganizationExpensesData {
    if (!this.storage) {
      return getDefaultExpensesData(organizationId, branchId)
    }

    const key = getOrganizationExpensesStorageKey(organizationId, branchId)
    try {
      const raw = this.storage.getItem(key)
      if (!raw) {
        const seed = getDefaultExpensesData(organizationId, branchId)
        this.save(seed)
        return seed
      }
      const parsed = JSON.parse(raw) as Partial<OrganizationExpensesData>
      if (
        !parsed ||
        !Array.isArray(parsed.categories) ||
        !Array.isArray(parsed.expenses)
      ) {
        const fallback = getDefaultExpensesData(organizationId, branchId)
        this.save(fallback)
        return fallback
      }

      return {
        organizationId,
        branchId,
        categories: parsed.categories,
        expenses: parsed.expenses,
        lastSequence:
          typeof parsed.lastSequence === 'number'
            ? parsed.lastSequence
            : parsed.expenses.length,
        storageRevision:
          typeof parsed.storageRevision === 'number'
            ? parsed.storageRevision
            : 1,
      }
    } catch {
      return getDefaultExpensesData(organizationId, branchId)
    }
  }

  save(data: OrganizationExpensesData): { ok: true } | { ok: false; error: string } {
    if (!this.storage) {
      return { ok: true }
    }

    const key = getOrganizationExpensesStorageKey(
      data.organizationId,
      data.branchId,
    )
    try {
      const updatedData: OrganizationExpensesData = {
        ...data,
        storageRevision: (data.storageRevision || 0) + 1,
      }
      this.storage.setItem(key, JSON.stringify(updatedData))
      return { ok: true }
    } catch (err) {
      return {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : 'Error de cuota o persistencia en almacenamiento local.',
      }
    }
  }

  /**
   * Registra un gasto garantizando consistencia transaccional atómica con Caja si el método es efectivo.
   */
  createExpense(params: {
    organizationId: string
    branchId: string
    branchName: string
    payload: CreateExpensePayload
  }):
    | { ok: true; expense: ExpenseRecord; updatedCashData?: OrganizationCashData }
    | { ok: false; error: string } {
    const { organizationId, branchId, branchName, payload } = params
    const expensesData = this.load(organizationId, branchId)

    // Protección de idempotencia
    const duplicate = expensesData.expenses.find(
      (e) => e.operationId === payload.operationId,
    )
    if (duplicate) {
      return { ok: true, expense: duplicate }
    }

    // Validar categoría
    const category = expensesData.categories.find(
      (c) => c.id === payload.categoryId,
    )
    if (!category) {
      return { ok: false, error: 'La categoría seleccionada no existe.' }
    }
    if (!category.isActive) {
      return {
        ok: false,
        error: 'La categoría seleccionada está inactiva y no admite nuevos gastos.',
      }
    }

    let cashSessionId: string | null = null
    let cashMovementId: string | null = null
    let nextCashData: OrganizationCashData | undefined

    // Integración atómica con Sesión de Caja si es Efectivo
    if (payload.paymentMethod === 'cash') {
      const cashOutcome = defaultCashRepository.load(organizationId, branchId)
      const cashData = cashOutcome.cashData
      const openSession = cashData.sessions.find((s) => s.status === 'open')

      if (!openSession) {
        return {
          ok: false,
          error:
            'No hay ninguna sesión de caja abierta en esta sucursal. Para registrar un gasto en efectivo es obligatorio contar con un turno de caja abierto.',
        }
      }

      if (openSession.currency !== payload.currency) {
        return {
          ok: false,
          error: `La moneda del gasto (${payload.currency}) no coincide con la moneda de la sesión de caja activa (${openSession.currency}).`,
        }
      }

      const sessionTotals = calculateSessionComputedTotals(
        openSession,
        cashData.movements,
      )

      if (sessionTotals.expectedBalanceCents < payload.amountCents) {
        return {
          ok: false,
          error: `Saldo insuficiente en la sesión de caja activa. Disponible: ${formatCentsWithHistoricalCurrency(
            sessionTotals.expectedBalanceCents,
            openSession.currency,
          )}, requerido: ${formatCentsWithHistoricalCurrency(
            payload.amountCents,
            payload.currency,
          )}.`,
        }
      }

      cashSessionId = openSession.id
      cashMovementId = `mov-${generateExpenseId('csh')}`
      const nextSequence = (cashData.lastSequence || 0) + 1
      const nowIso = new Date().toISOString()

      const newMovement: CashMovement = {
        id: cashMovementId,
        organizationId,
        branchId,
        registerId: openSession.registerId,
        sessionId: openSession.id,
        type: 'expense_out',
        direction: 'out',
        amountCents: payload.amountCents,
        balanceAfterCents: sessionTotals.expectedBalanceCents - payload.amountCents,
        currency: payload.currency,
        reason: `Gasto operativo: ${payload.concept.trim()} (${category.name})`,
        reference: `FOL-GAS-${(expensesData.lastSequence + 1).toString().padStart(4, '0')}`,
        isCompensatory: false,
        compensatedMovementId: null,
        operatorName: payload.operatorName,
        createdAt: nowIso,
        sequence: nextSequence,
        operationId: `cash-${payload.operationId}`,
      }

      const updatedSessions = cashData.sessions.map((s) =>
        s.id === openSession.id ? { ...s, version: s.version + 1 } : s,
      )

      nextCashData = {
        ...cashData,
        lastSequence: nextSequence,
        sessions: updatedSessions,
        movements: [newMovement, ...cashData.movements],
        storageRevision: cashData.storageRevision + 1,
      }
    }

    const nextFolioSequence = expensesData.lastSequence + 1
    const folio = `GAS-${nextFolioSequence.toString().padStart(4, '0')}`
    const expenseId = generateExpenseId('exp')
    const nowIso = new Date().toISOString()

    const newExpense: ExpenseRecord = {
      id: expenseId,
      folio,
      organizationId,
      branchId,
      branchName,
      categoryId: category.id,
      categoryName: category.name,
      concept: payload.concept.trim(),
      amountCents: Math.round(payload.amountCents),
      currency: payload.currency,
      paymentMethod: payload.paymentMethod,
      expenseDate: payload.expenseDate,
      createdAt: nowIso,
      registeredBy: payload.operatorName,
      externalReference: payload.externalReference?.trim() || null,
      attachment: payload.attachment || null,
      cashSessionId,
      cashMovementId,
      status: 'active',
      cancellation: null,
      operationId: payload.operationId,
    }

    // Persistencia atómica de Gasto y Caja
    if (nextCashData) {
      const cashSaveResult = defaultCashRepository.save(
        organizationId,
        nextCashData,
      )
      if (!cashSaveResult.ok) {
        return {
          ok: false,
          error: `Error al persistir movimiento de caja: ${cashSaveResult.error}`,
        }
      }
    }

    const nextExpensesData: OrganizationExpensesData = {
      ...expensesData,
      expenses: [newExpense, ...expensesData.expenses],
      lastSequence: nextFolioSequence,
      storageRevision: expensesData.storageRevision + 1,
    }

    const expenseSaveResult = this.save(nextExpensesData)
    if (!expenseSaveResult.ok) {
      // Revertir caja si falló gastos
      if (nextCashData) {
        const cashData = defaultCashRepository.load(
          organizationId,
          branchId,
        ).cashData
        defaultCashRepository.save(organizationId, cashData)
      }
      return {
        ok: false,
        error: `Error al persistir registro de gasto: ${expenseSaveResult.error}`,
      }
    }

    return { ok: true, expense: newExpense, updatedCashData: nextCashData }
  }

  /**
   * Anula un gasto de forma trazable e inmutable.
   * Si fue en efectivo, exige que la sesión de caja original continúe abierta para reintegrar el saldo.
   */
  cancelExpense(params: {
    organizationId: string
    branchId: string
    payload: CancelExpensePayload
  }):
    | { ok: true; expense: ExpenseRecord; updatedCashData?: OrganizationCashData }
    | { ok: false; error: string } {
    const { organizationId, branchId, payload } = params
    const expensesData = this.load(organizationId, branchId)

    const expense = expensesData.expenses.find((e) => e.id === payload.expenseId)
    if (!expense) {
      return { ok: false, error: 'El gasto especificado no existe.' }
    }

    if (expense.status === 'cancelled') {
      return {
        ok: false,
        error: `El gasto ${expense.folio} ya fue anulado previamente. No es posible anularlo dos veces.`,
      }
    }

    let nextCashData: OrganizationCashData | undefined
    let cancelCashMovementId: string | null = null

    // Si fue en efectivo, verificar que la sesión de caja original siga abierta
    if (expense.paymentMethod === 'cash') {
      if (!payload.cashReturnedConfirmed) {
        return {
          ok: false,
          error:
            'Es necesario confirmar expresamente que el efectivo devuelto fue reingresado a la caja física.',
        }
      }

      const cashOutcome = defaultCashRepository.load(organizationId, branchId)
      const cashData = cashOutcome.cashData
      const targetSession = cashData.sessions.find(
        (s) => s.id === expense.cashSessionId,
      )

      if (!targetSession) {
        return {
          ok: false,
          error:
            'No se encontró la sesión de caja original vinculada a este desembolso.',
        }
      }

      if (targetSession.status !== 'open') {
        return {
          ok: false,
          error:
            'La sesión de caja original en la que se realizó este gasto ya fue cerrada. Por control de arqueo y corte histórico, no es posible reintegrar automáticamente efectivo a un turno anterior cerrado en esta fase.',
        }
      }

      const sessionTotals = calculateSessionComputedTotals(
        targetSession,
        cashData.movements,
      )

      cancelCashMovementId = `mov-can-${generateExpenseId('csh')}`
      const nextSequence = (cashData.lastSequence || 0) + 1
      const nowIso = new Date().toISOString()

      const compensatoryMovement: CashMovement = {
        id: cancelCashMovementId,
        organizationId,
        branchId,
        registerId: targetSession.registerId,
        sessionId: targetSession.id,
        type: 'expense_cancel_in',
        direction: 'in',
        amountCents: expense.amountCents,
        balanceAfterCents: sessionTotals.expectedBalanceCents + expense.amountCents,
        currency: expense.currency,
        reason: `Reintegro por anulación de gasto ${expense.folio}: "${payload.reason.trim()}"`,
        reference: expense.folio,
        isCompensatory: true,
        compensatedMovementId: expense.cashMovementId,
        operatorName: payload.operatorName,
        createdAt: nowIso,
        sequence: nextSequence,
        operationId: `cancel-cash-${payload.operationId}`,
      }

      const updatedSessions = cashData.sessions.map((s) =>
        s.id === targetSession.id ? { ...s, version: s.version + 1 } : s,
      )

      nextCashData = {
        ...cashData,
        lastSequence: nextSequence,
        sessions: updatedSessions,
        movements: [compensatoryMovement, ...cashData.movements],
        storageRevision: cashData.storageRevision + 1,
      }
    }

    const nowIso = new Date().toISOString()
    const updatedExpense: ExpenseRecord = {
      ...expense,
      status: 'cancelled',
      cancellation: {
        cancelledAt: nowIso,
        cancelledBy: payload.operatorName,
        reason: payload.reason.trim(),
        cashMovementId: cancelCashMovementId,
      },
    }

    if (nextCashData) {
      const cashSaveResult = defaultCashRepository.save(
        organizationId,
        nextCashData,
      )
      if (!cashSaveResult.ok) {
        return {
          ok: false,
          error: `Error al persistir movimiento de caja: ${cashSaveResult.error}`,
        }
      }
    }

    const updatedExpenses = expensesData.expenses.map((e) =>
      e.id === expense.id ? updatedExpense : e,
    )

    const nextExpensesData: OrganizationExpensesData = {
      ...expensesData,
      expenses: updatedExpenses,
      storageRevision: expensesData.storageRevision + 1,
    }

    const expenseSaveResult = this.save(nextExpensesData)
    if (!expenseSaveResult.ok) {
      return {
        ok: false,
        error: `Error al persistir anulación de gasto: ${expenseSaveResult.error}`,
      }
    }

    return { ok: true, expense: updatedExpense, updatedCashData: nextCashData }
  }

  createCategory(
    organizationId: string,
    branchId: string,
    name: string,
  ): { ok: true; category: ExpenseCategory } | { ok: false; error: string } {
    const data = this.load(organizationId, branchId)
    const clean = name.trim()
    const normalized = clean.toLowerCase()

    if (
      data.categories.some((c) => c.name.trim().toLowerCase() === normalized)
    ) {
      return {
        ok: false,
        error: `Ya existe una categoría llamada "${clean}" en esta organización.`,
      }
    }

    const now = new Date().toISOString()
    const newCategory: ExpenseCategory = {
      id: `cat-${organizationId}-${Date.now().toString(36)}`,
      organizationId,
      name: clean,
      isActive: true,
      isDefault: false,
      createdAt: now,
      updatedAt: now,
    }

    const updatedData: OrganizationExpensesData = {
      ...data,
      categories: [...data.categories, newCategory],
      storageRevision: data.storageRevision + 1,
    }

    const saveResult = this.save(updatedData)
    if (!saveResult.ok) {
      return { ok: false, error: saveResult.error }
    }

    return { ok: true, category: newCategory }
  }

  updateCategory(
    organizationId: string,
    branchId: string,
    categoryId: string,
    nextName: string,
  ): { ok: true; category: ExpenseCategory } | { ok: false; error: string } {
    const data = this.load(organizationId, branchId)
    const clean = nextName.trim()
    const normalized = clean.toLowerCase()

    const category = data.categories.find((c) => c.id === categoryId)
    if (!category) {
      return { ok: false, error: 'La categoría especificada no existe.' }
    }

    if (
      data.categories.some(
        (c) =>
          c.name.trim().toLowerCase() === normalized && c.id !== categoryId,
      )
    ) {
      return {
        ok: false,
        error: `Ya existe otra categoría llamada "${clean}".`,
      }
    }

    const updatedCategory: ExpenseCategory = {
      ...category,
      name: clean,
      updatedAt: new Date().toISOString(),
    }

    // Actualiza el nombre en las categorías
    const updatedCategories = data.categories.map((c) =>
      c.id === categoryId ? updatedCategory : c,
    )

    // Actualiza denormalizado en los gastos
    const updatedExpenses = data.expenses.map((e) =>
      e.categoryId === categoryId ? { ...e, categoryName: clean } : e,
    )

    const updatedData: OrganizationExpensesData = {
      ...data,
      categories: updatedCategories,
      expenses: updatedExpenses,
      storageRevision: data.storageRevision + 1,
    }

    const saveResult = this.save(updatedData)
    if (!saveResult.ok) {
      return { ok: false, error: saveResult.error }
    }

    return { ok: true, category: updatedCategory }
  }

  toggleCategoryActive(
    organizationId: string,
    branchId: string,
    categoryId: string,
  ): { ok: true; category: ExpenseCategory } | { ok: false; error: string } {
    const data = this.load(organizationId, branchId)
    const category = data.categories.find((c) => c.id === categoryId)
    if (!category) {
      return { ok: false, error: 'La categoría no existe.' }
    }

    const nextState = !category.isActive
    const updatedCategory: ExpenseCategory = {
      ...category,
      isActive: nextState,
      updatedAt: new Date().toISOString(),
    }

    const updatedCategories = data.categories.map((c) =>
      c.id === categoryId ? updatedCategory : c,
    )

    const updatedData: OrganizationExpensesData = {
      ...data,
      categories: updatedCategories,
      storageRevision: data.storageRevision + 1,
    }

    const saveResult = this.save(updatedData)
    if (!saveResult.ok) {
      return { ok: false, error: saveResult.error }
    }

    return { ok: true, category: updatedCategory }
  }
}

export const defaultExpensesRepository = new ExpensesRepository()

