module.exports = {
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Explicitly fallback to an empty string if undefined to see if it changes the error message,
    // though Prisma requires a non-empty string for migrations.
    url: process.env.DATABASE_URL,
  },
};
