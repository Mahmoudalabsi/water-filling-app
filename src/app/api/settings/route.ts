import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

const DEFAULT_SETTINGS = {
  freeMinutesPerWeek: 12,
  pricePerMinute: 0.5,
  autoResetWeekly: true,
  resetDay: 6,
  lastAutoReset: null as Date | null,
}

// GET /api/settings - get settings for current user
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user?.id) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    let settings = await db.settings.findUnique({
      where: { userId: user.id },
    })

    if (!settings) {
      settings = await db.settings.create({
        data: { ...DEFAULT_SETTINGS, userId: user.id },
      })
    }

    return NextResponse.json(settings)
  } catch (error) {
    console.error('Error fetching settings:', error)
    return NextResponse.json({ error: 'حدث خطأ في تحميل الإعدادات' }, { status: 500 })
  }
}

// PUT /api/settings - update settings for current user
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user?.id) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    let settings = await db.settings.findUnique({
      where: { userId: user.id },
    })

    if (!settings) {
      settings = await db.settings.create({
        data: { ...DEFAULT_SETTINGS, userId: user.id },
      })
    }

    const body = await request.json()

    const updated = await db.settings.update({
      where: { id: settings.id },
      data: {
        freeMinutesPerWeek: typeof body.freeMinutesPerWeek === 'number' ? body.freeMinutesPerWeek : settings.freeMinutesPerWeek,
        pricePerMinute: typeof body.pricePerMinute === 'number' ? body.pricePerMinute : settings.pricePerMinute,
        autoResetWeekly: typeof body.autoResetWeekly === 'boolean' ? body.autoResetWeekly : settings.autoResetWeekly,
        resetDay: typeof body.resetDay === 'number' ? body.resetDay : settings.resetDay,
        lastAutoReset: body.lastAutoReset !== undefined ? (body.lastAutoReset ? new Date(body.lastAutoReset) : null) : settings.lastAutoReset,
        resendApiKey: body.resendApiKey !== undefined ? body.resendApiKey : settings.resendApiKey,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating settings:', error)
    return NextResponse.json({ error: 'حدث خطأ في حفظ الإعدادات' }, { status: 500 })
  }
}
