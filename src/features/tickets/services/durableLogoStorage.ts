/**
 * Servicio de almacenamiento durable de logotipos mediante IndexedDB.
 *
 * Permite almacenar los bytes de imágenes (Blob/ArrayBuffer) de forma durable
 * sin inflar ni agotar la cuota de localStorage (~5 MB), permitiendo que:
 * 1. El logotipo de la organización persista entre recargas de página.
 * 2. Cada comprobante histórico conserve una copia durable inmutable de los bytes
 *    del logotipo utilizado en su momento, aun si la organización cambia o elimina
 *    su logotipo posteriormente.
 */

const DB_NAME = 'nedaxoli_durable_logos_db_v1'
const STORE_NAME = 'logos'
const DB_VERSION = 1

interface StoredLogoEntry {
  key: string
  blob: Blob
  mimeType: string
  updatedAt: string
}

const memoryFallback = new Map<string, { blob: Blob; mimeType: string; updatedAt: string }>()

function isIndexedDbAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined'
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDbAvailable()) {
      reject(new Error('IndexedDB no está disponible en este entorno.'))
      return
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Guarda los bytes de un logotipo bajo una clave única.
 */
export async function saveDurableLogo(
  key: string,
  blobOrFile: Blob,
  mimeType = 'image/png',
): Promise<boolean> {
  const entry: StoredLogoEntry = {
    key,
    blob: blobOrFile,
    mimeType: blobOrFile.type || mimeType,
    updatedAt: new Date().toISOString(),
  }

  // Respaldo en memoria siempre activo
  memoryFallback.set(key, {
    blob: blobOrFile,
    mimeType: entry.mimeType,
    updatedAt: entry.updatedAt,
  })

  if (!isIndexedDbAvailable()) {
    return true
  }

  try {
    const db = await openDatabase()
    return await new Promise<boolean>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const putReq = store.put(entry)

      putReq.onsuccess = () => resolve(true)
      putReq.onerror = () => resolve(false)
      tx.oncomplete = () => db.close()
    })
  } catch (err) {
    console.warn('[DurableLogoStorage] Error al persistir en IndexedDB, usando memoria:', err)
    return true
  }
}

/**
 * Recupera el Blob del logotipo almacenado.
 */
export async function getDurableLogo(key: string): Promise<Blob | null> {
  if (memoryFallback.has(key)) {
    return memoryFallback.get(key)!.blob
  }

  if (!isIndexedDbAvailable()) {
    return null
  }

  try {
    const db = await openDatabase()
    return await new Promise<Blob | null>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const getReq = store.get(key)

      getReq.onsuccess = () => {
        const result = getReq.result as StoredLogoEntry | undefined
        if (result?.blob) {
          memoryFallback.set(key, {
            blob: result.blob,
            mimeType: result.mimeType,
            updatedAt: result.updatedAt,
          })
          resolve(result.blob)
        } else {
          resolve(null)
        }
      }
      getReq.onerror = () => resolve(null)
      tx.oncomplete = () => db.close()
    })
  } catch (err) {
    console.warn('[DurableLogoStorage] Error al leer de IndexedDB:', err)
    return null
  }
}

/**
 * Crea una URL Object (blob:...) temporal a partir de los bytes guardados.
 */
export async function getDurableLogoObjectUrl(key: string): Promise<string | null> {
  const blob = await getDurableLogo(key)
  if (!blob) return null
  try {
    return URL.createObjectURL(blob)
  } catch {
    return null
  }
}

/**
 * Convierte un Blob durable a Data URL base64 para impresión asegurada.
 */
export async function getDurableLogoDataUrl(key: string): Promise<string | null> {
  const blob = await getDurableLogo(key)
  if (!blob) return null

  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      resolve(typeof reader.result === 'string' ? reader.result : null)
    }
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(blob)
  })
}

/**
 * Clona de forma inmutable el logotipo de origen para un ticket histórico.
 */
export async function copyDurableLogo(
  sourceKey: string,
  destinationKey: string,
): Promise<boolean> {
  const blob = await getDurableLogo(sourceKey)
  if (!blob) return false
  return saveDurableLogo(destinationKey, blob, blob.type)
}

/**
 * Elimina una clave de logotipo.
 */
export async function deleteDurableLogo(key: string): Promise<void> {
  memoryFallback.delete(key)
  if (!isIndexedDbAvailable()) return

  try {
    const db = await openDatabase()
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      store.delete(key)
      tx.oncomplete = () => {
        db.close()
        resolve()
      }
      tx.onerror = () => resolve()
    })
  } catch {
    // Ignorar errores al eliminar
  }
}

