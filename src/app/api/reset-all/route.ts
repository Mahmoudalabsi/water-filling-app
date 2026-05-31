import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/reset-all - reset all weekly usage, with optional auto-reset check
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { checkAutoReset } = body

    if (checkAutoReset) {
      // Auto-reset check mode
      const settings = await db.settings.findFirst()
      if (!settings || !settings.autoResetWeekly) {
        return NextResponse.json({ didReset: false })
      }

      // Calculate week start based on the selected reset day
      const now = new Date()
      const dayOfWeek = now.getDay()
      const resetDay = settings.resetDay ?? 6
      const daysSinceResetDay = (dayOfWeek - resetDay + 7) % 7
      const weekStart = new Date(now)
      weekStart.setDate(now.getDate() - daysSinceResetDay)
      weekStart.setHours(0, 0, 0, 0)

      const lastReset = settings.lastAutoReset

      if (!lastReset || new Date(lastReset) < weekStart) {
        // Need to auto-reset
        await db.session.deleteMany({})

        await db.settings.update({
          where: { id: settings.id },
          data: { lastAutoReset: new Date() },
        })

        return NextResponse.json({ didReset: true })
      }

      return NextResponse.json({ didReset: false })
    }

    // Manual reset all mode
    await db.session.deleteMany({})

    // Update last auto reset time
    const settings = await db.settings.findFirst()
    if (settings) {
      await db.settings.update({
        where: { id: settings.id },
        data: { lastAutoReset: new Date() },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error resetting all:', error)
    return NextResponse.json({ error: 'حدث خطأ في التصفير' }, { status: 500 })
  }
}
