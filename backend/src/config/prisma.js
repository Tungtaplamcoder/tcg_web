const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

// Connection pool optimization for production
// Prisma handles connection pooling internally via the query engine
// For serverless/edge environments, consider using Prisma Data Proxy or pgbouncer

module.exports = prisma;