export const ORDER_CODE_REGEX = /^TCG-\d{8}-[0-9A-F]{8}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_REGEX = /^[+\d][\d\s().-]{5,19}$/;

export const detectIdentifier = (raw) => {
  const value = (raw || '').trim();
  if (!value) return { type: 'empty', value: '' };
  if (ORDER_CODE_REGEX.test(value)) return { type: 'orderCode', value: value.toUpperCase() };
  if (EMAIL_REGEX.test(value)) return { type: 'email', value };
  if (PHONE_REGEX.test(value)) return { type: 'phone', value };
  return { type: 'unknown', value };
};

export const isValidIdentifier = (detected) =>
  detected.type === 'orderCode' || detected.type === 'email' || detected.type === 'phone';

export const IDENTIFIER_LABELS = {
  orderCode: 'Mã đơn hàng',
  email: 'Email',
  phone: 'Số điện thoại',
  unknown: 'Không hợp lệ',
  empty: ''
};
