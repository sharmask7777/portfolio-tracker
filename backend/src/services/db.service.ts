import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  // Prisma 7+ handles connection pooling and adapters differently, 
  // but for standard PG, this basic init should work if DATABASE_URL is in env.
});
