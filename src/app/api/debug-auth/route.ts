import { NextRequest, NextResponse } from 'next/server'
import { verifyApiToken, extractBearerToken } from '@/lib/api-auth'

/**
 * Debug endpoint to test JWT token verification
 * This helps diagnose authentication issues
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const result: any = {
    hasAuthHeader: !!authHeader,
    authHeaderPrefix: authHeader?.split(' ')[0] || null,
    nextauthSecretSet: !!process.env.NEXTAUTH_SECRET,
    nextauthSecretLength: process.env.NEXTAUTH_SECRET?.length || 0,
  }

  if (authHeader) {
    const token = extractBearerToken(request)
    result.tokenReceived = !!token
    result.tokenLength = token?.length || 0
    
    if (token) {
      const payload = verifyApiToken(token)
      if (payload) {
        result.tokenValid = true
        result.tokenPayload = {
          userId: payload.userId,
          email: payload.email,
          name: payload.name,
        }
      } else {
        result.tokenValid = false
        result.tokenError = 'Token verification failed (invalid signature, expired, or wrong secret)'
      }
    }
  }

  return NextResponse.json(result)
}
