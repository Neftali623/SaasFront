import type {
  CashRegisterStatus,
  CurrencyCode,
  DateFormatOption,
  TimezoneOption,
} from '../../../types'
import { formatDateTimeInOrganizationTimezone } from '../../inventory/utils/quantityUtils'
import { parseStrictMonetaryInput } from '../../products/utils/validation'
import { formatAmountByCurrency } from '../../settings/formatters'
import type {
  CashDifferenceKind,
  CashMovement,
  CashMovementType,
  CashSession,
  CashSessionComputedTotals,
  OrganizationCashData,
  SessionMovementPeriodFilter,
  SessionsHistoryPeriodFilter,
} from '../types'

export const CENTS_PER_UNIT = 100

/**
 * Convierte un monto decimal validado (máximo 2 decimales) a centavos enteros exactos.
 */
export function amountToCents(amount: number): number {
  return Math.round(amount * CENTS_PER_UNIT)
}

/**
 * Convierte centavos enteros a su representación decimal exacta de 2 decimales.
 */
export function centsToAmount(cents: number): number {
  return Math.round(cents) / CENTS_PER_UNIT
}

export type CashCentsParseResult =
  | {
      ok: true
      cents: number
    }
  | {
      ok: false
      error: string
    }

/**
 * Valida y convierte una entrada de texto monetaria a centavos enteros exactos.
 * - Reutiliza `parseStrictMonetaryInput` para rechazar negativos, valores no finitos
 *   y entradas con más de 2 decimales sin redondear silenciosamente.
 * - Si `allowZero` es false, exige un importe estrictamente mayor que cero (`cents > 0`).
 */
export function parseStrictCashInputToCents(
  rawInput: string,
  fieldLabel: string,
  allowZero: boolean,
): CashCentsParseResult {
  const result = parseStrictMonetaryInput(rawInput, fieldLabel, false)
  if (!result.ok || result.value === null) {
    return {
      ok: false,
      error: result.ok ? `El ${fieldLabel} es obligatorio.` : result.error,
    }
  }

  const cents = amountToCents(result.value)

  if (!allowZero && cents <= 0) {
    return {
      ok: false,
      error: `El ${fieldLabel} debe ser mayor que cero (0.00).`,
    }
  }

  return {
    ok: true,
    cents,
  }
}

/**
 * Formatea un importe en centavos usando la moneda histórica fija de la sesión o movimiento.
 * IMPORTANTE: Ignora cualquier cambio posterior en las preferencias del negocio para
 * preservar la integridad histórica de la sesión.
 */
export function formatCentsWithHistoricalCurrency(
  cents: number,
  historicalCurrency: CurrencyCode,
): string {
  const amount = centsToAmount(cents)
  return formatAmountByCurrency(amount, historicalCurrency)
}

export function formatSignedCentsWithHistoricalCurrency(
  signedCents: number,
  historicalCurrency: CurrencyCode,
): string {
  if (signedCents === 0) {
    return formatCentsWithHistoricalCurrency(0, historicalCurrency)
  }
  const absFormatted = formatCentsWithHistoricalCurrency(
    Math.abs(signedCents),
    historicalCurrency,
  )
  return signedCents > 0 ? `+${absFormatted}` : `-${absFormatted}`
}

/**
 * Calcula el saldo esperado y totales de una sesión a partir de sus registros en centavos enteros:
 * `Saldo esperado = Fondo inicial + Ventas en efectivo - Reembolsos en efectivo + Entradas manuales - Retiros manuales`
 * - El fondo inicial se toma una sola vez (`session.openingAmountCents`); el movimiento
 *   informativo `opening_float` nunca se duplica sobre el saldo.
 */
