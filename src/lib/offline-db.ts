// Offline-first database using IndexedDB for caching API data
// Enhanced with family caching, session store, settings cache, and proper sync handling

import { apiUrl, getApiToken } from './api-config'

const DB_NAME = 'water-filling-offline'
const DB_VERSION = 2
const STORES = {
  families: 'families',
  settings: 'settings',
  pending: 'pending-operations',
  session: 'auth-session', // cached auth session for offline use
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORES.families)) {
        db.createObjectStore(STORES.families, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORES.settings)) {
        db.createObjectStore(STORES.settings, { keyPath: 'userId' })
      }
      if (!db.objectStoreNames.contains(STORES.pending)) {
        const store = db.createObjectStore(STORES.pending, { keyPath: 'id', autoIncrement: true })
        store.createIndex('timestamp', 'timestamp', { unique: false })
      }
      if (!db.objectStoreNames.contains(STORES.session)) {
        db.createObjectStore(STORES.session, { keyPath: 'key' })
      }
    }
  })
}

// ====== Generic Cache Operations ======

// Save data to IndexedDB
export async function cacheData(storeName: string, data: any): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    if (Array.isArray(data)) {
      store.clear()
      data.forEach((item: any) => store.put(item))
    } else {
      store.put(data)
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// Get cached data from IndexedDB
export async function getCachedData(storeName: string): Promise<any[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// Get single cached item
export async function getCachedItem(storeName: string, key: string): Promise<any> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const request = store.get(key)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// ====== Family Caching ======

export async function cacheFamilies(families: any[]): Promise<void> {
  return cacheData(STORES.families, families)
}

export async function getCachedFamilies(): Promise<any[] | null> {
  try {
    const data = await getCachedData(STORES.families)
    return data.length > 0 ? data : null
  } catch {
    return null
  }
}

// ====== Settings Caching ======

export async function cacheSettings(settings: any): Promise<void> {
  return cacheData(STORES.settings, { ...settings, userId: 'current' })
}

export async function getCachedSettings(): Promise<any | null> {
  try {
    const item = await getCachedItem(STORES.settings, 'current')
    return item || null
  } catch {
    return null
  }
}

// ====== Auth Session Caching ======

export async function cacheSession(session: any): Promise<void> {
  return cacheData(STORES.session, { key: 'auth-session', data: session, timestamp: Date.now() })
}

export async function getCachedSession(): Promise<any | null> {
  try {
    const item = await getCachedItem(STORES.session, 'auth-session')
    if (!item) return null
    // Cache is valid for 7 days
    if (Date.now() - item.timestamp > 7 * 24 * 60 * 60 * 1000) {
      return null
    }
    return item.data
  } catch {
    return null
  }
}

export async function clearCachedSession(): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.session, 'readwrite')
    const store = tx.objectStore(STORES.session)
    store.delete('auth-session')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// ====== API Token Caching (JWT Bearer Token) ======

export async function cacheApiToken(token: string): Promise<void> {
  return cacheData(STORES.session, { key: 'api-token', data: { token }, timestamp: Date.now() })
}

export async function getCachedApiToken(): Promise<string | null> {
  try {
    const item = await getCachedItem(STORES.session, 'api-token')
    if (!item) return null
    // Token cache is valid for 30 days (matches JWT expiry)
    if (Date.now() - item.timestamp > 30 * 24 * 60 * 60 * 1000) {
      return null
    }
    return item.data.token || null
  } catch {
    return null
  }
}

export async function clearCachedApiToken(): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.session, 'readwrite')
    const store = tx.objectStore(STORES.session)
    store.delete('api-token')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// ====== Pending Operations ======

export async function addPendingOperation(operation: {
  type: string
  url: string
  method: string
  body?: any
  tempId?: string // for tracking temp IDs that need mapping
}): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.pending, 'readwrite')
    const store = tx.objectStore(STORES.pending)
    store.add({
      ...operation,
      timestamp: Date.now(),
    })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getPendingOperations(): Promise<any[]> {
  return getCachedData(STORES.pending)
}

export async function getPendingCount(): Promise<number> {
  const ops = await getPendingOperations()
  return ops.length
}

export async function clearPendingOperations(): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.pending, 'readwrite')
    const store = tx.objectStore(STORES.pending)
    store.clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function deletePendingOperation(id: number): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.pending, 'readwrite')
    const store = tx.objectStore(STORES.pending)
    store.delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// ====== Sync Pending Operations ======

// Map of temp IDs to real IDs (populated during sync)
let idMapping: Record<string, string> = {}

