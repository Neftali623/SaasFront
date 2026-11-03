import type { CurrencyCode } from '../../../types'
import type { CashMovement, CashSession } from '../../cash/types'
import { calculateSessionComputedTotals } from '../../cash/utils/moneyUtils'
import type {
  ExpenseCategory,
  ExpensePaymentMethod,
  ExpenseRecord,
} from '../../expenses/types'
import type { PosPaymentMethod, SaleRecord, SaleStatus } from '../../pos/types'
import type { ProductUnit } from '../../products/types'
import type {
  CashReportSummary,
  CashSessionReportItem,
  ExpenseCategoryBreakdown,
  ExpenseMethodBreakdown,
  ExpensesReportSummary,
  ProductSoldItemReport,
  ProductsSoldSummary,
  ReportFilterParams,
  SalesReportMethodBreakdown,
  SalesReportStatusBreakdown,
  SalesReportSummary,
} from '../types'

/**
 * Obtiene el rango [inicio, fin] en formato YYYY-MM-DD para un período dado
 */
export function getPeriodDateRange(params: ReportFilterParams): {
  dateFrom: string
  dateTo: string
  label: string
} {
  const now = new Date()
  const toDateString = (d: Date) => d.toISOString().split('T')[0]

  switch (params.period) {
    case 'today': {
      const todayStr = toDateString(now)
      return { dateFrom: todayStr, dateTo: todayStr, label: 'Hoy' }
    }
    case 'yesterday': {
      const y = new Date(now)
      y.setDate(y.getDate() - 1)
      const yStr = toDateString(y)
      return { dateFrom: yStr, dateTo: yStr, label: 'Ayer' }
    }
    case 'this_week': {
      const start = new Date(now)
      const day = start.getDay()
      const diff = start.getDate() - day + (day === 0 ? -6 : 1) // Lunes
      start.setDate(diff)
      return {
        dateFrom: toDateString(start),
        dateTo: toDateString(now),
        label: 'Esta semana',
      }
    }
    case 'this_month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      return {
        dateFrom: toDateString(start),
        dateTo: toDateString(now),
        label: 'Este mes',
      }
    }
    case 'custom': {
      const from = params.dateFrom || '2000-01-01'
      const to = params.dateTo || toDateString(now)
      return {
        dateFrom: from,
        dateTo: to,
        label: `Personalizado (${from} al ${to})`,
      }
    }
    case 'all':
    default: {
      return {
        dateFrom: '2000-01-01',
        dateTo: toDateString(now),
        label: 'Todo el historial',
      }
    }
  }
}

/**
 * Comprueba si una fecha ISO o YYYY-MM-DD cae dentro del rango
 */
function isDateInRange(dateIsoOrYmd: string, dateFrom: string, dateTo: string): boolean {
  const ymd = dateIsoOrYmd.includes('T') ? dateIsoOrYmd.split('T')[0] : dateIsoOrYmd
  return ymd >= dateFrom && ymd <= dateTo
}

/**
 * Calcula el Reporte de Ventas Operativas
 */
