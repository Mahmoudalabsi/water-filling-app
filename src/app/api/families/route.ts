import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

// GET /api/families - list all families for current user
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user?.id) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    const families = await db.family.findMany({
      where: { userId: user.id },
      include: { sessions: true },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(families)
  } catch (error) {
    console.error('Error fetching families:', error)
    return NextResponse.json({ error: 'حدث خطأ في تحميل البيانات' }, { status: 500 })
  }
}

// POST /api/families - add a new family
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user?.id) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    const body = await request.json()
    const { name } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'اسم العائلة مطلوب' }, { status: 400 })
    }

    const family = await db.family.create({
      data: { name: name.trim(), userId: user.id },
      include: { sessions: true },
    })

    return NextResponse.json(family, { status: 201 })
  } catch (error) {
    console.error('Error adding family:', error)
    return NextResponse.json({ error: 'حدث خطأ في إضافة العائلة' }, { status: 500 })
  }
}
