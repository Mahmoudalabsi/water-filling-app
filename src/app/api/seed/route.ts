import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    // Clear existing data
    await db.session.deleteMany()
    await db.family.deleteMany()

    // Create sample families
    const families = await Promise.all([
      db.family.create({ data: { name: 'عائلة الأغا' } }),
      db.family.create({ data: { name: 'عائلة الشريف' } }),
      db.family.create({ data: { name: 'عائلة الحسيني' } }),
      db.family.create({ data: { name: 'عائلة النابلسي' } }),
      db.family.create({ data: { name: 'عائلة القاسم' } }),
      db.family.create({ data: { name: 'عائلة المصري' } }),
    ])

    const now = new Date()

    // Helper to create a date N days/hours ago
    const daysAgo = (days: number, hour = 10, minute = 0) => {
      const d = new Date(now)
      d.setDate(d.getDate() - days)
      d.setHours(hour, minute, 0, 0)
      return d
    }

    // Create sample sessions with various durations
    const sessions = [
      // عائلة الأغا - used 5 minutes this week (within free limit)
      { familyId: families[0].id, startTime: daysAgo(1, 8, 30), endTime: daysAgo(1, 8, 35), duration: 5 * 60 },
      { familyId: families[0].id, startTime: daysAgo(3, 14, 0), endTime: daysAgo(3, 14, 7), duration: 7 * 60 },

      // عائلة الشريف - used 15 minutes this week (exceeds free limit by 3 min)
      { familyId: families[1].id, startTime: daysAgo(0, 9, 0), endTime: daysAgo(0, 9, 6), duration: 6 * 60 },
      { familyId: families[1].id, startTime: daysAgo(2, 11, 15), endTime: daysAgo(2, 11, 21), duration: 6 * 60 },
      { familyId: families[1].id, startTime: daysAgo(4, 16, 0), endTime: daysAgo(4, 16, 4), duration: 4 * 60 },

      // عائلة الحسيني - used exactly 12 minutes (at the limit)
      { familyId: families[2].id, startTime: daysAgo(1, 7, 0), endTime: daysAgo(1, 7, 10), duration: 10 * 60 },
      { familyId: families[2].id, startTime: daysAgo(5, 13, 30), endTime: daysAgo(5, 13, 32), duration: 2 * 60 },

      // عائلة النابلسي - heavy user, 25 minutes this week (13 min over)
      { familyId: families[3].id, startTime: daysAgo(0, 6, 0), endTime: daysAgo(0, 6, 8), duration: 8 * 60 },
      { familyId: families[3].id, startTime: daysAgo(1, 10, 0), endTime: daysAgo(1, 10, 17), duration: 7 * 60 },
      { familyId: families[3].id, startTime: daysAgo(3, 15, 0), endTime: daysAgo(3, 15, 17), duration: 10 * 60 },
      // Old session from previous week
      { familyId: families[3].id, startTime: daysAgo(9, 8, 0), endTime: daysAgo(9, 8, 15), duration: 15 * 60 },
      { familyId: families[3].id, startTime: daysAgo(10, 12, 0), endTime: daysAgo(10, 12, 22), duration: 20 * 60 },

      // عائلة القاسم - minimal usage, only 3 minutes
      { familyId: families[4].id, startTime: daysAgo(2, 9, 0), endTime: daysAgo(2, 9, 3), duration: 3 * 60 },

      // عائلة المصري - moderate usage, 10 minutes
      { familyId: families[5].id, startTime: daysAgo(1, 11, 0), endTime: daysAgo(1, 11, 6), duration: 6 * 60 },
      { familyId: families[5].id, startTime: daysAgo(4, 14, 30), endTime: daysAgo(4, 14, 34), duration: 4 * 60 },
      // Previous week session
      { familyId: families[5].id, startTime: daysAgo(8, 10, 0), endTime: daysAgo(8, 10, 18), duration: 18 * 60 },
    ]

    await db.session.createMany({ data: sessions })

    return NextResponse.json({
      success: true,
      familiesCreated: families.length,
      sessionsCreated: sessions.length,
      message: 'تم إنشاء البيانات التجريبية بنجاح',
    })
  } catch (error) {
    console.error('Error seeding data:', error)
    return NextResponse.json({ error: 'Failed to seed data' }, { status: 500 })
  }
}
