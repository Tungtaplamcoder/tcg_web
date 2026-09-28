const cron = require('node-cron');

let cronTask = null;

const startOrderCron = () => {
  if (cronTask) {
    console.log('Order cron already running');
    return cronTask;
  }

  // HIỆN TẠI: không tự động hủy đơn PENDING nữa.
  // Nhân viên sẽ xử lý thủ công qua trang quản lý đơn hàng.
  // Nếu cần chức năng tự động, có thể bật lại bằng cách uncomment logic cũ.

  /*
  cronTask = cron.schedule('*!/5 * * * *', async () => {
    console.log(`[CRON] Running expired order cancellation at ${new Date().toISOString()}`);
    try {
      const cancelled = await orderService.cancelExpiredOrders();
      if (cancelled > 0) {
        console.log(`[CRON] Cancelled ${cancelled} expired orders`);
      }
    } catch (error) {
      console.error('[CRON] Error cancelling expired orders:', error.message);
    }
  });
  */

  console.log('Order cron started (auto-cancel disabled). Waiting for manual processing.');
  return cronTask;
};

const stopOrderCron = () => {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
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