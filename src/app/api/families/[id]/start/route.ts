import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/families/[id]/start - start a new session
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Check family exists
    const family = await db.family.findUnique({
      where: { id },
      include: { sessions: true },
    })

    if (!family) {
      return NextResponse.json({ error: 'العائلة غير موجودة' }, { status: 404 })
    }

    // Check for active session
    const activeSession = family.sessions.find((s) => !s.endTime)
    if (activeSession) {
      return NextResponse.json({ error: 'يوجد جلسة نشطة بالفعل لهذه العائلة' }, { status: 400 })
    }

    const session = await db.session.create({
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
