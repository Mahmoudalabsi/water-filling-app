import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

// POST /api/families/[id]/start - start a new session
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request)
    if (!user?.id) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    const { id } = await params

    // Check family exists and belongs to user
    const family = await db.family.findUnique({
      where: { id },
      include: { sessions: true },
    })

    if (!family || family.userId !== user.id) {
      return NextResponse.json({ error: 'العائلة غير موجودة' }, { status: 404 })
    }

    // Check for active session
    const activeSession = family.sessions.find((s) => !s.endTime)
    if (activeSession) {
      return NextResponse.json({ error: 'يوجد جلسة نشطة بالفعل لهذه العائلة' }, { status: 400 })
    }

    const session = await db.fillingSession.create({
      data: {
        familyId: id,
        startTime: new Date(),
      },
    })

    return NextResponse.json({ success: true, session })
  } catch (error) {
    console.error('Error starting session:', error)
    return NextResponse.json({ error: 'حدث خطأ في بدء الجلسة' }, { status: 500 })
  }
}
