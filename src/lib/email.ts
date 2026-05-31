import { Resend } from 'resend'

// Lazy-initialize Resend to avoid build-time errors when API key is not available
let _resend: Resend | null = null
let _lastApiKey: string | null = null

function getResend(apiKey?: string): Resend {
  const key = apiKey || process.env.RESEND_API_KEY || ''
  if (!_resend || _lastApiKey !== key) {
    if (!key) {
      throw new Error('RESEND_API_KEY is not configured')
    }
    _resend = new Resend(key)
    _lastApiKey = key
  }
  return _resend
}

// App URL for links in emails
const APP_URL = process.env.NEXTAUTH_URL || 'https://water-filling-app.vercel.app'

interface SendVerificationEmailParams {
  email: string
  code: string
  name?: string
  apiKey?: string
}

export async function sendVerificationEmail({ email, code, name, apiKey }: SendVerificationEmailParams) {
  const userName = name || email.split('@')[0]

  // Arabic and bilingual email
  const html = `
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

  try {
    const { error } = await getResend(apiKey).emails.send({
      from: 'Water Filling App <onboarding@resend.dev>',
      to: email,
      subject: `رمز التحقق - تعبئة المياه | Verification Code`,
      html,
    })

    if (error) {
      console.error('Resend email error:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err: any) {
    console.error('Email send failed:', err)
    return { success: false, error: err.message || 'Failed to send email' }
  }
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
 * Check if email verification is available (has API key)
 */
export async function isEmailVerificationAvailable(userId?: string): Promise<boolean> {
  const key = await getResendApiKey(userId)
  return !!key
}
