import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { XCircle, MessageCircle, ShoppingCart, Home } from 'lucide-react';

const PaymentCancel = () => {
  const navigate = useNavigate();

  return (
    <div className="relative overflow-hidden min-h-[60vh] flex items-center justify-center px-4 py-16">
      <div className="pointer-events-none absolute -top-24 left-1/3 h-72 w-72 rounded-full bg-amber-300/15 blur-[110px] animate-tcg-float" />
      <div className="pointer-events-none absolute -bottom-24 right-1/4 h-64 w-64 rounded-full bg-primary-400/15 blur-[100px] animate-tcg-float-slow" />

      <div className="relative max-w-md w-full rounded-3xl bg-white/85 backdrop-blur-xl border border-ink-100 shadow-2xl shadow-amber-900/5 p-8 sm:p-10 text-center animate-tcg-scale-in">
        <div className="relative mx-auto h-16 w-16">
          <div className="absolute inset-0 rounded-full bg-amber-400/30 blur-xl" />
          <div className="relative h-16 w-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 ring-4 ring-white flex items-center justify-center">
            <XCircle className="h-9 w-9 text-white" />
          </div>
        </div>
        <h1 className="mt-6 heading-display text-2xl">Payment Cancelled</h1>
        <p className="mt-2 text-ink-500 leading-relaxed">
          Your payment was cancelled. Your order is still pending and will expire soon.
        </p>
        <div className="mt-8 space-y-3">
          <Link to="/cart" className="btn-primary w-full">
            <ShoppingCart className="h-5 w-5" />
            Return to Cart
          </Link>
          <Link to="/chat" className="btn-secondary w-full">
            <MessageCircle className="h-5 w-5" />
            Contact Support
          </Link>
          <button
            onClick={() => navigate('/')}
            className="w-full inline-flex items-center justify-center gap-2 py-3 text-sm font-medium text-ink-400 hover:text-ink-700 transition-colors"
          >
            <Home className="h-4 w-4" />
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentCancel;
