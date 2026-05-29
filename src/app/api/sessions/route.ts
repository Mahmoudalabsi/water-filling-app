import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// Get weekly usage for a family
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const familyId = searchParams.get('familyId')

    if (!familyId) {
      return NextResponse.json({ error: 'معرف العائلة مطلوب' }, { status: 400 })
    }

    // Get start of current week (Saturday midnight - Islamic week start)
    const now = new Date()
    const dayOfWeek = now.getDay()
    // Calculate days since last Saturday
    const daysSinceSaturday = (dayOfWeek + 1) % 7
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - daysSinceSaturday)
    weekStart.setHours(0, 0, 0, 0)

    const sessions = await db.session.findMany({
      where: {
        familyId,
        startTime: { gte: weekStart },
      },
      orderBy: { startTime: 'desc' },
    })

    const totalSeconds = sessions.reduce((acc, s) => acc + s.duration, 0)

    return NextResponse.json({
      sessions,
      totalSeconds,
      weekStart,
    })
  } catch (error) {
    console.error('Error fetching sessions:', error)
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 })
  }
}

// Start a new session
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { familyId } = body

    if (!familyId) {
      return NextResponse.json({ error: 'معرف العائلة مطلوب' }, { status: 400 })
    }

    // Check if there's already an active session for this family
    const activeSession = await db.session.findFirst({
      where: {
        familyId,
        endTime: null,
      },
    })

    if (activeSession) {
      return NextResponse.json({ error: 'يوجد جلسة نشطة بالفعل لهذه العائلة' }, { status: 400 })
    }

    const session = await db.session.create({
      data: {
        familyId,
        startTime: new Date(),
      },
    })

    return NextResponse.json(session, { status: 201 })
  } catch (error) {
    console.error('Error creating session:', error)
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
  }
}

// Stop an active session
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { sessionId, duration } = body

    if (!sessionId) {
      return NextResponse.json({ error: 'معرف الجلسة مطلوب' }, { status: 400 })
    }

    const session = await db.session.update({
      where: { id: sessionId },
      data: {
        endTime: new Date(),
        duration: duration || 0,
      },
    })

    return NextResponse.json(session)
  } catch (error) {
    console.error('Error updating session:', error)
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 })
  }
}

// Reset weekly usage for a family
export async function PATCH(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const familyId = searchParams.get('familyId')

    if (!familyId) {
      return NextResponse.json({ error: 'معرف العائلة مطلوب' }, { status: 400 })
    }

    await db.session.deleteMany({
      where: { familyId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error resetting sessions:', error)
    return NextResponse.json({ error: 'Failed to reset sessions' }, { status: 500 })
  }
}
