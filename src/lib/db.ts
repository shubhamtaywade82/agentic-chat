import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Fallback to a local sqlite file when DATABASE_URL is not configured. This
// keeps `npm run dev` runnable on a fresh clone without env setup, while
// honoring DATABASE_URL when explicitly set (e.g. in production).
const databaseUrl = process.env.DATABASE_URL || 'file:./db/custom.db'

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['query', 'error', 'warn'],
    datasources: { db: { url: databaseUrl } },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
