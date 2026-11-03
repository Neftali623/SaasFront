import type { CurrencyCode } from '../../../types'

/**
 * Clasificación de movimientos de efectivo en caja:
 * - `opening_float`: Registro de apertura (informativo en bitácora; el fondo inicial se contabiliza una sola vez).
 * - `manual_in`: Entrada manual de efectivo (ej. aportación o reposición de cambio; no es una venta).
 * - `manual_out`: Retiro manual de efectivo (ej. retiro a resguardo o propietario; no crea un gasto contable).
 * - `cash_sale` / `cash_refund`: Reservados para la futura integración con Punto de Venta y Ventas.
 */
export type CashMovementType =
  | 'opening_float'
  | 'manual_in'
  | 'manual_out'
  | 'cash_sale'
  | 'cash_refund'
  | 'expense_out'
  | 'expense_cancel_in'

export type CashMovementDirection = 'in' | 'out'

export type CashSessionStatus = 'open' | 'closed'

export type CashDifferenceKind = 'exact' | 'surplus' | 'shortage'

/**
 * Punto físico de cobro (Caja) asignado a una sucursal de la organización.
 */
export interface CashRegister {
  id: string
  organizationId: string
  branchId: string
  branchName: string
  name: string
  code: string
}

/**
 * Sesión (turno) de caja abierta o cerrada sobre una caja física.
 * - Todos los importes se almacenan de forma exacta en centavos enteros (`*Cents`)
 *   y en unidades decimales equivalentes para facilitar lectura sin errores de coma flotante.
 * - `currency`: Moneda fijada al momento de abrir la sesión. Un cambio posterior en las
 *   preferencias del negocio no convierte ni reetiqueta esta sesión ni sus movimientos.
 * - `version`: Entero incremental que cambia con cada movimiento para detectar
 *   actualizaciones ocurridas mientras el formulario de cierre o retiro está abierto.
 */
export interface CashSession {
  id: string
  organizationId: string
  branchId: string
  branchName: string
  registerId: string
  registerName: string
  status: CashSessionStatus
  currency: CurrencyCode
  openedBy: string
  openedAt: string
  openingAmountCents: number
  openingNote: string | null
  closedBy: string | null
  closedAt: string | null
  expectedClosingAmountCents: number | null
  countedAmountCents: number | null
  differenceAmountCents: number | null
  differenceKind: CashDifferenceKind | null
  closingNote: string | null
  version: number
  sequence: number
  operationId: string
}

/**
 * Movimiento inmutable registrado dentro de una sesión de caja.
 */
export interface CashMovement {
  id: string
  organizationId: string
  branchId: string
  registerId: string
  sessionId: string
  type: CashMovementType
  direction: CashMovementDirection
  amountCents: number
  balanceAfterCents: number
  currency: CurrencyCode
  reason: string
  reference: string | null
  isCompensatory: boolean
  compensatedMovementId: string | null
  operatorName: string
  createdAt: string
  sequence: number
  operationId: string
}

/**
 * Totales calculados dinámicamente desde los registros de una sesión de caja.
 * Fórmula:
 * `expectedBalanceCents = openingAmountCents + cashSalesCents - cashRefundsCents + manualInCents - manualOutCents`
 */
export interface CashSessionComputedTotals {
  openingAmountCents: number
  cashSalesCents: number
  cashSalesCount: number
  cashRefundsCents: number
  cashRefundsCount: number
  manualInCents: number
  manualOutCents: number
  manualInCount: number
  manualOutCount: number
  expenseOutCents: number
  expenseOutCount: number
  expenseCancelInCents: number
  expenseCancelInCount: number
  expectedBalanceCents: number
  movementsCount: number
}

export interface OrganizationCashData {
  organizationId: string
  branchId: string
  branchName: string
  storageRevision: number
  lastSequence: number
  register: CashRegister
  sessions: CashSession[]
  movements: CashMovement[]
}

export type SessionMovementPeriodFilter = 'all' | 'last_hour' | 'last_4_hours' | 'today'

export interface SessionMovementsFilters {
  typeFilter:
    | 'all'
    | 'opening_float'
    | 'cash_sale'
    | 'cash_refund'
    | 'manual_in'
    | 'manual_out'
    | 'expense_out'
    | 'expense_cancel_in'
    | 'compensatory'
  periodFilter: SessionMovementPeriodFilter
}

export type SessionsHistoryPeriodFilter = 'all' | 'today' | 'last_7_days' | 'last_30_days'

export interface SessionsHistoryFilters {
  statusFilter: 'all' | CashSessionStatus
  periodFilter: SessionsHistoryPeriodFilter
}

