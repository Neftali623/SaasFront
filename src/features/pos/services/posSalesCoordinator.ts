import type { StorageLike } from '../../../services/settings/organizationSettingsRepository'
import type { CurrencyCode } from '../../../types'
import {
  createLocalCashRepository,
  generateCashId,
  type CashRepository,
} from '../../cash/services/cashRepository'
import type {
  CashMovement,
  CashSession,
  OrganizationCashData,
} from '../../cash/types'
import { cloneCashData } from '../../cash/utils/mockCash'
import {
  amountToCents,
  calculateSessionComputedTotals,
  formatCentsWithHistoricalCurrency,
} from '../../cash/utils/moneyUtils'
import {
  createLocalInventoryRepository,
  generateInventoryId,
  type InventoryRepository,
} from '../../inventory/services/inventoryRepository'
import type {
  InventoryBalance,
  InventoryMovement,
  OrganizationInventoryData,
} from '../../inventory/types'
import {
  cloneInventoryData,
  getBranchForOrganization,
} from '../../inventory/utils/mockInventory'
import {
  addControlledQuantities,
  formatQuantityWithUnit,
  isQuantityCompatibleWithUnit,
  normalizeControlledQuantity,
  subtractControlledQuantities,
  toScaledQuantity,
} from '../../inventory/utils/quantityUtils'
import {
  createLocalProductsCatalogRepository,
  type ProductsCatalogRepository,
} from '../../products/services/productsCatalogRepository'
import type {
  OrganizationCatalogData,
  Product,
  ProductUnit,
} from '../../products/types'
import { getUnitLabel } from '../../products/utils/validation'
import type {
  CancelSaleOutcome,
  CancelSaleParams,
  OrganizationSalesData,
  PosCartItem,
  PosCheckoutDiscrepancy,
  PosCheckoutErrorCode,
  PosPaymentMethod,
  RefundSaleOutcome,
  RefundSaleParams,
  SaleAuditEvent,
  SaleLineItem,
  SalePaymentRecord,
  SaleRecord,
  SaleRefundRecord,
  SaleReturnLineItem,
  SaleReturnRecord,
  SaleStatus,
} from '../types'
import {
  calculateLineSubtotalCents,
  calculateReturnLineRefundCents,
  deriveSaleComputedTotals,
  formatReturnFolio,
  formatSaleFolio,
  sortSalesDeterministically,
} from '../utils/posMoneyAndQuantityUtils'

export const BRANCH_TX_SCHEMA_VERSION = 1

/**
 * Instantánea transaccional unificada por organización y sucursal.
 * Permite persistir en UNA SOLA operación atómica (`storage.setItem`) el estado
 * coordinado de Inventario, Caja y Ventas al confirmar un cobro en Punto de Venta,
 * evitando escrituras encadenadas que pudieran dejar una venta parcial.
 */
export interface StoredBranchTransactionEnvelope {
  schemaVersion: number
  organizationId: string
  branchId: string
  branchName: string
  updatedAt: string
  data: {
    inventory: OrganizationInventoryData
    cashData: OrganizationCashData
    salesData: OrganizationSalesData
  }
}

export interface LoadPosWorkspaceOutcome {
  catalog: OrganizationCatalogData
  inventory: OrganizationInventoryData
  cashData: OrganizationCashData
  salesData: OrganizationSalesData
  warning?: string
}

export interface CheckoutSaleParams {
  organizationId: string
  organizationName: string
  branchId?: string
  expectedSessionId?: string
  operatorName: string
  cartItems: PosCartItem[]
  paymentMethod: PosPaymentMethod
  cashReceivedCents?: number | null
  externalReference?: string | null
  externalVerifiedByOperator?: boolean
  operationId: string
  simulateStorageError?: boolean
}

export type CheckoutSaleOutcome =
  | {
      ok: true
      idempotentReplay: boolean
      sale: SaleRecord
      inventory: OrganizationInventoryData
      cashData: OrganizationCashData
      salesData: OrganizationSalesData
      updatedAt: string
    }
  | {
      ok: false
      errorCode: PosCheckoutErrorCode
      error: string
      discrepancies?: PosCheckoutDiscrepancy[]
      latestCatalog?: OrganizationCatalogData
      latestInventory?: OrganizationInventoryData
      latestCashData?: OrganizationCashData
    }

export interface PosSalesCoordinator {
  loadWorkspace(organizationId: string, branchId?: string): LoadPosWorkspaceOutcome
  loadSales(organizationId: string, branchId?: string): OrganizationSalesData
  validateCartBeforeCheckout(params: {
    organizationId: string
    branchId?: string
    expectedSessionId?: string
    cartItems: PosCartItem[]
  }): {
    ok: boolean
    errorCode?: PosCheckoutErrorCode
    error?: string
    discrepancies: PosCheckoutDiscrepancy[]
    openSession: CashSession | null
    catalogCurrency: CurrencyCode
    catalog: OrganizationCatalogData
    inventory: OrganizationInventoryData
    cashData: OrganizationCashData
  }
  checkoutSale(params: CheckoutSaleParams): CheckoutSaleOutcome
  cancelSale(params: CancelSaleParams): CancelSaleOutcome
  refundSale(params: RefundSaleParams): RefundSaleOutcome
}

export function getOrganizationBranchTransactionStorageKey(
  organizationId: string,
  branchId: string,
): string {
  return `nedaxoli_demo_branch_tx_v${BRANCH_TX_SCHEMA_VERSION}_${organizationId}_${branchId}`
}

