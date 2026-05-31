import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, code } = body

    if (!email || !code) {
      return NextResponse.json(
        { error: 'البريد الإلكتروني ورمز التحقق مطلوبان' },
        { status: 400 }
      )
    }

    // Find the verification token
    const verificationToken = await db.verificationToken.findUnique({
      where: { token: code },
    })

    if (!verificationToken) {
      return NextResponse.json(
        { error: 'رمز التحقق غير صحيح' },
        { status: 400 }
      )
    }

    // Check if the token belongs to this email
    if (verificationToken.identifier !== email) {
      return NextResponse.json(
        { error: 'رمز التحقق غير صحيح' },
        { status: 400 }
      )
    }

    // Check if the token has expired
    if (verificationToken.expires < new Date()) {
      // Delete expired token
      await db.verificationToken.delete({
        where: { token: code },
      })
      return NextResponse.json(
        { error: 'رمز التحقق منتهي الصلاحية، يرجى طلب رمز جديد' },
        { status: 400 }
      )
    }

    // Mark the user's email as verified
    const user = await db.user.findUnique({
      where: { email },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'المستخدم غير موجود' },
        { status: 404 }
      )
    }

    await db.user.update({
      where: { id: user.id },
      data: { emailVerified: new Date() },
    })

    // Delete the used verification token
    await db.verificationToken.delete({
      where: { token: code },
    })

    return NextResponse.json({
      success: true,
      message: 'تم تأكيد البريد الإلكتروني بنجاح',
      user: { id: user.id, email: user.email, name: user.name },
    })
  } catch (error) {
    console.error('Email verification error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ في التحقق من البريد الإلكتروني' },
      { status: 500 }
    )
  }
}
