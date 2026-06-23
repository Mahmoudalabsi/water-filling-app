import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/admin/users - List all users with their verification status
 * Admin diagnostic endpoint
 */
export async function GET() {
  try {
    const users = await db.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        createdAt: true,
        settings: {
          select: {
            gmailUser: true,
            gmailAppPassword: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      status: 'ok',
      count: users.length,
      users: users.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        emailVerified: u.emailVerified,
        createdAt: u.createdAt,
        hasGmailSettings: !!(u.settings?.[0]?.gmailUser && u.settings?.[0]?.gmailAppPassword),
      }))
    })
  } catch (error: any) {
    console.error('Error listing users:', error)
    return NextResponse.json({ error: error?.message || 'Unknown error' }, { status: 500 })
  }
}
