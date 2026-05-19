import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });

/**
 * Cleanup function to close database connections.
 * Primarily used for tests to allow Jest to exit gracefully.
 */
export const cleanupDatabase = async () => {
  await prisma.$disconnect();
  await pool.end();
};
