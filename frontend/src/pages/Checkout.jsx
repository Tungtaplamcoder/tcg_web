import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2, ExternalLink, MapPin, ChevronDown, ShieldCheck, Lock, TicketPercent, X } from 'lucide-react';
import api from '../services/api';
import { useCartStore } from '../store/useCartStore';
import { useAuthStore } from '../store/useAuthStore';
import { useAddressStore } from '../store/useAddressStore';
import { useLanguage } from '../i18n/LanguageContext';
import { formatVND } from '../utils/format';
import VoucherPickerModal from '../components/VoucherPickerModal';
import AddressManager from '../components/AddressManager';
import provincesData from '../province.json';
import wardsData from '../ward.json';

const provinces = Object.values(provincesData).sort((a, b) => a.name.localeCompare(b.name));
const allWards = Object.values(wardsData);

const Checkout = () => {
  const { items, totalItems, clearCart } = useCartStore();
  const { user } = useAuthStore();
  const { addresses, setUser: setAddressUser } = useAddressStore();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [shippingAddress, setShippingAddress] = useState({
    fullName: user?.fullName || '',
    phone: user?.phone || '',
    addressLine1: user?.address || '',
    addressLine2: '',
    city: '',
    state: '',
    country: 'Vietnam',
    zipCode: ''
  });
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedWard, setSelectedWard] = useState('');
  const [filteredWards, setFilteredWards] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [orderData, setOrderData] = useState(null);
  const [polling, setPolling] = useState(false);
  const pollingIntervalRef = useRef(null);
  // Phí ship động từ cấu hình admin — backend chốt lại giá trị này khi tạo đơn
  const [shippingFee, setShippingFee] = useState(0);
  useEffect(() => {
    api.get('/shipping-fee')
      .then((res) => setShippingFee(Number(res.data.data?.defaultShippingFee) || 0))
      .catch(() => setShippingFee(0));
  }, []);

  // Voucher đã chọn: { code, discountAmount, voucher } | null
  const [appliedVoucher, setAppliedVoucher] = useState(null);
  const [voucherModalOpen, setVoucherModalOpen] = useState(false);

  // Saved-address picker (Shopee-style 1-click fill).
  const [addressPickerOpen, setAddressPickerOpen] = useState(false);
  const pendingWardRef = useRef(null);
  const prefillDoneRef = useRef(false);

  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, []);

  const totalPrice = items.reduce((sum, item) => sum + Number(item.price || 0) * item.quantity, 0);
  const effectiveShippingFee = items.length > 0 ? shippingFee : 0;
  const discountAmount = appliedVoucher ? Math.min(appliedVoucher.discountAmount || 0, totalPrice) : 0;
  const grandTotal = Math.max(0, totalPrice - discountAmount + effectiveShippingFee);

  // Giỏ hàng thay đổi có thể làm voucher hết điều kiện — bỏ chọn để user xác nhận lại
  const cartSignature = items.map((i) => `${i.productId}:${i.variantId || ''}:${i.quantity}`).sort().join('|');
  const lastCartSignatureRef = useRef(null);
  useEffect(() => {
    if (lastCartSignatureRef.current !== null && lastCartSignatureRef.current !== cartSignature) {
      setAppliedVoucher(null);
    }
    lastCartSignatureRef.current = cartSignature;
  }, [cartSignature]);

  useEffect(() => {
    if (selectedProvince) {
      const wards = allWards
        .filter(w => String(w.parent_code) === String(selectedProvince))
        .sort((a, b) => a.name.localeCompare(b.name));
      setFilteredWards(wards);
      // A saved address may set province + ward in one action. When the ward
      // list becomes available, honour the pending ward instead of clearing.
      if (pendingWardRef.current) {
        const wanted = pendingWardRef.current;
        pendingWardRef.current = null;
        setSelectedWard(wards.some(w => w.code === wanted) ? wanted : '');
      } else {
        setSelectedWard('');
      }
    } else {
      setFilteredWards([]);
      setSelectedWard('');
    }
  }, [selectedProvince]);

  // Bind the saved-address book to the signed-in account.
  useEffect(() => {
    if (user?.id) setAddressUser(user.id);
  }, [user?.id, setAddressUser]);

  // One-click fill: drop a saved address straight into the checkout fields.
  const applyAddress = (addr) => {
    if (!addr) return;
    const nextProvince = addr.provinceCode || '';
    if (nextProvince === selectedProvince) {
      // Province unchanged → the sync effect won't fire; set ward directly.
      const wards = nextProvince
        ? allWards.filter(w => String(w.parent_code) === String(nextProvince)).sort((a, b) => a.name.localeCompare(b.name))
        : [];
      setFilteredWards(wards);
      setSelectedWard(addr.wardCode || '');
    } else {
      pendingWardRef.current = addr.wardCode || null;
      setSelectedProvince(nextProvince);
    }
    setShippingAddress((prev) => ({
      ...prev,
      fullName: addr.fullName || '',
      phone: addr.phone || '',
      addressLine1: addr.addressLine1 || '',
      addressLine2: '',
      city: addr.provinceName || '',
      state: addr.wardName || '',
      country: 'Vietnam'
    }));
  };

  // Pre-fill from the default saved address once per checkout session.
  useEffect(() => {
    if (prefillDoneRef.current || addresses.length === 0) return;
    const def = addresses.find(a => a.isDefault) || addresses[0];
    if (!def) return;
    applyAddress(def);
    prefillDoneRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addresses]);

  const handleInputChange = (e) => {
    setShippingAddress({ ...shippingAddress, [e.target.name]: e.target.value });
  };

  const handleProvinceChange = (e) => {
    const code = e.target.value;
    setSelectedProvince(code);
    const province = provinces.find(p => p.code === code);
    if (province) {
      setShippingAddress(prev => ({ ...prev, city: province.name_with_type || province.name }));
    }
  };

  const handleWardChange = (e) => {
    const code = e.target.value;
    setSelectedWard(code);
    const ward = filteredWards.find(w => w.code === code);
    if (ward) {
      setShippingAddress(prev => ({ ...prev, state: ward.name_with_type || ward.name }));
    }
  };

  const validate = () => {
    if (!selectedProvince) { setError(t('checkout.errProvince')); return false; }
    if (!selectedWard) { setError(t('checkout.errWard')); return false; }
    if (!shippingAddress.fullName.trim()) { setError(t('checkout.errName')); return false; }
    if (!shippingAddress.phone.trim()) { setError(t('checkout.errPhone')); return false; }
    if (!shippingAddress.addressLine1.trim()) { setError(t('checkout.errAddress')); return false; }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (items.length === 0) { setError(t('checkout.errEmptyCart')); return; }
    setError('');
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const checkoutItems = items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId || undefined,
        cardId: item.cardId || undefined,
        quantity: item.quantity
      }));

      const province = provinces.find(p => p.code === selectedProvince);
      const ward = filteredWards.find(w => w.code === selectedWard);

      const addressPayload = {
        fullName: shippingAddress.fullName.trim(),
        phone: shippingAddress.phone.trim(),
        addressLine1: shippingAddress.addressLine1.trim(),
        addressLine2: shippingAddress.addressLine2.trim(),
        country: 'Vietnam',
        zipCode: '',
        provinceCode: selectedProvince,
        wardCode: selectedWard,
        provinceName: province?.name_with_type || province?.name,
        wardName: ward?.name_with_type || ward?.name,
        city: province?.name_with_type || province?.name || '',
        state: ward?.name_with_type || ward?.name || ''
      };

      const response = await api.post('/orders/checkout', {
        items: checkoutItems,
        shippingAddress: addressPayload,
        paymentMethod: 'SEPAY',
        voucherCode: appliedVoucher?.code || undefined
      });

      const data = response.data.data;
      setOrderData(data);

      // Xóa giỏ hàng ngay sau khi tạo đơn thành công
      clearCart();

      startPolling(data.order.id);
    } catch (err) {
      console.error('Checkout error:', err.response?.status, err.response?.data?.error?.message || err.message);
      const apiMessage = err.response?.data?.error?.message;
      const detail = err.response?.data?.error?.details?.map((d) => d.message).join('; ');
      setError(
        apiMessage
          ? (detail ? `${apiMessage} (${detail})` : apiMessage)
          : t('checkout.errCreateOrder')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const startPolling = (orderId) => {
    setPolling(true);
    let attempts = 0;
    const MAX_ATTEMPTS = 60;
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    const interval = setInterval(async () => {
      attempts += 1;
      try {
        const response = await api.get(`/orders/${orderId}/payment-status`);
        const status = response.data.data.status;
        if (status === 'PACKAGING') {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
          setPolling(false);
          navigate(`/payment/success?orderId=${orderId}`);
        } else if (status === 'CANCELLED') {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
          setPolling(false);
          setError(t('checkout.errCancelled'));
          navigate('/payment/cancel');
        } else if (attempts >= MAX_ATTEMPTS) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
          setPolling(false);
        }
      } catch (err) {
        console.error('Polling error:', err.response?.status || err.message);
      }
    }, 5000);
    pollingIntervalRef.current = interval;
  };

  // Đơn đã tạo thành công — hiển thị bước thanh toán SePay.
  // Nếu backend/SePay không sinh được checkoutUrl thì fallback sang màn hình
  // chuyển khoản thủ công (QR/mã đơn) thay vì crash.
  if (orderData) {
    const { checkoutUrl, formFields, amount, transferContent } = orderData.payment || {};

    return (
      <div className="relative overflow-hidden max-w-2xl mx-auto px-4 py-12 animate-tcg-reveal">
        <div className="pointer-events-none absolute -top-24 left-1/4 h-64 w-64 rounded-full bg-primary-400/15 blur-[100px] animate-tcg-float" />
        <div className="pointer-events-none absolute -bottom-24 right-1/4 h-64 w-64 rounded-full bg-fuchsia-400/15 blur-[100px] animate-tcg-float-slow" />

        <div className="relative rounded-3xl bg-white/85 dark:bg-[#1c1216]/85 backdrop-blur-xl border border-ink-100 dark:border-white/10 shadow-card p-6 sm:p-9">
          <div className="text-center">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-primary-50 to-fuchsia-100 ring-1 ring-primary-200/60 flex items-center justify-center animate-tcg-glow-pulse">
              <Lock className="h-7 w-7 text-primary-700" />
            </div>
            <h2 className="heading-display text-2xl mt-4">{t('checkout.redirectTitle')}</h2>
            <p className="mt-2 text-ink-500 dark:text-ink-300">{t('checkout.redirectBody')}</p>
          </div>

          <div className="mt-7 rounded-2xl bg-ink-50/80 ring-1 ring-ink-100 dark:ring-white/10 p-5 space-y-3.5 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-ink-500 dark:text-ink-300">{t('checkout.orderCode')}</span>
              <span className="font-mono font-semibold text-ink-900 dark:text-white">{orderData.order.orderCode}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-ink-500 dark:text-ink-300">{t('checkout.amountVnd')}</span>
              <span className="font-display font-bold text-xl text-gradient-brand">
                {formatVND(amount ?? orderData.order.grandTotal)}
              </span>
            </div>
            {transferContent && (
              <div className="flex justify-between items-center gap-4">
                <span className="text-ink-500 dark:text-ink-300 shrink-0">{t('checkout.transferContent')}</span>
                <span className="font-mono font-semibold text-ink-900 dark:text-white break-all text-right">{transferContent}</span>
              </div>
            )}
          </div>

          <div className="mt-7 flex flex-col items-center gap-3">
            {polling && (
              <div className="inline-flex items-center gap-2 text-sm font-medium text-ink-500 dark:text-ink-300 rounded-full bg-primary-50 ring-1 ring-primary-200/70 px-4 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary-600" />
                {t('checkout.waitingPayment')}
              </div>
            )}

            {checkoutUrl && formFields ? (
              <>
                <form id="sepay-checkout-form" action={checkoutUrl} method="POST" className="hidden">
                  {Object.entries(formFields).map(([key, value]) => (
                    <input key={key} type="hidden" name={key} value={value} />
                  ))}
                </form>

                <button
                  onClick={() => document.getElementById('sepay-checkout-form').submit()}
                  className="btn-primary w-full sm:w-auto"
                >
                  <ExternalLink className="h-5 w-5" />
                  {t('checkout.payNow')}
                </button>
              </>
            ) : (
              <div className="w-full rounded-2xl bg-amber-50 dark:bg-amber-500/10 ring-1 ring-amber-200 dark:ring-amber-500/30 p-4 text-sm text-amber-700 dark:text-amber-300">
                {t('checkout.noSePaySession', { code: orderData.order.orderCode })}
              </div>
            )}

            <p className="flex items-center gap-1.5 text-xs text-ink-400 dark:text-ink-300 mt-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              {t('checkout.encrypted')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8 animate-tcg-reveal">
      <div className="mb-7">
        <p className="section-eyebrow">{t('checkout.secureEyebrow')}</p>
        <h1 className="heading-display text-3xl mt-1">{t('checkout.title')}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Shipping Form */}
        <div className="lg:col-span-2 rounded-3xl bg-white/85 dark:bg-[#1c1216]/85 backdrop-blur-xl border border-ink-100 dark:border-white/10 shadow-card p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="heading-display text-lg flex items-center gap-2.5">
              <MapPin className="h-5 w-5 text-primary-600" />
              {t('checkout.shippingAddress')}
            </h2>
            {user && (
              <button
                type="button"
                onClick={() => setAddressPickerOpen(true)}
                data-testid="checkout-saved-address-btn"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-semibold text-pink-700 dark:text-pink-300 bg-pink-100 dark:bg-pink-950/60 hover:bg-pink-200/70 dark:hover:bg-pink-950 transition-colors"
              >
                <MapPin className="h-4 w-4" />
                {t('checkout.chooseSaved')}
              </button>
            )}
          </div>
          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="label-premium">{t('checkout.fullName')} *</label>
                <input
                  type="text"
                  name="fullName"
                  value={shippingAddress.fullName}
                  onChange={handleInputChange}
                  required
                  placeholder={t('checkout.namePlaceholder')}
                  className="input-premium"
                />
              </div>
              <div>
                <label className="label-premium">{t('checkout.phone')} *</label>
                <input
                  type="text"
                  name="phone"
                  value={shippingAddress.phone}
                  onChange={handleInputChange}
                  required
                  placeholder={t('checkout.phonePlaceholder')}
                  className="input-premium"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="label-premium">{t('checkout.province')} *</label>
                <div className="relative">
                  <select
                    value={selectedProvince}
                    onChange={handleProvinceChange}
                    required
                    data-testid="checkout-province"
                    className="input-premium appearance-none pr-10 cursor-pointer"
                  >
                    <option value="">{t('checkout.selectProvince')}</option>
                    {provinces.map((prov) => (
                      <option key={prov.code} value={prov.code}>
                        {prov.name_with_type}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400 dark:text-ink-300 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="label-premium">{t('checkout.ward')} *</label>
                <div className="relative">
                  <select
                    value={selectedWard}
                    onChange={handleWardChange}
                    required
                    disabled={!selectedProvince}
                    data-testid="checkout-ward"
                    className="input-premium appearance-none pr-10 cursor-pointer"
                  >
                    <option value="">{selectedProvince ? t('checkout.selectWard') : t('checkout.selectProvinceFirst')}</option>
                    {filteredWards.map((ward) => (
                      <option key={ward.code} value={ward.code}>
                        {ward.name_with_type}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400 dark:text-ink-300 pointer-events-none" />
                </div>
              </div>
            </div>

            <div>
              <label className="label-premium">{t('checkout.addressLine1')} *</label>
              <input
                type="text"
                name="addressLine1"
                value={shippingAddress.addressLine1}
                onChange={handleInputChange}
                required
                placeholder={t('checkout.addressLine1Placeholder')}
                className="input-premium"
              />
            </div>
            <div>
              <label className="label-premium">{t('checkout.addressLine2')}</label>
              <input
                type="text"
                name="addressLine2"
                value={shippingAddress.addressLine2}
                onChange={handleInputChange}
                placeholder={t('checkout.addressLine2Placeholder')}
                className="input-premium"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2.5 p-4 rounded-xl bg-rose-50 text-rose-600 ring-1 ring-rose-200 text-sm font-medium animate-tcg-scale-in">
                <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || items.length === 0}
              className="btn-primary w-full"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {t('checkout.processing')}
                </>
              ) : (
                <>
                  <Lock className="h-5 w-5" />
                  {t('checkout.submit')}
                </>
              )}
            </button>
          </form>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 rounded-3xl bg-white/85 dark:bg-[#1c1216]/85 backdrop-blur-xl border border-ink-100 dark:border-white/10 shadow-card p-6 sm:p-7">
            <h2 className="heading-display text-lg">{t('checkout.orderSummary')}</h2>

            {/* Voucher selector */}
            <button
              type="button"
              onClick={() => setVoucherModalOpen(true)}
              className={`mt-4 w-full flex items-center gap-3 p-3.5 rounded-2xl border transition-all duration-300 text-left ${
                appliedVoucher
                  ? 'border-primary-300 bg-primary-50/60 dark:bg-primary-400/10'
                  : 'border-dashed border-ink-200 dark:border-white/15 hover:border-primary-400 hover:bg-primary-50/40 dark:hover:bg-white/5'
              }`}
            >
              <div className={`h-9 w-9 rounded-xl flex items-center justify-center ring-1 flex-shrink-0 ${
                appliedVoucher
                  ? 'bg-brand-gradient-soft ring-primary-200/60'
                  : 'bg-ink-50 ring-ink-200 dark:bg-white/5 dark:ring-white/10'
              }`}>
                <TicketPercent className={`h-5 w-5 ${appliedVoucher ? 'text-primary-700 dark:text-white' : 'text-ink-400'}`} />
              </div>
              <div className="flex-1 min-w-0">
                {appliedVoucher ? (
                  <>
                    <p className="text-sm font-semibold text-ink-900 dark:text-white truncate">
                      {appliedVoucher.voucher?.title || appliedVoucher.code}
                    </p>
                    <p className="font-mono text-[11px] tracking-widest text-primary-700 dark:text-primary-300">
                      {appliedVoucher.code}
                    </p>
                  </>
                ) : (
                  <p className="text-sm font-semibold text-ink-600 dark:text-ink-200">
                    {t('checkout.chooseVoucher')}
                  </p>
                )}
              </div>
              {appliedVoucher ? (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); setAppliedVoucher(null); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); setAppliedVoucher(null); } }}
                  className="p-1 rounded-lg text-ink-400 hover:text-rose-500 hover:bg-rose-50 transition-colors flex-shrink-0"
                  aria-label={t('checkout.unselectVoucher')}
                >
                  <X className="h-4 w-4" />
                </span>
              ) : (
                <ChevronDown className="h-4 w-4 text-ink-300 flex-shrink-0" />
              )}
            </button>

            <div className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between text-ink-600 dark:text-ink-200">
                <span>{t('checkout.products', { count: totalItems })}</span>
                <span className="font-semibold text-ink-800 dark:text-white">{formatVND(totalPrice)}</span>
              </div>
              {appliedVoucher && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-300">
                  <span>{t('checkout.discount')}</span>
                  <span className="font-semibold">-{formatVND(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-ink-600 dark:text-ink-200">
                <span>{t('checkout.shippingFee')}</span>
                <span className="font-semibold text-ink-800 dark:text-white" data-testid="checkout-shipping-fee">{formatVND(effectiveShippingFee)}</span>
              </div>
              <div className="h-px bg-gradient-to-r from-transparent via-ink-200 to-transparent my-4" />
              <div className="flex justify-between items-baseline">
                <span className="font-semibold text-ink-900 dark:text-white">{t('checkout.grandTotal')}</span>
                <span className="text-2xl font-display font-bold text-gradient-brand" data-testid="checkout-grand-total">{formatVND(grandTotal)}</span>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-3">{t('checkout.products', { count: items.length })}</h3>
              <ul className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {items.map((item, idx) => (
                  <li key={idx} className="flex justify-between gap-3 text-sm">
                    <span className="text-ink-600 dark:text-ink-200 truncate">{item.name} <span className="text-ink-400 dark:text-ink-300">x {item.quantity}</span></span>
                    <span className="font-semibold text-ink-800 dark:text-white flex-shrink-0">{formatVND(item.price * item.quantity)}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-ink-400 dark:text-ink-300 border-t border-ink-100 dark:border-white/10 pt-5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              {t('checkout.securePayment')}
            </div>
          </div>
        </div>
      </div>

      <VoucherPickerModal
        isOpen={voucherModalOpen}
        onClose={() => setVoucherModalOpen(false)}
        cartItems={items}
        subtotal={totalPrice}
        selectedCode={appliedVoucher?.code || null}
        onApply={setAppliedVoucher}
      />

      <AddressManager
        isOpen={addressPickerOpen}
        onClose={() => setAddressPickerOpen(false)}
        pickerMode
        onSelect={applyAddress}
      />
    </div>
  );
};

export default Checkout;
