import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, Minus, Plus, ShoppingBag, ArrowRight, Sparkles } from 'lucide-react';
import { useCartStore } from '../store/useCartStore';
import { useAuthStore } from '../store/useAuthStore';

const Cart = () => {
  const { items, totalItems, updateQuantity, removeItem, clearCart } = useCartStore();
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shippingFee = items.length > 0 ? 2.00 : 0;
  const grandTotal = totalPrice + shippingFee;

  const handleCheckout = () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: '/cart' } });
      return;
    }
    navigate('/checkout');
  };

  if (items.length === 0) {
    return (
      <div className="relative overflow-hidden min-h-[60vh] flex items-center justify-center px-4 py-20">
        <div className="pointer-events-none absolute -top-20 left-1/3 h-72 w-72 rounded-full bg-primary-400/15 blur-[110px] animate-tcg-float" />
        <div className="pointer-events-none absolute -bottom-20 right-1/4 h-64 w-64 rounded-full bg-fuchsia-400/15 blur-[100px] animate-tcg-float-slow" />
        <div className="relative text-center animate-tcg-reveal">
          <div className="mx-auto h-20 w-20 rounded-3xl bg-white/80 backdrop-blur ring-1 ring-ink-100 shadow-glass flex items-center justify-center">
            <ShoppingBag className="h-10 w-10 text-primary-400" />
          </div>
          <h2 className="mt-6 heading-display text-2xl">Your cart is empty</h2>
          <p className="mt-2 text-ink-500">Browse our catalog to find your next chase card.</p>
          <Link to="/catalog" className="btn-primary mt-8">
            Continue Shopping <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 animate-tcg-reveal">
      <div className="flex items-end justify-between mb-7">
        <div>
          <p className="section-eyebrow">Your Bag</p>
          <h1 className="heading-display text-3xl mt-1">Shopping Cart</h1>
        </div>
        <span className="hidden sm:inline-flex items-center gap-2 text-sm font-medium text-ink-500">
          <Sparkles className="h-4 w-4 text-fuchsia-500" />
          {totalItems} item{totalItems !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => (
            <div
              key={`${item.productId}-${item.cardId || 'product'}`}
              className="card-premium flex items-center gap-4 p-4 sm:p-5"
            >
              {/* Image */}
              {item.image ? (
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-xl ring-1 ring-ink-100 shadow-sm flex-shrink-0"
                />
              ) : (
                <div className="w-20 h-20 sm:w-24 sm:h-24 bg-ink-50 ring-1 ring-ink-100 rounded-xl flex items-center justify-center text-ink-300 text-xs flex-shrink-0">
                  No Image
                </div>
              )}

              {/* Details */}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-ink-900 truncate">{item.name}</h3>
                <p className="text-sm text-ink-400 mt-0.5">${Number(item.price).toFixed(2)} each</p>
                <div className="mt-3 inline-flex items-center rounded-lg border border-ink-200 bg-white overflow-hidden">
                  <button
                    onClick={() => updateQuantity(item.productId, item.quantity - 1, item.cardId)}
                    className="p-1.5 text-ink-500 hover:text-primary-700 hover:bg-primary-50 transition-colors"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="px-3.5 text-sm font-bold text-ink-900">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.productId, item.quantity + 1, item.cardId)}
                    className="p-1.5 text-ink-500 hover:text-primary-700 hover:bg-primary-50 transition-colors"
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Price and Remove */}
              <div className="text-right flex flex-col items-end gap-2.5 flex-shrink-0">
                <p className="font-bold text-gradient-brand">${(item.price * item.quantity).toFixed(2)}</p>
                <button
                  onClick={() => removeItem(item.productId, item.cardId)}
                  className="p-1.5 rounded-lg text-ink-300 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  aria-label="Remove item"
                >
                  <Trash2 className="h-[18px] w-[18px]" />
                </button>
              </div>
            </div>
          ))}

          <button
            onClick={clearCart}
            className="text-sm font-medium text-rose-500 hover:text-rose-700 transition-colors inline-flex items-center gap-1.5"
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear Cart
          </button>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 rounded-3xl bg-white/85 backdrop-blur-xl border border-ink-100 shadow-card p-6 sm:p-7">
            <h2 className="heading-display text-lg">Order Summary</h2>
            <div className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between text-ink-600">
                <span>Items ({totalItems})</span>
                <span className="font-semibold text-ink-800">${totalPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-ink-600">
                <span>Shipping Fee</span>
                <span className="font-semibold text-ink-800">${shippingFee.toFixed(2)}</span>
              </div>
              <div className="h-px bg-gradient-to-r from-transparent via-ink-200 to-transparent my-4" />
              <div className="flex justify-between items-baseline">
                <span className="font-semibold text-ink-900">Total</span>
                <span className="text-2xl font-display font-bold text-gradient-brand">${grandTotal.toFixed(2)}</span>
              </div>
            </div>
            <button onClick={handleCheckout} className="btn-primary w-full mt-6">
              Proceed to Checkout <ArrowRight className="h-5 w-5" />
            </button>
            <p className="mt-4 text-center text-xs text-ink-400">
              Secure checkout powered by SePay
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;
