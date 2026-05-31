// Offline-first database using IndexedDB for caching API data
// Auto-syncs when online

const DB_NAME = 'water-filling-offline'
const DB_VERSION = 1
const STORES = {
  families: 'families',
  settings: 'settings',
  pending: 'pending-operations', // operations to sync when online
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
    }
  })
}

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

// Add a pending operation (for offline sync)
export async function addPendingOperation(operation: {
  type: string
  url: string
  method: string
  body?: any
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

// Get all pending operations
export async function getPendingOperations(): Promise<any[]> {
  return getCachedData(STORES.pending)
}

// Clear pending operations after sync
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

// Delete a single pending operation
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

// Sync all pending operations when online
export async function syncPendingOperations(): Promise<{ synced: number; failed: number }> {
  const operations = await getPendingOperations()
  let synced = 0
  let failed = 0

  for (const op of operations) {
    try {
      const res = await fetch(op.url, {
        method: op.method,
        headers: { 'Content-Type': 'application/json' },
        body: op.body ? JSON.stringify(op.body) : undefined,
      })
      if (res.ok) {
        await deletePendingOperation(op.id)
        synced++
      } else {
        failed++
      }
    } catch {
      failed++
    }
  }

  return { synced, failed }
}

// Smart fetch: try network first, fall back to cache, queue if offline
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

// Auto-sync: listen for online events
let syncInterval: NodeJS.Timeout | null = null

export function startAutoSync(onSync?: (result: { synced: number; failed: number }) => void) {
  // Sync when coming back online
  window.addEventListener('online', async () => {
    const result = await syncPendingOperations()
    onSync?.(result)
  })

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
