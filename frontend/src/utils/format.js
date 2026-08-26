// Tối ưu bộ nhớ: Tạo instance format 1 lần duy nhất
const vndFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
});

export const formatVND = (amount) => vndFormatter.format(Number(amount) || 0);

// Lấy tỷ giá từ localStorage hoặc dùng mặc định 25,400
const savedRate = localStorage.getItem('USD_TO_VND_RATE');
export let USD_TO_VND_RATE = savedRate ? Number(savedRate) : 25400;

// Tiến trình chạy ngầm (Background Task) kiểm tra & cập nhật tỷ giá tự động 1 tháng/lần
(async () => {
  const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
  const lastFetch = localStorage.getItem('USD_TO_VND_LAST_FETCH');
  const now = Date.now();

  // Nếu chưa đủ 30 ngày thì thoát ngay, 0 overhead, không tốn request API
  if (lastFetch && now - Number(lastFetch) < ONE_MONTH_MS) return;

  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    const data = await res.json();

    if (data?.rates?.VND) {
      // Làm tròn đến 1 chữ số ở hàng thập phân
      const rawRate = data.rates.VND;
      const roundedRate = Math.round(rawRate * 10) / 10;

      // Cập nhật biến export và lưu cache cho lần truy cập sau
      USD_TO_VND_RATE = roundedRate;
      localStorage.setItem('USD_TO_VND_RATE', roundedRate);
      localStorage.setItem('USD_TO_VND_LAST_FETCH', now);
    }
  } catch (err) {
    // Nếu lỗi mạng thì giữ nguyên giá trị fallback cũ, không làm gián đoạn app
  }
})();