export function calculateSalesReport(
  sales: SaleRecord[],
  filterParams: ReportFilterParams,
  currency: CurrencyCode,
): SalesReportSummary {
  const { dateFrom, dateTo } = getPeriodDateRange(filterParams)

  const filteredSales = sales.filter((s) =>
    isDateInRange(s.createdAt, dateFrom, dateTo),
  )

  let grossTotalCents = 0
  let refundedTotalCents = 0
  let netTotalCents = 0

  const methodMap = new Map<
    PosPaymentMethod,
    { count: number; gross: number; refunded: number; net: number }
  >([
    ['cash', { count: 0, gross: 0, refunded: 0, net: 0 }],
    ['card', { count: 0, gross: 0, refunded: 0, net: 0 }],
    ['transfer', { count: 0, gross: 0, refunded: 0, net: 0 }],
  ])

  const statusMap = new Map<SaleStatus, { count: number; net: number }>([
    ['completed', { count: 0, net: 0 }],
    ['partially_refunded', { count: 0, net: 0 }],
    ['fully_refunded', { count: 0, net: 0 }],
    ['cancelled', { count: 0, net: 0 }],
  ])

  for (const sale of filteredSales) {
    grossTotalCents += sale.totalCents
    refundedTotalCents += sale.refundedTotalCents
    netTotalCents += sale.netTotalCents

    // Agrupación por método
    const m = methodMap.get(sale.payment.method)
    if (m) {
      m.count += 1
      m.gross += sale.totalCents
      m.refunded += sale.refundedTotalCents
      m.net += sale.netTotalCents
    }

    // Agrupación por estado
    const st = statusMap.get(sale.status)
    if (st) {
      st.count += 1
      st.net += sale.netTotalCents
    }
  }

  const byPaymentMethod: SalesReportMethodBreakdown[] = [
    {
      method: 'cash',
      label: 'Efectivo en caja',
      salesCount: methodMap.get('cash')?.count ?? 0,
      grossCents: methodMap.get('cash')?.gross ?? 0,
      refundedCents: methodMap.get('cash')?.refunded ?? 0,
      netCents: methodMap.get('cash')?.net ?? 0,
    },
    {
      method: 'card',
      label: 'Tarjeta bancaria',
      salesCount: methodMap.get('card')?.count ?? 0,
      grossCents: methodMap.get('card')?.gross ?? 0,
      refundedCents: methodMap.get('card')?.refunded ?? 0,
      netCents: methodMap.get('card')?.net ?? 0,
    },
    {
      method: 'transfer',
      label: 'Transferencia electrónica',
      salesCount: methodMap.get('transfer')?.count ?? 0,
      grossCents: methodMap.get('transfer')?.gross ?? 0,
      refundedCents: methodMap.get('transfer')?.refunded ?? 0,
      netCents: methodMap.get('transfer')?.net ?? 0,
    },
  ]

  const statusLabels: Record<SaleStatus, string> = {
    completed: 'Completada sin devoluciones',
    partially_refunded: 'Con devoluciones parciales',
    fully_refunded: 'Totalmente reembolsada',
    cancelled: 'Cancelada',
  }

  const byStatus: SalesReportStatusBreakdown[] = (
    ['completed', 'partially_refunded', 'fully_refunded', 'cancelled'] as SaleStatus[]
  ).map((status) => ({
    status,
    label: statusLabels[status],
    count: statusMap.get(status)?.count ?? 0,
    netCents: statusMap.get(status)?.net ?? 0,
  }))

  return {
    period: filterParams.period,
    dateFrom,
    dateTo,
    currency,
    salesCount: filteredSales.length,
    grossTotalCents,
    refundedTotalCents,
    netTotalCents,
    byPaymentMethod,
    byStatus,
    sales: filteredSales,
  }
}

/**
 * Calcula el Reporte de Productos Vendidos y Devueltos.
 * REGLA ESTRICTA: Jamás suma cantidades de unidades incompatibles (pzas con kg).
 */
