const cron = require('node-cron');
const orderService = require('../services/order.service');

let cronTask = null;
let isRunning = false;

// Configurable interval: default every 2 minutes ('*/2 * * * *')
// Prevents high CPU/disk I/O on cPanel 1 vCPU and 15MB/s disk I/O limits
const CRON_SCHEDULE = process.env.ORDER_CRON_SCHEDULE || '*/2 * * * *';

const startOrderCron = () => {
  if (cronTask) {
    console.log('Order cron already running');
    return cronTask;
  }

  cronTask = cron.schedule(CRON_SCHEDULE, async () => {
    // Overlapping guard: if previous cycle is still active, skip tick to prevent connection pile-up
    if (isRunning) {
      console.warn('[CRON] Previous order cancellation cycle still active; skipping tick');
      return;
    }

    isRunning = true;
    try {
      const cancelled = await orderService.cancelExpiredOrders();
      if (cancelled > 0) {
        console.log(`[CRON] Cleaned up ${cancelled} expired orders at ${new Date().toISOString()}`);
      }
    } catch (error) {
      console.error('[CRON] Error cancelling expired orders:', error.message);
    } finally {
      isRunning = false;
    }
  });

  console.log(`⏰ Order cron job started with schedule: ${CRON_SCHEDULE}`);
  return cronTask;
};

const stopOrderCron = () => {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
    isRunning = false;
    console.log('Order cron stopped');
  }
};

if (require.main === module) {
  startOrderCron();
}

module.exports = {
  startOrderCron,
  stopOrderCron
};