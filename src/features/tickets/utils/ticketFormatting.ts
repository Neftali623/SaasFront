import type {
  CurrencyCode,
  DateFormatOption,
  Organization,
  TimezoneOption,
} from '../../../types'
import { formatCentsWithHistoricalCurrency } from '../../cash/utils/moneyUtils'
import { formatDateTimeInOrganizationTimezone } from '../../inventory/utils/quantityUtils'
import type {
  TicketConfig,
  TicketDocumentType,
  TicketLineItemSnapshot,
  TicketSnapshot,
} from '../types'

/**
 * Genera una instantánea de comprobante de demostración enriquecida para el
 * editor de configuración y la vista previa en vivo.
 * Incluye acentos, nombres largos, cantidades fraccionarias y cambio.
 */
export function getMockPreviewTicketSnapshot(
  organization: Organization,
  config: TicketConfig,
): TicketSnapshot {
  const mockLines: TicketLineItemSnapshot[] = [
    {
      saleLineId: 'mock-line-1',
      productName:
        'Cuaderno profesional pasta dura cuadro grande 100 hojas cuadrícula 7 mm',
      sku: 'PAP-CUA-PRO-100',
      unit: 'pieza',
      quantity: 2,
      unitPriceCents: 4500, // $45.00
      lineSubtotalCents: 9000, // $90.00
    },
    {
      saleLineId: 'mock-line-2',
      productName:
        'Café gourmet de grano tostado mezcla artesanal de altura (Oaxaca Pluma)',
      sku: 'CAF-GRA-ALT-KG',
      unit: 'kg',
      quantity: 1.25, // Cantidad fraccionaria compatible
      unitPriceCents: 24000, // $240.00/kg
      lineSubtotalCents: 30000, // $300.00
    },
    {
      saleLineId: 'mock-line-3',
      productName: 'Bolígrafo tinta gel punto extra fino 0.38 mm tinta negra',
      sku: 'ESC-BOL-GEL-NEG',
      unit: 'pieza',
      quantity: 3,
      unitPriceCents: 2200, // $22.00
      lineSubtotalCents: 6600, // $66.00
    },
  ]

  const totalCents = 9000 + 30000 + 6600 // 45,600 = $456.00
  const cashReceivedCents = 50000 // $500.00
  const cashChangeCents = cashReceivedCents - totalCents // $44.00

  return {
    id: 'mock-preview-ticket',
    ticketFolio: 'TKT-FOL-DEMO',
    documentType: 'sale_ticket',
    organizationId: organization.id,
    branchId: 'branch-demo',
    branchName: organization.branchName,
    registerName: 'Caja Principal 01',
    registerCode: 'CAJA-01',
    operatorName: 'Operador de Mostrador',
    saleId: 'mock-sale-id',
    saleFolio: 'FOL-DEMO',
    createdAt: new Date().toISOString(),
    timezone: organization.preferences.timezone,
    dateFormat: organization.preferences.dateFormat,
    currency: organization.preferences.currency,
    configSnapshot: { ...config },
    businessProfileSnapshot: {
      commercialName: organization.businessProfile.commercialName,
      phone: organization.businessProfile.phone || '+52 55 1234 5678',
      email: organization.businessProfile.email || 'contacto@negocio.demo',
      address:
        organization.businessProfile.address ||
        'Av. Independencia #104, Col. Centro Histórico',
      website: organization.businessProfile.website || 'https://nedaxoli.com',
    },
    logoStorageKey: organization.logo?.objectUrl
      ? `org_logo_${organization.id}`
      : null,
    lines: mockLines,
    subtotalCents: totalCents,
    totalCents,
    netTotalCents: totalCents,
    paymentMethod: 'cash',
    cashReceivedCents,
    cashChangeCents,
    externalReference: null,
    isReconstructed: false,
    reprintAuditTrail: [],
  }
}

export function getDocumentTypePresentation(type: TicketDocumentType): {
  badgeLabel: string
  badgeVariant: 'brand' | 'warning' | 'neutral'
  headerTitle: string
} {
  switch (type) {
    case 'sale_ticket':
      return {
        badgeLabel: 'Ticket de Venta',
        badgeVariant: 'brand',
        headerTitle: 'COMPROBANTE DE COMPRA',
      }
    case 'refund_ticket':
      return {
        badgeLabel: 'Comprobante de Devolución',
        badgeVariant: 'warning',
        headerTitle: 'COMPROBANTE DE DEVOLUCIÓN',
      }
    case 'cancellation_ticket':
      return {
        badgeLabel: 'Comprobante de Cancelación',
        badgeVariant: 'neutral',
        headerTitle: 'COMPROBANTE DE CANCELACIÓN DE VENTA',
      }
  }
}

export function formatTicketDateTime(
  isoDate: string,
  timezone: string,
  dateFormat: string,
): { dateLabel: string; timeLabel: string; fullLabel: string } {
  const dt = formatDateTimeInOrganizationTimezone(
    isoDate,
    timezone as TimezoneOption,
    dateFormat as DateFormatOption,
  )
  return {
    dateLabel: dt.dateLabel,
    timeLabel: dt.timeLabel,
    fullLabel: `${dt.dateLabel} ${dt.timeLabel}`,
  }
}

export function formatTicketMoney(
  cents: number,
  currency: string,
): string {
  return formatCentsWithHistoricalCurrency(cents, currency as CurrencyCode)
}
