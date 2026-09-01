import React, { useState } from 'react';
import { Search, Package, AlertCircle, ShieldCheck, MapPin, Truck } from 'lucide-react';
import api from '../services/api';
import { STATUS_MAP, TIMELINE_STEPS } from '../constants/orderStatus';
import { detectIdentifier, IDENTIFIER_LABELS } from '../utils/orderId';
import { formatVND } from '../utils/format';

/* ── detection chip shown live inside the search field ─────────────────── */
const DETECTION_STYLE = {
  orderCode: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  email: 'bg-primary-50 text-primary-700 ring-primary-200',
  phone: 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200',
  unknown: 'bg-rose-50 text-rose-600 ring-rose-200'
};

const DetectionChip = ({ type }) => {
  if (type === 'empty') return null;
  return (
    <span
      className={`absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 animate-tcg-scale-in ${DETECTION_STYLE[type] || DETECTION_STYLE.unknown}`}
    >
      {IDENTIFIER_LABELS[type] || IDENTIFIER_LABELS.unknown}
    </span>
  );
};

/* ── timeline progress (same flow as OrderHistory) ─────────────────────── */
const ORDER_FLOW = ['PENDING', 'PACKAGING', 'SHIPPING', 'DELIVERED'];
const getStepStatus = (orderStatus, stepKey) => {
  const currentIndex = ORDER_FLOW.indexOf(orderStatus);
  const stepIndex = ORDER_FLOW.indexOf(stepKey);
  if (currentIndex === -1) return 'upcoming';
  if (stepIndex < currentIndex) return 'done';
  if (stepIndex === currentIndex) return 'current';
  return 'upcoming';
};

