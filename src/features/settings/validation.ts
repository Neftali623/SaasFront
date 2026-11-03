import type { BusinessProfileSettings } from '../../types'

export interface BusinessProfileErrors {
  commercialName?: string
  phone?: string
  email?: string
  address?: string
  website?: string
}

const PHONE_REGEX = /^[+]?[0-9()\-\s]{7,20}$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function validateBusinessProfile(
  profile: BusinessProfileSettings,
): BusinessProfileErrors {
  const errors: BusinessProfileErrors = {}

  const name = profile.commercialName.trim()
  if (!name) {
    errors.commercialName = 'El nombre comercial es obligatorio.'
  } else if (name.length < 2) {
    errors.commercialName =
      'El nombre comercial debe tener al menos 2 caracteres.'
  } else if (name.length > 80) {
    errors.commercialName =
      'El nombre comercial no puede exceder 80 caracteres.'
  }

  const phone = profile.phone.trim()
  if (phone.length > 0) {
    const digitCount = phone.replace(/\D/g, '').length
    if (!PHONE_REGEX.test(phone) || digitCount < 7 || digitCount > 15) {
      errors.phone =
        'Ingresa un teléfono válido (7 a 15 dígitos; permite +, espacios, guiones y paréntesis).'
    }
  }

  const email = profile.email.trim()
  if (email.length > 0) {
    if (email.length > 100 || !EMAIL_REGEX.test(email)) {
      errors.email =
        'Ingresa un correo electrónico con formato válido (ejemplo: contacto@negocio.com).'
    }
  }

  const address = profile.address.trim()
  if (address.length > 0) {
    if (address.length < 5) {
      errors.address =
        'Si indicas una dirección, ingresa al menos 5 caracteres.'
    } else if (address.length > 180) {
      errors.address = 'La dirección no puede exceder 180 caracteres.'
    }
  }

  const website = profile.website.trim()
  if (website.length > 0) {
    if (website.length > 150) {
      errors.website = 'El sitio web no puede exceder 150 caracteres.'
    } else {
      try {
        const parsed = new URL(website)
        const isHttp =
          parsed.protocol === 'http:' || parsed.protocol === 'https:'
        const hasHostDot = parsed.hostname.includes('.')
        if (!isHttp || !hasHostDot) {
          errors.website =
            'Ingresa una URL completa que inicie con https:// o http:// (ejemplo: https://minegocio.com).'
        }
      } catch {
        errors.website =
          'Ingresa una URL válida que inicie con https:// o http:// (ejemplo: https://minegocio.com).'
      }
    }
  }

  return errors
}

export function hasBusinessProfileErrors(
  errors: BusinessProfileErrors,
): boolean {
  return Boolean(
    errors.commercialName ||
      errors.phone ||
      errors.email ||
      errors.address ||
      errors.website,
  )
}

