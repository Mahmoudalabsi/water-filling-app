import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// PUT /api/families/[id] - update family name
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'اسم العائلة مطلوب' }, { status: 400 })
    }

    const family = await db.family.update({
      where: { id },
      data: { name: name.trim() },
      include: { sessions: true },
    })

    return NextResponse.json(family)
  } catch (error) {
    console.error('Error updating family:', error)
    return NextResponse.json({ error: 'حدث خطأ في تعديل العائلة' }, { status: 500 })
  }
}

// DELETE /api/families/[id] - delete a family
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    await db.family.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting family:', error)
    return NextResponse.json({ error: 'حدث خطأ في حذف العائلة' }, { status: 500 })
  }
}
