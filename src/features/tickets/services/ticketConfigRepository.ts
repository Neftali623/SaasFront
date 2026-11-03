import type { StorageLike } from '../../../services/settings/organizationSettingsRepository'
import type {
  TicketConfig,
  TicketFontSize,
  TicketPaperWidth,
  TicketTemplateKind,
} from '../types'

export const TICKET_CONFIG_SCHEMA_VERSION = 1

export const MAX_HEADER_MESSAGE_LENGTH = 160
export const MAX_FOOTER_MESSAGE_LENGTH = 160
export const MAX_RETURN_POLICY_LENGTH = 320

export const DEFAULT_TICKET_CONFIG_BY_ORG: Record<string, TicketConfig> = {
  'org-papeleria-luna': {
    organizationId: 'org-papeleria-luna',
    templateKind: 'compact',
    paperWidth: '80mm',
    fontSize: 'normal',
    showLogo: true,
    showAddressAndContact: true,
    showBranchRegisterOperator: true,
    showSku: false,
    headerMessage: '¡Gracias por apoyar el comercio local!',
    footerMessage: 'Conserve este ticket para cualquier aclaración.',
    returnPolicy:
      'Devoluciones dentro de los primeros 7 días naturales presentando este comprobante en estado original y sellado.',
    updatedAt: '2026-11-01T12:00:00.000Z',
    version: 1,
  },
  'org-cafeteria-faro': {
    organizationId: 'org-cafeteria-faro',
    templateKind: 'detailed',
    paperWidth: '58mm',
    fontSize: 'normal',
    showLogo: true,
    showAddressAndContact: true,
    showBranchRegisterOperator: true,
    showSku: true,
    headerMessage: 'Cafetería y Panadería Artesanal',
    footerMessage: '¡Gracias por su visita! Vuelva pronto.',
    returnPolicy:
      'Por salubridad y frescura, alimentos y bebidas no admiten devolución una vez retirados de barra.',
    updatedAt: '2026-11-01T12:00:00.000Z',
    version: 1,
  },
}

export function getDefaultTicketConfig(organizationId: string): TicketConfig {
  const seed = DEFAULT_TICKET_CONFIG_BY_ORG[organizationId]
  if (seed) {
    return { ...seed }
  }
  return {
    organizationId,
    templateKind: 'compact',
    paperWidth: '80mm',
    fontSize: 'normal',
    showLogo: true,
    showAddressAndContact: true,
    showBranchRegisterOperator: true,
    showSku: false,
    headerMessage: '¡Gracias por su compra!',
    footerMessage: 'Conserve este comprobante para cualquier duda.',
    returnPolicy:
      'Consulte nuestras políticas de cambio o devolución en mostrador.',
    updatedAt: new Date().toISOString(),
    version: 1,
  }
}

export function getTicketConfigStorageKey(organizationId: string): string {
  return `nedaxoli_demo_ticket_config_v${TICKET_CONFIG_SCHEMA_VERSION}_${organizationId}`
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

/**
 * Sanitiza y limita la longitud de los textos del ticket para evitar
 * inyección de HTML o desbordamientos en impresoras térmicas.
 */
export function sanitizeTicketText(
  value: string | null | undefined,
  maxLength: number,
): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  // Elimina posibles etiquetas HTML
  const noHtml = trimmed.replace(/<[^>]*>?/gm, '')
  return noHtml.slice(0, maxLength)
}

export function sanitizeTicketConfig(
  raw: unknown,
  fallbackOrgId: string,
): TicketConfig {
  const fallback = getDefaultTicketConfig(fallbackOrgId)
  if (!raw || typeof raw !== 'object') {
    return fallback
  }

  const r = raw as Partial<TicketConfig>
  const templateKind: TicketTemplateKind =
    r.templateKind === 'detailed' ? 'detailed' : 'compact'
  const paperWidth: TicketPaperWidth =
    r.paperWidth === '58mm' ? '58mm' : '80mm'
  const fontSize: TicketFontSize =
    r.fontSize === 'small' || r.fontSize === 'large'
      ? r.fontSize
      : 'normal'

  return {
    organizationId: fallbackOrgId,
    templateKind,
    paperWidth,
    fontSize,
    showLogo: typeof r.showLogo === 'boolean' ? r.showLogo : fallback.showLogo,
    showAddressAndContact:
      typeof r.showAddressAndContact === 'boolean'
        ? r.showAddressAndContact
        : fallback.showAddressAndContact,
    showBranchRegisterOperator:
      typeof r.showBranchRegisterOperator === 'boolean'
        ? r.showBranchRegisterOperator
        : fallback.showBranchRegisterOperator,
    showSku: typeof r.showSku === 'boolean' ? r.showSku : fallback.showSku,
    headerMessage: sanitizeTicketText(
      r.headerMessage,
      MAX_HEADER_MESSAGE_LENGTH,
    ),
    footerMessage: sanitizeTicketText(
      r.footerMessage,
      MAX_FOOTER_MESSAGE_LENGTH,
    ),
    returnPolicy: sanitizeTicketText(
      r.returnPolicy,
      MAX_RETURN_POLICY_LENGTH,
    ),
    updatedAt:
      typeof r.updatedAt === 'string' ? r.updatedAt : new Date().toISOString(),
    version:
      typeof r.version === 'number' && Number.isInteger(r.version)
        ? r.version
        : fallback.version,
  }
}

export class TicketConfigRepository {
  private storage: StorageLike | null

  constructor(storage: StorageLike | null = getBrowserLocalStorage()) {
    this.storage = storage
  }

  load(organizationId: string): TicketConfig {
    if (!this.storage) {
      return getDefaultTicketConfig(organizationId)
    }

    try {
      const key = getTicketConfigStorageKey(organizationId)
      const raw = this.storage.getItem(key)
      if (!raw) {
        const initial = getDefaultTicketConfig(organizationId)
        this.save(initial)
        return initial
      }
      const parsed = JSON.parse(raw)
      return sanitizeTicketConfig(parsed, organizationId)
    } catch {
      return getDefaultTicketConfig(organizationId)
    }
  }

  save(config: TicketConfig): TicketConfig {
    const sanitized: TicketConfig = {
      ...sanitizeTicketConfig(config, config.organizationId),
      updatedAt: new Date().toISOString(),
      version: (config.version || 1) + 1,
    }

    if (this.storage) {
      try {
        const key = getTicketConfigStorageKey(config.organizationId)
        this.storage.setItem(key, JSON.stringify(sanitized))
      } catch (err) {
        console.warn('[TicketConfigRepository] Error al guardar configuración:', err)
      }
    }

    return sanitized
  }

  reset(organizationId: string): TicketConfig {
    const initial = getDefaultTicketConfig(organizationId)
    return this.save(initial)
  }
}

export const defaultTicketConfigRepository = new TicketConfigRepository()
