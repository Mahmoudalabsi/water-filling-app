import { NextResponse } from 'next/server'

// GET /api/auth/providers-status - Check which auth providers are configured
export async function GET() {
  const googleConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)

  return NextResponse.json({
    google: googleConfigured,
    credentials: true, // Always available
  })
}
