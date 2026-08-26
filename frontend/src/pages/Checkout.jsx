import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2, ExternalLink, MapPin, ChevronDown, ShieldCheck, Lock } from 'lucide-react';
import api from '../services/api';
import { useCartStore } from '../store/useCartStore';
import { useAuthStore } from '../store/useAuthStore';
import provincesData from '../province.json';
import wardsData from '../ward.json';

const provinces = Object.values(provincesData).sort((a, b) => a.name.localeCompare(b.name));
const allWards = Object.values(wardsData);

const Checkout = () => {
  const { items, totalItems, clearCart } = useCartStore();
  const { user } = useAuthStore();
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

  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, []);

  const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shippingFee = items.length > 0 ? 2.0 : 0;
  const grandTotal = totalPrice + shippingFee;

  useEffect(() => {
    if (selectedProvince) {
      const wards = allWards.filter(w => String(w.parent_code) === selectedProvince);
      setFilteredWards(wards.sort((a, b) => a.name.localeCompare(b.name)));
    } else {
      setFilteredWards([]);
    }
    setSelectedWard('');
  }, [selectedProvince]);

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
    if (!selectedProvince) { setError('Vui lòng chọn Tỉnh/Thành phố.'); return false; }
    if (!selectedWard) { setError('Vui lòng chọn Phường/Xã/Thị trấn.'); return false; }
    if (!shippingAddress.addressLine1.trim()) { setError('Vui lòng nhập địa chỉ cụ thể (số nhà, đường...).'); return false; }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (items.length === 0) { setError('Giỏ hàng trống.'); return; }
    setError('');
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const checkoutItems = items.map((item) => ({
        productId: item.productId,
        cardId: item.cardId || undefined,
        quantity: item.quantity
      }));

      const province = provinces.find(p => p.code === selectedProvince);
      const ward = filteredWards.find(w => w.code === selectedWard);

      const addressPayload = {
        ...shippingAddress,
        provinceCode: selectedProvince,
        wardCode: selectedWard,
        provinceName: province?.name_with_type || province?.name,
        wardName: ward?.name_with_type || ward?.name,
        city: province?.name || '',
        state: ward?.name || ''
      };

      const response = await api.post('/orders/checkout', {
        items: checkoutItems,
        shippingAddress: addressPayload,
        paymentMethod: 'SEPAY'
      });

      const data = response.data.data;
      setOrderData(data);

      // Xóa giỏ hàng ngay sau khi tạo đơn thành công
      clearCart();

      startPolling(data.order.id);
    } catch (err) {
      console.error('Checkout error:', err.response?.status, err.response?.data?.error?.message || err.message);
      setError(err.response?.data?.error?.message || 'Không thể tạo đơn hàng.');
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
          setError('Đơn hàng đã bị hủy.');
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

  if (orderData && orderData.payment?.checkoutUrl && orderData.payment?.formFields) {
    const { checkoutUrl, formFields, amount, transferContent } = orderData.payment;

    return (
      <div className="relative overflow-hidden max-w-2xl mx-auto px-4 py-12 animate-tcg-reveal">
        <div className="pointer-events-none absolute -top-24 left-1/4 h-64 w-64 rounded-full bg-primary-400/15 blur-[100px] animate-tcg-float" />
        <div className="pointer-events-none absolute -bottom-24 right-1/4 h-64 w-64 rounded-full bg-fuchsia-400/15 blur-[100px] animate-tcg-float-slow" />

        <div className="relative rounded-3xl bg-white/85 backdrop-blur-xl border border-ink-100 shadow-card p-6 sm:p-9">
          <div className="text-center">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-primary-50 to-fuchsia-100 ring-1 ring-primary-200/60 flex items-center justify-center animate-tcg-glow-pulse">
              <Lock className="h-7 w-7 text-primary-700" />
            </div>
            <h2 className="heading-display text-2xl mt-4">Chuyển hướng đến SePay</h2>
            <p className="mt-2 text-ink-500">Nhấn nút bên dưới để tiến hành thanh toán an toàn.</p>
          </div>

          <div className="mt-7 rounded-2xl bg-ink-50/80 ring-1 ring-ink-100 p-5 space-y-3.5 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-ink-500">Mã đơn hàng</span>
              <span className="font-mono font-semibold text-ink-900">{orderData.order.orderCode}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-ink-500">Số tiền (VND)</span>
              <span className="font-display font-bold text-xl text-gradient-brand">
                {Number(amount).toLocaleString('vi-VN')} ₫
              </span>
            </div>
            {transferContent && (
              <div className="flex justify-between items-center gap-4">
                <span className="text-ink-500 shrink-0">Nội dung chuyển khoản</span>
                <span className="font-mono font-semibold text-ink-900 break-all text-right">{transferContent}</span>
              </div>
            )}
          </div>

          <div className="mt-7 flex flex-col items-center gap-3">
            {polling && (
              <div className="inline-flex items-center gap-2 text-sm font-medium text-ink-500 rounded-full bg-primary-50 ring-1 ring-primary-200/70 px-4 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary-600" />
                Đang chờ xác nhận thanh toán...
              </div>
            )}

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
              Thanh toán ngay
            </button>

            <p className="flex items-center gap-1.5 text-xs text-ink-400 mt-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              Giao dịch được mã hóa và bảo mật
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8 animate-tcg-reveal">
      <div className="mb-7">
        <p className="section-eyebrow">Secure Checkout</p>
        <h1 className="heading-display text-3xl mt-1">Thanh toán</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Shipping Form */}
        <div className="lg:col-span-2 rounded-3xl bg-white/85 backdrop-blur-xl border border-ink-100 shadow-card p-6 sm:p-8">
          <h2 className="heading-display text-lg flex items-center gap-2.5">
            <MapPin className="h-5 w-5 text-primary-600" />
            Địa chỉ giao hàng
          </h2>
          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="label-premium">Họ tên *</label>
                <input
                  type="text"
                  name="fullName"
                  value={shippingAddress.fullName}
                  onChange={handleInputChange}
                  required
                  placeholder="Nguyễn Văn A"
                  className="input-premium"
                />
              </div>
              <div>
                <label className="label-premium">Số điện thoại *</label>
                <input
                  type="text"
                  name="phone"
                  value={shippingAddress.phone}
                  onChange={handleInputChange}
                  required
                  placeholder="0123 456 789"
                  className="input-premium"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="label-premium">Tỉnh/Thành phố *</label>
                <div className="relative">
                  <select
                    value={selectedProvince}
                    onChange={handleProvinceChange}
                    required
                    className="input-premium appearance-none pr-10 cursor-pointer"
                  >
                    <option value="">-- Chọn Tỉnh/Thành phố --</option>
                    {provinces.map((prov) => (
                      <option key={prov.code} value={prov.code}>
                        {prov.name_with_type}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="label-premium">Phường/Xã/Thị trấn *</label>
                <div className="relative">
                  <select
                    value={selectedWard}
                    onChange={handleWardChange}
                    required
                    disabled={!selectedProvince}
                    className="input-premium appearance-none pr-10 cursor-pointer"
                  >
                    <option value="">{selectedProvince ? '-- Chọn Phường/Xã --' : 'Vui lòng chọn Tỉnh trước'}</option>
                    {filteredWards.map((ward) => (
                      <option key={ward.code} value={ward.code}>
                        {ward.name_with_type}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400 pointer-events-none" />
                </div>
              </div>
            </div>

            <div>
              <label className="label-premium">Địa chỉ cụ thể (số nhà, đường, thôn/ấp...) *</label>
              <input
                type="text"
                name="addressLine1"
                value={shippingAddress.addressLine1}
                onChange={handleInputChange}
                required
                placeholder="VD: 123 Nguyễn Huệ, phường 5"
                className="input-premium"
              />
            </div>
            <div>
              <label className="label-premium">Ghi chú thêm (optional)</label>
              <input
                type="text"
                name="addressLine2"
                value={shippingAddress.addressLine2}
                onChange={handleInputChange}
                placeholder="VD: gần chợ Bến Thành"
                className="input-premium"
              />
            </div>

            <input type="hidden" name="country" value={shippingAddress.country} />
            <input type="hidden" name="zipCode" value={shippingAddress.zipCode} />

            {error && (
              <div className="flex items-center gap-2.5 p-4 rounded-xl bg-rose-50 text-rose-600 ring-1 ring-rose-200 text-sm font-medium animate-tcg-scale-in">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                {error}
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
                  Đang xử lý...
                </>
              ) : (
                <>
                  <Lock className="h-5 w-5" />
                  Đặt hàng & Thanh toán
                </>
              )}
            </button>
          </form>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 rounded-3xl bg-white/85 backdrop-blur-xl border border-ink-100 shadow-card p-6 sm:p-7">
            <h2 className="heading-display text-lg">Tóm tắt đơn hàng</h2>
            <div className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between text-ink-600">
                <span>Sản phẩm ({totalItems})</span>
                <span className="font-semibold text-ink-800">${totalPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-ink-600">
                <span>Phí vận chuyển</span>
                <span className="font-semibold text-ink-800">${shippingFee.toFixed(2)}</span>
              </div>
              <div className="h-px bg-gradient-to-r from-transparent via-ink-200 to-transparent my-4" />
              <div className="flex justify-between items-baseline">
                <span className="font-semibold text-ink-900">Tổng cộng</span>
                <span className="text-2xl font-display font-bold text-gradient-brand">${grandTotal.toFixed(2)}</span>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-400 mb-3">Sản phẩm</h3>
              <ul className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {items.map((item, idx) => (
                  <li key={idx} className="flex justify-between gap-3 text-sm">
                    <span className="text-ink-600 truncate">{item.name} <span className="text-ink-400">x {item.quantity}</span></span>
                    <span className="font-semibold text-ink-800 flex-shrink-0">${(item.price * item.quantity).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-ink-400 border-t border-ink-100 pt-5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              Thanh toán bảo mật qua SePay
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
