import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const createPrismaClient = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })
}

// Reuse Prisma client in development to avoid connection pool exhaustion
// In production (Vercel serverless), create new client per cold start
export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

// Auto-migrate: ensure tables exist on first request
let migrationPromise: Promise<void> | null = null

export async function ensureDatabase() {
  if (!migrationPromise) {
    migrationPromise = migrateIfNeeded()
  }
  await migrationPromise
}

async function migrateIfNeeded() {
  try {
    // Test if tables exist by querying users
    await db.user.findFirst()
  } catch (error: any) {
    if (error?.message?.includes('does not exist') || error?.code === '42P01') {
      console.log('Tables not found, running auto-migration...')
      try {
        // Call the migration endpoint internally
        const baseUrl = process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : process.env.NEXTAUTH_URL || 'http://localhost:3000'

        const response = await fetch(`${baseUrl}/api/migrate`, { method: 'POST' })
        if (!response.ok) {
          console.error('Auto-migration failed:', await response.text())
        } else {
          console.log('Auto-migration completed successfully')
        }
      } catch (e) {
        console.error('Auto-migration error:', e)
      }
    }
  }
}
