import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/families - list all families with sessions
export async function GET() {
  try {
    const families = await db.family.findMany({
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
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'اسم العائلة مطلوب' }, { status: 400 })
    }

    const family = await db.family.create({
      data: { name: name.trim() },
      include: { sessions: true },
    })

    return NextResponse.json(family, { status: 201 })
  } catch (error) {
    console.error('Error adding family:', error)
    return NextResponse.json({ error: 'حدث خطأ في إضافة العائلة' }, { status: 500 })
  }
}
