import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

/**
 * POST /api/setup-email - Save Gmail SMTP credentials to database
 * This allows the email verification system to work without Vercel env vars
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user?.id) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    const body = await request.json()
    const { gmailUser, gmailAppPassword } = body

    if (!gmailUser || !gmailAppPassword) {
      return NextResponse.json({ error: 'يرجى ملء جميع الحقول' }, { status: 400 })
    }

    // Validate Gmail format
    if (!gmailUser.includes('@gmail.com')) {
      return NextResponse.json({ error: 'يرجى إدخال بريد Gmail صحيح' }, { status: 400 })
    }

    // Save to the user's settings
    const settings = await db.settings.findUnique({
      where: { userId: user.id },
    })

    if (settings) {
      await db.settings.update({
        where: { id: settings.id },
        data: {
          gmailUser,
          gmailAppPassword,
        },
      })
    } else {
      await db.settings.create({
        data: {
          userId: user.id,
          gmailUser,
          gmailAppPassword,
          freeMinutesPerWeek: 12,
          pricePerMinute: 0.5,
          autoResetWeekly: true,
          resetDay: 6,
        },
      })
    }

    return NextResponse.json({
      success: true,
      message: 'تم حفظ إعدادات Gmail بنجاح',
    })
  } catch (error) {
    console.error('Error saving Gmail settings:', error)
    return NextResponse.json({ error: 'حدث خطأ في حفظ الإعدادات' }, { status: 500 })
  }
}
