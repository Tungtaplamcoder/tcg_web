const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  },
  // Connection pool settings optimized for low-resource VPS (2GB RAM)
  // Limit max connections to 10 to prevent memory spikes
  // Note: Prisma uses its own connection pool via the query engine
  // These settings work with the DATABASE_URL connection string
});

module.exports = prisma;