export function generatePosId(
  prefix: 'sale' | 'sline' | 'spay' | 'op' | 'ret' | 'ref',
): string {
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

function isValidPaymentMethod(value: unknown): value is PosPaymentMethod {
  return value === 'cash' || value === 'card' || value === 'transfer'
}

function isValidUnit(value: unknown): value is ProductUnit {
  return (
    value === 'pieza' ||
    value === 'paquete' ||
    value === 'caja' ||
    value === 'kg' ||
    value === 'litro' ||
    value === 'servicio'
  )
}

function cloneSalesData(data: OrganizationSalesData): OrganizationSalesData {
  return {
    organizationId: data.organizationId,
    branchId: data.branchId,
    branchName: data.branchName,
    storageRevision: data.storageRevision,
    lastFolioNumber: data.lastFolioNumber,
    lastReturnFolioNumber: data.lastReturnFolioNumber ?? 0,
    lastSequence: data.lastSequence,
    sales: data.sales.map((sale) => ({
      ...sale,
      lines: sale.lines.map((line) => ({ ...line })),
      payment: { ...sale.payment },
      inventoryMovementIds: [...sale.inventoryMovementIds],
      returns: (sale.returns ?? []).map((ret) => ({
        ...ret,
        lines: ret.lines.map((rl) => ({ ...rl })),
        refund: { ...ret.refund },
      })),
      auditEvents: (sale.auditEvents ?? []).map((ae) => ({ ...ae })),
    })),
  }
}

function sanitizeStoredSalesData(
  rawSalesData: unknown,
  organizationId: string,
  branchId: string,
  fallbackBranchName: string,
): OrganizationSalesData | null {
  if (!isObjectRecord(rawSalesData) || !Array.isArray(rawSalesData.sales)) {
    return null
  }

  const sales: SaleRecord[] = []
  const seenSaleIds = new Set<string>()
  const seenOperationIds = new Set<string>()
  let maxFolioNumber = 0
  let maxReturnFolioNumber = 0
  let maxSequence = 0

  for (const rawSale of rawSalesData.sales) {
    if (
      !isObjectRecord(rawSale) ||
      typeof rawSale.id !== 'string' ||
      !rawSale.id.trim() ||
      typeof rawSale.folio !== 'string' ||
      !rawSale.folio.trim() ||
      typeof rawSale.folioNumber !== 'number' ||
      !Number.isInteger(rawSale.folioNumber) ||
      typeof rawSale.sessionId !== 'string' ||
      !isValidCurrency(rawSale.currency) ||
      typeof rawSale.subtotalCents !== 'number' ||
      typeof rawSale.totalCents !== 'number' ||
      !Array.isArray(rawSale.lines) ||
      !isObjectRecord(rawSale.payment) ||
      !isValidPaymentMethod(rawSale.payment.method)
    ) {
      continue
    }

    if (
      typeof rawSale.organizationId === 'string' &&
      rawSale.organizationId !== organizationId
    ) {
      continue
    }

    if (seenSaleIds.has(rawSale.id)) {
      continue
    }
    seenSaleIds.add(rawSale.id)

    const operationId =
      typeof rawSale.operationId === 'string' && rawSale.operationId.trim()
        ? rawSale.operationId.trim()
        : `op-sale-${rawSale.id}`

    if (seenOperationIds.has(operationId)) {
      continue
    }
    seenOperationIds.add(operationId)

    const lines: SaleLineItem[] = []
    for (const rawLine of rawSale.lines) {
      if (
        !isObjectRecord(rawLine) ||
        typeof rawLine.id !== 'string' ||
        typeof rawLine.productId !== 'string' ||
        typeof rawLine.productName !== 'string' ||
        typeof rawLine.sku !== 'string' ||
        !isValidUnit(rawLine.unit) ||
        typeof rawLine.quantity !== 'number' ||
        !Number.isFinite(rawLine.quantity) ||
        rawLine.quantity <= 0 ||
        typeof rawLine.unitPriceCents !== 'number' ||
        typeof rawLine.lineSubtotalCents !== 'number'
      ) {
        continue
      }

      lines.push({
        id: rawLine.id,
        productId: rawLine.productId,
        productName: rawLine.productName,
        sku: rawLine.sku,
        barcodeUsed:
          typeof rawLine.barcodeUsed === 'string' && rawLine.barcodeUsed.trim()
            ? rawLine.barcodeUsed.trim()
            : null,
        unit: rawLine.unit,
        quantity: rawLine.quantity,
        unitPriceCents: Math.round(rawLine.unitPriceCents),
        lineSubtotalCents: Math.round(rawLine.lineSubtotalCents),
        historicalUnitCostCents:
          typeof rawLine.historicalUnitCostCents === 'number' &&
          Number.isFinite(rawLine.historicalUnitCostCents)
            ? Math.round(rawLine.historicalUnitCostCents)
            : null,
        inventoryMovementId:
          typeof rawLine.inventoryMovementId === 'string'
            ? rawLine.inventoryMovementId
            : '',
      })
    }

    if (lines.length === 0) {
      continue
    }

    const rawPay = rawSale.payment
    const payment: SalePaymentRecord = {
      id: typeof rawPay.id === 'string' ? rawPay.id : `spay-${rawSale.id}`,
      method: rawPay.method as PosPaymentMethod,
      currency: rawSale.currency,
      amountCents: Math.round(rawSale.totalCents),
      cashReceivedCents:
        typeof rawPay.cashReceivedCents === 'number' &&
        Number.isFinite(rawPay.cashReceivedCents)
          ? Math.round(rawPay.cashReceivedCents)
          : null,
      cashChangeCents:
        typeof rawPay.cashChangeCents === 'number' &&
        Number.isFinite(rawPay.cashChangeCents)
          ? Math.round(rawPay.cashChangeCents)
          : null,
      externalReference:
        typeof rawPay.externalReference === 'string' &&
        rawPay.externalReference.trim()
          ? rawPay.externalReference.trim()
          : null,
      externalVerifiedByOperator: Boolean(rawPay.externalVerifiedByOperator),
      cashMovementId:
        typeof rawPay.cashMovementId === 'string' &&
        rawPay.cashMovementId.trim()
          ? rawPay.cashMovementId.trim()
          : null,
    }

    if (rawSale.folioNumber > maxFolioNumber) {
      maxFolioNumber = rawSale.folioNumber
    }

    const sequence =
      typeof rawSale.sequence === 'number' && Number.isInteger(rawSale.sequence)
        ? rawSale.sequence
        : maxSequence + 1
    if (sequence > maxSequence) {
      maxSequence = sequence
    }

    const returns: SaleReturnRecord[] = []
    if (Array.isArray(rawSale.returns)) {
      for (const rawRet of rawSale.returns) {
        if (
          !isObjectRecord(rawRet) ||
          typeof rawRet.id !== 'string' ||
          typeof rawRet.returnFolio !== 'string' ||
          typeof rawRet.returnFolioNumber !== 'number' ||
          !Array.isArray(rawRet.lines) ||
          !isObjectRecord(rawRet.refund)
        ) {
          continue
        }

        if (rawRet.returnFolioNumber > maxReturnFolioNumber) {
          maxReturnFolioNumber = rawRet.returnFolioNumber
        }

        const retLines: SaleReturnLineItem[] = []
        for (const rl of rawRet.lines) {
          if (
            !isObjectRecord(rl) ||
            typeof rl.saleLineId !== 'string' ||
            typeof rl.productId !== 'string' ||
            typeof rl.returnedQuantity !== 'number' ||
            typeof rl.refundCents !== 'number'
          ) {
            continue
          }
          retLines.push({
            saleLineId: rl.saleLineId,
            productId: rl.productId,
            productName:
              typeof rl.productName === 'string' ? rl.productName : '',
            sku: typeof rl.sku === 'string' ? rl.sku : '',
            barcodeUsed:
              typeof rl.barcodeUsed === 'string' ? rl.barcodeUsed : null,
            unit: isValidUnit(rl.unit) ? rl.unit : 'pieza',
            returnedQuantity: rl.returnedQuantity,
            unitPriceCents:
              typeof rl.unitPriceCents === 'number'
                ? Math.round(rl.unitPriceCents)
                : 0,
            refundCents: Math.round(rl.refundCents),
            destination:
              rl.destination === 'unsellable' ? 'unsellable' : 'sellable',
            inventoryMovementId:
              typeof rl.inventoryMovementId === 'string'
                ? rl.inventoryMovementId
                : null,
          })
        }

        const rawRef = rawRet.refund
        const refundRecord: SaleRefundRecord = {
          id: typeof rawRef.id === 'string' ? rawRef.id : `ref-${rawRet.id}`,
          saleId: rawSale.id.trim(),
          returnId: rawRet.id,
          method: isValidPaymentMethod(rawRef.method)
            ? rawRef.method
            : 'cash',
          currency: isValidCurrency(rawRef.currency)
            ? rawRef.currency
            : 'MXN',
          amountCents:
            typeof rawRef.amountCents === 'number'
              ? Math.round(rawRef.amountCents)
              : 0,
          cashSessionId:
            typeof rawRef.cashSessionId === 'string'
              ? rawRef.cashSessionId
              : null,
          cashMovementId:
            typeof rawRef.cashMovementId === 'string'
              ? rawRef.cashMovementId
              : null,
          externalReference:
            typeof rawRef.externalReference === 'string'
              ? rawRef.externalReference
              : null,
          externalVerifiedByOperator: Boolean(rawRef.externalVerifiedByOperator),
          operatorName:
            typeof rawRef.operatorName === 'string'
              ? rawRef.operatorName
              : 'Operador',
          createdAt:
            typeof rawRef.createdAt === 'string'
              ? rawRef.createdAt
              : new Date().toISOString(),
        }

        returns.push({
          id: rawRet.id,
          returnFolio: rawRet.returnFolio,
          returnFolioNumber: rawRet.returnFolioNumber,
          organizationId,
          branchId,
          branchName: fallbackBranchName,
          saleId: rawSale.id.trim(),
          saleFolio: rawSale.folio.trim(),
          type: rawRet.type === 'cancelation' ? 'cancelation' : 'return',
          reason: typeof rawRet.reason === 'string' ? rawRet.reason : '',
          operatorName:
            typeof rawRet.operatorName === 'string'
              ? rawRet.operatorName
              : 'Operador',
          createdAt:
            typeof rawRet.createdAt === 'string'
              ? rawRet.createdAt
              : new Date().toISOString(),
          lines: retLines,
          totalRefundCents:
            typeof rawRet.totalRefundCents === 'number'
              ? Math.round(rawRet.totalRefundCents)
              : 0,
          refund: refundRecord,
          operationId:
            typeof rawRet.operationId === 'string'
              ? rawRet.operationId
              : `op-ret-${rawRet.id}`,
          sequence:
            typeof rawRet.sequence === 'number' ? rawRet.sequence : 0,
        })
      }
    }

    const auditEvents: SaleAuditEvent[] = []
    if (Array.isArray(rawSale.auditEvents)) {
      for (const rawAe of rawSale.auditEvents) {
        if (!isObjectRecord(rawAe) || typeof rawAe.id !== 'string') {
          continue
        }
        auditEvents.push({
          id: rawAe.id,
          saleId: rawSale.id.trim(),
          eventType:
            rawAe.eventType === 'sale_cancelled' ||
            rawAe.eventType === 'sale_returned'
              ? rawAe.eventType
              : 'sale_created',
          actionSummary:
            typeof rawAe.actionSummary === 'string'
              ? rawAe.actionSummary
              : '',
          operatorName:
            typeof rawAe.operatorName === 'string'
              ? rawAe.operatorName
              : 'Operador',
          createdAt:
            typeof rawAe.createdAt === 'string'
              ? rawAe.createdAt
              : new Date().toISOString(),
          relatedFolio:
            typeof rawAe.relatedFolio === 'string'
              ? rawAe.relatedFolio
              : null,
          notes: typeof rawAe.notes === 'string' ? rawAe.notes : null,
        })
      }
    }

    if (auditEvents.length === 0) {
      auditEvents.push({
        id: `ae-created-${rawSale.id}`,
        saleId: rawSale.id.trim(),
        eventType: 'sale_created',
        actionSummary: `Venta registrada por ${formatCentsWithHistoricalCurrency(
          Math.round(rawSale.totalCents),
          rawSale.currency,
        )}`,
        operatorName:
          typeof rawSale.operatorName === 'string'
            ? rawSale.operatorName
            : 'Operador',
        createdAt:
          typeof rawSale.createdAt === 'string'
            ? rawSale.createdAt
            : new Date().toISOString(),
        relatedFolio: rawSale.folio.trim(),
        notes: null,
      })
    }

    const rawRefundedTotal =
      typeof rawSale.refundedTotalCents === 'number' &&
      Number.isFinite(rawSale.refundedTotalCents)
        ? Math.round(rawSale.refundedTotalCents)
        : 0

    const provisionalSale: SaleRecord = {
      id: rawSale.id.trim(),
      folio: rawSale.folio.trim(),
      folioNumber: rawSale.folioNumber,
      organizationId,
      organizationName:
        typeof rawSale.organizationName === 'string'
          ? rawSale.organizationName
          : organizationId,
      branchId,
      branchName: fallbackBranchName,
      registerId:
        typeof rawSale.registerId === 'string' ? rawSale.registerId : '',
      registerName:
        typeof rawSale.registerName === 'string'
          ? rawSale.registerName
          : 'Caja Principal',
      registerCode:
        typeof rawSale.registerCode === 'string'
          ? rawSale.registerCode
          : 'CAJA-01',
      sessionId: rawSale.sessionId,
      operatorName:
        typeof rawSale.operatorName === 'string' && rawSale.operatorName.trim()
          ? rawSale.operatorName.trim()
          : 'Operador de Demostración',
      createdAt:
        typeof rawSale.createdAt === 'string'
          ? rawSale.createdAt
          : new Date().toISOString(),
      currency: rawSale.currency,
      subtotalCents: Math.round(rawSale.subtotalCents),
      totalCents: Math.round(rawSale.totalCents),
      itemsCount: lines.length,
      lines,
      payment,
      inventoryMovementIds: Array.isArray(rawSale.inventoryMovementIds)
        ? rawSale.inventoryMovementIds.filter(
            (id): id is string => typeof id === 'string',
          )
        : lines.map((l) => l.inventoryMovementId).filter(Boolean),
      cashMovementId: payment.cashMovementId,
      sequence,
      operationId,
      status: (rawSale.status as SaleStatus) ?? 'completed',
      refundedTotalCents: rawRefundedTotal,
      netTotalCents: Math.max(0, Math.round(rawSale.totalCents) - rawRefundedTotal),
      returnsCount: returns.length,
      returns,
      auditEvents,
    }

    const derived = deriveSaleComputedTotals(provisionalSale)

    sales.push({
      ...provisionalSale,
      status: derived.status,
      refundedTotalCents: derived.refundedTotalCents,
      netTotalCents: derived.netTotalCents,
      returnsCount: derived.returnsCount,
    })
  }

  const storageRevision =
    typeof rawSalesData.storageRevision === 'number' &&
    Number.isInteger(rawSalesData.storageRevision) &&
    rawSalesData.storageRevision >= 1
      ? rawSalesData.storageRevision
      : 1

  const lastFolioNumber =
    typeof rawSalesData.lastFolioNumber === 'number' &&
    Number.isInteger(rawSalesData.lastFolioNumber) &&
    rawSalesData.lastFolioNumber >= maxFolioNumber
      ? rawSalesData.lastFolioNumber
      : maxFolioNumber

  const lastReturnFolioNumber =
    typeof rawSalesData.lastReturnFolioNumber === 'number' &&
    Number.isInteger(rawSalesData.lastReturnFolioNumber) &&
    rawSalesData.lastReturnFolioNumber >= maxReturnFolioNumber
      ? rawSalesData.lastReturnFolioNumber
      : maxReturnFolioNumber

  const lastSequence =
    typeof rawSalesData.lastSequence === 'number' &&
    Number.isInteger(rawSalesData.lastSequence) &&
    rawSalesData.lastSequence >= maxSequence
      ? rawSalesData.lastSequence
      : maxSequence

  return {
    organizationId,
    branchId,
    branchName: fallbackBranchName,
    storageRevision,
    lastFolioNumber,
    lastReturnFolioNumber,
    lastSequence,
    sales: sortSalesDeterministically(sales),
  }
}

export function createLocalPosSalesCoordinator(options?: {
  storage?: StorageLike | null
  catalogRepository?: ProductsCatalogRepository
  inventoryRepository?: InventoryRepository
  cashRepository?: CashRepository
}): PosSalesCoordinator {
  const resolveStorage = (): StorageLike | null => {
    if (options?.storage !== undefined) {
      return options.storage
    }
    return getBrowserLocalStorage()
  }

  const catalogRepo =
    options?.catalogRepository ??
    createLocalProductsCatalogRepository(options?.storage)
  const inventoryRepo =
    options?.inventoryRepository ??
    createLocalInventoryRepository(options?.storage)
  const cashRepo =
    options?.cashRepository ?? createLocalCashRepository(options?.storage)

  const loadSalesInternal = (
    organizationId: string,
    branchId?: string,
  ): OrganizationSalesData => {
    const defaultBranch = getBranchForOrganization(organizationId)
    const targetBranchId = branchId ?? defaultBranch.id
    const emptySales: OrganizationSalesData = {
      organizationId,
      branchId: targetBranchId,
      branchName: defaultBranch.name,
      storageRevision: 1,
      lastFolioNumber: 0,
      lastReturnFolioNumber: 0,
      lastSequence: 0,
      sales: [],
    }

    const storage = resolveStorage()
    if (!storage) {
      return emptySales
    }

    const txKey = getOrganizationBranchTransactionStorageKey(
      organizationId,
      targetBranchId,
    )
    try {
      const rawTx = storage.getItem(txKey)
      if (!rawTx) {
        return emptySales
      }
      const parsed: unknown = JSON.parse(rawTx)
      if (
        !isObjectRecord(parsed) ||
        parsed.schemaVersion !== BRANCH_TX_SCHEMA_VERSION ||
        parsed.organizationId !== organizationId ||
        parsed.branchId !== targetBranchId ||
        !isObjectRecord(parsed.data)
      ) {
        return emptySales
      }

      const sanitized = sanitizeStoredSalesData(
        parsed.data.salesData,
        organizationId,
        targetBranchId,
        defaultBranch.name,
      )
      return sanitized ?? emptySales
    } catch {
      return emptySales
    }
  }

  const validateCartBeforeCheckout = (params: {
    organizationId: string
    branchId?: string
    expectedSessionId?: string
    cartItems: PosCartItem[]
  }): {
    ok: boolean
    errorCode?: PosCheckoutErrorCode
    error?: string
    discrepancies: PosCheckoutDiscrepancy[]
    openSession: CashSession | null
    catalogCurrency: CurrencyCode
    catalog: OrganizationCatalogData
    inventory: OrganizationInventoryData
    cashData: OrganizationCashData
  } => {
    const { organizationId, branchId, expectedSessionId, cartItems } = params
    const defaultBranch = getBranchForOrganization(organizationId)
    const targetBranchId = branchId ?? defaultBranch.id

    const catalogLoad = catalogRepo.load(organizationId)
    const inventoryLoad = inventoryRepo.load(organizationId, targetBranchId)
    const cashLoad = cashRepo.load(organizationId, targetBranchId)

    const catalog = catalogLoad.catalog
    const inventory = inventoryLoad.inventory
    const cashData = cashLoad.cashData
    const catalogCurrency: CurrencyCode = catalog.baseCurrency ?? 'MXN'

    const openSession =
      cashData.sessions.find(
        (s) =>
          s.organizationId === organizationId &&
          s.branchId === targetBranchId &&
          s.registerId === cashData.register.id &&
          s.status === 'open',
      ) ?? null

    if (!openSession) {
      return {
        ok: false,
        errorCode: 'NO_OPEN_CASH_SESSION',
        error: `La caja "${cashData.register.name}" se encuentra cerrada. Abre una sesión de caja antes de procesar el cobro.`,
        discrepancies: [],
        openSession: null,
        catalogCurrency,
        catalog,
        inventory,
        cashData,
      }
    }

    if (expectedSessionId && openSession.id !== expectedSessionId) {
      return {
        ok: false,
        errorCode: 'NO_OPEN_CASH_SESSION',
        error:
          'La sesión de caja activa cambió mientras preparabas el cobro. Revisa el contexto actual de la caja antes de confirmar.',
        discrepancies: [],
        openSession,
        catalogCurrency,
        catalog,
        inventory,
        cashData,
      }
    }

    if (openSession.currency !== catalogCurrency) {
      return {
        ok: false,
        errorCode: 'INCOMPATIBLE_CURRENCY',
        error: `Moneda incompatible: la sesión de caja activa está fijada en ${openSession.currency}, mientras que los precios del catálogo están denominados en ${catalogCurrency}. No se convierten ni mezclan monedas automáticamente.`,
        discrepancies: [],
        openSession,
        catalogCurrency,
        catalog,
        inventory,
        cashData,
      }
    }

    if (cartItems.length === 0) {
      return {
        ok: false,
        errorCode: 'EMPTY_CART',
        error: 'El carrito está vacío. Agrega al menos un producto para cobrar.',
        discrepancies: [],
        openSession,
        catalogCurrency,
        catalog,
        inventory,
        cashData,
      }
    }

    const productsById = new Map<string, Product>()
    for (const p of catalog.products) {
      productsById.set(p.id, p)
    }

    const balancesByProductId = new Map<string, InventoryBalance>()
    for (const b of inventory.balances) {
      if (b.branchId === targetBranchId) {
        balancesByProductId.set(b.productId, b)
      }
    }

    const discrepancies: PosCheckoutDiscrepancy[] = []

    for (const line of cartItems) {
      const liveProduct = productsById.get(line.productId)

      if (!liveProduct || liveProduct.organizationId !== organizationId) {
        discrepancies.push({
          productId: line.productId,
          productName: line.productName,
          sku: line.sku,
          kind: 'product_not_found',
          message: `El producto "${line.productName}" ya no se encuentra disponible en el catálogo de la organización activa.`,
        })
        continue
      }

      if (liveProduct.status !== 'active') {
        discrepancies.push({
          productId: line.productId,
          productName: liveProduct.name,
          sku: liveProduct.sku,
          kind: 'product_inactive',
          message: `El producto "${liveProduct.name}" (${liveProduct.sku}) fue desactivado y no puede incluirse en nuevas ventas.`,
        })
        continue
      }

      if (liveProduct.unit !== line.unit) {
        discrepancies.push({
          productId: line.productId,
          productName: liveProduct.name,
          sku: liveProduct.sku,
          kind: 'unit_changed',
          message: `La unidad de medida de "${liveProduct.name}" cambió de ${getUnitLabel(line.unit)} a ${getUnitLabel(liveProduct.unit)}.`,
        })
        continue
      }

      const liveUnitPriceCents = amountToCents(liveProduct.salePrice)
      if (liveUnitPriceCents !== line.unitPriceCents) {
        discrepancies.push({
          productId: line.productId,
          productName: liveProduct.name,
          sku: liveProduct.sku,
          kind: 'price_changed',
          previousUnitPriceCents: line.unitPriceCents,
          currentUnitPriceCents: liveUnitPriceCents,
          message: `El precio de "${liveProduct.name}" cambió de ${formatCentsWithHistoricalCurrency(
            line.unitPriceCents,
            openSession.currency,
          )} a ${formatCentsWithHistoricalCurrency(
            liveUnitPriceCents,
            openSession.currency,
          )}.`,
        })
      }

      const liveBalance = balancesByProductId.get(line.productId)
      if (!liveBalance) {
        discrepancies.push({
          productId: line.productId,
          productName: liveProduct.name,
          sku: liveProduct.sku,
          kind: 'uninitialized_stock',
          requestedQuantity: line.quantity,
          availableQuantity: null,
          message: `El producto "${liveProduct.name}" no tiene inventario inicializado en esta sucursal.`,
        })
        continue
      }

      if (toScaledQuantity(liveBalance.quantity) < toScaledQuantity(line.quantity)) {
        discrepancies.push({
          productId: line.productId,
          productName: liveProduct.name,
          sku: liveProduct.sku,
          kind: 'insufficient_stock',
          requestedQuantity: line.quantity,
          availableQuantity: liveBalance.quantity,
          message: `Existencia insuficiente para "${liveProduct.name}": solicitaste ${formatQuantityWithUnit(
            line.quantity,
            liveProduct.unit,
          )}, pero la existencia disponible actual es ${formatQuantityWithUnit(
            liveBalance.quantity,
            liveProduct.unit,
          )}.`,
        })
      }
    }

    if (discrepancies.length > 0) {
      return {
        ok: false,
        errorCode: 'CATALOG_OR_STOCK_DISCREPANCY',
        error:
          'Se detectaron cambios de precio, estado o disponibilidad en uno o más productos del carrito. Revisa las diferencias antes de volver a confirmar.',
        discrepancies,
        openSession,
        catalogCurrency,
        catalog,
        inventory,
        cashData,
      }
    }

    return {
      ok: true,
      discrepancies: [],
      openSession,
      catalogCurrency,
      catalog,
      inventory,
      cashData,
    }
  }

  return {
    loadWorkspace(
      organizationId: string,
      branchId?: string,
    ): LoadPosWorkspaceOutcome {
      const defaultBranch = getBranchForOrganization(organizationId)
      const targetBranchId = branchId ?? defaultBranch.id

      const catalogLoad = catalogRepo.load(organizationId)
      const inventoryLoad = inventoryRepo.load(organizationId, targetBranchId)
      const cashLoad = cashRepo.load(organizationId, targetBranchId)
      const salesData = loadSalesInternal(organizationId, targetBranchId)

      return {
        catalog: catalogLoad.catalog,
        inventory: inventoryLoad.inventory,
        cashData: cashLoad.cashData,
        salesData,
        warning:
          inventoryLoad.warning ?? cashLoad.warning ?? catalogLoad.warning,
      }
    },

    loadSales: loadSalesInternal,

    validateCartBeforeCheckout,

    checkoutSale(params: CheckoutSaleParams): CheckoutSaleOutcome {
      const {
        organizationId,
        organizationName,
        branchId,
        expectedSessionId,
        operatorName,
        cartItems,
        paymentMethod,
        cashReceivedCents = null,
        externalReference = null,
        externalVerifiedByOperator = false,
        operationId,
        simulateStorageError = false,
      } = params

      if (!organizationId.trim()) {
        return {
          ok: false,
          errorCode: 'INVALID_CONTEXT',
          error: 'Organización activa inválida.',
        }
      }

      const cleanOperationId = operationId.trim()
      if (!cleanOperationId) {
        return {
          ok: false,
          errorCode: 'INVALID_CONTEXT',
          error: 'Se requiere un identificador de idempotencia válido.',
        }
      }

      const defaultBranch = getBranchForOrganization(organizationId)
      const targetBranchId = branchId ?? defaultBranch.id

      // 1. Verificar idempotencia: si la operación ya fue confirmada antes, devolver su resultado original
      const currentSalesData = loadSalesInternal(organizationId, targetBranchId)
      const existingConfirmedSale = currentSalesData.sales.find(
        (s) => s.operationId === cleanOperationId,
      )
      if (existingConfirmedSale) {
        const currentInv = inventoryRepo.load(
          organizationId,
          targetBranchId,
        ).inventory
        const currentCash = cashRepo.load(
          organizationId,
          targetBranchId,
        ).cashData
        return {
          ok: true,
          idempotentReplay: true,
          sale: existingConfirmedSale,
          inventory: currentInv,
          cashData: currentCash,
          salesData: currentSalesData,
          updatedAt: existingConfirmedSale.createdAt,
        }
      }

      // 2. Validar cantidades y formato del carrito
      if (cartItems.length === 0) {
        return {
          ok: false,
          errorCode: 'EMPTY_CART',
          error: 'No hay productos en el carrito para cobrar.',
        }
      }

      const seenProductsInCart = new Set<string>()
      for (const item of cartItems) {
        if (seenProductsInCart.has(item.productId)) {
          return {
            ok: false,
            errorCode: 'INVALID_CART_QUANTITY',
            error: `El producto "${item.productName}" aparece duplicado en distintas partidas. Un mismo producto debe acumularse en una sola partida.`,
          }
        }
        seenProductsInCart.add(item.productId)

        if (
          !Number.isFinite(item.quantity) ||
          item.quantity <= 0 ||
          !isQuantityCompatibleWithUnit(item.quantity, item.unit)
        ) {
          return {
            ok: false,
            errorCode: 'INVALID_CART_QUANTITY',
            error: `La cantidad de "${item.productName}" (${item.quantity}) no es válida para la unidad ${getUnitLabel(item.unit)}.`,
          }
        }
      }

      // 3. Re-validar estado vigente de catálogo, inventario, sesión de caja y moneda
      const validation = validateCartBeforeCheckout({
        organizationId,
        branchId: targetBranchId,
        expectedSessionId,
        cartItems,
      })

      if (!validation.ok || !validation.openSession) {
        return {
          ok: false,
          errorCode: validation.errorCode ?? 'CATALOG_OR_STOCK_DISCREPANCY',
          error:
            validation.error ??
            'No se pudo validar el estado vigente para confirmar la venta.',
          discrepancies:
            validation.discrepancies.length > 0
              ? validation.discrepancies
              : undefined,
          latestCatalog: validation.catalog,
          latestInventory: validation.inventory,
          latestCashData: validation.cashData,
        }
      }

      const openSession = validation.openSession
      const sessionCurrency = openSession.currency
      const currentCatalog = validation.catalog
      const currentInventory = validation.inventory
      const currentCashData = validation.cashData

      // 4. Recalcular importes por partida con la regla explícita de redondeo y sumar total
      const productsById = new Map<string, Product>()
      for (const prod of currentCatalog.products) {
        productsById.set(prod.id, prod)
      }

      let subtotalCents = 0
      const normalizedLinesDraft: Array<{
        product: Product
        barcodeUsed: string | null
        quantity: number
        unitPriceCents: number
        lineSubtotalCents: number
        historicalUnitCostCents: number | null
      }> = []

      for (const item of cartItems) {
        const product = productsById.get(item.productId)!
        const unitPriceCents = amountToCents(product.salePrice)
        const quantity = normalizeControlledQuantity(item.quantity)
        const lineSubtotalCents = calculateLineSubtotalCents(
          unitPriceCents,
          quantity,
        )
        const historicalUnitCostCents =
          product.cost !== null ? amountToCents(product.cost) : null

        subtotalCents += lineSubtotalCents
        normalizedLinesDraft.push({
          product,
          barcodeUsed: item.barcodeUsed,
          quantity,
          unitPriceCents,
          lineSubtotalCents,
          historicalUnitCostCents,
        })
      }

      const totalCents = subtotalCents

      // 5. Validar método e información de pago
      if (!isValidPaymentMethod(paymentMethod)) {
        return {
          ok: false,
          errorCode: 'INVALID_PAYMENT',
          error: 'Selecciona un método de pago válido.',
        }
      }

      let validatedCashReceivedCents: number | null = null
      let validatedCashChangeCents: number | null = null

      if (paymentMethod === 'cash') {
        if (
          cashReceivedCents === null ||
          cashReceivedCents === undefined ||
          !Number.isFinite(cashReceivedCents) ||
          !Number.isInteger(cashReceivedCents) ||
          cashReceivedCents < 0
        ) {
          return {
            ok: false,
            errorCode: 'INVALID_PAYMENT',
            error: 'Ingresa un importe válido para el efectivo recibido.',
          }
        }

        if (cashReceivedCents < totalCents) {
          return {
            ok: false,
            errorCode: 'INSUFFICIENT_CASH_RECEIVED',
            error: `El efectivo recibido (${formatCentsWithHistoricalCurrency(
              cashReceivedCents,
              sessionCurrency,
            )}) es menor al total de la venta (${formatCentsWithHistoricalCurrency(
              totalCents,
              sessionCurrency,
            )}).`,
          }
        }

        validatedCashReceivedCents = cashReceivedCents
        validatedCashChangeCents = cashReceivedCents - totalCents
      } else {
        if (!externalVerifiedByOperator) {
          return {
            ok: false,
            errorCode: 'EXTERNAL_VERIFICATION_REQUIRED',
            error: `Para registrar un cobro manual con ${
              paymentMethod === 'card' ? 'tarjeta' : 'transferencia'
            }, debes confirmar que verificaste el pago externamente.`,
          }
        }
      }

      // 6. Verificar disponibilidad del almacenamiento antes de construir el commit
      const storage = resolveStorage()
      if (!storage || simulateStorageError) {
        return {
          ok: false,
          errorCode: 'STORAGE_ERROR',
          error: simulateStorageError
            ? 'Fallo simulado de persistencia: no se pudo guardar la transacción de venta. No se modificó el inventario, la caja ni el registro de ventas.'
            : 'El almacenamiento local no está disponible. No se realizó ningún cargo ni descuento de inventario.',
        }
      }

      // 7. Construir en memoria todos los registros coordinados (Venta + Partidas + Pago + Inventario + Caja)
      const now = new Date().toISOString()
      const nextFolioNumber = currentSalesData.lastFolioNumber + 1
      const folio = formatSaleFolio(nextFolioNumber)
      const nextSaleSequence = currentSalesData.lastSequence + 1
      const saleId = generatePosId('sale')
      const paymentId = generatePosId('spay')
      const cleanOperator = operatorName.trim() || 'Operador de Demostración'

      // 7a. Movimientos de salida de inventario y actualización de balances
      let nextInvSequence = currentInventory.lastSequence
      const nextBalancesMap = new Map<string, InventoryBalance>()
      for (const bal of currentInventory.balances) {
        nextBalancesMap.set(`${bal.branchId}:${bal.productId}`, { ...bal })
      }

      const newInventoryMovements: InventoryMovement[] = []
      const saleLines: SaleLineItem[] = []
      const inventoryMovementIds: string[] = []

      for (const draftLine of normalizedLinesDraft) {
        const balanceKey = `${targetBranchId}:${draftLine.product.id}`
        const currentBal = nextBalancesMap.get(balanceKey)!
        const previousQuantity = currentBal.quantity
        const newQuantity = subtractControlledQuantities(
          previousQuantity,
          draftLine.quantity,
        )

        nextInvSequence += 1
        const invMovId = generateInventoryId('mov')
        const invMovement: InventoryMovement = {
          id: invMovId,
          organizationId,
          branchId: targetBranchId,
          productId: draftLine.product.id,
          type: 'sale_out',
          delta: -draftLine.quantity,
          previousQuantity,
          newQuantity,
          reason: `Salida por venta en Punto de Venta (${folio})`,
          reference: folio,
          operatorName: cleanOperator,
          createdAt: now,
          sequence: nextInvSequence,
          operationId: `${cleanOperationId}-inv-${draftLine.product.id}`,
        }

        newInventoryMovements.push(invMovement)
        inventoryMovementIds.push(invMovId)

        nextBalancesMap.set(balanceKey, {
          ...currentBal,
          quantity: newQuantity,
          updatedAt: now,
          version: currentBal.version + 1,
        })

        saleLines.push({
          id: generatePosId('sline'),
          productId: draftLine.product.id,
          productName: draftLine.product.name,
          sku: draftLine.product.sku,
          barcodeUsed: draftLine.barcodeUsed,
          unit: draftLine.product.unit,
          quantity: draftLine.quantity,
          unitPriceCents: draftLine.unitPriceCents,
          lineSubtotalCents: draftLine.lineSubtotalCents,
          historicalUnitCostCents: draftLine.historicalUnitCostCents,
          inventoryMovementId: invMovId,
        })
      }

      const nextInventory: OrganizationInventoryData = {
        ...currentInventory,
        storageRevision: currentInventory.storageRevision + 1,
        lastSequence: nextInvSequence,
        balances: Array.from(nextBalancesMap.values()),
        movements: [...newInventoryMovements, ...currentInventory.movements],
      }

      // 7b. Movimiento de caja (SOLO si el método de pago es efectivo)
      //     Se registra como entrada a caja el TOTAL de la venta, no el efectivo recibido.
      let cashMovementId: string | null = null
      let nextCashData: OrganizationCashData = {
        ...currentCashData,
        storageRevision: currentCashData.storageRevision + 1,
      }

      if (paymentMethod === 'cash') {
        const currentSessionTotals = calculateSessionComputedTotals(
          openSession,
          currentCashData.movements,
        )
        const nextCashSequence = currentCashData.lastSequence + 1
        const balanceAfterCents =
          currentSessionTotals.expectedBalanceCents + totalCents

        const cashMov: CashMovement = {
          id: generateCashId('cmov'),
          organizationId,
          branchId: targetBranchId,
          registerId: openSession.registerId,
          sessionId: openSession.id,
          type: 'cash_sale',
          direction: 'in',
          amountCents: totalCents,
          balanceAfterCents,
          currency: sessionCurrency,
          reason: `Cobro de venta en efectivo (${folio})`,
          reference: folio,
          isCompensatory: false,
          compensatedMovementId: null,
          operatorName: cleanOperator,
          createdAt: now,
          sequence: nextCashSequence,
          operationId: `${cleanOperationId}-cash`,
        }

        cashMovementId = cashMov.id

        const updatedOpenSession: CashSession = {
          ...openSession,
          version: openSession.version + 1,
        }

        nextCashData = {
          ...currentCashData,
          storageRevision: currentCashData.storageRevision + 1,
          lastSequence: nextCashSequence,
          sessions: currentCashData.sessions.map((s) =>
            s.id === openSession.id ? updatedOpenSession : s,
          ),
          movements: [cashMov, ...currentCashData.movements],
        }
      }

      // 7c. Registro de pago y registro de venta
      const paymentRecord: SalePaymentRecord = {
        id: paymentId,
        method: paymentMethod,
        currency: sessionCurrency,
        amountCents: totalCents,
        cashReceivedCents: validatedCashReceivedCents,
        cashChangeCents: validatedCashChangeCents,
        externalReference:
          paymentMethod !== 'cash' && externalReference?.trim()
            ? externalReference.trim()
            : null,
        externalVerifiedByOperator:
          paymentMethod === 'cash' ? true : Boolean(externalVerifiedByOperator),
        cashMovementId,
      }

      const initialAuditEvent: SaleAuditEvent = {
        id: generatePosId('op'),
        saleId,
        eventType: 'sale_created',
        actionSummary: `Venta registrada por ${formatCentsWithHistoricalCurrency(
          totalCents,
          sessionCurrency,
        )} (${paymentMethod === 'cash' ? 'Efectivo' : paymentMethod === 'card' ? 'Tarjeta' : 'Transferencia'})`,
        operatorName: cleanOperator,
        createdAt: now,
        relatedFolio: folio,
        notes: null,
      }

      const saleRecord: SaleRecord = {
        id: saleId,
        folio,
        folioNumber: nextFolioNumber,
        organizationId,
        organizationName,
        branchId: targetBranchId,
        branchName: defaultBranch.name,
        registerId: currentCashData.register.id,
        registerName: currentCashData.register.name,
        registerCode: currentCashData.register.code,
        sessionId: openSession.id,
        operatorName: cleanOperator,
        createdAt: now,
        currency: sessionCurrency,
        subtotalCents,
        totalCents,
        itemsCount: saleLines.length,
        lines: saleLines,
        payment: paymentRecord,
        inventoryMovementIds,
        cashMovementId,
        sequence: nextSaleSequence,
        operationId: cleanOperationId,
        status: 'completed',
        refundedTotalCents: 0,
        netTotalCents: totalCents,
        returnsCount: 0,
        returns: [],
        auditEvents: [initialAuditEvent],
      }

      const nextSalesData: OrganizationSalesData = {
        organizationId,
        branchId: targetBranchId,
        branchName: defaultBranch.name,
        storageRevision: currentSalesData.storageRevision + 1,
        lastFolioNumber: nextFolioNumber,
        lastReturnFolioNumber: currentSalesData.lastReturnFolioNumber ?? 0,
        lastSequence: nextSaleSequence,
        sales: [saleRecord, ...currentSalesData.sales],
      }

      // 8. Persistir la instantánea completa (Inventario + Caja + Ventas) en UNA SOLA operación atómica
      const txEnvelope: StoredBranchTransactionEnvelope = {
        schemaVersion: BRANCH_TX_SCHEMA_VERSION,
        organizationId,
        branchId: targetBranchId,
        branchName: defaultBranch.name,
        updatedAt: now,
        data: {
          inventory: cloneInventoryData(nextInventory),
          cashData: cloneCashData(nextCashData),
          salesData: cloneSalesData(nextSalesData),
        },
      }

      const txKey = getOrganizationBranchTransactionStorageKey(
        organizationId,
        targetBranchId,
      )
      const serialized = JSON.stringify(txEnvelope)

      try {
        storage.setItem(txKey, serialized)
        const verifyRead = storage.getItem(txKey)
        if (verifyRead !== serialized) {
          return {
            ok: false,
            errorCode: 'STORAGE_ERROR',
            error:
              'No se pudo verificar la escritura atómica de la transacción de venta en localStorage.',
          }
        }
      } catch {
        return {
          ok: false,
          errorCode: 'STORAGE_ERROR',
          error:
            'Error al guardar la transacción en localStorage. No quedó ninguna venta, pago, descuento de stock ni movimiento de caja parcialmente registrado.',
        }
      }

      return {
        ok: true,
        idempotentReplay: false,
        sale: saleRecord,
        inventory: nextInventory,
        cashData: nextCashData,
        salesData: nextSalesData,
        updatedAt: now,
      }
    },

    cancelSale(params: CancelSaleParams): CancelSaleOutcome {
      const {
        organizationId,
        branchId,
        saleId,
        reason,
        operatorName,
        operationId,
        externalReference = null,
        externalVerifiedByOperator = false,
        simulateStorageError = false,
      } = params

      if (!organizationId.trim() || !saleId.trim()) {
        return {
          ok: false,
          errorCode: 'INVALID_CONTEXT',
          error: 'Parámetros de contexto o venta inválidos.',
        }
      }

      const cleanOpId = operationId.trim()
      if (!cleanOpId) {
        return {
          ok: false,
          errorCode: 'INVALID_CONTEXT',
          error: 'Se requiere un identificador de idempotencia válido.',
        }
      }

      const cleanReason = reason.trim()
      if (cleanReason.length < 3) {
        return {
          ok: false,
          errorCode: 'INVALID_CONTEXT',
          error:
            'Debes capturar un motivo válido para la cancelación (mínimo 3 caracteres).',
        }
      }

      const defaultBranch = getBranchForOrganization(organizationId)
      const targetBranchId = branchId ?? defaultBranch.id

      // 1. Cargar historial y ubicar venta
      const currentSalesData = loadSalesInternal(organizationId, targetBranchId)
      const targetSale = currentSalesData.sales.find((s) => s.id === saleId)

      if (!targetSale || targetSale.organizationId !== organizationId) {
        return {
          ok: false,
          errorCode: 'SALE_NOT_FOUND',
          error: 'No se encontró la venta solicitada en la organización activa.',
        }
      }

      // 2. Verificar idempotencia: si ya existe una cancelación con este operationId
      for (const s of currentSalesData.sales) {
        const existingReturn = (s.returns ?? []).find(
          (r) => r.operationId === cleanOpId,
        )
        if (existingReturn) {
          return {
            ok: true,
            idempotentReplay: true,
            sale: s,
            returnRecord: existingReturn,
            updatedAt: existingReturn.createdAt,
          }
        }
      }

      // 3. Reglas de elegibilidad para Cancelación:
      const currentComputed = deriveSaleComputedTotals(targetSale)
      if (currentComputed.status === 'cancelled') {
        return {
          ok: false,
          errorCode: 'SALE_ALREADY_CANCELLED',
          error: 'La venta ya se encuentra cancelada.',
        }
      }

      if (
        currentComputed.returnsCount > 0 ||
        currentComputed.refundedTotalCents > 0
      ) {
        return {
          ok: false,
          errorCode: 'SALE_HAS_PREVIOUS_RETURNS',
          error:
            'La venta ya cuenta con devoluciones previas registradas. Las ventas con devoluciones parciales no pueden cancelarse completamente; utiliza el flujo de Devolución para las partidas pendientes.',
        }
      }

      // c) Sesión original de caja debe seguir ABIERTA
      const cashLoad = cashRepo.load(organizationId, targetBranchId)
      const currentCashData = cashLoad.cashData
      const originalSession = currentCashData.sessions.find(
        (s) => s.id === targetSale.sessionId && s.status === 'open',
      )

      if (!originalSession) {
        return {
          ok: false,
          errorCode: 'ORIGINAL_SESSION_CLOSED',
          error:
            'La sesión de caja original en la que se cobró esta venta ya fue cerrada. Las ventas de turnos cerrados no pueden cancelarse completamente; deben tramitarse mediante Devolución afectando la sesión de caja abierta actual.',
        }
      }

      if (originalSession.currency !== targetSale.currency) {
        return {
          ok: false,
          errorCode: 'INCOMPATIBLE_CURRENCY',
          error: `Moneda incompatible entre la sesión original (${originalSession.currency}) y la venta (${targetSale.currency}).`,
        }
      }

      // d) Si el método original fue efectivo: verificar saldo suficiente en originalSession
      if (targetSale.payment.method === 'cash') {
        const sessionTotals = calculateSessionComputedTotals(
          originalSession,
          currentCashData.movements,
        )
        if (sessionTotals.expectedBalanceCents < targetSale.totalCents) {
          return {
            ok: false,
            errorCode: 'INSUFFICIENT_CASH_BALANCE',
            error: `Saldo insuficiente en la sesión de caja para entregar el reembolso en efectivo. Saldo disponible: ${formatCentsWithHistoricalCurrency(
              sessionTotals.expectedBalanceCents,
              originalSession.currency,
            )}, Requerido: ${formatCentsWithHistoricalCurrency(
              targetSale.totalCents,
              targetSale.currency,
            )}.`,
          }
        }
      } else {
        if (!externalVerifiedByOperator) {
          return {
            ok: false,
            errorCode: 'EXTERNAL_VERIFICATION_REQUIRED',
            error: `Debes confirmar que el reembolso externo por ${
              targetSale.payment.method === 'card' ? 'tarjeta' : 'transferencia'
            } fue verificado y entregado fuera del sistema.`,
          }
        }
      }

      // 4. Verificar persistencia disponible
      const storage = resolveStorage()
      if (!storage || simulateStorageError) {
        return {
          ok: false,
          errorCode: 'STORAGE_ERROR',
          error: simulateStorageError
            ? 'Fallo simulado de persistencia: no se pudo guardar la cancelación. El inventario, la caja y la venta permanecieron intactos.'
            : 'El almacenamiento local no está disponible.',
        }
      }

      // 5. Construir registros en memoria
      const now = new Date().toISOString()
      const cleanOperator = operatorName.trim() || 'Operador de Demostración'
      const nextReturnFolioNumber =
        (currentSalesData.lastReturnFolioNumber ?? 0) + 1
      const returnFolio = formatReturnFolio(nextReturnFolioNumber)
      const returnId = generatePosId('ret')
      const refundId = generatePosId('ref')

      // 5a. Inventario: reingreso de todas las partidas como vendibles
      const invLoad = inventoryRepo.load(organizationId, targetBranchId)
      const currentInv = invLoad.inventory
      let nextInvSeq = currentInv.lastSequence
      const balancesMap = new Map<string, InventoryBalance>()
      for (const b of currentInv.balances) {
        balancesMap.set(`${b.branchId}:${b.productId}`, { ...b })
      }

      const newInvMovements: InventoryMovement[] = []
      const returnLines: SaleReturnLineItem[] = []

      for (const line of targetSale.lines) {
        const key = `${targetBranchId}:${line.productId}`
        const existingBal = balancesMap.get(key)
        const prevQty = existingBal ? existingBal.quantity : 0
        const newQty = addControlledQuantities(prevQty, line.quantity)

        nextInvSeq += 1
        const invMovId = generateInventoryId('mov')
        const invMov: InventoryMovement = {
          id: invMovId,
          organizationId,
          branchId: targetBranchId,
          productId: line.productId,
          type: 'sale_return_in',
          delta: line.quantity,
          previousQuantity: prevQty,
          newQuantity: newQty,
          reason: `Reingreso por cancelación total (${returnFolio} / ${targetSale.folio}): ${cleanReason}`,
          reference: returnFolio,
          operatorName: cleanOperator,
          createdAt: now,
          sequence: nextInvSeq,
          operationId: `${cleanOpId}-inv-${line.id}`,
        }
        newInvMovements.push(invMov)

        if (existingBal) {
          balancesMap.set(key, {
            ...existingBal,
            quantity: newQty,
            updatedAt: now,
            version: existingBal.version + 1,
          })
        }

        returnLines.push({
          saleLineId: line.id,
          productId: line.productId,
          productName: line.productName,
          sku: line.sku,
          barcodeUsed: line.barcodeUsed,
          unit: line.unit,
          returnedQuantity: line.quantity,
          unitPriceCents: line.unitPriceCents,
          refundCents: line.lineSubtotalCents,
          destination: 'sellable',
          inventoryMovementId: invMovId,
        })
      }

      const nextInventory: OrganizationInventoryData = {
        ...currentInv,
        storageRevision: currentInv.storageRevision + 1,
        lastSequence: nextInvSeq,
        balances: Array.from(balancesMap.values()),
        movements: [...newInvMovements, ...currentInv.movements],
      }

      // 5b. Caja: si efectivo, registrar salida por reembolso en la sesión original
      let nextCashData = {
        ...currentCashData,
        storageRevision: currentCashData.storageRevision + 1,
      }
      let cashMovementId: string | null = null

      if (targetSale.payment.method === 'cash') {
        const sessionTotals = calculateSessionComputedTotals(
          originalSession,
          currentCashData.movements,
        )
        const nextCashSeq = currentCashData.lastSequence + 1
        const balanceAfterCents =
          sessionTotals.expectedBalanceCents - targetSale.totalCents

        const cashMov: CashMovement = {
          id: generateCashId('cmov'),
          organizationId,
          branchId: targetBranchId,
          registerId: originalSession.registerId,
          sessionId: originalSession.id,
          type: 'cash_refund',
          direction: 'out',
          amountCents: targetSale.totalCents,
          balanceAfterCents,
          currency: targetSale.currency,
          reason: `Reembolso por cancelación de venta (${returnFolio} / ${targetSale.folio}): ${cleanReason}`,
          reference: returnFolio,
          isCompensatory: false,
          compensatedMovementId: null,
          operatorName: cleanOperator,
          createdAt: now,
          sequence: nextCashSeq,
          operationId: `${cleanOpId}-cash`,
        }
        cashMovementId = cashMov.id

        const updatedSession: CashSession = {
          ...originalSession,
          version: originalSession.version + 1,
        }

        nextCashData = {
          ...currentCashData,
          storageRevision: currentCashData.storageRevision + 1,
          lastSequence: nextCashSeq,
          sessions: currentCashData.sessions.map((s) =>
            s.id === originalSession.id ? updatedSession : s,
          ),
          movements: [cashMov, ...currentCashData.movements],
        }
      }

      // 5c. Reembolso, Devolución y Auditoría
      const refundRecord: SaleRefundRecord = {
        id: refundId,
        saleId: targetSale.id,
        returnId,
        method: targetSale.payment.method,
        currency: targetSale.currency,
        amountCents: targetSale.totalCents,
        cashSessionId:
          targetSale.payment.method === 'cash' ? originalSession.id : null,
        cashMovementId,
        externalReference:
          targetSale.payment.method !== 'cash' && externalReference?.trim()
            ? externalReference.trim()
            : null,
        externalVerifiedByOperator:
          targetSale.payment.method === 'cash'
            ? true
            : Boolean(externalVerifiedByOperator),
        operatorName: cleanOperator,
        createdAt: now,
      }

      const returnRecord: SaleReturnRecord = {
        id: returnId,
        returnFolio,
        returnFolioNumber: nextReturnFolioNumber,
        organizationId,
        branchId: targetBranchId,
        branchName: defaultBranch.name,
        saleId: targetSale.id,
        saleFolio: targetSale.folio,
        type: 'cancelation',
        reason: cleanReason,
        operatorName: cleanOperator,
        createdAt: now,
        lines: returnLines,
        totalRefundCents: targetSale.totalCents,
        refund: refundRecord,
        operationId: cleanOpId,
        sequence: currentSalesData.lastSequence + 1,
      }

      const auditEvent: SaleAuditEvent = {
        id: generatePosId('op'),
        saleId: targetSale.id,
        eventType: 'sale_cancelled',
        actionSummary: `Venta cancelada en su totalidad (${returnFolio}). Reembolso: ${formatCentsWithHistoricalCurrency(
          targetSale.totalCents,
          targetSale.currency,
        )} (${targetSale.payment.method}). Todas las partidas reingresadas a stock vendible.`,
        operatorName: cleanOperator,
        createdAt: now,
        relatedFolio: returnFolio,
        notes: cleanReason,
      }

      const updatedSale: SaleRecord = {
        ...targetSale,
        status: 'cancelled',
        refundedTotalCents: targetSale.totalCents,
        netTotalCents: 0,
        returnsCount: (targetSale.returnsCount ?? 0) + 1,
        returns: [returnRecord, ...(targetSale.returns ?? [])],
        auditEvents: [auditEvent, ...(targetSale.auditEvents ?? [])],
      }

      const nextSalesData: OrganizationSalesData = {
        ...currentSalesData,
        storageRevision: currentSalesData.storageRevision + 1,
        lastReturnFolioNumber: nextReturnFolioNumber,
        lastSequence: currentSalesData.lastSequence + 1,
        sales: currentSalesData.sales.map((s) =>
          s.id === targetSale.id ? updatedSale : s,
        ),
      }

      // 6. Escritura atómica única
      const txEnvelope: StoredBranchTransactionEnvelope = {
        schemaVersion: BRANCH_TX_SCHEMA_VERSION,
        organizationId,
        branchId: targetBranchId,
        branchName: defaultBranch.name,
        updatedAt: now,
        data: {
          inventory: cloneInventoryData(nextInventory),
          cashData: cloneCashData(nextCashData),
          salesData: cloneSalesData(nextSalesData),
        },
      }

      const txKey = getOrganizationBranchTransactionStorageKey(
        organizationId,
        targetBranchId,
      )
      const serialized = JSON.stringify(txEnvelope)

      try {
        storage.setItem(txKey, serialized)
        const verifyRead = storage.getItem(txKey)
        if (verifyRead !== serialized) {
          return {
            ok: false,
            errorCode: 'STORAGE_ERROR',
            error:
              'No se pudo verificar la persistencia de la cancelación en localStorage.',
          }
        }
      } catch {
        return {
          ok: false,
          errorCode: 'STORAGE_ERROR',
          error:
            'Error al persistir la cancelación en localStorage. Ningún cambio fue aplicado.',
        }
      }

      return {
        ok: true,
        idempotentReplay: false,
        sale: updatedSale,
        returnRecord,
        updatedAt: now,
      }
    },

    refundSale(params: RefundSaleParams): RefundSaleOutcome {
      const {
        organizationId,
        branchId,
        saleId,
        items,
        reason,
        operatorName,
        operationId,
        externalReference = null,
        externalVerifiedByOperator = false,
        simulateStorageError = false,
      } = params

      if (!organizationId.trim() || !saleId.trim()) {
        return {
          ok: false,
          errorCode: 'INVALID_CONTEXT',
          error: 'Parámetros de contexto o venta inválidos.',
        }
      }

      const cleanOpId = operationId.trim()
      if (!cleanOpId) {
        return {
          ok: false,
          errorCode: 'INVALID_CONTEXT',
          error: 'Se requiere un identificador de idempotencia válido.',
        }
      }

      const cleanReason = reason.trim()
      if (cleanReason.length < 3) {
        return {
          ok: false,
          errorCode: 'INVALID_CONTEXT',
          error:
            'Debes capturar un motivo válido para la devolución (mínimo 3 caracteres).',
        }
      }

      if (!Array.isArray(items) || items.length === 0) {
        return {
          ok: false,
          errorCode: 'EMPTY_REFUND_ITEMS',
          error: 'Debes seleccionar al menos un artículo para devolver.',
        }
      }

      const defaultBranch = getBranchForOrganization(organizationId)
      const targetBranchId = branchId ?? defaultBranch.id

      // 1. Cargar historial y ubicar venta
      const currentSalesData = loadSalesInternal(organizationId, targetBranchId)
      const targetSale = currentSalesData.sales.find((s) => s.id === saleId)

      if (!targetSale || targetSale.organizationId !== organizationId) {
        return {
          ok: false,
          errorCode: 'SALE_NOT_FOUND',
          error: 'No se encontró la venta solicitada en la organización activa.',
        }
      }

      // 2. Idempotencia: si ya existe devolución con este operationId
      for (const s of currentSalesData.sales) {
        const existingReturn = (s.returns ?? []).find(
          (r) => r.operationId === cleanOpId,
        )
        if (existingReturn) {
          return {
            ok: true,
            idempotentReplay: true,
            sale: s,
            returnRecord: existingReturn,
            updatedAt: existingReturn.createdAt,
          }
        }
      }

      // 3. Estado de la venta
      const currentComputed = deriveSaleComputedTotals(targetSale)
      if (currentComputed.status === 'cancelled') {
        return {
          ok: false,
          errorCode: 'SALE_ALREADY_CANCELLED',
          error: 'La venta está cancelada; no admite devoluciones.',
        }
      }

      if (currentComputed.status === 'fully_refunded') {
        return {
          ok: false,
          errorCode: 'SALE_ALREADY_FULLY_REFUNDED',
          error:
            'Esta venta ya fue devuelta en su totalidad (100% de las partidas reembolsadas).',
        }
      }

      // 4. Validar partidas seleccionadas y cantidades pendientes
      const linesMap = new Map<string, SaleLineItem>()
      for (const l of targetSale.lines) {
        linesMap.set(l.id, l)
      }

      const lineStatusMap = new Map<string, (typeof currentComputed.linesSummary)[0]>()
      for (const ls of currentComputed.linesSummary) {
        lineStatusMap.set(ls.line.id, ls)
      }

      let totalRefundCents = 0
      let totalReturnedItemsCount = 0
      const processedReturnLines: SaleReturnLineItem[] = []

      for (const it of items) {
        const targetLine = linesMap.get(it.saleLineId)
        if (!targetLine) {
          return {
            ok: false,
            errorCode: 'INVALID_REFUND_ITEMS',
            error: `La partida solicitada (${it.saleLineId}) no pertenece a esta venta.`,
          }
        }

        const lineStatus = lineStatusMap.get(it.saleLineId)!
        const returnQty = normalizeControlledQuantity(it.returnedQuantity)

        if (toScaledQuantity(returnQty) <= 0) {
          continue
        }

        if (
          !isQuantityCompatibleWithUnit(returnQty, targetLine.unit)
        ) {
          return {
            ok: false,
            errorCode: 'INVALID_REFUND_QUANTITY',
            error: `La cantidad a devolver (${returnQty}) no es compatible con la unidad ${getUnitLabel(
              targetLine.unit,
            )}.`,
          }
        }

        if (
          toScaledQuantity(returnQty) >
          toScaledQuantity(lineStatus.remainingReturnableQuantity)
        ) {
          return {
            ok: false,
            errorCode: 'QUANTITY_EXCEEDS_PENDING',
            error: `La cantidad solicitada para devolver de "${
              targetLine.productName
            }" (${formatQuantityWithUnit(
              returnQty,
              targetLine.unit,
            )}) supera la cantidad pendiente disponible (${formatQuantityWithUnit(
              lineStatus.remainingReturnableQuantity,
              targetLine.unit,
            )}).`,
          }
        }

        const lineRefundCents = calculateReturnLineRefundCents(
          targetLine,
          lineStatus.returnedQuantity,
          lineStatus.refundedCents,
          returnQty,
        )

        totalRefundCents += lineRefundCents
        totalReturnedItemsCount += 1

        processedReturnLines.push({
          saleLineId: targetLine.id,
          productId: targetLine.productId,
          productName: targetLine.productName,
          sku: targetLine.sku,
          barcodeUsed: targetLine.barcodeUsed,
          unit: targetLine.unit,
          returnedQuantity: returnQty,
          unitPriceCents: targetLine.unitPriceCents,
          refundCents: lineRefundCents,
          destination: it.destination === 'unsellable' ? 'unsellable' : 'sellable',
          inventoryMovementId: null, // Se asignará si es vendible
        })
      }

      if (totalReturnedItemsCount === 0 || totalRefundCents <= 0) {
        return {
          ok: false,
          errorCode: 'INVALID_REFUND_AMOUNT',
          error:
            'Debes ingresar al menos una cantidad válida mayor a cero para procesar la devolución.',
        }
      }

      // 5. Validar método de reembolso y disponibilidad de caja
      const cashLoad = cashRepo.load(organizationId, targetBranchId)
      const currentCashData = cashLoad.cashData
      let openSession: CashSession | null = null

      if (targetSale.payment.method === 'cash') {
        openSession =
          currentCashData.sessions.find(
            (s) =>
              s.organizationId === organizationId &&
              s.branchId === targetBranchId &&
              s.status === 'open',
          ) ?? null

        if (!openSession) {
          return {
            ok: false,
            errorCode: 'NO_OPEN_CASH_SESSION',
            error:
              'Se requiere una sesión de caja abierta en esta sucursal para entregar el reembolso en efectivo.',
          }
        }

        if (openSession.currency !== targetSale.currency) {
          return {
            ok: false,
            errorCode: 'INCOMPATIBLE_CURRENCY',
            error: `La sesión de caja abierta está fijada en ${openSession.currency}, incompatible con la moneda de la venta (${targetSale.currency}). No se mezclan divisas.`,
          }
        }

        const sessionTotals = calculateSessionComputedTotals(
          openSession,
          currentCashData.movements,
        )
        if (sessionTotals.expectedBalanceCents < totalRefundCents) {
          return {
            ok: false,
            errorCode: 'INSUFFICIENT_CASH_BALANCE',
            error: `Saldo insuficiente en la sesión de caja abierta para entregar el reembolso en efectivo. Saldo disponible: ${formatCentsWithHistoricalCurrency(
              sessionTotals.expectedBalanceCents,
              openSession.currency,
            )}, Reembolso requerido: ${formatCentsWithHistoricalCurrency(
              totalRefundCents,
              targetSale.currency,
            )}.`,
          }
        }
      } else {
        if (!externalVerifiedByOperator) {
          return {
            ok: false,
            errorCode: 'EXTERNAL_VERIFICATION_REQUIRED',
            error: `Debes confirmar que el reembolso externo por ${
              targetSale.payment.method === 'card' ? 'tarjeta' : 'transferencia'
            } fue verificado y entregado fuera del sistema.`,
          }
        }
      }

      // 6. Verificar persistencia disponible
      const storage = resolveStorage()
      if (!storage || simulateStorageError) {
        return {
          ok: false,
          errorCode: 'STORAGE_ERROR',
          error: simulateStorageError
            ? 'Fallo simulado de persistencia: no se pudo guardar la devolución. Ningún saldo ni registro fue alterado.'
            : 'El almacenamiento local no está disponible.',
        }
      }

      // 7. Construir registros en memoria
      const now = new Date().toISOString()
      const cleanOperator = operatorName.trim() || 'Operador de Demostración'
      const nextReturnFolioNumber =
        (currentSalesData.lastReturnFolioNumber ?? 0) + 1
      const returnFolio = formatReturnFolio(nextReturnFolioNumber)
      const returnId = generatePosId('ret')
      const refundId = generatePosId('ref')

      // 7a. Inventario: reingresar SOLO las partidas con destination === 'sellable'
      const invLoad = inventoryRepo.load(organizationId, targetBranchId)
      const currentInv = invLoad.inventory
      let nextInvSeq = currentInv.lastSequence
      const balancesMap = new Map<string, InventoryBalance>()
      for (const b of currentInv.balances) {
        balancesMap.set(`${b.branchId}:${b.productId}`, { ...b })
      }

      const newInvMovements: InventoryMovement[] = []
      const finalReturnLines: SaleReturnLineItem[] = []

      for (const pLine of processedReturnLines) {
        let invMovId: string | null = null

        if (pLine.destination === 'sellable') {
          const key = `${targetBranchId}:${pLine.productId}`
          const existingBal = balancesMap.get(key)
          const prevQty = existingBal ? existingBal.quantity : 0
          const newQty = addControlledQuantities(prevQty, pLine.returnedQuantity)

          nextInvSeq += 1
          invMovId = generateInventoryId('mov')
          const invMov: InventoryMovement = {
            id: invMovId,
            organizationId,
            branchId: targetBranchId,
            productId: pLine.productId,
            type: 'sale_return_in',
            delta: pLine.returnedQuantity,
            previousQuantity: prevQty,
            newQuantity: newQty,
            reason: `Reingreso por devolución de venta (${returnFolio} / ${targetSale.folio}): ${cleanReason}`,
            reference: returnFolio,
            operatorName: cleanOperator,
            createdAt: now,
            sequence: nextInvSeq,
            operationId: `${cleanOpId}-inv-${pLine.saleLineId}`,
          }
          newInvMovements.push(invMov)

          if (existingBal) {
            balancesMap.set(key, {
              ...existingBal,
              quantity: newQty,
              updatedAt: now,
              version: existingBal.version + 1,
            })
          }
        }

        finalReturnLines.push({
          ...pLine,
          inventoryMovementId: invMovId,
        })
      }

      const nextInventory: OrganizationInventoryData = {
        ...currentInv,
        storageRevision: currentInv.storageRevision + 1,
        lastSequence: nextInvSeq,
        balances: Array.from(balancesMap.values()),
        movements: [...newInvMovements, ...currentInv.movements],
      }

      // 7b. Caja: si efectivo, registrar salida por reembolso en openSession actual
      let nextCashData = {
        ...currentCashData,
        storageRevision: currentCashData.storageRevision + 1,
      }
      let cashMovementId: string | null = null

      if (targetSale.payment.method === 'cash' && openSession) {
        const sessionTotals = calculateSessionComputedTotals(
          openSession,
          currentCashData.movements,
        )
        const nextCashSeq = currentCashData.lastSequence + 1
        const balanceAfterCents =
          sessionTotals.expectedBalanceCents - totalRefundCents

        const cashMov: CashMovement = {
          id: generateCashId('cmov'),
          organizationId,
          branchId: targetBranchId,
          registerId: openSession.registerId,
          sessionId: openSession.id,
          type: 'cash_refund',
          direction: 'out',
          amountCents: totalRefundCents,
          balanceAfterCents,
          currency: targetSale.currency,
          reason: `Reembolso por devolución de venta (${returnFolio} / ${targetSale.folio}): ${cleanReason}`,
          reference: returnFolio,
          isCompensatory: false,
          compensatedMovementId: null,
          operatorName: cleanOperator,
          createdAt: now,
          sequence: nextCashSeq,
          operationId: `${cleanOpId}-cash`,
        }
        cashMovementId = cashMov.id

        const updatedSession: CashSession = {
          ...openSession,
          version: openSession.version + 1,
        }

        nextCashData = {
          ...currentCashData,
          storageRevision: currentCashData.storageRevision + 1,
          lastSequence: nextCashSeq,
          sessions: currentCashData.sessions.map((s) =>
            s.id === openSession!.id ? updatedSession : s,
          ),
          movements: [cashMov, ...currentCashData.movements],
        }
      }

      // 7c. Reembolso, Devolución y Auditoría
      const refundRecord: SaleRefundRecord = {
        id: refundId,
        saleId: targetSale.id,
        returnId,
        method: targetSale.payment.method,
        currency: targetSale.currency,
        amountCents: totalRefundCents,
        cashSessionId:
          targetSale.payment.method === 'cash' && openSession
            ? openSession.id
            : null,
        cashMovementId,
        externalReference:
          targetSale.payment.method !== 'cash' && externalReference?.trim()
            ? externalReference.trim()
            : null,
        externalVerifiedByOperator:
          targetSale.payment.method === 'cash'
            ? true
            : Boolean(externalVerifiedByOperator),
        operatorName: cleanOperator,
        createdAt: now,
      }

      const returnRecord: SaleReturnRecord = {
        id: returnId,
        returnFolio,
        returnFolioNumber: nextReturnFolioNumber,
        organizationId,
        branchId: targetBranchId,
        branchName: defaultBranch.name,
        saleId: targetSale.id,
        saleFolio: targetSale.folio,
        type: 'return',
        reason: cleanReason,
        operatorName: cleanOperator,
        createdAt: now,
        lines: finalReturnLines,
        totalRefundCents,
        refund: refundRecord,
        operationId: cleanOpId,
        sequence: currentSalesData.lastSequence + 1,
      }

      // 7d. Determinar nuevo estado de la venta
      const combinedReturns = [returnRecord, ...(targetSale.returns ?? [])]
      const nextRefundedTotalCents =
        (targetSale.refundedTotalCents ?? 0) + totalRefundCents
      const nextNetTotalCents = Math.max(0, targetSale.totalCents - nextRefundedTotalCents)

      const provisionalSale: SaleRecord = {
        ...targetSale,
        returns: combinedReturns,
        refundedTotalCents: nextRefundedTotalCents,
        netTotalCents: nextNetTotalCents,
        returnsCount: combinedReturns.length,
      }

      const postDerived = deriveSaleComputedTotals(provisionalSale)

      const auditEvent: SaleAuditEvent = {
        id: generatePosId('op'),
        saleId: targetSale.id,
        eventType: 'sale_returned',
        actionSummary: `Devolución procesada (${returnFolio}). Reembolso: ${formatCentsWithHistoricalCurrency(
          totalRefundCents,
          targetSale.currency,
        )} (${targetSale.payment.method}). Estado resultante: ${
          postDerived.status === 'fully_refunded'
            ? 'Devuelta totalmente'
            : 'Devuelta parcialmente'
        }.`,
        operatorName: cleanOperator,
        createdAt: now,
        relatedFolio: returnFolio,
        notes: cleanReason,
      }

      const updatedSale: SaleRecord = {
        ...provisionalSale,
        status: postDerived.status,
        auditEvents: [auditEvent, ...(targetSale.auditEvents ?? [])],
      }

      const nextSalesData: OrganizationSalesData = {
        ...currentSalesData,
        storageRevision: currentSalesData.storageRevision + 1,
        lastReturnFolioNumber: nextReturnFolioNumber,
        lastSequence: currentSalesData.lastSequence + 1,
        sales: currentSalesData.sales.map((s) =>
          s.id === targetSale.id ? updatedSale : s,
        ),
      }

      // 8. Persistencia atómica unificada
      const txEnvelope: StoredBranchTransactionEnvelope = {
        schemaVersion: BRANCH_TX_SCHEMA_VERSION,
        organizationId,
        branchId: targetBranchId,
        branchName: defaultBranch.name,
        updatedAt: now,
        data: {
          inventory: cloneInventoryData(nextInventory),
          cashData: cloneCashData(nextCashData),
          salesData: cloneSalesData(nextSalesData),
        },
      }

      const txKey = getOrganizationBranchTransactionStorageKey(
        organizationId,
        targetBranchId,
      )
      const serialized = JSON.stringify(txEnvelope)

      try {
        storage.setItem(txKey, serialized)
        const verifyRead = storage.getItem(txKey)
        if (verifyRead !== serialized) {
          return {
            ok: false,
            errorCode: 'STORAGE_ERROR',
            error:
              'No se pudo verificar la persistencia de la devolución en localStorage.',
          }
        }
      } catch {
        return {
          ok: false,
          errorCode: 'STORAGE_ERROR',
          error:
            'Error al persistir la devolución en localStorage. Ningún cambio fue aplicado.',
        }
      }

      return {
        ok: true,
        idempotentReplay: false,
        sale: updatedSale,
        returnRecord,
        updatedAt: now,
      }
    },
  }
}

export const defaultPosSalesCoordinator = createLocalPosSalesCoordinator()

