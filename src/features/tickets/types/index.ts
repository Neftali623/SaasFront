import type {
  CurrencyCode,
  DateFormatOption,
  TimezoneOption,
} from '../../../types'
import type { PosPaymentMethod, SaleReturnDestination } from '../../pos/types'
import type { ProductUnit } from '../../products/types'

export type TicketTemplateKind = 'compact' | 'detailed'
export type TicketPaperWidth = '58mm' | '80mm'
export type TicketFontSize = 'small' | 'normal' | 'large'
export type TicketDocumentType =
  | 'sale_ticket'
  | 'refund_ticket'
  | 'cancellation_ticket'

/**
 * Configuración editable por organización para la emisión de comprobantes térmicos.
 */
export interface TicketConfig {
  organizationId: string
  templateKind: TicketTemplateKind
  paperWidth: TicketPaperWidth
  fontSize: TicketFontSize
  showLogo: boolean
  showAddressAndContact: boolean
  showBranchRegisterOperator: boolean
  showSku: boolean
  headerMessage: string | null
  footerMessage: string | null
  returnPolicy: string | null
  updatedAt: string
  version: number
}

/**
 * Instantánea histórica inmutable de los datos comerciales vigentes al emitir el comprobante.
 */
export interface TicketBusinessProfileSnapshot {
  commercialName: string
  phone: string | null
  email: string | null
  address: string | null
  website: string | null
}

/**
 * Instantánea histórica inmutable de cada partida en el comprobante.
 */
export interface TicketLineItemSnapshot {
  saleLineId: string
  productName: string
  sku: string
  unit: ProductUnit
  quantity: number
  unitPriceCents: number
  lineSubtotalCents: number
  returnedQuantity?: number
  refundCents?: number
  destination?: SaleReturnDestination
}

/**
 * Bitácora de auditoría de intentos de reimpresión de un comprobante.
 */
export interface TicketReprintEvent {
  id: string
  reprintedAt: string
  reprintedBy: string
  reason: string | null
}

/**
 * Registro completo e inmutable de un comprobante histórico (venta, devolución o cancelación).
 * Almacena la plantilla, formato y datos exactos vigentes al momento de la operación.
 */
export interface TicketSnapshot {
  id: string
  ticketFolio: string
  documentType: TicketDocumentType
  organizationId: string
  branchId: string
  branchName: string
  registerName: string
  registerCode: string
  operatorName: string
  saleId: string
  saleFolio: string
  returnFolio?: string | null
  returnReason?: string | null
  createdAt: string
  timezone: TimezoneOption
  dateFormat: DateFormatOption
  currency: CurrencyCode
  configSnapshot: TicketConfig
  businessProfileSnapshot: TicketBusinessProfileSnapshot
  logoStorageKey: string | null
  lines: TicketLineItemSnapshot[]
  subtotalCents: number
  totalCents: number
  refundTotalCents?: number
  netTotalCents?: number
  paymentMethod: PosPaymentMethod
  cashReceivedCents?: number | null
  cashChangeCents?: number | null
  externalReference?: string | null
  isReconstructed?: boolean
  reprintAuditTrail: TicketReprintEvent[]
}

export type TicketPrintState =
  | 'idle'
  | 'preparing'
  | 'dialog_opened'
  | 'error'

export interface OrganizationTicketsData {
  organizationId: string
  storageRevision: number
  config: TicketConfig
  tickets: TicketSnapshot[]
}

