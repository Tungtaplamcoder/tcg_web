import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Truck, Loader2, AlertCircle, Save, Check, Coins
} from 'lucide-react';
import api from '../../services/api';
import { useLanguage } from '../../i18n/LanguageContext';

// Chuyển số nguyên VND -> chuỗi có dấu phẩy ngăn cách hàng nghìn: 25000 -> "25,000"
// (Input hiển thị suffix "đ" riêng ở phần beside-label, không nằm trong value —
// value thuần số giúp fill() của Playwright và paste hoạt động tự nhiên.)
const formatFeeInput = (raw) => {
  const digits = String(raw).replace(/[^\d]/g, '');
  if (!digits) return '';
  return Number(digits).toLocaleString('en-US');
};

// "35,000" / "35000" / "35.000đ" -> 35000
const parseFeeInput = (raw) => {
  const digits = String(raw).replace(/[^\d]/g, '');
  if (!digits) return NaN;
  return Number(digits);
};

const PRESET_FEES = [0, 20000, 30000, 50000];
const PRESET_LABELS = (t) => [
  t('admin.shippingSettings.presetFree'),
  '20k', '30k', '50k'
];

const ShippingSettings = () => {
  const { t } = useLanguage();
  const [feeInput, setFeeInput] = useState('');
  const [savedFee, setSavedFee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  const parsedFee = useMemo(() => parseFeeInput(feeInput), [feeInput]);
  const isValid = Number.isInteger(parsedFee) && parsedFee >= 0;
  const isDirty = isValid && savedFee !== null && parsedFee !== savedFee;

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    const fetchConfig = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.get('/admin/settings/shipping');
        const fee = response.data.data?.defaultShippingFee ?? 20000;
        setSavedFee(fee);
        setFeeInput(formatFeeInput(fee));
      } catch (err) {
        console.error('Failed to fetch shipping settings:', err);
        setError(err.response?.data?.error?.message || t('admin.shippingSettings.loadFailed'));
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
    return () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveFee = useCallback(async () => {
    if (saving) return;
    if (!Number.isInteger(parsedFee) || parsedFee < 0) {
      setError(t('admin.shippingSettings.invalid'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      const response = await api.put('/admin/settings/shipping', { defaultShippingFee: parsedFee });
      const fee = response.data.data?.defaultShippingFee ?? parsedFee;
      setSavedFee(fee);
      setFeeInput(formatFeeInput(fee));
      showToast(response.data.message || t('admin.shippingSettings.saved'));
    } catch (err) {
      console.error('Failed to save shipping settings:', err);
      const detail = err.response?.data?.error?.details?.map((d) => `${d.field}: ${d.message}`).join('. ');
      setError(detail || err.response?.data?.error?.message || t('admin.shippingSettings.saveFailed'));
    } finally {
      setSaving(false);
    }
  }, [parsedFee, saving, t]);

  // Cmd/Ctrl+S saves from anywhere on the page
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveFee();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveFee]);

  const handleInputChange = (e) => {
    setError('');
    setFeeInput(formatFeeInput(e.target.value));
  };

  const applyPreset = (fee) => {
    setError('');
    setFeeInput(formatFeeInput(fee));
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-12 w-12 animate-spin text-primary-600" />
      </div>
    );
  }

  const inputClass = 'w-full pl-10 pr-12 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 flex items-center">
          <Truck className="h-6 w-6 mr-2 text-primary-600" />
          {t('admin.shippingSettings.title')}
        </h2>
        <p className="text-gray-500">{t('admin.shippingSettings.subtitle')}</p>
      </div>

      {toast && (
        <div
          data-testid="shipping-fee-toast"
          role="status"
          className={`p-3 rounded-lg flex items-center animate-fade-in ${
            toast.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
          }`}
        >
          {toast.type === 'success' ? <Check className="h-5 w-5 mr-2" /> : <AlertCircle className="h-5 w-5 mr-2" />}
          {toast.message}
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 text-red-600 rounded-lg flex items-center animate-fade-in">
          <AlertCircle className="h-5 w-5 mr-2" />
          {error}
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); saveFee(); }} className="bg-white rounded-lg shadow-card p-6 space-y-5">
        <div>
          <label htmlFor="shipping-fee-input" className="block text-sm font-medium text-gray-700 mb-1">
            {t('admin.shippingSettings.feeLabel')}
          </label>
          <div className="relative">
            <Coins className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              id="shipping-fee-input"
              name="defaultShippingFee"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              data-testid="shipping-fee-input"
              value={feeInput}
              onChange={handleInputChange}
              placeholder="20,000"
              aria-invalid={!isValid}
              className={`${inputClass} ${
                !isValid
                  ? 'border-red-400 focus:ring-red-300 animate-shake'
                  : 'border-gray-300 focus:ring-primary-500'
              }`}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-400 select-none pointer-events-none">đ</span>
          </div>
          <p className="mt-1.5 text-xs text-gray-500">{t('admin.shippingSettings.feeHint')}</p>
        </div>

        <div>
          <span className="block text-sm font-medium text-gray-700 mb-2">{t('admin.shippingSettings.presets')}</span>
          <div className="flex flex-wrap gap-2" data-testid="shipping-fee-presets">
            {PRESET_FEES.map((fee, idx) => (
              <button
                key={fee}
                type="button"
                data-testid={`shipping-fee-preset-${fee}`}
                onClick={() => applyPreset(fee)}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-medium border transition-all duration-200 hover:-translate-y-0.5 ${
                  parsedFee === fee
                    ? 'border-primary-500 bg-primary-50 text-primary-700 shadow-glow'
                    : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700'
                }`}
              >
                {PRESET_LABELS(t)[idx]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-100">
          <span className="text-xs text-gray-400">{t('admin.shippingSettings.saveHint')}</span>
          <button
            type="submit"
            data-testid="shipping-fee-save-btn"
            disabled={saving || !isValid}
            title={t('admin.shippingSettings.save')}
            className={`inline-flex items-center px-6 py-2 text-white font-medium rounded-lg transition-all duration-200 ${
              isDirty
                ? 'bg-primary-600 shadow-glow hover:bg-primary-700 hover:-translate-y-0.5 hover:shadow-glow-lg'
                : 'bg-primary-600 hover:bg-primary-700'
            } disabled:opacity-50 disabled:hover:translate-y-0`}
          >
            {saving ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                {t('admin.shippingSettings.saving')}
              </>
            ) : (
              <>
                <Save className="h-5 w-5 mr-2" />
                {t('admin.shippingSettings.save')}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ShippingSettings;
