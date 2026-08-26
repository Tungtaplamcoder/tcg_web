const app = require('./app');
const env = require('./config/env');
const prisma = require('./config/prisma');
const setupSocket = require('./socket');
const { startOrderCron } = require('./cron/orderCron');

const startServer = async () => {
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully');

    const server = app.listen(env.port, () => {
      console.log(`🚀 Server running on port ${env.port} in ${env.nodeEnv} mode`);
    });

    // Initialize Socket.io & Gán vào global để các Service (như SePay Webhook) có thể emit sự kiện
    const io = setupSocket(server);
    global.io = io; 
    console.log('🔌 Socket.io initialized & assigned to global.io');

    // Start order expiry cron
    startOrderCron(io);
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
        // Đóng Socket.io connections
        if (global.io) {
          global.io.close();
          console.log('🔌 Socket.io server closed');
        }

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