export function calculateProductsSoldReport(
  sales: SaleRecord[],
  filterParams: ReportFilterParams,
  currency: CurrencyCode,
): ProductsSoldSummary {
  const { dateFrom, dateTo } = getPeriodDateRange(filterParams)
  const filteredSales = sales.filter((s) =>
    isDateInRange(s.createdAt, dateFrom, dateTo),
  )

  const itemsMap = new Map<
    string,
    {
      productId: string
      productName: string
      sku: string
      unit: ProductUnit
      grossQuantity: number
      refundedQuantity: number
      grossAmountCents: number
      refundedAmountCents: number
    }
  >()

  for (const sale of filteredSales) {
    // Acumular ventas brutas por partida
    for (const line of sale.lines) {
      const key = `${line.productId}__${line.unit}`
      const existing = itemsMap.get(key)
      if (!existing) {
        itemsMap.set(key, {
          productId: line.productId,
          productName: line.productName,
          sku: line.sku,
          unit: line.unit,
          grossQuantity: line.quantity,
          refundedQuantity: 0,
          grossAmountCents: line.lineSubtotalCents,
          refundedAmountCents: 0,
        })
      } else {
        existing.grossQuantity += line.quantity
        existing.grossAmountCents += line.lineSubtotalCents
      }
    }

    // Acumular devoluciones registradas en la venta
    for (const ret of sale.returns) {
      for (const rLine of ret.lines) {
        const key = `${rLine.productId}__${rLine.unit}`
        const existing = itemsMap.get(key)
        if (existing) {
          existing.refundedQuantity += rLine.returnedQuantity
          existing.refundedAmountCents += rLine.refundCents
        } else {
          itemsMap.set(key, {
            productId: rLine.productId,
            productName: rLine.productName,
            sku: rLine.sku,
            unit: rLine.unit,
            grossQuantity: 0,
            refundedQuantity: rLine.returnedQuantity,
            grossAmountCents: 0,
            refundedAmountCents: rLine.refundCents,
          })
        }
      }
    }
  }

  const items: ProductSoldItemReport[] = Array.from(itemsMap.values())
    .map((item) => {
      const netQuantity = Math.max(0, item.grossQuantity - item.refundedQuantity)
      const netAmountCents = Math.max(
        0,
        item.grossAmountCents - item.refundedAmountCents,
      )
      return {
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        unit: item.unit,
        grossQuantity: item.grossQuantity,
        refundedQuantity: item.refundedQuantity,
        netQuantity: Number(netQuantity.toFixed(4)),
        grossAmountCents: item.grossAmountCents,
        refundedAmountCents: item.refundedAmountCents,
        netAmountCents,
      }
    })
    .sort((a, b) => b.netAmountCents - a.netAmountCents)

  // Totales por tipo de unidad (cada unidad mantiene su total independiente)
  const unitMap = new Map<ProductUnit, number>()
  let totalGrossCents = 0
  let totalRefundedCents = 0
  let totalNetCents = 0

  for (const item of items) {
    const prev = unitMap.get(item.unit) ?? 0
    unitMap.set(item.unit, Number((prev + item.netQuantity).toFixed(4)))
    totalGrossCents += item.grossAmountCents
    totalRefundedCents += item.refundedAmountCents
    totalNetCents += item.netAmountCents
  }

  const unitTotals = Array.from(unitMap.entries()).map(([unit, netQuantity]) => ({
    unit,
    netQuantity,
  }))

  return {
    period: filterParams.period,
    dateFrom,
    dateTo,
    currency,
    items,
    unitTotals,
    totalGrossCents,
    totalRefundedCents,
    totalNetCents,
  }
}

/**
 * Calcula el Reporte de Gastos Operativos
 */
export function calculateExpensesReport(
  expenses: ExpenseRecord[],
  categories: ExpenseCategory[],
  filterParams: ReportFilterParams,
  currency: CurrencyCode,
): ExpensesReportSummary {
  const { dateFrom, dateTo } = getPeriodDateRange(filterParams)
  const filtered = expenses.filter((e) =>
    isDateInRange(e.expenseDate, dateFrom, dateTo),
  )

  let grossTotalCents = 0
  let cancelledTotalCents = 0
  let netTotalCents = 0
  let activeCount = 0
  let cancelledCount = 0

  const catMap = new Map<string, { name: string; count: number; netCents: number }>()
  for (const cat of categories) {
    catMap.set(cat.id, { name: cat.name, count: 0, netCents: 0 })
  }

  const methodMap = new Map<ExpensePaymentMethod, { count: number; netCents: number }>([
    ['cash', { count: 0, netCents: 0 }],
    ['card', { count: 0, netCents: 0 }],
    ['transfer', { count: 0, netCents: 0 }],
  ])

  for (const exp of filtered) {
    grossTotalCents += exp.amountCents
    if (exp.status === 'cancelled') {
      cancelledTotalCents += exp.amountCents
      cancelledCount += 1
    } else {
      netTotalCents += exp.amountCents
      activeCount += 1

      // Desglose por categoría
      const c = catMap.get(exp.categoryId)
      if (c) {
        c.count += 1
        c.netCents += exp.amountCents
      } else {
        catMap.set(exp.categoryId, {
          name: exp.categoryName,
          count: 1,
          netCents: exp.amountCents,
        })
      }

      // Desglose por método
      const m = methodMap.get(exp.paymentMethod)
      if (m) {
        m.count += 1
        m.netCents += exp.amountCents
      }
    }
  }

  const byCategory: ExpenseCategoryBreakdown[] = Array.from(catMap.entries())
    .map(([categoryId, data]) => {
      const percentage =
        netTotalCents > 0
          ? Number(((data.netCents / netTotalCents) * 100).toFixed(1))
          : 0
      return {
        categoryId,
        categoryName: data.name,
        count: data.count,
        netCents: data.netCents,
        percentage,
      }
    })
    .filter((c) => c.count > 0 || c.netCents > 0)
    .sort((a, b) => b.netCents - a.netCents)

  const byPaymentMethod: ExpenseMethodBreakdown[] = [
    {
      method: 'cash',
      label: 'Efectivo en caja',
      count: methodMap.get('cash')?.count ?? 0,
      netCents: methodMap.get('cash')?.netCents ?? 0,
    },
    {
      method: 'card',
      label: 'Tarjeta comercial',
      count: methodMap.get('card')?.count ?? 0,
      netCents: methodMap.get('card')?.netCents ?? 0,
    },
    {
      method: 'transfer',
      label: 'Transferencia electrónica',
      count: methodMap.get('transfer')?.count ?? 0,
      netCents: methodMap.get('transfer')?.netCents ?? 0,
    },
  ]

  return {
    period: filterParams.period,
    dateFrom,
    dateTo,
    currency,
    expensesCount: filtered.length,
    activeExpensesCount: activeCount,
    cancelledExpensesCount: cancelledCount,
    grossTotalCents,
    cancelledTotalCents,
    netTotalCents,
    byCategory,
    byPaymentMethod,
    expenses: filtered,
  }
}

