import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { XCircle, MessageCircle, Home, RotateCcw } from 'lucide-react';

const PaymentError = () => {
  const navigate = useNavigate();

  return (
    <div className="relative overflow-hidden min-h-[60vh] flex items-center justify-center px-4 py-16">
      <div className="pointer-events-none absolute -top-24 right-1/3 h-72 w-72 rounded-full bg-rose-400/15 blur-[110px] animate-tcg-float" />
      <div className="pointer-events-none absolute -bottom-24 left-1/4 h-64 w-64 rounded-full bg-orange-300/15 blur-[100px] animate-tcg-float-slow" />

      <div className="relative max-w-md w-full rounded-3xl bg-white/85 backdrop-blur-xl border border-ink-100 shadow-2xl shadow-rose-900/5 p-8 sm:p-10 text-center animate-tcg-scale-in">
        <div className="relative mx-auto h-16 w-16">
          <div className="absolute inset-0 rounded-full bg-rose-400/30 blur-xl" />
          <div className="relative h-16 w-16 rounded-full bg-gradient-to-br from-rose-400 to-red-600 ring-4 ring-white flex items-center justify-center">
            <XCircle className="h-9 w-9 text-white" />
          </div>
        </div>
        <h1 className="mt-6 heading-display text-2xl">Payment Failed</h1>
        <p className="mt-2 text-ink-500 leading-relaxed">
          There was an error processing your payment. Please try again or contact support.
        </p>
        <div className="mt-8 space-y-3">
          <Link to="/cart" className="btn-primary w-full">
            <RotateCcw className="h-5 w-5" />
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

export default PaymentError;
