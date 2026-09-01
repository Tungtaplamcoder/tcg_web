import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Package, Home, Loader2, RefreshCw } from 'lucide-react';
import { useCartStore } from '../store/useCartStore';
import api from '../services/api';
import { formatVND } from '../utils/format';

const STATUS_LABELS = {
  PENDING: 'Awaiting payment confirmation',
  PACKAGING: 'Payment confirmed — preparing your order',
  SHIPPING: 'Paid — on its way to you',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled'
};

/**
 * PaymentSuccess — landing page for SePay's return redirect
 * (`${NEXT_PUBLIC_APP_URL}/payment/success?orderId=...`).
 *
 * Renders the success screen IMMEDIATELY (SePay already confirmed the
 * payment server-side via the webhook/IPN — this page is just the browser
 * redirect target), then opportunistically verifies the order status via
 * the API. Verification is best-effort with bounded retries:
 * a slow/missing API response NEVER blocks or times out the page.
 */
const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { clearCart } = useCartStore();
  const orderId = searchParams.get('orderId');

  const [order, setOrder] = useState(null);
  const [verifyState, setVerifyState] = useState('idle'); // idle | loading | confirmed | unavailable
  const attemptsRef = useRef(0);
  const timerRef = useRef(null);

  useEffect(() => {
    clearCart();
  }, [clearCart]);

  // Best-effort status verification — bounded to 6 attempts with a 3s
  // backoff, then gives up gracefully (page already shows success).
  // While the order is still PENDING, also calls POST /orders/:id/sync-payment
  // so the backend re-verifies against SePay (fallback when the webhook is late).
  useEffect(() => {
    if (!orderId) return undefined;

    let cancelled = false;

    const verify = async () => {
      attemptsRef.current += 1;
      try {
        const response = await api.get(`/orders/${encodeURIComponent(orderId)}/payment-status`);
        if (!cancelled) {
          setOrder(response.data?.data || null);
          setVerifyState('confirmed');
        }
      } catch (err) {
        // 404/401/timeout after payment redirect is common (token just
        // refreshed, order lookup by id) — retry a few times, then stop.
        if (cancelled) return;
        if (attemptsRef.current < 4) {
          timerRef.current = setTimeout(verify, 3000);
        } else {
          setVerifyState('unavailable');
        }
      }
    };

    const syncAndVerify = async () => {
      try {
        // Fallback reconciliation — ask backend to re-check SePay directly
        await api.post(`/orders/${encodeURIComponent(orderId)}/sync-payment`);
      } catch {
        // best-effort: sync may fail for guest tokens — ignore
      }
      if (!cancelled) verify();
    };

    setVerifyState('loading');
    syncAndVerify();

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [orderId]);

  const statusKey = order?.status ? String(order.status).toUpperCase() : null;
  const isPaid = statusKey && statusKey !== 'PENDING' && statusKey !== 'CANCELLED';

  return (
    <div className="relative overflow-hidden min-h-[60vh] flex items-center justify-center px-4 py-16">
      <div className="pointer-events-none absolute -top-24 left-1/3 h-72 w-72 rounded-full bg-emerald-300/15 blur-[110px] animate-tcg-float" />
      <div className="pointer-events-none absolute -bottom-24 right-1/4 h-64 w-64 rounded-full bg-primary-400/15 blur-[100px] animate-tcg-float-slow" />

      <div className="relative max-w-md w-full rounded-3xl bg-white/85 dark:bg-[#12121a]/85 backdrop-blur-xl border border-ink-100 dark:border-white/10 shadow-2xl shadow-emerald-900/5 p-8 sm:p-10 text-center animate-tcg-scale-in">
        <div className="relative mx-auto h-16 w-16">
          <div className="absolute inset-0 rounded-full bg-emerald-400/30 blur-xl" />
          <div className="relative h-16 w-16 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 ring-4 ring-white dark:ring-[#14141e] flex items-center justify-center">
            <CheckCircle2 className="h-9 w-9 text-white" />
          </div>
        </div>
        <h1 className="mt-6 heading-display text-2xl">Payment Successful!</h1>
        <p className="mt-2 text-ink-500 dark:text-ink-300 leading-relaxed">
          Your order has been confirmed. We will process and ship your items soon.
        </p>
        {orderId && (
          <p className="mt-3 inline-block text-sm text-ink-400 dark:text-ink-300 rounded-full bg-ink-50 dark:bg-white/5 ring-1 ring-ink-100 dark:ring-white/10 px-4 py-1.5">
            Order ID: <span className="font-mono font-semibold text-ink-700 dark:text-ink-100">{orderId}</span>
          </p>
        )}

        {/* Best-effort verification strip — never blocks the success screen */}
        <div className="mt-4 min-h-[1.5rem] text-sm">
          {verifyState === 'loading' && (
            <span className="inline-flex items-center gap-1.5 text-ink-400 dark:text-ink-300">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Verifying payment…
            </span>
          )}
          {verifyState === 'confirmed' && order && (
            <span className={`inline-flex items-center gap-1.5 ${isPaid ? 'text-emerald-600 dark:text-emerald-400' : 'text-ink-500 dark:text-ink-300'}`}>
              {isPaid ? <CheckCircle2 className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
              {STATUS_LABELS[statusKey] || 'Order received'}
            </span>
          )}
          {verifyState === 'unavailable' && (
            <span className="text-ink-400 dark:text-ink-300">
              We could not reach the server to double-check this order, but your payment reference is saved above.
            </span>
          )}
        </div>

        {order?.grandTotal != null && (
          <p className="mt-1 text-sm font-semibold text-ink-700 dark:text-ink-100">
            Total: {formatVND(Number(order.grandTotal))}
          </p>
        )}

        <div className="mt-8 space-y-3">
          <button onClick={() => navigate('/orders')} className="btn-primary w-full">
            <Package className="h-5 w-5" />
            View My Orders
          </button>
          <button onClick={() => navigate('/')} className="btn-secondary w-full">
            <Home className="h-5 w-5" />
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
