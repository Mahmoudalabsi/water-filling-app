import { NextRequest, NextResponse } from 'next/server'
import { sendVerificationEmail, getGmailCredentials, isEmailVerificationAvailable } from '@/lib/email'

/**
 * POST /api/admin/test-email - Test email sending with detailed diagnostics
 * No auth required - admin diagnostic endpoint
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json({ error: 'Email address is required' }, { status: 400 })
    }

    const diagnostics: Record<string, any> = {}

    // Step 1: Check env vars
    diagnostics.envVars = {
      GMAIL_USER: process.env.GMAIL_USER ? `${process.env.GMAIL_USER.slice(0, 3)}***` : 'NOT SET',
      GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD ? 'SET' : 'NOT SET',
      RESEND_API_KEY: process.env.RESEND_API_KEY ? 'SET' : 'NOT SET',
    }

    // Step 2: Check Gmail credentials
    const gmailCreds = await getGmailCredentials()
    diagnostics.gmailCredentials = gmailCreds
      ? { user: `${gmailCreds.user.slice(0, 3)}***@gmail.com`, pass: '***configured***' }
      : null

    // Step 3: Check if email service is available
    diagnostics.emailServiceAvailable = await isEmailVerificationAvailable()

    // Step 4: Try to send a test email
    const testCode = '123456'
    const emailResult = await sendVerificationEmail({
      email,
      code: testCode,
      name: 'Test User',
    })

    diagnostics.sendResult = {
      success: emailResult.success,
      error: emailResult.error || null,
    }

    if (emailResult.success) {
      return NextResponse.json({
        status: 'ok',
        message: `Test email sent successfully to ${email}`,
        diagnostics,
      })
    } else {
      return NextResponse.json({
        status: 'error',
        message: 'Failed to send test email',
        diagnostics,
      }, { status: 500 })
    }
  } catch (error: any) {
    console.error('Test email error:', error)
    return NextResponse.json({
      status: 'error',
      message: 'Test email failed with exception',
      error: error?.message || 'Unknown error',
      stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
    }, { status: 500 })
  }
}
