import type { StorageLike } from '../../../services/settings/organizationSettingsRepository'
import type { Organization } from '../../../types'
import type { SaleRecord, SaleReturnRecord } from '../../pos/types'
import { deriveSaleComputedTotals } from '../../pos/utils/posMoneyAndQuantityUtils'
import type {
  TicketConfig,
  TicketDocumentType,
  TicketLineItemSnapshot,
  TicketReprintEvent,
  TicketSnapshot,
} from '../types'
import { copyDurableLogo } from './durableLogoStorage'
import { defaultTicketConfigRepository } from './ticketConfigRepository'

export const TICKET_SNAPSHOTS_SCHEMA_VERSION = 1

export function getTicketSnapshotsStorageKey(organizationId: string): string {
  return `nedaxoli_demo_ticket_snapshots_v${TICKET_SNAPSHOTS_SCHEMA_VERSION}_${organizationId}`
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

export function generateTicketId(prefix: 'tkt' | 'rep'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export class TicketSnapshotService {
  private storage: StorageLike | null

  constructor(storage: StorageLike | null = getBrowserLocalStorage()) {
    this.storage = storage
  }

  loadAllTickets(organizationId: string): TicketSnapshot[] {
    if (!this.storage) return []
    try {
      const key = getTicketSnapshotsStorageKey(organizationId)
      const raw = this.storage.getItem(key)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  saveTickets(organizationId: string, tickets: TicketSnapshot[]): void {
    if (!this.storage) return
    try {
      const key = getTicketSnapshotsStorageKey(organizationId)
      this.storage.setItem(key, JSON.stringify(tickets))
    } catch (err) {
      console.warn('[TicketSnapshotService] Error al guardar tickets:', err)
    }
  }

  getTicketById(organizationId: string, ticketId: string): TicketSnapshot | null {
    const tickets = this.loadAllTickets(organizationId)
    return tickets.find((t) => t.id === ticketId) ?? null
  }

  getTicketForSale(organizationId: string, saleId: string): TicketSnapshot | null {
    const tickets = this.loadAllTickets(organizationId)
    return (
      tickets.find(
        (t) => t.saleId === saleId && t.documentType === 'sale_ticket',
      ) ?? null
    )
  }

  getSnapshotForSale(organizationId: string, saleId: string): TicketSnapshot | null {
    return this.getTicketForSale(organizationId, saleId)
  }

  getTicketForReturn(
    organizationId: string,
    returnFolioOrId: string,
  ): TicketSnapshot | null {
    const tickets = this.loadAllTickets(organizationId)
    return (
      tickets.find(
        (t) =>
          t.returnFolio === returnFolioOrId ||
          t.id === returnFolioOrId ||
          t.ticketFolio === returnFolioOrId,
      ) ?? null
    )
  }

  getSnapshotForReturn(
    organizationId: string,
    returnFolioOrId: string,
  ): TicketSnapshot | null {
    return this.getTicketForReturn(organizationId, returnFolioOrId)
  }

  /**
   * Crea y persiste la instantánea inmutable del comprobante de venta al confirmar el cobro en POS.
   */
  async createSaleTicketSnapshot(params: {
    sale: SaleRecord
    organization: Organization
    config?: TicketConfig
    operatorName?: string
  }): Promise<TicketSnapshot> {
    const { sale, organization, operatorName } = params
    const config =
      params.config ?? defaultTicketConfigRepository.load(organization.id)

    const ticketId = generateTicketId('tkt')
    let logoStorageKey: string | null = null

    // Conservación durable de los bytes del logo vigente en el momento de la venta
    if (config.showLogo && organization.logo?.objectUrl) {
      const orgLogoKey = `org_logo_${organization.id}`
      const ticketLogoKey = `ticket_logo_${ticketId}`
      const copied = await copyDurableLogo(orgLogoKey, ticketLogoKey)
      if (copied) {
        logoStorageKey = ticketLogoKey
      }
    }

    const lines: TicketLineItemSnapshot[] = sale.lines.map((line) => ({
      saleLineId: line.id,
      productName: line.productName,
      sku: line.sku,
      unit: line.unit,
      quantity: line.quantity,
      unitPriceCents: line.unitPriceCents,
      lineSubtotalCents: line.lineSubtotalCents,
    }))

    const snapshot: TicketSnapshot = {
      id: ticketId,
      ticketFolio: `TKT-${sale.folio}`,
      documentType: 'sale_ticket',
      organizationId: organization.id,
      branchId: sale.branchId,
      branchName: sale.branchName,
      registerName: sale.registerName,
      registerCode: sale.registerCode,
      operatorName: operatorName || sale.operatorName,
      saleId: sale.id,
      saleFolio: sale.folio,
      createdAt: sale.createdAt,
      timezone: organization.preferences.timezone,
      dateFormat: organization.preferences.dateFormat,
      currency: sale.currency,
      configSnapshot: { ...config },
      businessProfileSnapshot: {
        commercialName: organization.businessProfile.commercialName,
        phone: organization.businessProfile.phone || null,
        email: organization.businessProfile.email || null,
        address: organization.businessProfile.address || null,
        website: organization.businessProfile.website || null,
      },
      logoStorageKey,
      lines,
      subtotalCents: sale.subtotalCents,
      totalCents: sale.totalCents,
      netTotalCents: sale.totalCents,
      paymentMethod: sale.payment.method,
      cashReceivedCents: sale.payment.cashReceivedCents ?? null,
      cashChangeCents: sale.payment.cashChangeCents ?? null,
      externalReference: sale.payment.externalReference ?? null,
      isReconstructed: false,
      reprintAuditTrail: [],
    }

    const existing = this.loadAllTickets(organization.id)
    const filtered = existing.filter((t) => t.id !== ticketId)
    this.saveTickets(organization.id, [snapshot, ...filtered])

    return snapshot
  }

  /**
   * Crea y persiste un comprobante separado para una devolución o cancelación confirmada.
   */
  async createReturnTicketSnapshot(params: {
    sale: SaleRecord
    returnRecord: SaleReturnRecord
    organization: Organization
    config?: TicketConfig
    operatorName?: string
  }): Promise<TicketSnapshot> {
    const { sale, returnRecord, organization, operatorName } = params
    const config =
      params.config ?? defaultTicketConfigRepository.load(organization.id)

    const ticketId = generateTicketId('tkt')
    const isCancel = returnRecord.type === 'cancelation'
    const docType: TicketDocumentType = isCancel
      ? 'cancellation_ticket'
      : 'refund_ticket'

    let logoStorageKey: string | null = null
    if (config.showLogo && organization.logo?.objectUrl) {
      const orgLogoKey = `org_logo_${organization.id}`
      const ticketLogoKey = `ticket_logo_${ticketId}`
      const copied = await copyDurableLogo(orgLogoKey, ticketLogoKey)
      if (copied) {
        logoStorageKey = ticketLogoKey
      }
    }

    const lines: TicketLineItemSnapshot[] = returnRecord.lines.map((rl) => ({
      saleLineId: rl.saleLineId,
      productName: rl.productName,
      sku: rl.sku,
      unit: rl.unit,
      quantity: rl.returnedQuantity,
      unitPriceCents: rl.unitPriceCents,
      lineSubtotalCents: rl.refundCents,
      returnedQuantity: rl.returnedQuantity,
      refundCents: rl.refundCents,
      destination: rl.destination,
    }))

    const derived = deriveSaleComputedTotals(sale)

    const snapshot: TicketSnapshot = {
      id: ticketId,
      ticketFolio: `TKT-${returnRecord.returnFolio}`,
      documentType: docType,
      organizationId: organization.id,
      branchId: returnRecord.branchId,
      branchName: returnRecord.branchName,
      registerName: sale.registerName,
      registerCode: sale.registerCode,
      operatorName: operatorName || returnRecord.operatorName,
      saleId: sale.id,
      saleFolio: sale.folio,
      returnFolio: returnRecord.returnFolio,
      returnReason: returnRecord.reason,
      createdAt: returnRecord.createdAt,
      timezone: organization.preferences.timezone,
      dateFormat: organization.preferences.dateFormat,
      currency: returnRecord.refund.currency,
      configSnapshot: { ...config },
      businessProfileSnapshot: {
        commercialName: organization.businessProfile.commercialName,
        phone: organization.businessProfile.phone || null,
        email: organization.businessProfile.email || null,
        address: organization.businessProfile.address || null,
        website: organization.businessProfile.website || null,
      },
      logoStorageKey,
      lines,
      subtotalCents: returnRecord.totalRefundCents,
      totalCents: returnRecord.totalRefundCents,
      refundTotalCents: returnRecord.totalRefundCents,
      netTotalCents: derived.netTotalCents,
      paymentMethod: returnRecord.refund.method,
      externalReference: returnRecord.refund.externalReference,
      isReconstructed: false,
      reprintAuditTrail: [],
    }

    const existing = this.loadAllTickets(organization.id)
    this.saveTickets(organization.id, [snapshot, ...existing])

    return snapshot
  }

  /**
   * Reconstruye de forma transparente y fiel el comprobante para ventas
   * generadas antes de esta fase, identificándolo explícitamente como reconstruido
   * sin inventar logos ni configuraciones ficticias.
   */
  reconstructLegacyTicketSnapshot(
    saleOrParams: SaleRecord | { sale: SaleRecord; organization: Organization },
    maybeOrganization?: Organization,
  ): TicketSnapshot {
    const sale = 'sale' in saleOrParams ? saleOrParams.sale : saleOrParams
    const organization =
      'organization' in saleOrParams
        ? saleOrParams.organization
        : (maybeOrganization as Organization)
    const defaultConfig = defaultTicketConfigRepository.load(organization.id)
    const derived = deriveSaleComputedTotals(sale)

    const lines: TicketLineItemSnapshot[] = sale.lines.map((line) => ({
      saleLineId: line.id,
      productName: line.productName,
      sku: line.sku,
      unit: line.unit,
      quantity: line.quantity,
      unitPriceCents: line.unitPriceCents,
      lineSubtotalCents: line.lineSubtotalCents,
    }))

    return {
      id: `legacy-${sale.id}`,
      ticketFolio: `TKT-${sale.folio}`,
      documentType:
        sale.status === 'cancelled' ? 'cancellation_ticket' : 'sale_ticket',
      organizationId: organization.id,
      branchId: sale.branchId,
      branchName: sale.branchName,
      registerName: sale.registerName,
      registerCode: sale.registerCode,
      operatorName: sale.operatorName,
      saleId: sale.id,
      saleFolio: sale.folio,
      createdAt: sale.createdAt,
      timezone: organization.preferences.timezone,
      dateFormat: organization.preferences.dateFormat,
      currency: sale.currency,
      configSnapshot: {
        ...defaultConfig,
        showLogo: false, // No atribuir logo actual retroactivamente a venta antigua
        headerMessage: null,
      },
      businessProfileSnapshot: {
        commercialName: organization.businessProfile.commercialName,
        phone: organization.businessProfile.phone || null,
        email: organization.businessProfile.email || null,
        address: organization.businessProfile.address || null,
        website: organization.businessProfile.website || null,
      },
      logoStorageKey: null,
      lines,
      subtotalCents: sale.subtotalCents,
      totalCents: sale.totalCents,
      refundTotalCents: derived.refundedTotalCents,
      netTotalCents: derived.netTotalCents,
      paymentMethod: sale.payment.method,
      cashReceivedCents: sale.payment.cashReceivedCents ?? null,
      cashChangeCents: sale.payment.cashChangeCents ?? null,
      externalReference: sale.payment.externalReference ?? null,
      isReconstructed: true,
      reprintAuditTrail: [],
    }
  }

  /**
   * Registra un intento de reimpresión en la bitácora inmutable del ticket,
   * sin modificar la venta comercial ni mover inventario o caja.
   */
  registerTicketReprint(params: {
    organizationId: string
    ticketId: string
    operatorName: string
    reason?: string | null
  }): TicketSnapshot | null {
    const { organizationId, ticketId, operatorName, reason } = params
    const tickets = this.loadAllTickets(organizationId)
    const index = tickets.findIndex((t) => t.id === ticketId)
    if (index === -1) return null

    const target = tickets[index]
    const reprintEvent: TicketReprintEvent = {
      id: generateTicketId('rep'),
      reprintedAt: new Date().toISOString(),
      reprintedBy: operatorName,
      reason: reason || null,
    }

    const updated: TicketSnapshot = {
      ...target,
      reprintAuditTrail: [reprintEvent, ...target.reprintAuditTrail],
    }

    tickets[index] = updated
    this.saveTickets(organizationId, tickets)
    return updated
  }
}

export const defaultTicketSnapshotService = new TicketSnapshotService()
