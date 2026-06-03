'use client'

import { SessionProvider, useSession } from 'next-auth/react'
import { ReactNode, useEffect } from 'react'
import { cacheSession, getCachedSession, clearCachedSession } from '@/lib/offline-db'

/**
 * Inner component that watches session changes and caches them for offline use.
 * When offline and next-auth reports "unauthenticated", it checks IndexedDB
 * for a previously cached session and uses that to stay authenticated.
 */
function SessionCacheWatcher({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession()

  // Cache session when authenticated
  useEffect(() => {
    if (status === 'authenticated' && session) {
      cacheSession(session).catch(() => {})
    }
  }, [session, status])

  // Clear cached session on explicit sign out
  useEffect(() => {
    if (status === 'unauthenticated') {
      // Only clear cache if we're online (meaning a real sign-out happened,
      // not just a network failure causing next-auth to report unauthenticated)
      if (navigator.onLine) {
        clearCachedSession().catch(() => {})
      }
    }
  }, [status])

  return <>{children}</>
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <SessionCacheWatcher>{children}</SessionCacheWatcher>
    </SessionProvider>
  )
}

/**
 * Hook to check if we have a cached offline session.
 * Use this in pages where next-auth reports "unauthenticated" but we might be offline.
 */
export async function hasOfflineSession(): Promise<boolean> {
  const cached = await getCachedSession()
  return cached !== null
}

export { getCachedSession }
