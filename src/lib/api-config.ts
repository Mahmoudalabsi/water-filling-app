// API configuration utility for offline-first support
// Detects Capacitor native app and provides correct API base URL

const VERCEL_URL = 'https://water-filling-app.vercel.app'

/**
 * Detects if running inside a Capacitor native app (Android APK)
 */
export function isCapacitorApp(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const win = window as any
    return !!(win.Capacitor?.isNativePlatform?.())
  } catch {
    return false
  }
}

/**
 * Get the base URL for API calls
 * - In Capacitor: returns the Vercel deployment URL
 * - In browser: returns empty string (relative URLs)
 */
export function getApiBaseUrl(): string {
  if (isCapacitorApp()) {
    return VERCEL_URL
  }
  return '' // relative URL for web
}

/**
 * Build a full API URL for a given path
 * Handles both Capacitor and web environments
 */
export function apiUrl(path: string): string {
  const base = getApiBaseUrl()
  return `${base}${path}`
}

// ====== Authenticated Fetch ======
// Token cache in memory for fast access (avoids IndexedDB reads on every request)
let _cachedToken: string | null = null

/**
 * Set the API token in memory cache
 */
export function setApiToken(token: string | null): void {
  _cachedToken = token
}

/**
 * Get the current API token from memory cache
 */
export function getApiToken(): string | null {
  return _cachedToken
}

/**
 * Authenticated fetch - automatically adds Bearer token to requests
 * This is the primary way to make API calls from the client.
 * It reads the JWT token from memory cache and adds it as Authorization header.
 * 
 * Usage:
 *   const res = await authFetch('/api/families')
 *   const res = await authFetch('/api/families', { method: 'POST', body: JSON.stringify(data) })
 */
export async function authFetch(url: string, options?: RequestInit): Promise<Response> {
  const token = getApiToken()
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string> || {}),
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  // If Content-Type is not set and we have a body, set it
  if (options?.body && !headers['Content-Type'] && typeof options.body === 'string') {
    headers['Content-Type'] = 'application/json'
  }
  
  return fetch(url, {
    ...options,
    headers,
  })
}
