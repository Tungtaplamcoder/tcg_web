import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  X, TicketPercent, Loader2, Check, Ban, Clock, ChevronDown, ChevronRight
} from 'lucide-react';
import api from '../services/api';
import { useLanguage } from '../i18n/LanguageContext';
import { formatVND } from '../utils/format';
import { formatVoucherValue, formatVoucherRules, timeUntilExpiry } from '../utils/voucher';

/**
 * Modal "Chọn voucher" trong Checkout.
 * - Load ví voucher của user, validate live từng voucher với giỏ hàng hiện tại.
 * - Voucher không đủ điều kiện hiển thị grayscale + lý do rõ ràng
 *   (vd: "Thêm 50.000₫ nữa để áp dụng").
 * - Chọn voucher -> gọi onChange({ code, discountAmount, voucher }).
 */
const VoucherPickerModal = ({ isOpen, onClose, cartItems, subtotal, selectedCode, onApply }) => {
  const { t } = useLanguage();
  const [wallet, setWallet] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validations, setValidations] = useState({}); // code -> validate result
  const [applyingCode, setApplyingCode] = useState(null);
  const modalRef = useRef(null);

  // Items theo format backend: [{ productId, subtotal }]
  const validationItems = useMemo(
    () => cartItems.map((item) => ({ productId: item.productId, subtotal: item.price * item.quantity })),
    [cartItems]
  );

  const fetchAndValidate = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/vouchers/wallet');
      const entries = (response.data.data || []).filter((e) => e.status === 'ACTIVE');
      setWallet(entries);

      // Validate song song tất cả voucher đang hiệu lực
      const results = await Promise.allSettled(
        entries.map((entry) =>
          api.post('/vouchers/validate', { code: entry.voucher.code, items: validationItems, subtotal })
        )
      );
      const map = {};
      entries.forEach((entry, idx) => {
        const r = results[idx];
        map[entry.voucher.code] = r.status === 'fulfilled'
          ? (r.value?.data?.data || { eligible: false, reason: t('vouchers.pickerUnavailable') })
          : { eligible: false, reason: r.reason?.response?.data?.error?.message || t('vouchers.pickerUnavailable') };
      });
      setValidations(map);
    } catch (err) {
      console.error('Failed to load voucher wallet:', err);
      setError(t('vouchers.errLoad'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validationItems, subtotal, t]);

  useEffect(() => {
    if (isOpen) fetchAndValidate();
  }, [isOpen, fetchAndValidate]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  const handleSelect = async (entry) => {
    const code = entry.voucher.code;
    const validation = validations[code];
    if (!validation?.eligible) return;
    setApplyingCode(code);
    try {
      await onApply({ code, discountAmount: validation.discountAmount, voucher: entry.voucher });
      onClose();
    } finally {
      setApplyingCode(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/50 dark:bg-black/70 backdrop-blur-sm animate-tcg-fade-in"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-3xl bg-white/95 dark:bg-[#1e1318]/95 backdrop-blur-xl border border-ink-100 dark:border-white/10 shadow-2xl animate-tcg-scale-in"
      >
        <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-primary-400/60 to-transparent" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-ink-100 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-brand-gradient-soft ring-1 ring-primary-200/60 flex items-center justify-center">
              <TicketPercent className="h-5 w-5 text-primary-700 dark:text-white" />
            </div>
            <div>
              <h3 className="font-display font-bold text-lg text-ink-900 dark:text-white">{t('vouchers.pickerTitle')}</h3>
              <p className="text-xs text-ink-400 dark:text-ink-300">{t('vouchers.pickerSubtotal', { subtotal: formatVND(subtotal) })}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-ink-400 dark:text-ink-300 hover:text-ink-700 dark:text-ink-100 hover:bg-ink-900/5 dark:hover:bg-white/10 transition-colors"
            aria-label={t('common.close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error && (
            <div className="mb-4 p-3.5 rounded-xl bg-rose-50 text-rose-600 ring-1 ring-rose-200 text-sm font-medium dark:bg-rose-400/10 dark:text-rose-300 dark:ring-rose-400/30">
              {error}
            </div>
          )}

          {loading ? (
            <div className="py-14 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600 mx-auto" />
              <p className="mt-3 text-sm text-ink-400 dark:text-ink-300">{t('vouchers.pickerChecking')}</p>
            </div>
          ) : wallet.length === 0 ? (
            <div className="py-14 text-center">
              <div className="mx-auto h-14 w-14 rounded-2xl bg-ink-50 dark:bg-white/5 ring-1 ring-ink-100 dark:ring-white/10 flex items-center justify-center">
                <TicketPercent className="h-7 w-7 text-ink-300" />
              </div>
              <p className="mt-4 text-ink-600 dark:text-ink-200 font-medium">{t('vouchers.pickerEmpty')}</p>
              <p className="mt-1 text-sm text-ink-400 dark:text-ink-300">
                {t('vouchers.pickerEmptyHint')}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {wallet.map((entry) => {
                const voucher = entry.voucher;
                const validation = validations[voucher.code];
                const eligible = validation?.eligible;
                const isSelected = selectedCode === voucher.code;
                const expiry = timeUntilExpiry(voucher.endAt, new Date(), t);
                const missingAmount = validation?.missingAmount;

                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => handleSelect(entry)}
                    disabled={!eligible || applyingCode !== null}
                    className={`w-full text-left p-4 rounded-2xl border transition-all duration-300 ${
                      isSelected
                        ? 'border-primary-400 ring-2 ring-primary-300/60 bg-primary-50/60 dark:bg-primary-400/10'
                        : eligible
                          ? 'border-ink-100 dark:border-white/10 hover:border-primary-300 hover:bg-primary-50/40 dark:hover:bg-white/5'
                          : 'border-ink-100 dark:border-white/10 opacity-55 grayscale cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`flex-shrink-0 h-12 w-12 rounded-xl flex items-center justify-center ring-1 ${
                        eligible
                          ? 'bg-brand-gradient-soft ring-primary-200/60'
                          : 'bg-ink-50 ring-ink-200 dark:bg-white/5 dark:ring-white/10'
                      }`}>
                        <TicketPercent className={`h-6 w-6 ${eligible ? 'text-primary-700 dark:text-white' : 'text-ink-300'}`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-ink-900 dark:text-white truncate">{voucher.title}</p>
                          <span className={`flex-shrink-0 font-bold text-sm ${eligible ? 'text-gradient-brand' : 'text-ink-400'}`}>
                            {formatVoucherValue(voucher)}
                          </span>
                        </div>
                        <p className="mt-0.5 font-mono text-xs tracking-widest text-ink-500 dark:text-ink-300">
                          {voucher.code}
                        </p>
                         <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                           {formatVoucherRules(voucher, t).map((rule) => (
                            <span key={rule} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-ink-50 text-ink-500 ring-1 ring-ink-200 dark:bg-white/5 dark:text-ink-300 dark:ring-white/10">
                              {rule}
                            </span>
                          ))}
                          {expiry && !expiry.expired && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/30">
                              <Clock className="h-2.5 w-2.5" />{expiry.label}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex-shrink-0 self-center">
                        {isSelected ? (
                          <span className="h-7 w-7 rounded-full bg-primary-600 flex items-center justify-center">
                            <Check className="h-4 w-4 text-white" />
                          </span>
                        ) : eligible ? (
                          applyingCode === voucher.code
                            ? <Loader2 className="h-5 w-5 animate-spin text-primary-600" />
                            : <ChevronRight className="h-5 w-5 text-ink-300" />
                        ) : (
                          <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-ink-100 dark:bg-white/10">
                            <Ban className="h-3 w-3 text-ink-500 dark:text-ink-300" />
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Lý do không dùng được / số tiền được giảm */}
                    {!eligible && validation?.reason && (
                      <p className="mt-2.5 pl-16 text-xs font-medium text-rose-500 dark:text-rose-300">
                        {missingAmount
                          ? t('vouchers.pickerReasonMore', { reason: validation.reason, amount: formatVND(missingAmount) })
                          : validation.reason}
                      </p>
                    )}
                    {eligible && validation?.discountAmount > 0 && (
                      <p className="mt-2.5 pl-16 text-xs font-semibold text-emerald-600 dark:text-emerald-300">
                        {t('vouchers.pickerDiscountFor', { amount: formatVND(validation.discountAmount) })}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-ink-100 dark:border-white/10 flex items-center justify-between">
          {selectedCode ? (
            <button
              type="button"
              onClick={() => { onApply(null); onClose(); }}
              className="text-sm font-medium text-rose-500 hover:text-rose-600 transition-colors"
            >
              {t('vouchers.pickerUnselect')}
            </button>
          ) : <span />}
          <button onClick={onClose} className="btn-secondary !px-5 !py-2.5 text-sm">
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VoucherPickerModal;
