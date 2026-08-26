// frontend/src/utils/chart.js

/**
 * Parse một chuỗi ngày có thể thiếu timezone về Date đúng với múi giờ địa phương.
 * Nếu chuỗi chỉ có dạng "YYYY-MM-DD", chúng ta append "T00:00:00" để tránh bị parse thành UTC.
 */
const parseLocalDate = (dateStr) => {
  if (!dateStr) return null;
  // Nếu dateStr không chứa 'T' và không có timezone offset, coi là local midnight
  if (typeof dateStr === 'string' && !dateStr.includes('T')) {
    return new Date(`${dateStr}T00:00:00`);
  }
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
};

/**
 * Lọc mảng dữ liệu chart theo khoảng thời gian.
 * @param {Array} data - Mảng dữ liệu gốc (1Y)
 * @param {string} range - 'month', 'quarter', 'semi-annual', 'annual'
 * @param {Date} now - Mốc thời gian hiện tại (mặc định Date.now())
 * @returns {Array} Mảng đã lọc, giữ nguyên thứ tự tăng dần theo ngày.
 */
export const filterChartDataByRange = (data, range, now = new Date()) => {
  if (!Array.isArray(data) || data.length === 0) return [];

  const nowMs = now.getTime();
  let startMs = null;

  switch (range) {
    case 'month':
      startMs = nowMs - 30 * 24 * 60 * 60 * 1000; // 30 ngày
      break;
    case 'quarter':
      startMs = nowMs - 90 * 24 * 60 * 60 * 1000; // 90 ngày
      break;
    case 'semi-annual':
      startMs = nowMs - 180 * 24 * 60 * 60 * 1000; // 180 ngày
      break;
    case 'annual':
    default:
      return data; // 1Y trả về toàn bộ
  }

  return data.filter(item => {
    const dateStr = item.date || item.bucketStartDate || '';
    const itemDate = parseLocalDate(dateStr);
    return itemDate !== null && itemDate.getTime() >= startMs;
  });
};