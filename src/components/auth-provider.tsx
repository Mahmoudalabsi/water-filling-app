'use client'

import { SessionProvider, useSession, signOut as nextAuthSignOut } from 'next-auth/react'
import { ReactNode, useEffect, useState, createContext, useContext } from 'react'
import { cacheSession, getCachedSession, clearCachedSession } from '@/lib/offline-db'
import { apiUrl, isCapacitorApp } from '@/lib/api-config'

// ====== Local Auth Context ======
// This provides a fallback when NextAuth session is lost (e.g. WebView cookie issues)

interface LocalAuthState {
  isAuthenticated: boolean
  user: { id: string; name: string; email: string; image?: string } | null
  loginMethod: 'nextauth' | 'local' | null
}

const LocalAuthContext = createContext<{
  localAuth: LocalAuthState
  setLocalAuth: (state: LocalAuthState) => void
  localSignIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  localRegister: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string; requiresVerification?: boolean }>
  localSignOut: () => void
}>({
  localAuth: { isAuthenticated: false, user: null, loginMethod: null },
  setLocalAuth: () => {},
  localSignIn: async () => ({ success: false }),
  localRegister: async () => ({ success: false }),
  localSignOut: () => {},
})

export function useLocalAuth() {
  return useContext(LocalAuthContext)
}

/**
 * Inner component that watches session changes and caches them for offline use.
 * When offline and next-auth reports "unauthenticated", it checks IndexedDB
 * for a previously cached session and uses that to stay authenticated.
 */
function SessionCacheWatcher({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession()
  const [localAuth, setLocalAuth] = useState<LocalAuthState>({
    isAuthenticated: false,
    user: null,
    loginMethod: null,
  })

  // Cache session when authenticated via NextAuth
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      const userData = {
        id: (session.user as any).id || '',
        name: session.user.name || '',
        email: session.user.email || '',
        image: session.user.image || undefined,
      }
      cacheSession({ user: userData }).catch(() => {})
      setLocalAuth({
        isAuthenticated: true,
        user: userData,
        loginMethod: 'nextauth',
      })
    }
  }, [session, status])

  // When NextAuth says unauthenticated, check for cached session
  useEffect(() => {
    if (status === 'unauthenticated') {
      // Check if we have a cached session (could be offline or WebView cookie issue)
      getCachedSession().then((cached) => {
        if (cached?.user) {
          // We have a cached session - use it
          setLocalAuth({
            isAuthenticated: true,
            user: cached.user,
            loginMethod: 'local',
          })
        } else if (navigator.onLine) {
          // Online but no cached session = genuine sign out
          setLocalAuth({ isAuthenticated: false, user: null, loginMethod: null })
        }
      }).catch(() => {})
    }
  }, [status])

  // Local sign in function (direct API call, bypasses NextAuth cookie issues)
  const localSignIn = async (email: string, password: string) => {
    try {
      const res = await fetch(apiUrl('/api/auth/credentials-login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        return { success: false, error: data.error || 'Login failed' }
      }
      // Store session locally
      const userData = {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        image: data.user.image,
      }
      await cacheSession({ user: userData })
      setLocalAuth({
        isAuthenticated: true,
        user: userData,
        loginMethod: 'local',
      })
      return { success: true }
    } catch {
      return { success: false, error: 'Connection error' }
    }
  }

  // Local register function
  const localRegister = async (name: string, email: string, password: string) => {
    try {
      const res = await fetch(apiUrl('/api/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        return { success: false, error: data.error || 'Registration failed' }
      }
      if (data.requiresVerification) {
        return { success: true, requiresVerification: true }
      }
      // Auto-login after registration
      return await localSignIn(email, password)
    } catch {
      return { success: false, error: 'Connection error' }
    }
  }

  // Local sign out
  const localSignOut = async () => {
    await clearCachedSession()
    setLocalAuth({ isAuthenticated: false, user: null, loginMethod: null })
    // Also sign out from NextAuth
    try {
      await nextAuthSignOut({ redirect: false })
    } catch {}
  }

  return (
    <LocalAuthContext.Provider value={{ localAuth, setLocalAuth, localSignIn, localRegister, localSignOut }}>
      {children}
    </LocalAuthContext.Provider>
  )
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
