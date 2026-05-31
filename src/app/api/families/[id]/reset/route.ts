import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

// POST /api/families/[id]/reset - reset weekly usage for a family
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user?.id) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    const { id } = await params

    // Verify ownership
    const family = await db.family.findUnique({ where: { id } })
    if (!family || family.userId !== user.id) {
      return NextResponse.json({ error: 'العائلة غير موجودة' }, { status: 404 })
    }

    await db.fillingSession.deleteMany({
      where: { familyId: id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error resetting weekly usage:', error)
    return NextResponse.json({ error: 'حدث خطأ في إعادة التعيين' }, { status: 500 })
  }
}