export function getIdMapping(): Record<string, string> {
  return { ...idMapping }
}

export function setIdMapping(mapping: Record<string, string>): void {
  idMapping = { ...idMapping, ...mapping }
}

export function clearIdMapping(): void {
  idMapping = {}
}

function resolveTempIds(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj
  if (typeof obj === 'string' && obj.startsWith('temp-') && idMapping[obj]) {
    return idMapping[obj]
  }
  if (Array.isArray(obj)) {
    return obj.map(resolveTempIds)
  }
  const result: any = {}
  for (const key of Object.keys(obj)) {
    result[key] = resolveTempIds(obj[key])
  }
  return result
}

export async function syncPendingOperations(): Promise<{ synced: number; failed: number }> {
  const operations = await getPendingOperations()
  let synced = 0
  let failed = 0
  const token = getApiToken() // Get JWT token for authenticated sync

  for (const op of operations) {
    try {
      // Resolve temp IDs in URL and body
      const resolvedUrl = resolveTempIds(op.url)
      const resolvedBody = resolveTempIds(op.body)

      const res = await fetch(resolvedUrl, {
        method: op.method,
        headers: {
          'Content-Type': 'application/json',
          // Include Bearer token for authentication
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: resolvedBody ? JSON.stringify(resolvedBody) : undefined,
      })

      if (res.ok) {
        // If this was a create-family operation, store the real ID mapping
        if (op.type === 'create-family' && op.tempId) {
          try {
            const data = await res.json()
            if (data.id) {
              idMapping[op.tempId] = data.id
            }
          } catch {
            // If we can't parse the response, that's OK - the operation succeeded
          }
        }

        // If this was a start-session operation, store the real session ID mapping
        if (op.type === 'start-session' && op.tempId) {
          try {
            const data = await res.json()
            if (data.sessionId) {
              idMapping[op.tempId] = data.sessionId
            }
          } catch {
            // If we can't parse the response, that's OK
          }
        }

        await deletePendingOperation(op.id)
        synced++
      } else {
        // If server returns 404 for a temp ID, it might mean the resource was already created
        // For family operations, skip on 404
        if (res.status === 404 && (op.type === 'delete-family' || op.type === 'reset-family')) {
          await deletePendingOperation(op.id)
          synced++
        } else {
          failed++
        }
      }
    } catch {
      failed++
    }
  }

  return { synced, failed }
}

// ====== Smart Fetch ======

export async function smartFetch(
  url: string,
  options?: RequestInit,
  cacheStore?: string
): Promise<{ data: any; fromCache: boolean; pending: boolean }> {
  const isOnline = navigator.onLine

  // If online, try network
  if (isOnline) {
    try {
      const res = await fetch(url, options)
      if (res.ok) {
        const data = await res.json()
        // Cache the successful response
        if (cacheStore && (!options || options.method === 'GET')) {
          await cacheData(cacheStore, data).catch(() => {})
        }
        return { data, fromCache: false, pending: false }
      }
    } catch {
      // Network failed, fall through to cache
    }
  }

  // If it's a write operation and we're offline, queue it
  if (options && options.method && options.method !== 'GET') {
    await addPendingOperation({
      type: 'api-call',
      url,
      method: options.method,
      body: options.body ? JSON.parse(options.body as string) : undefined,
    })

    // Return cached data if available
    if (cacheStore) {
      const cached = await getCachedData(cacheStore)
      return { data: cached, fromCache: true, pending: true }
    }

    return { data: null, fromCache: false, pending: true }
  }

  // For GET requests, return cached data
  if (cacheStore) {
    const cached = await getCachedData(cacheStore)
    return { data: cached, fromCache: true, pending: false }
  }

  return { data: null, fromCache: false, pending: false }
}

// ====== Auto-Sync ======

let syncInterval: ReturnType<typeof setInterval> | null = null
let onlineListenerActive = false

export function startAutoSync(onSync?: (result: { synced: number; failed: number }) => void) {
  // Sync when coming back online
  if (!onlineListenerActive) {
    onlineListenerActive = true
    window.addEventListener('online', async () => {
      const result = await syncPendingOperations()
      onSync?.(result)
    })
  }

  // Periodic sync every 30 seconds when online
  syncInterval = setInterval(async () => {
    if (navigator.onLine) {
      const ops = await getPendingOperations()
      if (ops.length > 0) {
        const result = await syncPendingOperations()
        onSync?.(result)
      }
    }
  }, 30000)
}

export function stopAutoSync() {
  if (syncInterval) {
    clearInterval(syncInterval)
    syncInterval = null
  }
}
