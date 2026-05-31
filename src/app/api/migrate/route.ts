import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/migrate - Run database migrations (create tables if needed)
// This endpoint should be called once after deployment to set up the database
export async function GET() {
  try {
    // Test database connection by querying users table
    await db.user.findFirst()
    return NextResponse.json({ status: 'ok', message: 'Database is ready' })
  } catch (error: any) {
    console.error('Database migration error:', error)

    if (error?.message?.includes('does not exist') || error?.code === '42P01') {
      return NextResponse.json({
        status: 'error',
        message: 'Tables not found. Please run: npx prisma db push',
        hint: 'Go to Vercel Dashboard → Storage → Connect your Postgres database to the project, then redeploy.'
      }, { status: 500 })
    }

    return NextResponse.json({
      status: 'error',
      message: 'Database connection failed',
      error: error?.message || 'Unknown error',
      hint: 'Make sure you have connected a Vercel Postgres database to your project in Vercel Dashboard → Storage.'
    }, { status: 500 })
  }
}

// POST /api/migrate - Force run prisma db push via SQL
export async function POST() {
  try {
    // Try to create tables using raw SQL if Prisma schema push is needed
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT,
        "email" TEXT NOT NULL UNIQUE,
        "email_verified" TIMESTAMP(3),
        "password" TEXT,
        "image" TEXT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `)

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "accounts" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "user_id" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "provider" TEXT NOT NULL,
        "provider_account_id" TEXT NOT NULL,
        "refresh_token" TEXT,
        "access_token" TEXT,
        "expires_at" INTEGER,
        "token_type" TEXT,
        "scope" TEXT,
        "id_token" TEXT,
        "session_state" TEXT,
        CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "accounts_provider_provider_account_id_key" UNIQUE ("provider","provider_account_id")
      );
    `)

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "auth_sessions" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "session_token" TEXT NOT NULL UNIQUE,
        "user_id" TEXT NOT NULL,
        "expires" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `)

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "verification_tokens" (
        "identifier" TEXT NOT NULL,
        "token" TEXT NOT NULL UNIQUE,
        "expires" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "verification_tokens_identifier_token_key" UNIQUE ("identifier","token")
      );
    `)

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "families" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "user_id" TEXT NOT NULL,
        CONSTRAINT "families_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `)

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "filling_sessions" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "family_id" TEXT NOT NULL,
        "start_time" TIMESTAMP(3) NOT NULL,
        "end_time" TIMESTAMP(3),
        "duration" INTEGER NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "filling_sessions_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `)

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "settings" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "user_id" TEXT NOT NULL,
        "free_minutes_per_week" INTEGER NOT NULL DEFAULT 12,
        "price_per_minute" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
        "auto_reset_weekly" BOOLEAN NOT NULL DEFAULT true,
        "reset_day" INTEGER NOT NULL DEFAULT 6,
        "last_auto_reset" TIMESTAMP(3),
        CONSTRAINT "settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "settings_user_id_key" UNIQUE ("user_id")
      );
    `)

    // Create indexes
    const indexes = [
      'CREATE INDEX IF NOT EXISTS "accounts_user_id_idx" ON "accounts"("user_id");',
      'CREATE INDEX IF NOT EXISTS "auth_sessions_user_id_idx" ON "auth_sessions"("user_id");',
      'CREATE INDEX IF NOT EXISTS "families_user_id_idx" ON "families"("user_id");',
      'CREATE INDEX IF NOT EXISTS "filling_sessions_family_id_idx" ON "filling_sessions"("family_id");',
    ]

    for (const sql of indexes) {
      await db.$executeRawUnsafe(sql)
    }

    return NextResponse.json({ status: 'ok', message: 'Database tables created successfully' })
  } catch (error: any) {
    console.error('Migration error:', error)
    return NextResponse.json({
      status: 'error',
      message: error?.message || 'Migration failed',
    }, { status: 500 })
  }
}
