import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// In development, always create a fresh client to pick up schema changes
// The global caching only benefits production
const createPrismaClient = () => {
  return new PrismaClient({
    log: ['query'],
  })
}

export const db = process.env.NODE_ENV === 'production'
  ? (globalForPrisma.prisma ?? createPrismaClient())
  : createPrismaClient()

if (process.env.NODE_ENV === 'production') globalForPrisma.prisma = db
