/**
 * API Authentication - JWT Token System
 * 
 * This module provides token-based authentication that works alongside NextAuth.
 * It's specifically designed for mobile apps (Capacitor) where cookie-based
 * authentication doesn't work reliably in WebViews.
 * 
 * Flow:
 * 1. User logs in via /api/auth/credentials-login → gets JWT token
 * 2. Client stores token in IndexedDB (for offline/persistence)
 * 3. Client sends token as Authorization: Bearer <token> with every API request
 * 4. Server verifies token in getCurrentUser() as fallback to NextAuth cookies
 */

import jwt from 'jsonwebtoken'
import { NextRequest } from 'next/server'

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'water-filling-app-secret-key-2026-very-secure'
const TOKEN_EXPIRY = '30d' // Long-lived token for mobile apps

export interface ApiTokenPayload {
  userId: string
  email: string
  name: string
  iat?: number
  exp?: number
}

/**
 * Generate a JWT token for a user
 */
export function generateApiToken(user: { id: string; email: string; name: string }): string {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      name: user.name,
    },
    JWT_SECRET,
    {
      expiresIn: TOKEN_EXPIRY,
      issuer: 'water-filling-app',
      audience: 'water-filling-api',
    }
  )
}

/**
 * Verify a JWT token and return the payload
 */
export function verifyApiToken(token: string): ApiTokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'water-filling-app',
      audience: 'water-filling-api',
    }) as ApiTokenPayload
    return decoded
  } catch {
    return null
  }
}

/**
 * Extract Bearer token from Authorization header
 */
export function extractBearerToken(request: Request | NextRequest): string | null {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return null
  
  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null
  
  return parts[1]
}

/**
 * Get user ID from request - checks Bearer token first, then falls back to null
 * This is used alongside NextAuth's getCurrentUser() in API routes
 */
export function getUserIdFromToken(request: Request | NextRequest): string | null {
  const token = extractBearerToken(request)
  if (!token) return null
  
  const payload = verifyApiToken(token)
  return payload?.userId || null
}