export function calculateSessionComputedTotals(
  session: CashSession,
  allMovements: CashMovement[],
): CashSessionComputedTotals {
  const openingAmountCents = Math.round(session.openingAmountCents)
  let cashSalesCents = 0
  let cashSalesCount = 0
  let cashRefundsCents = 0
  let cashRefundsCount = 0
  let manualInCents = 0
  let manualOutCents = 0
  let manualInCount = 0
  let manualOutCount = 0
  let expenseOutCents = 0
  let expenseOutCount = 0
  let expenseCancelInCents = 0
  let expenseCancelInCount = 0
  let movementsCount = 0

  for (const mov of allMovements) {
    if (mov.sessionId !== session.id) {
      continue
    }
    movementsCount += 1

    if (mov.type === 'cash_sale') {
      cashSalesCents += Math.round(mov.amountCents)
      cashSalesCount += 1
    } else if (mov.type === 'cash_refund') {
      cashRefundsCents += Math.round(mov.amountCents)
      cashRefundsCount += 1
    } else if (mov.type === 'manual_in') {
      manualInCents += Math.round(mov.amountCents)
      manualInCount += 1
    } else if (mov.type === 'manual_out') {
      manualOutCents += Math.round(mov.amountCents)
      manualOutCount += 1
    } else if (mov.type === 'expense_out') {
      expenseOutCents += Math.round(mov.amountCents)
      expenseOutCount += 1
    } else if (mov.type === 'expense_cancel_in') {
      expenseCancelInCents += Math.round(mov.amountCents)
      expenseCancelInCount += 1
    }
  }

  const expectedBalanceCents =
    openingAmountCents +
    cashSalesCents -
    cashRefundsCents +
    manualInCents -
    manualOutCents -
    expenseOutCents +
    expenseCancelInCents

  return {
    openingAmountCents,
    cashSalesCents,
    cashSalesCount,
    cashRefundsCents,
    cashRefundsCount,
    manualInCents,
    manualOutCents,
    manualInCount,
    manualOutCount,
    expenseOutCents,
    expenseOutCount,
    expenseCancelInCents,
    expenseCancelInCount,
    expectedBalanceCents,
    movementsCount,
  }
}

/**
 * Calcula la diferencia de cierre mediante aritmética entera en centavos:
 * `Diferencia = Contado - Esperado`
 * - Cero (0): `exact` ("Sin diferencia")
 * - Positiva (> 0): `surplus` ("Sobrante")
 * - Negativa (< 0): `shortage` ("Faltante")
 */
export function calculateClosingDifference(
  expectedBalanceCents: number,
  countedAmountCents: number,
): {
  differenceAmountCents: number
  differenceKind: CashDifferenceKind
} {
  const differenceAmountCents =
    Math.round(countedAmountCents) - Math.round(expectedBalanceCents)

  if (differenceAmountCents === 0) {
    return {
      differenceAmountCents: 0,
      differenceKind: 'exact',
    }
  }

  if (differenceAmountCents > 0) {
    return {
      differenceAmountCents,
      differenceKind: 'surplus',
    }
  }

  return {
    differenceAmountCents,
    differenceKind: 'shortage',
  }
}

export function getDifferencePresentation(
  differenceCents: number,
  kind: CashDifferenceKind,
  currency: CurrencyCode,
): {
  label: string
  shortTag: string
  formattedDifference: string
  badgeVariant: 'success' | 'warning' | 'danger'
} {
  const formattedDifference = formatSignedCentsWithHistoricalCurrency(
    differenceCents,
    currency,
  )

  switch (kind) {
    case 'exact':
      return {
        label: `Sin diferencia (${formattedDifference})`,
        shortTag: 'Sin diferencia (Cuadre exacto)',
        formattedDifference,
        badgeVariant: 'success',
      }
    case 'surplus':
      return {
        label: `Sobrante (${formattedDifference})`,
        shortTag: 'Sobrante (+)',
        formattedDifference,
        badgeVariant: 'warning',
      }
    case 'shortage':
      return {
        label: `Faltante (${formattedDifference})`,
        shortTag: 'Faltante (-)',
        formattedDifference,
        badgeVariant: 'danger',
      }
  }
}

export function getCashMovementTypePresentation(
  type: CashMovementType,
  isCompensatory: boolean,
): {
  label: string
  directionLabel: string
  badgeVariant: 'brand' | 'success' | 'warning' | 'neutral'
} {
  if (isCompensatory) {
    return {
      label:
        type === 'manual_in'
          ? 'Entrada compensatoria'
          : 'Retiro compensatorio',
      directionLabel:
        type === 'manual_in' ? 'Entrada (+)' : 'Salida (-)',
      badgeVariant: 'neutral',
    }
  }

  switch (type) {
    case 'opening_float':
      return {
        label: 'Apertura de caja (Fondo inicial)',
        directionLabel: 'Fondo inicial',
        badgeVariant: 'brand',
      }
    case 'manual_in':
      return {
        label: 'Entrada manual de efectivo',
        directionLabel: 'Entrada (+)',
        badgeVariant: 'success',
      }
    case 'manual_out':
      return {
        label: 'Retiro manual de efectivo',
        directionLabel: 'Salida (-)',
        badgeVariant: 'warning',
      }
    case 'cash_sale':
      return {
        label: 'Cobro de venta en efectivo',
        directionLabel: 'Entrada (+)',
        badgeVariant: 'success',
      }
    case 'cash_refund':
      return {
        label: 'Devolución en efectivo',
        directionLabel: 'Salida (-)',
        badgeVariant: 'warning',
      }
    case 'expense_out':
      return {
        label: 'Gasto operativo en efectivo',
        directionLabel: 'Salida (-)',
        badgeVariant: 'warning',
      }
    case 'expense_cancel_in':
      return {
        label: 'Anulación de gasto (Efectivo devuelto)',
        directionLabel: 'Entrada (+)',
        badgeVariant: 'neutral',
      }
  }
}

