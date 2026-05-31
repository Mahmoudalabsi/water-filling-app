import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/families/[id]/reset - reset weekly usage for a family
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Delete all sessions for this family
    await db.session.deleteMany({
      where: { familyId: id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error resetting weekly usage:', error)
    return NextResponse.json({ error: 'حدث خطأ في إعادة التعيين' }, { status: 500 })
  }
}
