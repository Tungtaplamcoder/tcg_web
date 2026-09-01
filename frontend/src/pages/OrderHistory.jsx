import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Package, AlertCircle, ChevronDown, MapPin, ExternalLink, Truck, Loader2
} from 'lucide-react';
import api from '../services/api';
import { onSocketEvent } from '../services/socket';
import { useAuthStore } from '../store/useAuthStore';
import { STATUS_MAP, TIMELINE_STEPS } from '../constants/orderStatus';
import { formatVND } from '../utils/format';
import ConfirmDialog from '../components/ConfirmDialog';

const OrderHistory = () => {
  const { user } = useAuthStore();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ totalPages: 1 });
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [cancelTargetId, setCancelTargetId] = useState(null);
  const [repayingId, setRepayingId] = useState(null);

  const lastSyncAttemptRef = useRef({}); // orderId -> timestamp of last sync-payment call

  const fetchOrders = useCallback(async () => {
    setError('');
    try {
      const response = await api.get(`/orders?page=${page}&limit=10`);
      setOrders(response.data.data.items || []);
      setMeta(response.data.data.meta || { totalPages: 1 });
    } catch (err) {
      console.error('Failed to fetch orders:', err.response?.status, err.response?.data?.error?.message || err.message);
      setError('Failed to load orders. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    if (user) {
      fetchOrders();
    }
  }, [user, fetchOrders]);

  // ── Real-time updates: Socket.IO events from the payment webhook ──────────
  // Backend emits `order:paid` / `order:status_changed` / `order:cancelled`
  // when SePay IPN (or admin) updates the order — refresh the list instantly.
  useEffect(() => {
    if (!user) return undefined;

    const handleOrderEvent = (data) => {
      console.log('Order socket event:', data);
      fetchOrders();
    };

    const cleanups = [
      onSocketEvent('order:paid', handleOrderEvent),
      onSocketEvent('order:status_changed', handleOrderEvent),
      onSocketEvent('order:cancelled', handleOrderEvent)
    ];

    return () => cleanups.forEach((cleanup) => cleanup && cleanup());
  }, [user, fetchOrders]);

  // ── Polling fallback: re-fetch every 15s while a PENDING order exists ────
  // (covers cases where the socket connection drops or the user has multiple tabs)
  const hasPendingOrder = orders.some((o) => o.status === 'PENDING');
  useEffect(() => {
    if (!user || !hasPendingOrder) return undefined;
    const interval = setInterval(() => {
      fetchOrders();
    }, 15000);
    return () => clearInterval(interval);
  }, [user, hasPendingOrder, fetchOrders]);

  // ── Fallback sync: verify PENDING orders against SePay when webhook fails ─
  // POST /orders/:id/sync-payment re-checks SePay server-side; if SePay says
  // PAID, the backend flips the order to PACKAGING and we refresh the list.
  // Throttled to 1 attempt per order per 30s to avoid hammering SePay.
  useEffect(() => {
    if (!user) return undefined;
    const pendingOrders = orders.filter((o) => o.status === 'PENDING');
    if (pendingOrders.length === 0) return undefined;

    const SYNC_THROTTLE_MS = 30000;
    const now = Date.now();
    const dueOrders = pendingOrders.filter(
      (o) => !lastSyncAttemptRef.current[o.id] || now - lastSyncAttemptRef.current[o.id] > SYNC_THROTTLE_MS
    );
    if (dueOrders.length === 0) return undefined;

    let cancelled = false;
    const timer = setTimeout(async () => {
      dueOrders.forEach((o) => { lastSyncAttemptRef.current[o.id] = Date.now(); });
      const results = await Promise.allSettled(
        dueOrders.map((order) => api.post(`/orders/${order.id}/sync-payment`))
      );
      if (cancelled) return;
      const anySynced = results.some((r) => r.status === 'fulfilled' && r.value?.data?.data?.synced);
      if (anySynced) {
        fetchOrders();
      }
    }, 3000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, orders, fetchOrders]);

  const handleToggleExpand = (orderId) => {
    setExpandedOrderId(expandedOrderId === orderId ? null : orderId);
  };

  const handleCancelOrder = async (orderId) => {
    setCancelTargetId(null);
    setCancellingId(orderId);
    setError('');
    try {
      await api.post(`/orders/${orderId}/cancel`);
      fetchOrders();
    } catch (err) {
      console.error('Failed to cancel order:', err.response?.status, err.response?.data?.error?.message || err.message);
      setError(err.response?.data?.error?.message || 'Không thể hủy đơn hàng.');
    } finally {
      setCancellingId(null);
    }
  };

  // ── Retry payment ("Thanh toán ngay") ─────────────────────────────────────
  // SePay /checkout/init yêu cầu POST form có chữ ký HMAC (merchant, mã đơn,
  // số tiền, signature...) — link GET trực tiếp sẽ gặp 404. Nên gọi
  // POST /orders/:id/repay để backend tái tạo signed form fields rồi
  // auto-submit form chuyển hướng sang trang thanh toán SePay.
  const handleRepay = async (orderId) => {
    setRepayingId(orderId);
    setError('');
    try {
      const response = await api.post(`/orders/${orderId}/repay`);
      const { checkoutUrl, formFields } = response.data.data || {};

      if (!checkoutUrl || !formFields) {
        throw new Error('Backend không trả về phiên thanh toán SePay hợp lệ.');
      }

      const form = document.createElement('form');
      form.action = checkoutUrl;
      form.method = 'POST';
      Object.entries(formFields).forEach(([key, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = value;
        form.appendChild(input);
      });
      document.body.appendChild(form);
      form.submit();
    } catch (err) {
      console.error('Failed to retry payment:', err.response?.status, err.response?.data?.error?.message || err.message);
      setError(err.response?.data?.error?.message || 'Không thể tạo phiên thanh toán. Vui lòng thử lại.');
      setRepayingId(null);
    }
  };

  const getStatusBadge = (status) => {
    const config = STATUS_MAP[status] || {
      label: status,
      icon: Package,
      badgeClass: 'bg-gray-50 text-gray-700 border-gray-200'
    };
    const Icon = config.icon;
    return (
      <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold border ${config.badgeClass}`}>
        <Icon className="h-3.5 w-3.5 mr-1.5" />
        {config.label}
      </span>
    );
  };

  const getStepStatus = (orderStatus, stepKey) => {
    const orderFlow = ['PENDING', 'PACKAGING', 'SHIPPING', 'DELIVERED'];
    const currentIndex = orderFlow.indexOf(orderStatus);
    const stepIndex = orderFlow.indexOf(stepKey);
    if (currentIndex === -1) return 'upcoming';
    if (stepIndex < currentIndex) return 'done';
    if (stepIndex === currentIndex) return 'current';
    return 'upcoming';
  };

  if (loading && orders.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="h-8 bg-ink-100 dark:bg-white/10 rounded-lg w-56 mb-8 animate-pulse" />
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-ink-50 dark:bg-white/5 ring-1 ring-ink-100 dark:ring-white/10 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8 animate-tcg-reveal">
      <div className="mb-7">
        <p className="section-eyebrow">Purchase History</p>
        <h1 className="heading-display text-3xl mt-1">Đơn hàng của tôi</h1>
      </div>

      {error && (
        <div className="mb-5 flex items-center gap-2.5 p-4 rounded-xl bg-rose-50 text-rose-600 ring-1 ring-rose-200 text-sm font-medium animate-tcg-scale-in">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {orders.length === 0 ? (
        <div className="relative overflow-hidden text-center py-20 rounded-3xl bg-white/85 dark:bg-[#12121a]/85 backdrop-blur-xl border border-ink-100 dark:border-white/10 shadow-card">
          <div className="pointer-events-none absolute -top-16 right-1/4 h-56 w-56 rounded-full bg-primary-300/15 blur-[80px]" />
          <div className="relative">
            <div className="mx-auto h-16 w-16 rounded-2xl bg-ink-50 dark:bg-white/5 ring-1 ring-ink-100 dark:ring-white/10 flex items-center justify-center">
              <Package className="h-8 w-8 text-ink-300" />
            </div>
            <p className="mt-5 text-ink-600 dark:text-ink-200 font-medium">Bạn chưa có đơn hàng nào.</p>
            <Link to="/catalog" className="btn-primary mt-6">
              Bắt đầu mua sắm
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const expanded = expandedOrderId === order.id;
            return (
              <div
                key={order.id}
                className="card-premium overflow-hidden !translate-y-0 hover:!translate-y-0 hover:shadow-card-hover"
              >
                {/* Summary row */}
                <div
                  className="p-4 sm:p-5 cursor-pointer transition-colors hover:bg-primary-50/40"
                  onClick={() => handleToggleExpand(order.id)}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-start gap-4 min-w-0">
                      <div className="flex-shrink-0 h-12 w-12 rounded-xl bg-brand-gradient-soft ring-1 ring-primary-200/50 flex items-center justify-center">
                        <Package className="h-6 w-6 text-primary-700" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-semibold text-ink-900 dark:text-white truncate">{order.orderCode}</p>
                        <p className="text-xs text-ink-400 dark:text-ink-300 mt-1">
                          {new Date(order.createdAt).toLocaleDateString()} at {new Date(order.createdAt).toLocaleTimeString()}
                        </p>
                        <p className="text-xs text-ink-400 dark:text-ink-300">{order.items?.length || 0} sản phẩm</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <p className="font-display font-bold text-gradient-brand">{formatVND(order.grandTotal)}</p>
                        <div className="mt-1">{getStatusBadge(order.status)}</div>
                      </div>
                      <ChevronDown
                        className={`h-5 w-5 text-ink-400 dark:text-ink-300 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
                      />
                    </div>
                  </div>
                </div>

                {/* Expanded details */}
                <div
                  className="grid transition-[grid-template-rows] duration-300 ease-out"
                  style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
                >
                  <div className="overflow-hidden">
                    <div className="border-t border-ink-100 dark:border-white/10 p-4 sm:p-5 bg-ink-50/60">
                      {/* Progress timeline */}
                      <div className="mb-6 rounded-2xl bg-white dark:bg-white/5 ring-1 ring-ink-100 dark:ring-white/10 p-5">
                        <div className="flex items-center justify-between">
                          {TIMELINE_STEPS.map((step, idx) => {
                            const status = getStepStatus(order.status, step.key);
                            const Icon = step.icon;
                            return (
                              <React.Fragment key={step.key}>
                                <div className="flex flex-col items-center flex-1">
                                  <div
                                    className={`h-9 w-9 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                                      status === 'done' ? 'bg-emerald-500 border-emerald-500 text-white' :
                                      status === 'current' ? 'bg-primary-600 border-primary-600 text-white shadow-glow' :
                                      'bg-ink-200 dark:bg-white/15 border-ink-300 text-ink-500 dark:text-ink-300'
                                    }`}
                                  >
                                    <Icon className="h-4 w-4" />
                                  </div>
                                  <span className={`text-[11px] mt-1.5 text-center font-medium ${
                                    status === 'done' ? 'text-emerald-600' :
                                    status === 'current' ? 'text-primary-700' :
                                    'text-ink-400 dark:text-ink-300'
                                  }`}>
                                    {step.label}
                                  </span>
                                </div>
                                {idx < TIMELINE_STEPS.length - 1 && (
                                  <div className={`flex-1 h-1 mx-1 sm:mx-2 rounded-full transition-colors duration-500 ${
                                    status === 'done' ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : 'bg-ink-200 dark:bg-white/15'
                                  }`} />
                                )}
                              </React.Fragment>
                            );
                          })}
                        </div>
                      </div>

                      {/* Items list */}
                      <div className="space-y-2">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between gap-3 text-sm bg-white dark:bg-white/5 p-3.5 rounded-xl border border-ink-100 dark:border-white/10">
                            <span className="text-ink-700 dark:text-ink-100 truncate">
                              {item.product?.name || item.card?.sku || 'Sản phẩm'} <span className="text-ink-400 dark:text-ink-300">x {item.quantity}</span>
                            </span>
                            <span className="font-semibold text-ink-900 dark:text-white flex-shrink-0">{formatVND(item.totalPrice)}</span>
                          </div>
                        ))}
                      </div>

                      {/* Tracking number (visible once the order ships) */}
                      {order.trackingNumber && ['SHIPPING', 'DELIVERED'].includes(order.status) && (
                        <div className="mt-4 text-sm bg-white dark:bg-white/5 p-4 rounded-xl border border-indigo-100 dark:border-indigo-400/20 flex items-center gap-2.5">
                          <Truck className="h-4 w-4 text-indigo-600 flex-shrink-0" />
                          <span className="text-ink-600 dark:text-ink-200">
                            Mã vận đơn: <span className="font-mono font-semibold text-ink-900 dark:text-white">{order.trackingNumber}</span>
                          </span>
                        </div>
                      )}

                      {/* Shipping address */}
                      <div className="mt-4 text-sm text-ink-600 dark:text-ink-200 bg-white dark:bg-white/5 p-4 rounded-xl border border-ink-100 dark:border-white/10">
                        <p className="font-semibold flex items-center text-ink-800 dark:text-white mb-1.5">
                          <MapPin className="h-4 w-4 mr-1.5 text-primary-600" /> Địa chỉ giao hàng
                        </p>
                        <p>{order.shippingAddress?.fullName} - {order.shippingAddress?.phone}</p>
                        <p className="text-ink-500 dark:text-ink-300">{order.shippingAddress?.addressLine1}</p>
                        <p className="text-ink-500 dark:text-ink-300">{order.shippingAddress?.wardName}, {order.shippingAddress?.provinceName}</p>
                      </div>

                      {/* Action buttons */}
                      {order.status === 'PENDING' && (
                        <div className="mt-5 flex flex-col sm:flex-row justify-end gap-3">
                          <button
                            onClick={() => handleRepay(order.id)}
                            disabled={repayingId !== null}
                            className="btn-primary !py-2.5 text-sm"
                          >
                            {repayingId === order.id ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Đang chuyển hướng...
                              </>
                            ) : (
                              <>
                                <ExternalLink className="h-4 w-4" />
                                Thanh toán ngay
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => setCancelTargetId(order.id)}
                            disabled={cancellingId === order.id}
                            className="btn-danger !py-2.5 text-sm"
                          >
                            {cancellingId === order.id ? 'Đang hủy...' : 'Hủy đơn hàng'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="mt-8 flex justify-center items-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="btn-secondary !px-5 !py-2 text-sm"
          >
            Trước
          </button>
          <span className="px-3 text-sm font-semibold text-ink-600 dark:text-ink-200">Trang {page} / {meta.totalPages}</span>
          <button
            onClick={() => setPage(Math.min(meta.totalPages, page + 1))}
            disabled={page >= meta.totalPages}
            className="btn-secondary !px-5 !py-2 text-sm"
          >
            Sau
          </button>
        </div>
      )}

      <ConfirmDialog
        isOpen={cancelTargetId !== null}
        title="Hủy đơn hàng"
        message="Bạn chắc chắn muốn hủy đơn hàng này? Hành động này không thể hoàn tác."
        confirmLabel="Hủy đơn"
        variant="danger"
        onConfirm={() => handleCancelOrder(cancelTargetId)}
        onCancel={() => setCancelTargetId(null)}
      />
    </div>
  );
};

export default OrderHistory;
