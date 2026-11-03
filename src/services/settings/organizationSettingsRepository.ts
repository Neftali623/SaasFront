import {
  CURRENCY_OPTIONS,
  DATE_FORMAT_OPTIONS,
  TIMEZONE_OPTIONS,
} from '../../features/settings/formatters'
import {
  normalizeHexColor,
  validateAppearanceColors,
} from '../../features/settings/colorUtils'
import type {
  CurrencyCode,
  DateFormatOption,
  SerializableOrganizationSettings,
  TimezoneOption,
} from '../../types'

export const SETTINGS_SCHEMA_VERSION = 1

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface StoredSettingsEnvelope {
  schemaVersion: number
  organizationId: string
  updatedAt: string
  data: SerializableOrganizationSettings
}

export interface LoadSettingsOutcome {
  settings: SerializableOrganizationSettings
  updatedAt: string | null
  source: 'local-storage' | 'defaults'
  warning?: string
}

export type SaveSettingsOutcome =
  | {
      ok: true
      updatedAt: string
    }
  | {
      ok: false
      error: string
    }

export interface OrganizationSettingsRepository {
  load(
    organizationId: string,
    defaults: SerializableOrganizationSettings,
  ): LoadSettingsOutcome
  save(
    organizationId: string,
    settings: SerializableOrganizationSettings,
  ): SaveSettingsOutcome
  clear(organizationId: string): SaveSettingsOutcome
}

export function getOrganizationStorageKey(organizationId: string): string {
  return `nedaxoli_demo_org_settings_v${SETTINGS_SCHEMA_VERSION}_${organizationId}`
}

export function cloneSerializableSettings(
  settings: SerializableOrganizationSettings,
): SerializableOrganizationSettings {
  return {
    businessProfile: { ...settings.businessProfile },
    appearance: { ...settings.appearance },
    preferences: { ...settings.preferences },
  }
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
    typeof value === 'string' &&
    CURRENCY_OPTIONS.some((option) => option.value === value)
  )
}

function isValidTimezone(value: unknown): value is TimezoneOption {
  return (
    typeof value === 'string' &&
    TIMEZONE_OPTIONS.some((option) => option.value === value)
  )
}

function isValidDateFormat(value: unknown): value is DateFormatOption {
  return (
    typeof value === 'string' &&
    DATE_FORMAT_OPTIONS.some((option) => option.value === value)
  )
}

function sanitizeStoredSettings(
  rawData: unknown,
  defaults: SerializableOrganizationSettings,
): { settings: SerializableOrganizationSettings; hadFallback: boolean } {
  if (!isObjectRecord(rawData)) {
    return {
      settings: cloneSerializableSettings(defaults),
      hadFallback: true,
    }
  }

  let hadFallback = false

  const rawProfile = isObjectRecord(rawData.businessProfile)
    ? rawData.businessProfile
    : null
  if (!rawProfile) {
    hadFallback = true
  }

  const readStringField = (
    source: Record<string, unknown> | null,
    key: string,
    fallbackValue: string,
    requireNonEmpty = false,
  ): string => {
    const val = source?.[key]
    if (typeof val !== 'string') {
      hadFallback = true
      return fallbackValue
    }
    const trimmed = val.trim()
    if (requireNonEmpty && trimmed.length === 0) {
      hadFallback = true
      return fallbackValue
    }
    return trimmed
  }

  const businessProfile = {
    commercialName: readStringField(
      rawProfile,
      'commercialName',
      defaults.businessProfile.commercialName,
      true,
    ),
    phone: readStringField(rawProfile, 'phone', defaults.businessProfile.phone),
    email: readStringField(rawProfile, 'email', defaults.businessProfile.email),
    address: readStringField(
      rawProfile,
      'address',
      defaults.businessProfile.address,
    ),
    website: readStringField(
      rawProfile,
      'website',
      defaults.businessProfile.website,
    ),
  }

  const rawAppearance = isObjectRecord(rawData.appearance)
    ? rawData.appearance
    : null
  if (!rawAppearance) {
    hadFallback = true
  }

  const candidatePrimary =
    typeof rawAppearance?.primaryColor === 'string'
      ? normalizeHexColor(rawAppearance.primaryColor)
      : ''
  const candidateAccent =
    typeof rawAppearance?.accentColor === 'string'
      ? normalizeHexColor(rawAppearance.accentColor)
      : ''

  const colorCheck = validateAppearanceColors(candidatePrimary, candidateAccent)
  const appearance = colorCheck.isValid
    ? {
        primaryColor: candidatePrimary,
        accentColor: candidateAccent,
      }
    : (() => {
        hadFallback = true
        return { ...defaults.appearance }
      })()

  const rawPreferences = isObjectRecord(rawData.preferences)
    ? rawData.preferences
    : null
  if (!rawPreferences) {
    hadFallback = true
  }

  const currency = isValidCurrency(rawPreferences?.currency)
    ? rawPreferences.currency
    : (() => {
        hadFallback = true
        return defaults.preferences.currency
      })()

  const timezone = isValidTimezone(rawPreferences?.timezone)
    ? rawPreferences.timezone
    : (() => {
        hadFallback = true
        return defaults.preferences.timezone
      })()

  const dateFormat = isValidDateFormat(rawPreferences?.dateFormat)
    ? rawPreferences.dateFormat
    : (() => {
        hadFallback = true
        return defaults.preferences.dateFormat
      })()

  return {
    settings: {
      businessProfile,
      appearance,
      preferences: {
        currency,
        timezone,
        dateFormat,
      },
    },
    hadFallback,
  }
}

