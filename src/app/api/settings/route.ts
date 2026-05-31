import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

const DEFAULT_SETTINGS = {
  freeMinutesPerWeek: 12,
  pricePerMinute: 0.5,
  autoResetWeekly: true,
  resetDay: 6,
  lastAutoReset: null as Date | null,
}

// GET /api/settings - get settings (create default if not exists)
export async function GET() {
  try {
    let settings = await db.settings.findFirst()

    if (!settings) {
      settings = await db.settings.create({
        data: DEFAULT_SETTINGS,
      })
    }

    return NextResponse.json(settings)
  } catch (error) {
    console.error('Error fetching settings:', error)
    return NextResponse.json({ error: 'حدث خطأ في تحميل الإعدادات' }, { status: 500 })
  }
}

// PUT /api/settings - update settings
export async function PUT(request: Request) {
  try {
    let settings = await db.settings.findFirst()

    if (!settings) {
      settings = await db.settings.create({
        data: DEFAULT_SETTINGS,
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
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating settings:', error)
    return NextResponse.json({ error: 'حدث خطأ في حفظ الإعدادات' }, { status: 500 })
  }
}
