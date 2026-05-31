import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

// POST /api/families/[id]/stop - stop active session
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user?.id) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { sessionId, duration } = body

    if (!sessionId) {
      return NextResponse.json({ error: 'معرف الجلسة مطلوب' }, { status: 400 })
    }

    // Verify family belongs to user
    const family = await db.family.findUnique({ where: { id } })
    if (!family || family.userId !== user.id) {
      return NextResponse.json({ error: 'العائلة غير موجودة' }, { status: 404 })
    }

    const session = await db.fillingSession.findUnique({
      where: { id: sessionId },
    })

    if (!session) {
      return NextResponse.json({ error: 'الجلسة غير موجودة' }, { status: 404 })
    }

    if (session.endTime) {
      return NextResponse.json({ error: 'الجلسة منتهية بالفعل' }, { status: 400 })
    }

    const updatedSession = await db.fillingSession.update({
      where: { id: sessionId },
      data: {
        endTime: new Date(),
        duration: typeof duration === 'number' ? duration : 0,
      },
    })

    return NextResponse.json({ success: true, session: updatedSession })
  } catch (error) {
    console.error('Error stopping session:', error)
    return NextResponse.json({ error: 'حدث خطأ في إيقاف الجلسة' }, { status: 500 })
  }
}
