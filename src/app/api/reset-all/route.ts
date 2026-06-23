import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

// POST /api/reset-all - reset all weekly usage for current user
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user?.id) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    const body = await request.json()
    const { checkAutoReset } = body

    if (checkAutoReset) {
      const settings = await db.settings.findUnique({
        where: { userId: user.id },
      })
      if (!settings || !settings.autoResetWeekly) {
        return NextResponse.json({ didReset: false })
      }

      const now = new Date()
      const dayOfWeek = now.getDay()
      const resetDay = settings.resetDay ?? 6
      const daysSinceResetDay = (dayOfWeek - resetDay + 7) % 7
      const weekStart = new Date(now)
      weekStart.setDate(now.getDate() - daysSinceResetDay)
      weekStart.setHours(0, 0, 0, 0)

      const lastReset = settings.lastAutoReset

      if (!lastReset || new Date(lastReset) < weekStart) {
        // Delete only sessions for this user's families
        const userFamilyIds = await db.family.findMany({
          where: { userId: user.id },
          select: { id: true },
        })
        const familyIds = userFamilyIds.map(f => f.id)

        await db.fillingSession.deleteMany({
          where: { familyId: { in: familyIds } },
        })

        await db.settings.update({
          where: { id: settings.id },
          data: { lastAutoReset: new Date() },
        })

        return NextResponse.json({ didReset: true })
      }

      return NextResponse.json({ didReset: false })
    }

    // Manual reset all mode - only for current user's families
    const userFamilyIds = await db.family.findMany({
      where: { userId: user.id },
      select: { id: true },
    })
    const familyIds = userFamilyIds.map(f => f.id)

    await db.fillingSession.deleteMany({
      where: { familyId: { in: familyIds } },
    })

    const settings = await db.settings.findUnique({
      where: { userId: user.id },
    })
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
