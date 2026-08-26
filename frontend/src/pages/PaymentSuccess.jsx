import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Package, Home } from 'lucide-react';
import { useCartStore } from '../store/useCartStore';

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { clearCart } = useCartStore();
  const orderId = searchParams.get('orderId');

  useEffect(() => {
    clearCart();
  }, [clearCart]);

  return (
    <div className="relative overflow-hidden min-h-[60vh] flex items-center justify-center px-4 py-16">
      <div className="pointer-events-none absolute -top-24 left-1/3 h-72 w-72 rounded-full bg-emerald-300/15 blur-[110px] animate-tcg-float" />
      <div className="pointer-events-none absolute -bottom-24 right-1/4 h-64 w-64 rounded-full bg-primary-400/15 blur-[100px] animate-tcg-float-slow" />

      <div className="relative max-w-md w-full rounded-3xl bg-white/85 backdrop-blur-xl border border-ink-100 shadow-2xl shadow-emerald-900/5 p-8 sm:p-10 text-center animate-tcg-scale-in">
        <div className="relative mx-auto h-16 w-16">
          <div className="absolute inset-0 rounded-full bg-emerald-400/30 blur-xl" />
          <div className="relative h-16 w-16 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 ring-4 ring-white flex items-center justify-center">
            <CheckCircle2 className="h-9 w-9 text-white" />
          </div>
        </div>
        <h1 className="mt-6 heading-display text-2xl">Payment Successful!</h1>
        <p className="mt-2 text-ink-500 leading-relaxed">
          Your order has been confirmed. We will process and ship your items soon.
        </p>
        {orderId && (
          <p className="mt-3 inline-block text-sm text-ink-400 rounded-full bg-ink-50 ring-1 ring-ink-100 px-4 py-1.5">
            Order ID: <span className="font-mono font-semibold text-ink-700">{orderId}</span>
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
