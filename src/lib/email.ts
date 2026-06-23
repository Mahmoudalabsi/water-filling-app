import nodemailer from 'nodemailer'
import { Resend } from 'resend'

// App URL for links in emails
const APP_URL = process.env.NEXTAUTH_URL || 'https://water-filling-app.vercel.app'

// Resend lazy initialization
let _resend: Resend | null = null
let _lastResendKey: string | null = null

function getResend(apiKey: string): Resend {
  if (!_resend || _lastResendKey !== apiKey) {
    _resend = new Resend(apiKey)
    _lastResendKey = apiKey
  }
  return _resend
}

/**
 * Get Gmail credentials from env vars or database
 */
export async function getGmailCredentials(): Promise<{ user: string; pass: string } | null> {
  // Check env vars first
  const envUser = process.env.GMAIL_USER
  const envPass = process.env.GMAIL_APP_PASSWORD
  if (envUser && envPass) {
    return { user: envUser, pass: envPass }
  }

  // Check database
  try {
    const { db } = await import('@/lib/db')
    const settings = await db.settings.findFirst({
      where: {
        gmailUser: { not: null },
        gmailAppPassword: { not: null },
      },
      select: { gmailUser: true, gmailAppPassword: true },
    })
    if (settings?.gmailUser && settings?.gmailAppPassword) {
      return { user: settings.gmailUser, pass: settings.gmailAppPassword }
    }
  } catch {
    // Database might not be available
  }

  return null
}

/**
 * Email provider type
 */
type EmailProvider = 'gmail' | 'resend' | null

/**
 * Detect which email provider is available
 */
async function detectEmailProvider(resendApiKey?: string): Promise<EmailProvider> {
  // Check Gmail SMTP first (preferred - works with any recipient)
  const gmailCreds = await getGmailCredentials()
  if (gmailCreds) {
    return 'gmail'
  }

  // Check Resend API key
  const apiKey = resendApiKey || await getResendApiKeyFromDB()
  if (apiKey) {
    return 'resend'
  }

  return null
}

/**
 * Create Gmail SMTP transporter
 */
function createGmailTransporter(user: string, pass: string) {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  })
}

/**
 * Generate the HTML email content
 */
