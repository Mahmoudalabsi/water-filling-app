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
