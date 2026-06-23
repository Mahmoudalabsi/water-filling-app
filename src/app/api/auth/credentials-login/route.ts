import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { generateApiToken } from '@/lib/api-auth'

/**
 * Direct credentials login endpoint for mobile app (Capacitor) and browser
 * Returns user data + JWT token for API authentication
 * This is used when NextAuth's cookie-based session doesn't work in WebView
 */
export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'البريد الإلكتروني وكلمة المرور مطلوبان' },
        { status: 400 }
      )
    }

    const user = await db.user.findUnique({
      where: { email },
    })

    if (!user || !user.password) {
      return NextResponse.json(
        { error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' },
        { status: 401 }
      )
    }

    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) {
      return NextResponse.json(
        { error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' },
        { status: 401 }
      )
    }

    // Check email verification
    if (!user.emailVerified) {
      const pendingToken = await db.verificationToken.findFirst({
        where: { identifier: user.email },
      })

      if (pendingToken) {
        return NextResponse.json(
          { error: 'EMAIL_NOT_VERIFIED' },
          { status: 403 }
        )
      }

      // Legacy user - auto-verify
      await db.user.update({
        where: { id: user.id },
        data: { emailVerified: new Date() },
      })
    }

    // Generate JWT token for API authentication
    const token = generateApiToken({
      id: user.id,
      email: user.email,
      name: user.name,
    })

    // Return user data + JWT token
    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
      },
      token, // JWT token for API calls
    })
  } catch (error) {
    console.error('Credentials login error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ في تسجيل الدخول' },
      { status: 500 }
    )
  }
}
