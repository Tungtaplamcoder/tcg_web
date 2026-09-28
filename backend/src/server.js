const app = require('./app');
const env = require('./config/env');
const prisma = require('./config/prisma');
const { startOrderCron } = require('./cron/orderCron');

/* ── Database connect with retry ─────────────────────────────
   depends_on: service_healthy guarantees MariaDB accepts TCP
   connections before the backend starts, but brief network flaps
   (first-connection contention, DNS warm-up on tcg-network, a
   mariadb restart under `unless-stopped`) can still make the first
   $connect() fail with P1001/ECONNREFUSED. Retry with exponential
   backoff instead of crashing into the container restart loop. */
const connectWithRetry = async (retriesLeft = env.dbConnectRetries, attempt = 1) => {
  try {
    await prisma.$connect();
  } catch (error) {
    const retryable = ['P1001', 'P1002', 'P1003', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND'].some(
      (code) =>
        error.code === code ||
        error.message?.includes(code) ||
        error.message?.includes('Can\'t reach database server')
    );
    if (!retryable || retriesLeft <= 0) throw error;

    const delay = Math.min(env.dbConnectRetryDelayMs * attempt, 15000);
    console.warn(
      `⚠️ DB connect failed (${error.code || 'unknown'}: ${error.message?.split('\n')[0]}) — ` +
        `retry ${attempt}/${env.dbConnectRetries} in ${delay}ms`
    );
    await new Promise((resolve) => setTimeout(resolve, delay));
    return connectWithRetry(retriesLeft - 1, attempt + 1);
  }
};

const startServer = async () => {
  try {
    await connectWithRetry();
    console.log('✅ Database connected successfully');

    const server = app.listen(env.port, () => {
      console.log(`🚀 Server running on port ${env.port} in ${env.nodeEnv} mode`);
    });

    // Start order expiry cron
    startOrderCron();
    console.log('⏰ Order cron job started');

    // Graceful Shutdown Handler
    const shutdown = async (signal) => {
      console.log(`\n${signal} received. Shutting down gracefully...`);

      // Đặt timeout cưỡng chế dừng sau 10s nếu server bị kẹt request
      const forceExitTimeout = setTimeout(() => {
        console.error('⚠️ Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);

      try {
        // Đóng HTTP Server
        server.close(async () => {
          console.log('🌐 HTTP Server closed');
          
          // Ngắt kết nối Prisma Database
          await prisma.$disconnect();
          console.log('🗄️ Database disconnected');
          
          clearTimeout(forceExitTimeout);
          process.exit(0);
        });
      } catch (err) {
        console.error('Error during graceful shutdown:', err);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
};

startServer();