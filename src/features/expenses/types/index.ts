import type { CurrencyCode } from '../../../types'

export type ExpensePaymentMethod = 'cash' | 'card' | 'transfer'

export type ExpenseStatus = 'active' | 'cancelled'

export interface ExpenseAttachment {
  id: string
  fileName: string
  mimeType: string
  sizeBytes: number
  storageKey: string
  uploadedAt: string
}

export interface ExpenseCancellation {
  cancelledAt: string
  cancelledBy: string
  reason: string
  cashMovementId: string | null
}

export interface ExpenseRecord {
  id: string
  folio: string
  organizationId: string
  branchId: string
  branchName: string
  categoryId: string
  categoryName: string
  concept: string
  amountCents: number
  currency: CurrencyCode
  paymentMethod: ExpensePaymentMethod
  expenseDate: string // YYYY-MM-DD
  createdAt: string // ISO 8601
  registeredBy: string
  externalReference: string | null
  attachment: ExpenseAttachment | null
  cashSessionId: string | null
  cashMovementId: string | null
  status: ExpenseStatus
  cancellation: ExpenseCancellation | null
  operationId: string
}

export interface ExpenseCategory {
  id: string
  organizationId: string
  name: string
  isActive: boolean
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export interface OrganizationExpensesData {
  organizationId: string
  branchId: string
  categories: ExpenseCategory[]
  expenses: ExpenseRecord[]
  lastSequence: number
  storageRevision: number
}

export type ExpensePeriodFilter = 'all' | 'today' | 'last_7_days' | 'last_30_days'
export type ExpenseStatusFilter = 'all' | 'active' | 'cancelled'
export type ExpenseMethodFilter = 'all' | ExpensePaymentMethod

export interface ExpenseFilters {
  period: ExpensePeriodFilter
  category: string
  method: ExpenseMethodFilter
  status: ExpenseStatusFilter
  searchQuery: string
}

export interface CreateExpensePayload {
  concept: string
  categoryId: string
  amountCents: number
  currency: CurrencyCode
  paymentMethod: ExpensePaymentMethod
  expenseDate: string // YYYY-MM-DD
  externalReference?: string | null
  attachment?: ExpenseAttachment | null
  operationId: string
  operatorName: string
}

export interface CancelExpensePayload {
  expenseId: string
  reason: string
  operatorName: string
  operationId: string
  cashReturnedConfirmed?: boolean
}

