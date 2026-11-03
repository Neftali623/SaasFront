/**
 * Utilidades para validación y decodificación de logotipo en el cliente (Fase de Demostración).
 *
 * IMPORTANTE PARA INTEGRACIÓN CON BACKEND (Edwin):
 * Toda validación realizada en el navegador (tipo MIME, extensión, tamaño máximo y
 * decodificación real de imagen) es únicamente de experiencia de usuario y seguridad preliminar.
 * El backend DEBERÁ repetir obligatoriamente la validación de cabecera binaria (magic bytes),
 * límite de peso, dimensiones y recodificación/sanitización al implementar la carga real.
 */

export const ALLOWED_LOGO_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
] as const

export const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024 // 2 MB
export const MAX_LOGO_SIZE_LABEL = '2 MB'

export type LogoValidationOutcome =
  | {
      ok: true
      objectUrl: string
      width: number
      height: number
      fileName: string
      mimeType: string
      sizeBytes: number
    }
  | {
      ok: false
      error: string
    }

export function revokeLogoObjectUrl(url: string | null | undefined): void {
  if (!url || !url.startsWith('blob:')) {
    return
  }
  try {
    URL.revokeObjectURL(url)
  } catch {
    // Ignorar errores si la URL ya fue revocada previamente
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }
  const kb = bytes / 1024
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`
  }
  const mb = kb / 1024
  return `${mb.toFixed(2)} MB`
}

export async function validateAndDecodeLogoFile(
  file: File,
): Promise<LogoValidationOutcome> {
  if (!file || file.size === 0) {
    return {
      ok: false,
      error: 'El archivo seleccionado está vacío. Elige una imagen válida.',
    }
  }

  const isAllowedMime = (ALLOWED_LOGO_MIME_TYPES as readonly string[]).includes(
    file.type,
  )
  if (!isAllowedMime) {
    return {
      ok: false,
      error: `Formato de archivo no compatible (${file.type || 'sin tipo MIME'}). Solo se aceptan imágenes PNG, JPEG o WebP.`,
    }
  }

  if (file.size > MAX_LOGO_SIZE_BYTES) {
    return {
      ok: false,
      error: `El archivo pesa ${formatFileSize(file.size)} y excede el límite máximo de ${MAX_LOGO_SIZE_LABEL}.`,
    }
  }

  let objectUrl: string
  try {
    objectUrl = URL.createObjectURL(file)
  } catch {
    return {
      ok: false,
      error: 'No se pudo generar la vista previa temporal del archivo en el navegador.',
    }
  }

  try {
    const dimensions = await decodeImageFromUrl(objectUrl)
    return {
      ok: true,
      objectUrl,
      width: dimensions.width,
      height: dimensions.height,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    }
  } catch {
    revokeLogoObjectUrl(objectUrl)
    return {
      ok: false,
      error:
        'No se pudo decodificar la imagen. Es posible que el archivo esté dañado o no corresponda a una imagen PNG, JPEG o WebP válida.',
    }
  }
}

function decodeImageFromUrl(
  url: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()

    img.onload = async () => {
      try {
        if (typeof img.decode === 'function') {
          await img.decode()
        }
        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
          resolve({ width: img.naturalWidth, height: img.naturalHeight })
        } else {
          reject(new Error('Dimensiones de imagen inválidas'))
        }
      } catch (err) {
        reject(err)
      }
    }

    img.onerror = () => {
      reject(new Error('Error al cargar o decodificar la imagen'))
    }

    img.src = url
  })
}
