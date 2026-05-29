import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const families = await db.family.findMany({
      include: { sessions: true },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(families)
  } catch (error) {
    console.error('Error fetching families:', error)
    return NextResponse.json({ error: 'Failed to fetch families' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name } = body

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: 'اسم العائلة مطلوب' }, { status: 400 })
    }

    const family = await db.family.create({
      data: { name: name.trim() },
    })

    return NextResponse.json(family, { status: 201 })
  } catch (error) {
    console.error('Error creating family:', error)
    return NextResponse.json({ error: 'Failed to create family' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'معرف العائلة مطلوب' }, { status: 400 })
    }

    await db.session.deleteMany({ where: { familyId: id } })
    await db.family.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting family:', error)
    return NextResponse.json({ error: 'Failed to delete family' }, { status: 500 })
  }
}