function generateEmailHtml(code: string, userName: string): string {
  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; margin: 0; padding: 0; background-color: #f0fdfa; }
    .container { max-width: 480px; margin: 0 auto; padding: 20px; }
    .card { background: white; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); overflow: hidden; }
    .header { background: linear-gradient(135deg, #0891b2, #059669); padding: 30px 24px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 22px; }
    .header p { color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px; }
    .body { padding: 30px 24px; text-align: center; }
    .greeting { font-size: 18px; color: #1f2937; margin-bottom: 16px; }
    .message { font-size: 15px; color: #4b5563; line-height: 1.8; margin-bottom: 24px; }
    .code-box { background: linear-gradient(135deg, #f0fdfa, #ecfdf5); border: 2px dashed #0891b2; border-radius: 12px; padding: 20px; margin: 0 auto 24px; display: inline-block; direction: ltr; }
    .code-label { font-size: 13px; color: #6b7280; margin-bottom: 8px; }
    .code { font-size: 36px; font-weight: 700; color: #0891b2; letter-spacing: 8px; font-family: 'Courier New', monospace; }
    .expiry { font-size: 13px; color: #9ca3af; margin-top: 20px; }
    .footer { background: #f9fafb; padding: 16px 24px; text-align: center; border-top: 1px solid #e5e7eb; }
    .footer p { font-size: 12px; color: #9ca3af; margin: 4px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <h1>&#128167; تعبئة المياه</h1>
        <p>Water Filling Management</p>
      </div>
      <div class="body">
        <div class="greeting">مرحباً ${userName}!</div>
        <div class="message">
          شكراً لتسجيلك في تطبيق تعبئة المياه.<br/>
          يرجى إدخال رمز التحقق التالي لتأكيد بريدك الإلكتروني:
        </div>
        <div class="code-box">
          <div class="code-label">رمز التحقق / Verification Code</div>
          <div class="code">${code}</div>
        </div>
        <div class="message" style="font-size: 13px; color: #6b7280;">
          هذا الرمز صالح لمدة 10 دقائق فقط.<br/>
          This code is valid for 10 minutes only.
        </div>
        <div class="expiry">
          إذا لم تطلب هذا الرمز، يمكنك تجاهل هذه الرسالة بأمان.<br/>
          If you didn't request this code, you can safely ignore this email.
        </div>
      </div>
      <div class="footer">
        <p>تطبيق تعبئة المياه - Water Filling App</p>
        <p>${APP_URL}</p>
      </div>
    </div>
  </div>
</body>
</html>
  `
}

interface SendVerificationEmailParams {
  email: string
  code: string
  name?: string
  apiKey?: string  // Resend API key (optional, for backward compatibility)
}

export async function sendVerificationEmail({ email, code, name, apiKey }: SendVerificationEmailParams) {
  const userName = name || email.split('@')[0]
  const html = generateEmailHtml(code, userName)
  const subject = 'رمز التحقق - تعبئة المياه | Verification Code'

  const errors: string[] = []

  // Try Gmail SMTP first (always try, regardless of detectEmailProvider)
  try {
    const creds = await getGmailCredentials()
    if (creds) {
      console.log(`[email] Attempting Gmail SMTP to ${email} from ${creds.user}`)
      const transporter = createGmailTransporter(creds.user, creds.pass)
      await transporter.sendMail({
        from: `"Water Filling App" <${creds.user}>`,
        to: email,
        subject,
        html,
      })
      console.log(`[email] Gmail SMTP sent successfully to ${email}`)
      return { success: true }
    } else {
      console.log('[email] No Gmail credentials found (env or DB)')
      errors.push('Gmail credentials not configured')
    }
  } catch (err: any) {
    console.error('[email] Gmail SMTP error:', err?.message || err)
    errors.push(`Gmail SMTP: ${err?.message || 'Unknown error'}`)
    // Fall through to try Resend if available
  }

  // Try Resend as fallback
  const resendKey = apiKey || await getResendApiKeyFromDB()
  if (resendKey) {
    try {
      console.log(`[email] Attempting Resend to ${email}`)
      const { error } = await getResend(resendKey).emails.send({
        from: 'Water Filling App <onboarding@resend.dev>',
        to: email,
        subject,
        html,
      })

      if (error) {
        console.error('[email] Resend error:', error)
        errors.push(`Resend: ${error.message}`)
      } else {
        console.log(`[email] Resend sent successfully to ${email}`)
        return { success: true }
      }
    } catch (err: any) {
      console.error('[email] Resend failed:', err?.message || err)
      errors.push(`Resend: ${err?.message || 'Unknown error'}`)
    }
  } else {
    errors.push('No Resend API key configured')
  }

  return { success: false, error: errors.join(' | ') }
}

/**
 * Generate a 6-digit verification code
 */
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

/**
 * Save verification token in the database
 */
export async function saveVerificationToken(email: string, code: string) {
  const { db } = await import('@/lib/db')

  // Delete any existing verification tokens for this email
  await db.verificationToken.deleteMany({
    where: { identifier: email },
  })

  // Create new verification token (expires in 10 minutes)
  const expires = new Date(Date.now() + 10 * 60 * 1000)

  await db.verificationToken.create({
    data: {
      identifier: email,
      token: code,
      expires,
    },
  })

  return { code, expires }
}

/**
 * Get the Resend API key from database (global fallback)
 */
async function getResendApiKeyFromDB(): Promise<string | null> {
  try {
    const { db } = await import('@/lib/db')
    const anySettings = await db.settings.findFirst({
      where: { resendApiKey: { not: null } },
      select: { resendApiKey: true },
    })
    if (anySettings?.resendApiKey) return anySettings.resendApiKey
  } catch {
    // Database might not be available
  }
  return null
}

/**
 * Get the Resend API key from environment variable or database settings
 * Checks: 1) env var, 2) specific user's settings, 3) any user's settings (global fallback)
 */
export async function getResendApiKey(userId?: string): Promise<string | null> {
  // First check environment variable
  const envKey = process.env.RESEND_API_KEY
  if (envKey) return envKey

  try {
    const { db } = await import('@/lib/db')

    // Check specific user's settings if userId is provided
    if (userId) {
      const settings = await db.settings.findUnique({
        where: { userId },
      })
      if (settings?.resendApiKey) return settings.resendApiKey
    }

    // Global fallback: find any settings record that has a resendApiKey
    const anySettings = await db.settings.findFirst({
      where: { resendApiKey: { not: null } },
      select: { resendApiKey: true },
    })
    if (anySettings?.resendApiKey) return anySettings.resendApiKey
  } catch {
    // Database might not be available
  }

  return null
}

/**
 * Check if email verification is available (has Gmail SMTP or Resend API key)
 */
export async function isEmailVerificationAvailable(userId?: string): Promise<boolean> {
  // Check Gmail SMTP (env or database)
  const gmailCreds = await getGmailCredentials()
  if (gmailCreds) return true

  // Check Resend
  const key = await getResendApiKey(userId)
  return !!key
}
