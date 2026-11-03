import type {
  CurrencyCode,
  DateFormatOption,
  TimezoneOption,
} from '../../types'

export interface SelectOption<T extends string> {
  value: T
  label: string
  helper: string
}

export const CURRENCY_OPTIONS: SelectOption<CurrencyCode>[] = [
  {
    value: 'MXN',
    label: 'MXN ($) — Peso mexicano',
    helper: 'Formato: $1,250.00 MXN',
  },
  {
    value: 'USD',
    label: 'USD ($) — Dólar estadounidense',
    helper: 'Formato: $1,250.00 USD',
  },
  {
    value: 'COP',
    label: 'COP ($) — Peso colombiano',
    helper: 'Formato: $1,250.00 COP',
  },
  {
    value: 'EUR',
    label: 'EUR (€) — Euro',
    helper: 'Formato: €1,250.00 EUR',
  },
]

export const TIMEZONE_OPTIONS: SelectOption<TimezoneOption>[] = [
  {
    value: 'America/Mexico_City',
    label: 'America/Mexico_City (Centro de México, UTC-6)',
    helper: 'Ciudad de México, Guadalajara, Puebla, Veracruz',
  },
  {
    value: 'America/Monterrey',
    label: 'America/Monterrey (Noreste de México, UTC-6)',
    helper: 'Monterrey, Saltillo, Torreón',
  },
  {
    value: 'America/Tijuana',
    label: 'America/Tijuana (Pacífico Norte, UTC-8)',
    helper: 'Tijuana, Mexicali, Ensenada',
  },
  {
    value: 'America/Bogota',
    label: 'America/Bogota (Colombia, UTC-5)',
    helper: 'Bogotá, Medellín, Cali',
  },
  {
    value: 'America/Lima',
    label: 'America/Lima (Perú, UTC-5)',
    helper: 'Lima, Arequipa',
  },
  {
    value: 'Europe/Madrid',
    label: 'Europe/Madrid (España peninsular, UTC+1)',
    helper: 'Madrid, Barcelona, Valencia',
  },
]

export const DATE_FORMAT_OPTIONS: SelectOption<DateFormatOption>[] = [
  {
    value: 'DD/MM/YYYY',
    label: 'DD/MM/YYYY (Día / Mes / Año)',
    helper: 'Ejemplo: 02/11/2026',
  },
  {
    value: 'YYYY-MM-DD',
    label: 'YYYY-MM-DD (Año - Mes - Día ISO)',
    helper: 'Ejemplo: 2026-11-02',
  },
  {
    value: 'MM/DD/YYYY',
    label: 'MM/DD/YYYY (Mes / Día / Año)',
    helper: 'Ejemplo: 11/02/2026',
  },
]

const CURRENCY_SYMBOL_MAP: Record<CurrencyCode, string> = {
  MXN: '$',
  USD: '$',
  COP: '$',
  EUR: '€',
}

/**
 * Formatea un importe numérico usando el código y símbolo de la moneda elegida.
 * IMPORTANTE: No realiza conversión cambiaria; conserva íntegro el monto numérico.
 */
export function formatAmountByCurrency(
  amount: number,
  currency: CurrencyCode,
): string {
  const symbol = CURRENCY_SYMBOL_MAP[currency] ?? '$'
  const formattedNumber = new Intl.NumberFormat('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)

  return `${symbol}${formattedNumber} ${currency}`
}

/**
 * Formatea una fecha en formato ISO (YYYY-MM-DD) de acuerdo con la preferencia activa.
 */
export function formatDateByPreference(
  isoDate: string,
  dateFormat: DateFormatOption,
): string {
  const parts = isoDate.split('-')
  if (parts.length !== 3) {
    return isoDate
  }
  const [year, month, day] = parts

  switch (dateFormat) {
    case 'DD/MM/YYYY':
      return `${day}/${month}/${year}`
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`
    case 'MM/DD/YYYY':
      return `${month}/${day}/${year}`
  }
}

export function getTimezoneShortLabel(timezone: TimezoneOption): string {
  switch (timezone) {
    case 'America/Mexico_City':
      return 'Centro MX (UTC-6)'
    case 'America/Monterrey':
      return 'Monterrey (UTC-6)'
    case 'America/Tijuana':
      return 'Tijuana (UTC-8)'
    case 'America/Bogota':
      return 'Bogotá (UTC-5)'
    case 'America/Lima':
      return 'Lima (UTC-5)'
    case 'Europe/Madrid':
      return 'Madrid (UTC+1)'
  }
}

