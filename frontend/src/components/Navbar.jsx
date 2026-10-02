import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  ShoppingCart, Menu, X, User, LogOut, Package, LayoutDashboard,
  ChevronDown, Sparkles, TicketPercent, LogIn, MapPin
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useCartStore } from '../store/useCartStore';
import { useAddressStore } from '../store/useAddressStore';
import { useShop } from '../context/ShopContext';
import { useLanguage } from '../i18n/LanguageContext';
import ThemeToggle from './ThemeToggle';
import LanguageToggle from './LanguageToggle';

/* ── Top Navbar — seamless full-width glass header ───────────────────────
    Fixed full-bleed header (edge-to-edge) with a translucent surface that
    matches the app canvas (#fdfbf7 / #120b0e) and backdrop-blur. Because
    the surface spans the whole viewport there is no floating gutter where
    page content can peek through, and no rounded border/shadow clipping
    against the body — so the top of every page reads as one continuous
    background. A shadow only appears once the page is scrolled, giving
    separation without a permanent border seam.
    Layout: [brand | centered nav | utility group] on md+, flex
    justify-between below. Nav links are minimalist text links with a
    gradient underline that scales in on hover and stays on the active
    route. Order Lookup is a plain text link; Admin/Staff Portal is a
    compact ghost/outline action. Utility group: language segment,
    theme toggle, cart badge, profile dropdown — gap-3, right-aligned.
    A flow spacer (h-16 / h-20) keeps page content below the fixed header
    with zero layout shift for every existing route/layout. */

const Navbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user, isAuthenticated, logout } = useAuthStore();
  const { totalItems } = useCartStore();
  const { setUser: setAddressUser, openManager } = useAddressStore();
  const { shop } = useShop();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const userMenuRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 8);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keep the saved address book bound to the active account so the dropdown
  // modal and the checkout picker always read the right user's addresses.
  useEffect(() => {
    setAddressUser(user?.id ?? null);
  }, [user?.id, setAddressUser]);

  const handleLogout = async () => {
    setUserMenuOpen(false);
    await logout();
    navigate('/');
  };

  const handleOpenAddresses = () => {
    setUserMenuOpen(false);
    openManager();
  };

  const navLinks = [
    { to: '/', label: t('nav.home') },
    { to: '/catalog', label: t('nav.catalog') },
    { to: '/virtual-boxes', label: t('nav.virtualBoxes') },
    { to: '/news', label: t('nav.news') },
    { to: '/order-lookup', label: t('nav.orderLookup') }
  ];

  const isAdmin = user?.role === 'ADMIN';
  const isStaff = user?.role === 'STAFF';
  const hasPrivilege = isAdmin || isStaff;

  const isActive = (to) => (to === '/' ? location.pathname === '/' : location.pathname.startsWith(to));

  // Brand identity — bound to global ShopContext (Admin → Shop Settings)
  const shopName = shop?.shop_name || 'TCG Store';
  const shopLogoUrl = shop?.shop_logo_url || '';
  const trimmedName = shopName.trim();
  const lastSpace = trimmedName.lastIndexOf(' ');
  // Two-tone brand wordmark: the final word carries the vibrant gradient accent.
  const brandLead = lastSpace > 0 ? trimmedName.slice(0, lastSpace) : '';
  const brandTail = lastSpace > 0 ? trimmedName.slice(lastSpace + 1) : trimmedName;

  const underline = (active) =>
    `absolute left-3 right-3 -bottom-0.5 h-0.5 rounded-full bg-gradient-to-r from-primary-600 to-primary-400 origin-left transition-transform duration-300 ${
      active ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
    }`;

  return (
    <>
      {/* ── Floating rounded pill navbar ───────────────────────────────
          The outer full-width wrapper is strictly clean: background
          transparent, NO backdrop filter, NO glass class — so it can never
          paint a translucent band across the viewport behind the pill.
          ALL glass styling (bg-white/80, backdrop-blur-md, border-pink-100/60,
          shadow-sm) lives ONLY on the inner rounded pill, which floats over
          the continuous pastel page gradient. Sticky keeps the pill pinned on
          scroll while staying in flow, so no flow spacer is needed. */}
      <header
        data-testid="site-header"
        className="sticky top-0 z-50 w-full bg-transparent dark:bg-transparent overflow-visible p-0 border-none shadow-none [backdrop-filter:none] [-webkit-backdrop-filter:none]"
      >
        <nav data-testid="site-navbar" className="bg-transparent">
          {/* Floating pill: [brand | nav | utilities] — ONLY element with glass */}
          <div
            data-testid="navbar-pill"
            className={`mx-auto mt-4 w-[92%] max-w-7xl px-6 py-3 rounded-full bg-white/90 backdrop-blur-md border border-pink-100/60 flex items-center justify-between gap-4 dark:bg-[#1c1216]/80 dark:border-white/10 transition-shadow duration-300 ${
              scrolled ? 'shadow-soft-lg dark:shadow-[0_10px_30px_-18px_rgba(0,0,0,0.65)]' : 'shadow-sm'
            }`}
          >
            {/* ── Left: Brand ── */}
            <Link to="/" data-testid="navbar-brand" className="group flex items-center gap-2.5 min-w-0">
              {shopLogoUrl ? (
                <img
                  data-testid="navbar-shop-logo"
                  src={shopLogoUrl}
                  alt={shopName}
                  className="relative h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-primary-100 dark:ring-white/10 transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="relative h-9 w-9 shrink-0 rounded-full bg-brand-gradient flex items-center justify-center shadow-soft transition-transform duration-300 group-hover:scale-105">
                  <Sparkles className="h-5 w-5 text-white" />
                  <div className="absolute inset-0 rounded-full ring-1 ring-inset ring-white/25" />
                </div>
              )}
              <span
                data-testid="navbar-shop-name"
                className="font-display text-xl font-bold tracking-tight text-ink-900 dark:text-white truncate"
              >
                {brandLead && <span className="mr-1">{brandLead}</span>}
                {brandLead && ' '}
                <span className="text-gradient-brand">{brandTail}</span>
              </span>
            </Link>

            {/* ── Center: Primary navigation — minimalist text links ── */}
            <div className="hidden xl:flex items-center gap-1 shrink-0">
              {navLinks.map((link) => {
                const active = isActive(link.to);
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`group relative px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                      active
                        ? 'text-primary-700 dark:text-primary-300'
                        : 'text-ink-600 dark:text-ink-300 hover:text-primary-600 dark:hover:text-primary-400'
                    }`}
                  >
                    {link.label}
                    <span className={underline(active)} />
                  </Link>
                );
              })}
              {hasPrivilege && (
                <Link
                  to={isAdmin ? '/admin' : '/staff'}
                  className="ml-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-primary-100 dark:border-white/10 text-ink-600 dark:text-ink-300 text-sm font-medium whitespace-nowrap transition-colors hover:text-primary-600 dark:hover:text-primary-400 hover:border-primary-300 dark:hover:border-primary-400/50 hover:bg-primary-50/60 dark:hover:bg-primary-400/10"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span>{isAdmin ? t('nav.adminPortal') : t('nav.staffPortal')}</span>
                </Link>
              )}
            </div>

            {/* ── Right: Utility controls + profile ── */}
            <div className="flex items-center gap-3 shrink-0">
              {/* Language — compact VI | EN segment control */}
              <LanguageToggle />

              {/* Theme — icon morph toggle */}
              <ThemeToggle />

              {/* Cart — icon action link with counter badge */}
              <Link
                to="/cart"
                aria-label={t('nav.cart', { count: totalItems })}
                className="relative p-2 rounded-full text-ink-500 dark:text-ink-300 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50/70 dark:hover:bg-primary-400/10 transition-colors"
              >
                <ShoppingCart className="h-5 w-5" />
                {totalItems > 0 && (
                  <span
                    key={totalItems}
                    data-testid="cart-badge"
                    className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-gradient-to-r from-primary-600 to-primary-400 text-white text-[10px] font-bold rounded-full ring-2 ring-white dark:ring-[#1c1216] animate-tcg-badge-pop"
                  >
                    {totalItems}
                  </span>
                )}
              </Link>

              {/* Profile dropdown or ghost login */}
              {isAuthenticated && user ? (
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    aria-haspopup="menu"
                    aria-expanded={userMenuOpen}
                    className={`flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/50 ${
                      userMenuOpen
                        ? 'bg-primary-50 dark:bg-primary-400/10'
                        : 'hover:bg-primary-50/70 dark:hover:bg-white/5'
                    }`}
                  >
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blush-100 to-primary-100 dark:from-primary-400/30 dark:to-blush-500/30 ring-1 ring-primary-200/60 dark:ring-primary-400/30 flex items-center justify-center overflow-hidden">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.fullName} className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <User className="h-[18px] w-[18px] text-primary-700 dark:text-primary-300" />
                      )}
                    </div>
                    <span className="hidden lg:inline text-sm font-medium text-ink-700 dark:text-ink-200 max-w-[120px] truncate">
                      {user.fullName}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 text-ink-400 transition-transform duration-300 ${userMenuOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {userMenuOpen && (
                    <div className="absolute right-0 mt-3 w-60 rounded-2xl bg-white/95 dark:bg-[#1e1318]/95 backdrop-blur-xl border border-primary-100/70 dark:border-white/10 p-1.5 shadow-soft-lg z-50 animate-tcg-scale-in origin-top-right">
                      <div className="px-3.5 py-3 rounded-xl bg-blush-100/70 dark:bg-primary-400/10 mb-1">
                        <p className="text-sm font-bold text-ink-900 dark:text-white truncate">{user.fullName}</p>
                        <p className="text-xs text-ink-500 dark:text-ink-300 truncate mt-0.5">{user.email || user.phone}</p>
                      </div>
                      <Link
                        to="/orders"
                        className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium text-ink-600 dark:text-ink-300 hover:bg-primary-50 dark:hover:bg-white/5 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <Package className="h-4 w-4" />
                        {t('nav.myOrders')}
                      </Link>
                      <Link
                        to="/user/vouchers"
                        className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium text-ink-600 dark:text-ink-300 hover:bg-primary-50 dark:hover:bg-white/5 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <TicketPercent className="h-4 w-4" />
                        {t('nav.myVouchers')}
                      </Link>
                      <button
                        onClick={handleOpenAddresses}
                        data-testid="user-menu-addresses"
                        className="w-full text-left flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium text-ink-600 dark:text-ink-300 hover:bg-primary-50 dark:hover:bg-white/5 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                      >
                        <MapPin className="h-4 w-4" />
                        {t('nav.addresses')}
                      </button>
                      <button
                        onClick={handleLogout}
                        className="w-full text-left flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                      >
                        <LogOut className="h-4 w-4" />
                        {t('nav.logout')}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  to="/login"
                  className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-primary-100 dark:border-white/10 text-ink-700 dark:text-ink-200 text-sm font-medium transition-colors hover:text-primary-600 dark:hover:text-primary-400 hover:border-primary-300 dark:hover:border-primary-400/50 hover:bg-primary-50/60 dark:hover:bg-primary-400/10 active:scale-[0.97]"
                >
                  <LogIn className="h-4 w-4" />
                  {t('nav.login')}
                </Link>
              )}

              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Menu"
                aria-expanded={mobileMenuOpen}
                className="xl:hidden p-2 rounded-full text-ink-600 dark:text-ink-300 hover:bg-primary-50/70 dark:hover:bg-white/5 focus:outline-none transition-colors"
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </nav>

        {/* Mobile menu — floating rounded panel aligned with the pill */}
        <div
          className={`xl:hidden max-w-7xl mx-auto mt-2 overflow-hidden rounded-3xl border bg-white/90 backdrop-blur-md dark:bg-[#1c1216]/90 transition-all duration-300 ease-out ${
            mobileMenuOpen
              ? 'max-h-[480px] opacity-100 border-pink-100/60 shadow-soft-lg dark:border-white/10'
              : 'max-h-0 opacity-0 border-transparent'
          }`}
        >
          <div className="px-3 py-3 space-y-1">
            {navLinks.map((link) => {
              const active = isActive(link.to);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`block px-3 py-2.5 rounded-2xl text-sm font-medium transition-colors ${
                    active
                      ? 'text-primary-700 dark:text-primary-300 bg-primary-50/70 dark:bg-primary-400/10'
                      : 'text-ink-600 dark:text-ink-300 hover:bg-primary-50/60 dark:hover:bg-white/5 hover:text-primary-600 dark:hover:text-primary-400'
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              );
            })}
            {hasPrivilege && (
              <Link
                to={isAdmin ? '/admin' : '/staff'}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-2xl border border-primary-100 dark:border-white/10 text-ink-600 dark:text-ink-300 text-sm font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                <LayoutDashboard className="h-4 w-4" />
                {isAdmin ? t('nav.adminPortal') : t('nav.staffPortal')}
              </Link>
            )}
            {!isAuthenticated && (
              <Link
                to="/login"
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-2xl border border-primary-200 dark:border-primary-400/50 text-primary-700 dark:text-primary-300 text-sm font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                <LogIn className="h-4 w-4" />
                {t('nav.login')}
              </Link>
            )}
          </div>
        </div>
      </header>
    </>
  );
};

export default Navbar;