/**
 * Calcula el Reporte de Caja y Arqueo.
 * REGLA ESTRICTA: Los saldos finales de sesiones distintas son fotos aisladas,
 * NUNCA se suman entre sí como si fueran ingresos.
 */
export function calculateCashReport(
  sessions: CashSession[],
  movements: CashMovement[],
  filterParams: ReportFilterParams,
  currency: CurrencyCode,
): CashReportSummary {
  const { dateFrom, dateTo } = getPeriodDateRange(filterParams)

  const filteredSessions = sessions.filter((s) => {
    const openedYmd = s.openedAt.split('T')[0]
    return isDateInRange(openedYmd, dateFrom, dateTo)
  })

  let totalOpeningFloatCents = 0
  let totalCashSalesCents = 0
  let totalCashRefundsCents = 0
  let totalManualInCents = 0
  let totalManualOutCents = 0
  let totalExpensesOutCents = 0
  let totalExpensesCancelInCents = 0
  let totalCountedCents = 0
  let totalDifferenceCents = 0
  let openSessions = 0
  let closedSessions = 0

  const sessionItems: CashSessionReportItem[] = filteredSessions.map((session) => {
    if (session.status === 'open') {
      openSessions += 1
    } else {
      closedSessions += 1
    }

    const totals = calculateSessionComputedTotals(session, movements)

    totalOpeningFloatCents += session.openingAmountCents
    totalCashSalesCents += totals.cashSalesCents
    totalCashRefundsCents += totals.cashRefundsCents
    totalManualInCents += totals.manualInCents
    totalManualOutCents += totals.manualOutCents
    totalExpensesOutCents += totals.expenseOutCents
    totalExpensesCancelInCents += totals.expenseCancelInCents

    if (session.countedAmountCents !== null) {
      totalCountedCents += session.countedAmountCents
    }
    if (session.differenceAmountCents !== null) {
      totalDifferenceCents += session.differenceAmountCents
    }

    return {
      session,
      openingFloatCents: session.openingAmountCents,
      cashSalesCents: totals.cashSalesCents,
      cashRefundsCents: totals.cashRefundsCents,
      manualInCents: totals.manualInCents,
      manualOutCents: totals.manualOutCents,
      expensesOutCents: totals.expenseOutCents,
      expensesCancelInCents: totals.expenseCancelInCents,
      expectedBalanceCents: totals.expectedBalanceCents,
      countedBalanceCents: session.countedAmountCents,
      differenceCents: session.differenceAmountCents,
    }
  })

  // Saldo esperado neto consolidado
  const netExpectedBalanceCents =
    totalOpeningFloatCents +
    totalCashSalesCents -
    totalCashRefundsCents +
    totalManualInCents -
    totalManualOutCents -
    totalExpensesOutCents +
    totalExpensesCancelInCents

  return {
    period: filterParams.period,
    dateFrom,
    dateTo,
    currency,
    totalSessions: filteredSessions.length,
    openSessions,
    closedSessions,
    totalOpeningFloatCents,
    totalCashSalesCents,
    totalCashRefundsCents,
    totalManualInCents,
    totalManualOutCents,
    totalExpensesOutCents,
    totalExpensesCancelInCents,
    netExpectedBalanceCents,
    totalCountedCents,
    totalDifferenceCents,
    sessions: sessionItems,
  }
}
