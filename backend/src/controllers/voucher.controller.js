const voucherService = require('../services/voucher.service');

// GET /api/v1/vouchers/wallet — ví voucher của user (kèm trạng thái ACTIVE/USED/EXPIRED)
const getWallet = async (req, res, next) => {
  try {
    const data = await voucherService.listWallet(req.user.id);
    res.status(200).json({ success: true, data, message: 'Wallet retrieved' });
  } catch (error) { next(error); }
};

// POST /api/v1/vouchers/claim — nhận voucher vào ví bằng mã
const claim = async (req, res, next) => {
  try {
    const { alreadyOwned, entry, voucher } = await voucherService.claimVoucher(req.user.id, req.body.code);
    res.status(alreadyOwned ? 200 : 201).json({
      success: true,
      data: { alreadyOwned, entry, voucher },
      message: alreadyOwned ? 'Bạn đã sở hữu voucher này' : 'Đã nhận voucher vào ví'
    });
  } catch (error) { next(error); }
};

// POST /api/v1/vouchers/validate — kiểm tra voucher có áp dụng được cho giỏ hàng hiện tại
const validateVoucher = async (req, res, next) => {
  try {
    const data = await voucherService.validateForUser(req.user.id, req.body);
    res.status(200).json({ success: true, data, message: 'Voucher validated' });
  } catch (error) { next(error); }
};

module.exports = {
  getWallet,
  claim,
  validateVoucher
};
