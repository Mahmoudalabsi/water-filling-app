const CACHE_NAME = 'water-filling-v3'
const STATIC_ASSETS = [
  '/',
  '/signin',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
]

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS)
    })
  )
  self.skipWaiting()
})

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    })
  )
  self.clients.claim()
})

// Background Sync - sync pending operations when online
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-pending-operations') {
    event.waitUntil(syncPendingFromSW())
  }
})

async function syncPendingFromSW() {
  // This will be handled by the client-side code
  // The SW just triggers the sync event
  const clients = await self.clients.matchAll()
  clients.forEach((client) => {
    client.postMessage({ type: 'SYNC_REQUIRED' })
  })
}

// Handle messages from client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
  if (event.data && event.data.type === 'CACHE_URLS') {
    // Allow client to request caching of specific URLs
    const urls = event.data.urls || []
    if (urls.length > 0) {
      caches.open(CACHE_NAME).then((cache) => {
        cache.addAll(urls).catch(() => {})
      })
    }
  }
})

// Fetch event - network first for API, cache first for static
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests for caching (mutations are handled by client-side offline queue)
  if (request.method !== 'GET') {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(JSON.stringify({ error: 'offline', queued: true }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      })
    )
    return
  }

  // Skip auth-related requests - always need network
  if (url.pathname.includes('/api/auth') || url.pathname.includes('/api/callback')) {
    return
  }

  // For data APIs - network first with cache fallback
  // This is critical for offline support - cache all successful API responses
  if (url.pathname.includes('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const cloned = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, cloned)
            })
          }
          return response
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            return cached || new Response(JSON.stringify({ error: 'offline' }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            })
          })
        })
    )
    return
  }

  // For navigation requests - network first with cache fallback
  // This ensures the app shell loads even when offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const cloned = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, cloned)
          })
          return response
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            return cached || caches.match('/')
          })
        })
    )
    return
  }

  // For static assets (JS, CSS, images, fonts) - stale-while-revalidate
  // Serve from cache immediately, update in background
  if (
    request.url.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff2?|json|webmanifest)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((response) => {
          if (response.ok) {
            const cloned = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, cloned)
            })
          }
          return response
        }).catch(() => cached)

        return cached || fetchPromise
      })
    )
    return
  }

  // Default - network first with cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        const cloned = response.clone()
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, cloned)
        })
        return response
      })
      .catch(() => caches.match(request))
  )
})
