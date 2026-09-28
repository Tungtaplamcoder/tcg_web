const { z } = require('zod');

// Item tối giản phục vụ validate voucher: chỉ cần biết sản phẩm + giá trị dòng
const voucherItemSchema = z.object({
  productId: z.string().uuid(),
  // Tổng giá trị dòng (unitPrice * quantity) — thiếu thì default 0
  subtotal: z.coerce.number().min(0).default(0)
});

const claimVoucherSchema = z.object({
  code: z.string().trim().min(1, 'Mã voucher là bắt buộc').max(100)
});

const validateVoucherSchema = z.object({
  code: z.string().trim().min(1, 'Mã voucher là bắt buộc').max(100),
  items: z.array(voucherItemSchema).max(50).default([]),
  subtotal: z.coerce.number().min(0).default(0)
});

module.exports = {
  claimVoucherSchema,
  validateVoucherSchema
};
