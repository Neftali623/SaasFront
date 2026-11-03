import type { OrganizationTheme } from '../../types'

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/

export interface ColorValidationResult {
  isValid: boolean
  primaryError?: string
  accentError?: string
  primaryWhiteContrast: number
  accentSidebarContrast: number
}

export function isValidHexColor(value: string): boolean {
  return HEX_COLOR_REGEX.test(value.trim())
}

export function normalizeHexColor(value: string): string {
  const trimmed = value.trim()
  if (/^[0-9A-Fa-f]{6}$/.test(trimmed)) {
    return `#${trimmed.toUpperCase()}`
  }
  return trimmed.toUpperCase()
}

export function hexToRgb(
  hex: string,
): { r: number; g: number; b: number } | null {
  const normalized = normalizeHexColor(hex)
  if (!isValidHexColor(normalized)) {
    return null
  }
  const r = Number.parseInt(normalized.slice(1, 3), 16)
  const g = Number.parseInt(normalized.slice(3, 5), 16)
  const b = Number.parseInt(normalized.slice(5, 7), 16)
  return { r, g, b }
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)))
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`
}

function mixColors(hexA: string, hexB: string, weightA: number): string {
  const rgbA = hexToRgb(hexA)
  const rgbB = hexToRgb(hexB)
  if (!rgbA || !rgbB) {
    return hexA
  }
  const w = Math.max(0, Math.min(1, weightA))
  const r = rgbA.r * w + rgbB.r * (1 - w)
  const g = rgbA.g * w + rgbB.g * (1 - w)
  const b = rgbA.b * w + rgbB.b * (1 - w)
  return rgbToHex(r, g, b)
}

export function getRelativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex)
  if (!rgb) {
    return 0
  }
  const toLinear = (channel: number): number => {
    const sRgb = channel / 255
    return sRgb <= 0.03928 ? sRgb / 12.92 : ((sRgb + 0.055) / 1.055) ** 2.4
  }
  const r = toLinear(rgb.r)
  const g = toLinear(rgb.g)
  const b = toLinear(rgb.b)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function getContrastRatio(hexA: string, hexB: string): number {
  const lumA = getRelativeLuminance(hexA)
  const lumB = getRelativeLuminance(hexB)
  const brightest = Math.max(lumA, lumB)
  const darkest = Math.min(lumA, lumB)
  return (brightest + 0.05) / (darkest + 0.05)
}

/**
 * Valida que los colores hexadecimales tengan formato válido y mantengan
 * contraste legible en botones (texto blanco sobre primario), enlaces (primario sobre blanco)
 * e indicadores del menú lateral (#101D46).
 */
export function validateAppearanceColors(
  rawPrimary: string,
  rawAccent: string,
): ColorValidationResult {
  const primary = normalizeHexColor(rawPrimary)
  const accent = normalizeHexColor(rawAccent)

  let primaryError: string | undefined
  let accentError: string | undefined

  if (!isValidHexColor(primary)) {
    primaryError =
      'Ingresa un color hexadecimal válido de 6 dígitos (ejemplo: #8745E8).'
  }

  if (!isValidHexColor(accent)) {
    accentError =
      'Ingresa un color hexadecimal válido de 6 dígitos (ejemplo: #13C8EE).'
  }

  const primaryWhiteContrast = isValidHexColor(primary)
    ? getContrastRatio(primary, '#FFFFFF')
    : 0
  const accentSidebarContrast = isValidHexColor(accent)
    ? getContrastRatio(accent, '#101D46')
    : 0
  const accentWhiteContrast = isValidHexColor(accent)
    ? getContrastRatio(accent, '#FFFFFF')
    : 0

  if (!primaryError && primaryWhiteContrast < 3.5) {
    primaryError = `Contraste insuficiente (${primaryWhiteContrast.toFixed(
      2,
    )}:1 con texto blanco; mínimo 3.5:1). Elige un color principal más oscuro para que los botones y enlaces sean legibles.`
  }

  if (!accentError) {
    if (accentSidebarContrast < 2.2) {
      accentError = `El color de acento es demasiado oscuro (${accentSidebarContrast.toFixed(
        2,
      )}:1 sobre el menú lateral #101D46; mínimo 2.2:1). Elige un tono más luminoso.`
    } else if (accentWhiteContrast < 1.35) {
      accentError =
        'El color de acento es demasiado claro y se pierde sobre fondos claros. Elige un tono con mayor saturación.'
    }
  }

  return {
    isValid: !primaryError && !accentError,
    primaryError,
    accentError,
    primaryWhiteContrast,
    accentSidebarContrast,
  }
}

export function buildThemeFromColors(
  rawPrimary: string,
  rawAccent: string,
): OrganizationTheme {
  const primaryColor = isValidHexColor(normalizeHexColor(rawPrimary))
    ? normalizeHexColor(rawPrimary)
    : '#8745E8'
  const accentColor = isValidHexColor(normalizeHexColor(rawAccent))
    ? normalizeHexColor(rawAccent)
    : '#13C8EE'

  return {
    primaryColor,
    primaryHoverColor: mixColors(primaryColor, '#0A1029', 0.82),
    primarySoftColor: mixColors(primaryColor, '#FFFFFF', 0.14),
    accentColor,
    accentSoftColor: mixColors(accentColor, '#FFFFFF', 0.16),
  }
}

const STOP_WORDS = new Set(['y', 'e', 'de', 'del', 'la', 'el', 'los', 'las', 'en'])

export function computeInitials(name: string, fallback = 'NX'): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0)

  if (words.length === 0) {
    return fallback
  }

  const significant = words.filter(
    (word) => !STOP_WORDS.has(word.toLowerCase()),
  )
  const source = significant.length > 0 ? significant : words

  if (source.length === 1) {
    return source[0].slice(0, 2).toUpperCase()
  }

  return `${source[0][0] ?? ''}${source[1][0] ?? ''}`.toUpperCase()
}