const ProgressBar = ({ status }) => (
  <div className="rounded-2xl bg-white dark:bg-white/5 ring-1 ring-ink-100 dark:ring-white/10 p-5">
    <div className="flex items-center justify-between">
      {TIMELINE_STEPS.map((step, idx) => {
        const stepStatus = getStepStatus(status, step.key);
        const Icon = step.icon;
        return (
          <React.Fragment key={step.key}>
            <div className="flex flex-col items-center flex-1">
              <div
                className={`h-9 w-9 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                  stepStatus === 'done' ? 'bg-emerald-500 border-emerald-500 text-white' :
                  stepStatus === 'current' ? 'bg-primary-600 border-primary-600 text-white shadow-glow' :
                  'bg-ink-200 dark:bg-white/15 border-ink-300 text-ink-500 dark:text-ink-300'
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <span className={`text-[11px] mt-1.5 text-center font-medium ${
                stepStatus === 'done' ? 'text-emerald-600' :
                stepStatus === 'current' ? 'text-primary-700' :
                'text-ink-400 dark:text-ink-300'
              }`}>
                {step.label}
              </span>
            </div>
            {idx < TIMELINE_STEPS.length - 1 && (
              <div className={`flex-1 h-1 mx-1 sm:mx-2 rounded-full ${
                stepStatus === 'done' ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : 'bg-ink-200 dark:bg-white/15'
              }`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  </div>
);

/* ── skeleton loader mirroring the result card layout ──────────────────── */
const LookupSkeleton = () => (
  <div className="mt-8 rounded-3xl bg-white/85 dark:bg-[#12121a]/85 backdrop-blur-xl border border-ink-100 dark:border-white/10 shadow-card p-6 sm:p-8 animate-pulse">
    <div className="flex items-center justify-between gap-4 mb-6">
      <div className="h-5 bg-ink-100 dark:bg-white/10 rounded-lg w-40" />
      <div className="h-7 bg-ink-100 dark:bg-white/10 rounded-full w-28" />
    </div>
    <div className="rounded-2xl bg-ink-50 dark:bg-white/5 ring-1 ring-ink-100 dark:ring-white/10 p-5">
      <div className="flex justify-between mb-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex flex-col items-center flex-1 gap-2">
            <div className="h-9 w-9 rounded-full bg-ink-200 dark:bg-white/15" />
            <div className="h-2.5 bg-ink-200 dark:bg-white/15 rounded w-12" />
          </div>
        ))}
      </div>
    </div>
    <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-ink-100 dark:bg-white/10" />)}
    </div>
    <div className="mt-5 space-y-2.5">
      <div className="h-12 rounded-xl bg-ink-100 dark:bg-white/10" />
      <div className="h-12 rounded-xl bg-ink-100 dark:bg-white/10 opacity-70" />
    </div>
  </div>
);

/* ── order result card ─────────────────────────────────────────────────── */
const OrderResult = ({ order }) => {
  const config = STATUS_MAP[order.status] || {
    label: order.status,
    icon: Package,
    badgeClass: 'bg-gray-50 text-gray-700 border-gray-200'
  };
  const StatusIcon = config.icon;

  return (
    <div className="mt-8 rounded-3xl bg-white/85 dark:bg-[#12121a]/85 backdrop-blur-xl border border-ink-100 dark:border-white/10 shadow-card p-6 sm:p-8 animate-tcg-reveal">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-400 dark:text-ink-300">Mã đơn hàng</p>
          <p className="font-mono text-lg font-semibold text-ink-900 dark:text-white truncate">{order.orderCode}</p>
        </div>
        <span className={`self-start inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-semibold border ${config.badgeClass}`}>
          <StatusIcon className="h-3.5 w-3.5 mr-1.5" />
          {config.label}
        </span>
      </div>

      {order.status !== 'CANCELLED' && <ProgressBar status={order.status} />}
      {order.status === 'CANCELLED' && (
        <div className="rounded-2xl bg-rose-50 ring-1 ring-rose-200 p-4 text-sm font-medium text-rose-700 flex items-center gap-2.5">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          Đơn hàng này đã được hủy.
        </div>
      )}

      {/* summary metrics */}
      <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl bg-ink-50/70 ring-1 ring-ink-100 dark:ring-white/10 p-3.5">
          <p className="text-[11px] uppercase tracking-wider text-ink-400 dark:text-ink-300 font-semibold">Tổng tiền</p>
          <p className="font-display font-bold text-gradient-brand mt-1">
            {formatVND(order.grandTotal)}
          </p>
        </div>
        <div className="rounded-xl bg-ink-50/70 ring-1 ring-ink-100 dark:ring-white/10 p-3.5">
          <p className="text-[11px] uppercase tracking-wider text-ink-400 dark:text-ink-300 font-semibold">Sản phẩm</p>
          <p className="font-bold text-ink-800 dark:text-white mt-1">{order.items?.length || 0} mặt hàng</p>
        </div>
        <div className="rounded-xl bg-ink-50/70 ring-1 ring-ink-100 dark:ring-white/10 p-3.5">
          <p className="text-[11px] uppercase tracking-wider text-ink-400 dark:text-ink-300 font-semibold">Ngày tạo</p>
          <p className="font-semibold text-ink-800 dark:text-white mt-1 text-sm">
            {new Date(order.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="rounded-xl bg-ink-50/70 ring-1 ring-ink-100 dark:ring-white/10 p-3.5">
          <p className="text-[11px] uppercase tracking-wider text-ink-400 dark:text-ink-300 font-semibold">Thanh toán</p>
          <p className="font-semibold text-ink-800 dark:text-white mt-1 text-sm">
            {order.paidAt ? new Date(order.paidAt).toLocaleDateString() : 'Chưa thanh toán'}
          </p>
        </div>
      </div>

      {/* items */}
      {order.items && order.items.length > 0 && (
        <div className="mt-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-3">Sản phẩm</h3>
          <ul className="space-y-2.5">
            {order.items.map((item, idx) => (
              <li key={idx} className="flex justify-between gap-3 items-center text-sm p-3.5 rounded-xl bg-white dark:bg-white/5 ring-1 ring-ink-100 dark:ring-white/10">
                <span className="text-ink-700 dark:text-ink-100 truncate">
                  {item.product?.shortName || item.product?.name || item.card?.sku || 'Sản phẩm'}{' '}
                  <span className="text-ink-400 dark:text-ink-300">x {item.quantity}</span>
                </span>
                <span className="font-semibold text-ink-900 dark:text-white flex-shrink-0">
                  {formatVND(item.totalPrice)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* tracking number (visible once the order ships) */}
      {order.trackingNumber && order.status !== 'CANCELLED' && (
        <div className="mt-5 text-sm bg-white dark:bg-white/5 p-4 rounded-xl border border-indigo-100 dark:border-indigo-400/20 flex items-center gap-2.5">
          <Truck className="h-4 w-4 text-indigo-600 flex-shrink-0" />
          <span className="text-ink-600 dark:text-ink-200">
            Mã vận đơn: <span className="font-mono font-semibold text-ink-900 dark:text-white">{order.trackingNumber}</span>
          </span>
        </div>
      )}

      {/* masked shipping info (privacy-safe for guest tracking) */}
      {order.shippingAddress && (
        <div className="mt-5 text-sm text-ink-600 dark:text-ink-200 bg-white dark:bg-white/5 p-4 rounded-xl border border-ink-100 dark:border-white/10">
          <p className="font-semibold flex items-center text-ink-800 dark:text-white mb-1.5">
            <MapPin className="h-4 w-4 mr-1.5 text-primary-600" /> Nơi nhận
          </p>
          <p>
            {order.shippingAddress.fullName}
            {order.shippingAddress.wardName || order.shippingAddress.provinceName ? ' — ' : ''}
            {[order.shippingAddress.wardName, order.shippingAddress.provinceName].filter(Boolean).join(', ')}
          </p>
        </div>
      )}

      <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-ink-400 dark:text-ink-300">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
        Thông tin cá nhân được ẩn để bảo vệ quyền riêng tư
      </p>
    </div>
  );
};

/* ── page ──────────────────────────────────────────────────────────────── */
const OrderLookup = () => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationError, setValidationError] = useState('');
  const [order, setOrder] = useState(null);

  const detected = detectIdentifier(query);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (detected.type === 'empty') {
      setValidationError('Vui lòng nhập mã đơn hàng, email hoặc số điện thoại.');
      return;
    }
    if (detected.type === 'unknown') {
      setValidationError('Thông tin không hợp lệ. Vui lòng nhập mã đơn (TCG-...), email hoặc số điện thoại.');
      return;
    }

    setValidationError('');
    setError('');
    setOrder(null);
    setLoading(true);

    try {
      const response = await api.post('/orders/lookup', { query: detected.value });
      setOrder(response.data.data);
    } catch (err) {
      console.error('Order lookup failed:', err.response?.status, err.response?.data?.error?.message || err.message);
      const status = err.response?.status;
      if (status === 404) {
        setError('Không tìm thấy đơn hàng đang hoạt động khớp với thông tin bạn cung cấp.');
      } else if (status === 429) {
        setError('Quá nhiều lượt tra cứu. Vui lòng thử lại sau ít phút.');
      } else if (status === 400) {
        setError(err.response?.data?.error?.message || 'Thông tin tra cứu không hợp lệ.');
      } else {
        setError('Không thể tra cứu đơn hàng. Vui lòng kiểm tra kết nối và thử lại.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen app-bg">
      <div className="relative max-w-3xl mx-auto px-4 py-12">
        {/* Ambient background — entirely contained within the page wrapper */}
        <div className="pointer-events-none absolute -top-10 left-6 h-64 w-64 rounded-full bg-primary-400/10 blur-[100px] animate-tcg-float" />
        <div className="pointer-events-none absolute bottom-10 right-6 h-64 w-64 rounded-full bg-fuchsia-400/10 blur-[100px] animate-tcg-float-slow" />

      <div className="relative">
        <div className="text-center mb-9 animate-tcg-reveal">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-brand-gradient flex items-center justify-center shadow-glow">
            <Package className="h-8 w-8 text-white" />
          </div>
          <p className="section-eyebrow mt-5">Guest Tracking</p>
          <h1 className="heading-display text-3xl mt-1.5">Tra cứu đơn hàng</h1>
          <p className="mt-2 text-ink-500 dark:text-ink-300 max-w-md mx-auto">
            Không cần đăng nhập — nhập <strong className="text-ink-700 dark:text-ink-100 font-semibold">mã đơn hàng</strong>,{' '}
            <strong className="text-ink-700 dark:text-ink-100 font-semibold">email</strong> hoặc{' '}
            <strong className="text-ink-700 dark:text-ink-100 font-semibold">số điện thoại</strong> để xem trạng thái ngay lập tức.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-3xl bg-white/80 dark:bg-[#12121a]/80 backdrop-blur-xl border border-ink-100 dark:border-white/10 shadow-card p-6 sm:p-7 animate-tcg-reveal"
          style={{ animationDelay: '0.08s' }}
        >
          <label htmlFor="lookup-input" className="label-premium">
            Mã đơn hàng, email hoặc số điện thoại *
          </label>
          <div className="relative flex items-center">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-ink-400 dark:text-ink-300 pointer-events-none" />
            <input
              id="lookup-input"
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setValidationError('');
              }}
              placeholder="VD: TCG-20260101-A1B2C3D4, you@email.com, 0987654321"
              autoComplete="off"
              className={`input-premium !pl-11 ${detected.type !== 'empty' ? '!pr-32' : ''} font-mono tracking-wide`}
            />
            <DetectionChip type={detected.type} />
          </div>

          {validationError && (
            <p className="mt-2.5 flex items-center gap-1.5 text-sm font-medium text-rose-600 animate-tcg-scale-in">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {validationError}
            </p>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full mt-5">
            {loading ? (
              <>
                <Search className="h-5 w-5 animate-spin" />
                Đang tra cứu...
              </>
            ) : (
              <>
                <Search className="h-5 w-5" />
                Tra cứu ngay
              </>
            )}
          </button>

          <p className="mt-4 text-center text-xs text-ink-400 dark:text-ink-300 flex items-center justify-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            Tra cứu công khai, an toàn — thông tin nhạy cảm luôn được ẩn
          </p>
        </form>

        {/* Result area */}
        {loading && <LookupSkeleton />}

        {!loading && error && (
          <div className="mt-8 relative overflow-hidden rounded-3xl bg-white/85 dark:bg-[#12121a]/85 backdrop-blur-xl border border-ink-100 dark:border-white/10 shadow-card p-8 text-center animate-tcg-scale-in">
            <div className="pointer-events-none absolute -top-16 left-1/3 h-48 w-48 rounded-full bg-rose-300/15 blur-[80px]" />
            <div className="relative">
              <div className="mx-auto h-14 w-14 rounded-2xl bg-rose-50 ring-1 ring-rose-200 flex items-center justify-center">
                <Package className="h-7 w-7 text-rose-500" />
              </div>
              <h2 className="heading-display text-lg mt-4">No active shipment found</h2>
              <p className="mt-2 text-sm text-ink-500 dark:text-ink-300 max-w-md mx-auto">{error}</p>
              <button onClick={() => { setQuery(''); setOrder(null); setError(''); }} className="btn-secondary !py-2 text-sm mt-5">
                Thử lại với thông tin khác
              </button>
            </div>
          </div>
        )}

        {!loading && !error && order && <OrderResult order={order} />}
      </div>
      </div>
    </div>
  );
};

export default OrderLookup;
