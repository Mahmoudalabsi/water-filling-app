import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { generateVerificationCode, saveVerificationToken, sendVerificationEmail } from '@/lib/email'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, email, password } = body

    if (!email || !password || !name) {
      return NextResponse.json({ error: 'جميع الحقول مطلوبة' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' }, { status: 400 })
    }

    const existingUser = await db.user.findUnique({
      where: { email },
      include: { accounts: true },
    })

    if (existingUser) {
      // Check if this user was created via Google (no password)
      if (!existingUser.password) {
        // User signed up via Google before - let them set a password too
        const hashedPassword = await bcrypt.hash(password, 12)

        await db.user.update({
          where: { id: existingUser.id },
          data: {
            name: name || existingUser.name,
            password: hashedPassword,
          },
        })

        return NextResponse.json({
          success: true,
          message: 'تم ربط كلمة المرور بحسابك بنجاح',
          user: { id: existingUser.id, email: existingUser.email, name: existingUser.name },
        }, { status: 200 })
      }

      // User already has a password - email is taken
      return NextResponse.json({ error: 'البريد الإلكتروني مستخدم بالفعل' }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    // Check if email verification is available (RESEND_API_KEY is set)
    const hasEmailService = !!process.env.RESEND_API_KEY

    // Create user - if email service is not available, auto-verify
    const user = await db.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        // Auto-verify if no email service is configured
        emailVerified: hasEmailService ? null : new Date(),
      },
    })

    await db.settings.create({
      data: {
        userId: user.id,
        freeMinutesPerWeek: 12,
        pricePerMinute: 0.5,
        autoResetWeekly: true,
        resetDay: 6,
      },
    })

    // If email service is available, send verification email
    if (hasEmailService) {
      try {
        const code = generateVerificationCode()
        await saveVerificationToken(email, code)

        const emailResult = await sendVerificationEmail({
          email,
          code,
          name,
        })

        if (!emailResult.success) {
          console.error('Failed to send verification email:', emailResult.error)
          // Still return success for registration, but indicate email issue
          return NextResponse.json({
            success: true,
            requiresVerification: true,
            emailSent: false,
            message: 'تم إنشاء الحساب لكن حدث خطأ في إرسال بريد التحقق، يرجى طلب رمز جديد',
            user: { id: user.id, email: user.email, name: user.name },
          }, { status: 201 })
        }

        return NextResponse.json({
          success: true,
          requiresVerification: true,
          emailSent: true,
          message: 'تم إنشاء الحساب. يرجى التحقق من بريدك الإلكتروني',
          user: { id: user.id, email: user.email, name: user.name },
        }, { status: 201 })
      } catch (emailError) {
        console.error('Email service error:', emailError)
        // If email fails, still allow registration but require verification later
        return NextResponse.json({
          success: true,
          requiresVerification: true,
          emailSent: false,
          message: 'تم إنشاء الحساب لكن حدث خطأ في إرسال بريد التحقق، يرجى طلب رمز جديد',
          user: { id: user.id, email: user.email, name: user.name },
        }, { status: 201 })
      }
    }

    // No email service - auto-verified, can sign in directly
    return NextResponse.json({
      success: true,
      requiresVerification: false,
      emailSent: false,
      message: 'تم إنشاء الحساب بنجاح',
      user: { id: user.id, email: user.email, name: user.name },
    }, { status: 201 })
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json({ error: 'حدث خطأ في إنشاء الحساب' }, { status: 500 })
  }
}