export function createLocalOrganizationSettingsRepository(
  customStorage?: StorageLike | null,
): OrganizationSettingsRepository {
  const resolveStorage = (): StorageLike | null => {
    if (customStorage !== undefined) {
      return customStorage
    }
    return getBrowserLocalStorage()
  }

  return {
    load(
      organizationId: string,
      defaults: SerializableOrganizationSettings,
    ): LoadSettingsOutcome {
      const storage = resolveStorage()
      if (!storage) {
        return {
          settings: cloneSerializableSettings(defaults),
          updatedAt: null,
          source: 'defaults',
          warning:
            'El almacenamiento local del navegador no está disponible. Los ajustes funcionarán únicamente en memoria durante esta sesión.',
        }
      }

      const key = getOrganizationStorageKey(organizationId)
      let raw: string | null

      try {
        raw = storage.getItem(key)
      } catch {
        return {
          settings: cloneSerializableSettings(defaults),
          updatedAt: null,
          source: 'defaults',
          warning:
            'No fue posible leer el almacenamiento local del navegador. Se cargaron los valores de demostración por defecto.',
        }
      }

      if (!raw) {
        return {
          settings: cloneSerializableSettings(defaults),
          updatedAt: null,
          source: 'defaults',
        }
      }

      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch {
        return {
          settings: cloneSerializableSettings(defaults),
          updatedAt: null,
          source: 'defaults',
          warning:
            'Se detectó contenido JSON inválido en el almacenamiento local de esta organización; se restauraron los valores iniciales seguros.',
        }
      }

      if (
        !isObjectRecord(parsed) ||
        parsed.schemaVersion !== SETTINGS_SCHEMA_VERSION ||
        parsed.organizationId !== organizationId
      ) {
        return {
          settings: cloneSerializableSettings(defaults),
          updatedAt: null,
          source: 'defaults',
          warning:
            'La versión o identificador del esquema guardado no coincide; se restauraron los valores iniciales de la organización.',
        }
      }

      const { settings, hadFallback } = sanitizeStoredSettings(
        parsed.data,
        defaults,
      )
      const updatedAt =
        typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null

      return {
        settings,
        updatedAt,
        source: 'local-storage',
        warning: hadFallback
          ? 'Algunos campos guardados localmente estaban incompletos o tenían un formato no válido; se completaron con los valores por defecto.'
          : undefined,
      }
    },

    save(
      organizationId: string,
      settings: SerializableOrganizationSettings,
    ): SaveSettingsOutcome {
      if (!organizationId.trim()) {
        return {
          ok: false,
          error: 'Identificador de organización inválido para guardar ajustes.',
        }
      }

      const colorCheck = validateAppearanceColors(
        settings.appearance.primaryColor,
        settings.appearance.accentColor,
      )
      if (!colorCheck.isValid) {
        return {
          ok: false,
          error:
            colorCheck.primaryError ??
            colorCheck.accentError ??
            'La combinación de colores no cumple con las reglas de legibilidad.',
        }
      }

      const storage = resolveStorage()
      if (!storage) {
        return {
          ok: false,
          error:
            'El almacenamiento local del navegador no está disponible o está bloqueado. No se pudieron persistir los cambios.',
        }
      }

      const updatedAt = new Date().toISOString()
      const envelope: StoredSettingsEnvelope = {
        schemaVersion: SETTINGS_SCHEMA_VERSION,
        organizationId,
        updatedAt,
        data: {
          businessProfile: {
            commercialName: settings.businessProfile.commercialName.trim(),
            phone: settings.businessProfile.phone.trim(),
            email: settings.businessProfile.email.trim(),
            address: settings.businessProfile.address.trim(),
            website: settings.businessProfile.website.trim(),
          },
          appearance: {
            primaryColor: normalizeHexColor(settings.appearance.primaryColor),
            accentColor: normalizeHexColor(settings.appearance.accentColor),
          },
          preferences: {
            currency: settings.preferences.currency,
            timezone: settings.preferences.timezone,
            dateFormat: settings.preferences.dateFormat,
          },
        },
      }

      const key = getOrganizationStorageKey(organizationId)
      const serialized = JSON.stringify(envelope)

      try {
        storage.setItem(key, serialized)
        const verifyRead = storage.getItem(key)
        if (verifyRead !== serialized) {
          return {
            ok: false,
            error:
              'No se pudo confirmar la escritura en el almacenamiento local del navegador.',
          }
        }
        return {
          ok: true,
          updatedAt,
        }
      } catch {
        return {
          ok: false,
          error:
            'Error al escribir en localStorage (cuota excedida o almacenamiento deshabilitado). Tus datos en pantalla no se borraron.',
        }
      }
    },

    clear(organizationId: string): SaveSettingsOutcome {
      const storage = resolveStorage()
      if (!storage) {
        return {
          ok: false,
          error:
            'El almacenamiento local del navegador no está disponible para restablecer los datos.',
        }
      }

      const key = getOrganizationStorageKey(organizationId)
      try {
        storage.removeItem(key)
        return {
          ok: true,
          updatedAt: new Date().toISOString(),
        }
      } catch {
        return {
          ok: false,
          error: 'No fue posible limpiar los ajustes locales de la organización.',
        }
      }
    },
  }
}

export const defaultOrganizationSettingsRepository =
  createLocalOrganizationSettingsRepository()
