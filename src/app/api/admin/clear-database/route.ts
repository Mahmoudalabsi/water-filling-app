import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/admin/clear-database - Delete ALL data from all tables
// This resets the app to a brand new state with zero users
export async function POST() {
  try {
    console.log('[clear-database] Starting full database wipe...')

    // Delete in order respecting foreign key constraints
    // 1. Filling sessions (depends on families)
    const deletedSessions = await db.fillingSession.deleteMany({})
    console.log(`[clear-database] Deleted ${deletedSessions.count} filling sessions`)

    // 2. Settings (depends on users)
    const deletedSettings = await db.settings.deleteMany({})
    console.log(`[clear-database] Deleted ${deletedSettings.count} settings`)

    // 3. Families (depends on users)
    const deletedFamilies = await db.family.deleteMany({})
    console.log(`[clear-database] Deleted ${deletedFamilies.count} families`)

    // 4. Accounts (depends on users)
    const deletedAccounts = await db.account.deleteMany({})
    console.log(`[clear-database] Deleted ${deletedAccounts.count} accounts`)

    // 5. Auth sessions (depends on users)
    const deletedAuthSessions = await db.authSession.deleteMany({})
    console.log(`[clear-database] Deleted ${deletedAuthSessions.count} auth sessions`)

    // 6. Verification tokens (standalone)
    const deletedTokens = await db.verificationToken.deleteMany({})
    console.log(`[clear-database] Deleted ${deletedTokens.count} verification tokens`)

    // 7. Users (parent table)
    const deletedUsers = await db.user.deleteMany({})
    console.log(`[clear-database] Deleted ${deletedUsers.count} users`)

    // Verify database is empty
    const userCount = await db.user.count()
    const familyCount = await db.family.count()
    const sessionCount = await db.fillingSession.count()

    return NextResponse.json({
      status: 'ok',
      message: 'Database cleared successfully - app is now like new',
      deleted: {
        users: deletedUsers.count,
        accounts: deletedAccounts.count,
        authSessions: deletedAuthSessions.count,
        families: deletedFamilies.count,
        fillingSessions: deletedSessions.count,
        settings: deletedSettings.count,
        verificationTokens: deletedTokens.count,
      },
      verification: {
        remainingUsers: userCount,
        remainingFamilies: familyCount,
        remainingSessions: sessionCount,
      }
    })
  } catch (error: any) {
    console.error('[clear-database] Error:', error)
    return NextResponse.json({
      status: 'error',
      message: 'Failed to clear database',
      error: error?.message || 'Unknown error',
    }, { status: 500 })
  }
}

// GET /api/admin/clear-database - Check current database stats
export async function GET() {
  try {
    const [userCount, familyCount, sessionCount, settingsCount, accountCount, authTokenCount, verificationTokenCount] = await Promise.all([
      db.user.count(),
      db.family.count(),
      db.fillingSession.count(),
      db.settings.count(),
      db.account.count(),
      db.authSession.count(),
      db.verificationToken.count(),
    ])

    return NextResponse.json({
      status: 'ok',
      data: {
        users: userCount,
        families: familyCount,
        fillingSessions: sessionCount,
        settings: settingsCount,
        accounts: accountCount,
        authSessions: authTokenCount,
        verificationTokens: verificationTokenCount,
      }
    })
  } catch (error: any) {
    console.error('[clear-database] Stats error:', error)
    return NextResponse.json({
      status: 'error',
      message: 'Failed to get database stats',
      error: error?.message || 'Unknown error',
    }, { status: 500 })
  }
}
