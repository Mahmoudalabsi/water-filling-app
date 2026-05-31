import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateVerificationCode, saveVerificationToken, sendVerificationEmail, getResendApiKey } from '@/lib/email'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json(
        { error: 'البريد الإلكتروني مطلوب' },
        { status: 400 }
      )
    }

    // Check if user exists
    const user = await db.user.findUnique({
      where: { email },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'المستخدم غير موجود' },
        { status: 404 }
      )
    }

    // Check if already verified
    if (user.emailVerified) {
      return NextResponse.json(
        { error: 'البريد الإلكتروني مؤكد بالفعل' },
        { status: 400 }
      )
    }

    // Check if email service is configured
    const apiKey = await getResendApiKey(user.id)
    if (!apiKey) {
      return NextResponse.json(
        { error: 'خدمة تأكيد البريد الإلكتروني غير متاحة حالياً' },
        { status: 503 }
      )
    }

    // Check rate limiting: don't allow resend within 60 seconds
    const existingToken = await db.verificationToken.findFirst({
      where: { identifier: email },
    })

    if (existingToken) {
      const timeSinceCreated = Date.now() - (existingToken.expires.getTime() - 10 * 60 * 1000)
      if (timeSinceCreated < 60 * 1000) {
        const secondsLeft = Math.ceil((60 * 1000 - timeSinceCreated) / 1000)
        return NextResponse.json(
          { error: `يرجى الانتظار ${secondsLeft} ثانية قبل طلب رمز جديد` },
          { status: 429 }
        )
      }
    }

    // Generate and save new verification code
    const code = generateVerificationCode()
    await saveVerificationToken(email, code)

    // Send verification email
    const emailResult = await sendVerificationEmail({
      email,
      code,
      name: user.name || undefined,
      apiKey,
    })

    if (!emailResult.success) {
      return NextResponse.json(
        { error: 'حدث خطأ في إرسال البريد الإلكتروني، يرجى المحاولة لاحقاً' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'تم إرسال رمز التحقق الجديد',
    })
  } catch (error) {
    console.error('Resend verification error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ، يرجى المحاولة لاحقاً' },
      { status: 500 }
    )
  }
}
