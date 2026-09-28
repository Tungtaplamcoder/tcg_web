// Chia sẻ giữa Ví Voucher, Checkout modal và Admin Vouchers.
// Các chuỗi hiển thị được truyền vào qua `t` (i18n) để tuôn theo ngôn ngữ.

export const formatVoucherValue = (voucher) => {
  const value = Number(voucher.discountValue) || 0;
  return voucher.discountType === 'PERCENT'
    ? `-${value}%`
    : `-${value.toLocaleString('vi-VN')}₫`;
};

// Mô tả luật áp dụng gọn gàng cho thẻ voucher
export const formatVoucherRules = (voucher, t) => {
  const rules = [];
  const min = Number(voucher.minOrderAmount) || 0;
  if (min > 0) rules.push(t('vouchers.ruleMinOrder', { amount: min.toLocaleString('vi-VN') }));
  if (voucher.discountType === 'PERCENT' && voucher.maxDiscountAmount) {
    rules.push(t('vouchers.ruleMaxDiscount', { amount: Number(voucher.maxDiscountAmount).toLocaleString('vi-VN') }));
  }
  if (voucher.limitPerUser > 1) rules.push(t('vouchers.rulePerUser', { count: voucher.limitPerUser }));
  if (voucher.totalQuantity != null) {
    rules.push(t('vouchers.ruleRemaining', {
      remaining: Math.max(0, voucher.totalQuantity - voucher.usedQuantity),
      total: voucher.totalQuantity
    }));
  }
  return rules;
};

export const formatDateTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// Đếm ngược "còn X ngày Y giờ" tới hạn dùng
export const timeUntilExpiry = (endAt, now = new Date(), t) => {
  if (!endAt) return null;
  const end = new Date(endAt);
  if (Number.isNaN(end.getTime())) return null;
  const diff = end.getTime() - now.getTime();
  if (diff <= 0) return { expired: true, label: t ? t('vouchers.expiredLabel') : 'Đã hết hạn' };
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  let label;
  if (days > 0) {
    label = t ? t('vouchers.countdownDays', { days, hours }) : `${days} ngày ${hours} giờ`;
  } else if (hours > 0) {
    label = t ? t('vouchers.countdownHours', { hours, minutes }) : `${hours} giờ ${minutes} phút`;
  } else {
    label = t ? t('vouchers.countdownMinutes', { minutes }) : `${minutes} phút`;
  }
  return { expired: false, label: t ? t('vouchers.countdownRemaining', { label }) : `Còn ${label}` };
};
