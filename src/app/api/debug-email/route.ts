import { NextRequest, NextResponse } from 'next/server'
import { getGmailCredentials, isEmailVerificationAvailable } from '@/lib/email'

/**
 * Debug endpoint to check email configuration
 */
export async function GET(request: NextRequest) {
  const gmailCreds = await getGmailCredentials()
  const hasEmail = await isEmailVerificationAvailable()
  
  return NextResponse.json({
    gmailConfigured: !!gmailCreds,
    gmailUser: gmailCreds?.user || null,
    gmailPassLength: gmailCreds?.pass?.length || 0,
    gmailPassFirst3: gmailCreds?.pass?.substring(0, 3) || null,
    emailServiceAvailable: hasEmail,
    envGmailUser: process.env.GMAIL_USER || null,
    envGmailAppPassword: process.env.GMAIL_APP_PASSWORD ? 'SET' : 'NOT SET',
  })
}
