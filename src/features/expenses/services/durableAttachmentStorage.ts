const DB_NAME = 'nedaxoli_expense_attachments_db_v1'
const DB_VERSION = 1
const STORE_NAME = 'expense_attachments'

interface AttachmentEntry {
  storageKey: string
  blob: Blob
  fileName: string
  mimeType: string
  sizeBytes: number
  createdAt: string
}

const memoryFallback = new Map<string, AttachmentEntry>()
const activeObjectUrls = new Set<string>()

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB no está disponible en este entorno.'))
      return
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'storageKey' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function storeExpenseAttachmentBlob(
  storageKey: string,
  blob: Blob,
  fileName: string,
  mimeType: string,
): Promise<boolean> {
  const entry: AttachmentEntry = {
    storageKey,
    blob,
    fileName,
    mimeType,
    sizeBytes: blob.size,
    createdAt: new Date().toISOString(),
  }

  try {
    const db = await openDatabase()
    return await new Promise<boolean>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const putRequest = store.put(entry)

      putRequest.onsuccess = () => resolve(true)
      putRequest.onerror = () => {
        memoryFallback.set(storageKey, entry)
        resolve(true)
      }
    })
  } catch {
    memoryFallback.set(storageKey, entry)
    return true
  }
}

export async function getExpenseAttachmentBlob(
  storageKey: string,
): Promise<AttachmentEntry | null> {
  if (memoryFallback.has(storageKey)) {
    return memoryFallback.get(storageKey) ?? null
  }

  try {
    const db = await openDatabase()
    return await new Promise<AttachmentEntry | null>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const getRequest = store.get(storageKey)

      getRequest.onsuccess = () => {
        const result = getRequest.result as AttachmentEntry | undefined
        resolve(result ?? null)
      }
      getRequest.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

export async function getExpenseAttachmentObjectUrl(
  storageKey: string,
): Promise<{ url: string; fileName: string; mimeType: string } | null> {
  const entry = await getExpenseAttachmentBlob(storageKey)
  if (!entry) return null

  try {
    const url = URL.createObjectURL(entry.blob)
    activeObjectUrls.add(url)
    return {
      url,
      fileName: entry.fileName,
      mimeType: entry.mimeType,
    }
  } catch {
    return null
  }
}

export function revokeExpenseAttachmentObjectUrl(url: string | null): void {
  if (!url) return
  try {
    URL.revokeObjectURL(url)
    activeObjectUrls.delete(url)
  } catch {
    // Silencio ante URLs previamente revocadas
  }
}

export function cleanupAllActiveAttachmentUrls(): void {
  for (const url of activeObjectUrls) {
    try {
      URL.revokeObjectURL(url)
    } catch {
      // Ignorar errores en limpieza
    }
  }
  activeObjectUrls.clear()
}

