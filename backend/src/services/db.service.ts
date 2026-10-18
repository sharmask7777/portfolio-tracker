import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import dns from 'dns';

// Ensure Node resolves localhost to IPv4 (127.0.0.1) before IPv6 (::1)
// to prevent ECONNREFUSED when Docker binds to 0.0.0.0 on Linux/CI
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL environment variable is missing!');
}

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
