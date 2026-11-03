import type { ExpenseCategory } from '../types'

export const MAX_ATTACHMENT_SIZE_BYTES = 2 * 1024 * 1024 // 2 MB
export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
] as const

export type AllowedAttachmentMimeType =
  (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number]

export interface ExpenseValidationErrors {
  concept?: string
  categoryId?: string
  amount?: string
  expenseDate?: string
  externalReference?: string
  attachment?: string
}

export function validateExpenseForm(params: {
  concept: string
  categoryId: string
  amountCents: number
  expenseDate: string
  categories: ExpenseCategory[]
  selectedFile?: File | null
}): ExpenseValidationErrors {
  const errors: ExpenseValidationErrors = {}

  const cleanConcept = params.concept.trim()
  if (!cleanConcept) {
    errors.concept = 'El concepto del gasto es obligatorio.'
  } else if (cleanConcept.length < 3) {
    errors.concept = 'El concepto debe tener al menos 3 caracteres descriptivos.'
  } else if (cleanConcept.length > 160) {
    errors.concept = 'El concepto no puede superar los 160 caracteres.'
  }

  if (!params.categoryId) {
    errors.categoryId = 'Selecciona una categoría para clasificar el gasto.'
  } else {
    const category = params.categories.find((c) => c.id === params.categoryId)
    if (!category) {
      errors.categoryId = 'La categoría seleccionada no existe en la organización.'
    } else if (!category.isActive) {
      errors.categoryId =
        'La categoría seleccionada está inactiva y no admite nuevos registros.'
    }
  }

  if (!Number.isFinite(params.amountCents) || params.amountCents <= 0) {
    errors.amount = 'El importe del gasto debe ser mayor a $0.00.'
  } else if (params.amountCents > 100_000_000_00) {
    // 100 millones
    errors.amount = 'El importe ingresado excede el límite operativo.'
  }

  if (!params.expenseDate) {
    errors.expenseDate = 'La fecha efectiva del gasto es obligatoria.'
  } else {
    const today = new Date().toISOString().split('T')[0]
    if (params.expenseDate > today) {
      errors.expenseDate =
        'No es posible registrar gastos con fecha futura. La fecha efectiva debe ser hoy o anterior.'
    }
  }

  if (params.selectedFile) {
    const fileError = validateExpenseAttachmentFile(params.selectedFile)
    if (fileError) {
      errors.attachment = fileError
    }
  }

  return errors
}

export function validateExpenseAttachmentFile(file: File): string | null {
  const nameLower = file.name.toLowerCase()
  if (
    nameLower.endsWith('.svg') ||
    nameLower.endsWith('.html') ||
    nameLower.endsWith('.htm') ||
    nameLower.endsWith('.exe') ||
    nameLower.endsWith('.sh') ||
    nameLower.endsWith('.bat')
  ) {
    return 'Tipo de archivo no permitido por seguridad. Solo se admiten PNG, JPEG, WebP y PDF.'
  }

  if (!ALLOWED_ATTACHMENT_MIME_TYPES.includes(file.type as AllowedAttachmentMimeType)) {
    return 'Formato no admitido. Selecciona una imagen (PNG, JPEG, WebP) o un documento PDF.'
  }

  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return `El archivo pesa ${(file.size / (1024 * 1024)).toFixed(2)} MB y supera el límite máximo permitido de 2 MB.`
  }

  return null
}

export function validateExpenseCategoryName(
  name: string,
  existingCategories: ExpenseCategory[],
  currentCategoryId?: string,
): string | null {
  const clean = name.trim()
  if (!clean) {
    return 'El nombre de la categoría es obligatorio.'
  }
  if (clean.length < 2) {
    return 'El nombre debe tener al menos 2 caracteres.'
  }
  if (clean.length > 60) {
    return 'El nombre no puede superar los 60 caracteres.'
  }

  const normalized = clean.toLowerCase()
  const exists = existingCategories.some(
    (c) => c.name.trim().toLowerCase() === normalized && c.id !== currentCategoryId,
  )
  if (exists) {
    return `Ya existe una categoría llamada "${clean}" en esta organización.`
  }

  return null
}