/**
 * Ordena movimientos de caja de manera determinista (más reciente primero):
 * `(createdAt DESC, sequence DESC, id DESC)`
 */
export function sortCashMovementsDeterministically(
  movements: CashMovement[],
): CashMovement[] {
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
 * Ordena sesiones de caja de manera determinista (abierta primero, luego por apertura DESC y secuencia DESC).
 */
export function sortCashSessionsDeterministically(
  sessions: CashSession[],
): CashSession[] {
  return [...sessions].sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === 'open' ? -1 : 1
    }
    const timeA = Date.parse(a.openedAt)
    const timeB = Date.parse(b.openedAt)
    if (Number.isFinite(timeA) && Number.isFinite(timeB) && timeA !== timeB) {
      return timeB - timeA
    }
    if (a.sequence !== b.sequence) {
      return b.sequence - a.sequence
    }
    return b.id.localeCompare(a.id)
  })
}

export function isCashMovementWithinSessionPeriod(
  isoTimestamp: string,
  period: SessionMovementPeriodFilter,
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
  const maxHours = period === 'last_hour' ? 1 : 4
  const maxMs = maxHours * 60 * 60 * 1000
  return diffMs <= maxMs && diffMs >= -60 * 60 * 1000
}

export function isSessionWithinHistoryPeriod(
  isoTimestamp: string,
  period: SessionsHistoryPeriodFilter,
  timezone: TimezoneOption,
  referenceNow: Date = new Date(),
): boolean {
  if (period === 'all') {
    return true
  }

  const sessionDate = new Date(isoTimestamp)
  if (Number.isNaN(sessionDate.getTime())) {
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
      return formatter.format(sessionDate) === formatter.format(referenceNow)
    } catch {
      return isoTimestamp.slice(0, 10) === referenceNow.toISOString().slice(0, 10)
    }
  }

  const diffMs = referenceNow.getTime() - sessionDate.getTime()
  const maxDays = period === 'last_7_days' ? 7 : 30
  const maxMs = maxDays * 24 * 60 * 60 * 1000
  return diffMs <= maxMs && diffMs >= -24 * 60 * 60 * 1000
}

/**
 * Construye el estado de caja para el Resumen (Dashboard) a partir del
 * repositorio real de demostración de Caja, garantizando que Resumen y Caja
 * muestren exactamente el mismo estado, saldo esperado, fondo inicial y moneda.
 */
export function buildDashboardCashRegisterStatus(
  cashData: OrganizationCashData,
  timezone: TimezoneOption,
  dateFormat: DateFormatOption,
  fallbackCurrency: CurrencyCode,
): CashRegisterStatus {
  const openSession = cashData.sessions.find((s) => s.status === 'open')

  if (openSession) {
    const totals = calculateSessionComputedTotals(
      openSession,
      cashData.movements,
    )
    const openedFormatted = formatDateTimeInOrganizationTimezone(
      openSession.openedAt,
      timezone,
      dateFormat,
    )

    return {
      status: 'open',
      statusLabel: `Abierta · ${openSession.currency}`,
      shiftName: `${cashData.register.name}`,
      openedAt: openedFormatted.timeLabel,
      openingBalanceAmount: centsToAmount(totals.openingAmountCents),
      currentCashAmount: centsToAmount(totals.expectedBalanceCents),
      openingBalanceFormatted: formatCentsWithHistoricalCurrency(
        totals.openingAmountCents,
        openSession.currency,
      ),
      currentCashFormatted: formatCentsWithHistoricalCurrency(
        totals.expectedBalanceCents,
        openSession.currency,
      ),
      operatorName: openSession.openedBy,
    }
  }

  const sortedSessions = sortCashSessionsDeterministically(cashData.sessions)
  const lastClosed = sortedSessions.find((s) => s.status === 'closed')
  const displayCurrency = lastClosed?.currency ?? fallbackCurrency

  return {
    status: 'closed',
    statusLabel: 'Caja cerrada',
    shiftName: cashData.register.name,
    openedAt: 'Sin turno activo',
    openingBalanceAmount: 0,
    currentCashAmount: 0,
    openingBalanceFormatted: formatCentsWithHistoricalCurrency(
      0,
      displayCurrency,
    ),
    currentCashFormatted: formatCentsWithHistoricalCurrency(0, displayCurrency),
    operatorName: lastClosed?.closedBy ?? 'Sin turno abierto',
  }
}

