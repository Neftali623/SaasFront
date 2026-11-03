import type { CurrencyCode } from '../../../types'
import type { CashSession } from '../../cash/types'
import type { ExpensePaymentMethod, ExpenseRecord } from '../../expenses/types'
import type { PosPaymentMethod, SaleRecord, SaleStatus } from '../../pos/types'
import type { ProductUnit } from '../../products/types'

export type ReportPeriod =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'this_month'
  | 'all'
  | 'custom'

export interface ReportFilterParams {
  period: ReportPeriod
  dateFrom?: string
  dateTo?: string
}

export interface SalesReportMethodBreakdown {
  method: PosPaymentMethod
  label: string
  salesCount: number
  grossCents: number
  refundedCents: number
  netCents: number
}

export interface SalesReportStatusBreakdown {
  status: SaleStatus
  label: string
  count: number
  netCents: number
}

export interface SalesReportSummary {
  period: ReportPeriod
  dateFrom: string
  dateTo: string
  currency: CurrencyCode
  salesCount: number
  grossTotalCents: number
  refundedTotalCents: number
  netTotalCents: number
  byPaymentMethod: SalesReportMethodBreakdown[]
  byStatus: SalesReportStatusBreakdown[]
  sales: SaleRecord[]
}

export interface ProductSoldItemReport {
  productId: string
  productName: string
  sku: string
  unit: ProductUnit
  grossQuantity: number
  refundedQuantity: number
  netQuantity: number
  grossAmountCents: number
  refundedAmountCents: number
  netAmountCents: number
}

export interface ProductsSoldSummary {
  period: ReportPeriod
  dateFrom: string
  dateTo: string
  currency: CurrencyCode
  items: ProductSoldItemReport[]
  unitTotals: { unit: ProductUnit; netQuantity: number }[]
  totalGrossCents: number
  totalRefundedCents: number
  totalNetCents: number
}

export interface ExpenseCategoryBreakdown {
  categoryId: string
  categoryName: string
  count: number
  netCents: number
  percentage: number
}

export interface ExpenseMethodBreakdown {
  method: ExpensePaymentMethod
  label: string
  count: number
  netCents: number
}

export interface ExpensesReportSummary {
  period: ReportPeriod
  dateFrom: string
  dateTo: string
  currency: CurrencyCode
  expensesCount: number
  activeExpensesCount: number
  cancelledExpensesCount: number
  grossTotalCents: number
  cancelledTotalCents: number
  netTotalCents: number
  byCategory: ExpenseCategoryBreakdown[]
  byPaymentMethod: ExpenseMethodBreakdown[]
  expenses: ExpenseRecord[]
}

export interface CashSessionReportItem {
  session: CashSession
  openingFloatCents: number
  cashSalesCents: number
  cashRefundsCents: number
  manualInCents: number
  manualOutCents: number
  expensesOutCents: number
  expensesCancelInCents: number
  expectedBalanceCents: number
  countedBalanceCents: number | null
  differenceCents: number | null
}

export interface CashReportSummary {
  period: ReportPeriod
  dateFrom: string
  dateTo: string
  currency: CurrencyCode
  totalSessions: number
  openSessions: number
  closedSessions: number
  totalOpeningFloatCents: number
  totalCashSalesCents: number
  totalCashRefundsCents: number
  totalManualInCents: number
  totalManualOutCents: number
  totalExpensesOutCents: number
  totalExpensesCancelInCents: number
  netExpectedBalanceCents: number
  totalCountedCents: number
  totalDifferenceCents: number
  sessions: CashSessionReportItem[]
}
