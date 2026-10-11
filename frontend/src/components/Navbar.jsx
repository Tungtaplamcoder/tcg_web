import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  ShoppingCart, Menu, X, User, LogOut, Package, LayoutDashboard,
  ChevronDown, Sparkles, TicketPercent, LogIn, MapPin, Sun, Moon, Globe, UserPlus
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useCartStore } from '../store/useCartStore';
import { useAddressStore } from '../store/useAddressStore';
import { useShop } from '../context/ShopContext';
import { useLanguage } from '../i18n/LanguageContext';
import { useTheme } from '../context/ThemeContext';
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
  const { theme, toggleTheme } = useTheme();
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

  // Mobile drawer: lock body scroll while open, close on Escape, and
  // auto-close if the viewport grows to the desktop navbar breakpoint.
  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    };
    const onResize = () => {
      if (window.innerWidth >= 1280) setMobileMenuOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileMenuOpen]);

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
        <nav data-testid="site-navbar" className="bg-transparent overflow-visible">
          {/* Floating pill: [brand | nav | utilities] — ONLY element with glass */}
          <div
            data-testid="navbar-pill"
            className={`mx-auto mt-4 w-[94%] sm:w-[92%] max-w-7xl px-4 sm:px-6 py-3 rounded-full bg-white/90 backdrop-blur-none md:backdrop-blur-md border border-pink-100/60 flex items-center justify-between gap-2 sm:gap-4 dark:bg-[#1c1216]/80 dark:border-white/10 transition-shadow duration-300 overflow-visible ${
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
            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
              {/* Secondary controls (language / theme / profile) are hidden on
                  phones so the top bar only keeps Logo · Cart · Menu. From md
                  up they return to the bar. On mobile they live in the drawer. */}
              <div className="hidden md:flex items-center gap-3">
                {/* Language — compact VI | EN segment control */}
                <LanguageToggle />

                {/* Theme — icon morph toggle */}
                <ThemeToggle />

                {/* Profile dropdown or ghost login */}
                {isAuthenticated && user ? (
                  <div className="relative" ref={userMenuRef}>
                    <button
                      onClick={() => setUserMenuOpen(!userMenuOpen)}
                      aria-haspopup="menu"
                      aria-expanded={userMenuOpen}
                      aria-label={user.fullName || 'User menu'}
                      data-testid="user-menu-trigger"
                      className={`flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/50 ${
                        userMenuOpen
                          ? 'bg-pink-50 dark:bg-pink-400/10'
                          : 'hover:bg-pink-50/70 dark:hover:bg-white/5'
                      }`}
                    >
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blush-100 to-pink-100 dark:from-pink-400/30 dark:to-blush-500/30 ring-1 ring-pink-200/60 dark:ring-pink-400/30 flex items-center justify-center overflow-hidden">
                        {user.avatarUrl ? (
                          <img src={user.avatarUrl} alt={user.fullName} className="h-8 w-8 rounded-full object-cover" />
                        ) : (
                          <User className="h-[18px] w-[18px] text-pink-600 dark:text-pink-300" />
                        )}
                      </div>
                      <span className="text-sm font-medium text-ink-700 dark:text-ink-200 max-w-[140px] truncate">
                        {user.fullName}
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 text-ink-400 transition-transform duration-300 ${userMenuOpen ? 'rotate-180' : ''}`}
                      />
                    </button>

                    <div
                      data-testid="user-dropdown-menu"
                      className={`absolute right-0 top-full mt-2 w-60 z-[100] origin-top-right bg-white/95 backdrop-blur-md border border-pink-100 text-neutral-800 shadow-xl shadow-pink-500/10 rounded-2xl p-1.5 dark:bg-neutral-900/95 dark:backdrop-blur-md dark:border-neutral-800 dark:text-neutral-100 dark:shadow-2xl transform transition-all duration-200 ease-out ${
                        userMenuOpen
                          ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
                          : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'
                      }`}
                    >
                      <div className="bg-pink-50/60 border-b border-pink-100/80 rounded-xl p-3 mb-1 dark:bg-neutral-800/50 dark:border-neutral-800/80">
                        <p className="font-semibold text-sm text-neutral-900 dark:text-white truncate">{user.fullName}</p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono truncate mt-0.5">{user.email || user.phone}</p>
                      </div>
                      {isAdmin && (
                        <Link
                          to="/admin"
                          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-pink-50 hover:text-pink-600 dark:hover:bg-pink-950/40 dark:hover:text-pink-400 transition-colors"
                          onClick={() => setUserMenuOpen(false)}
                        >
                          <LayoutDashboard className="h-4 w-4 text-pink-500 shrink-0" />
                          <span>Khu vực Admin</span>
                        </Link>
                      )}
                      {isStaff && !isAdmin && (
                        <Link
                          to="/staff"
                          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-pink-50 hover:text-pink-600 dark:hover:bg-pink-950/40 dark:hover:text-pink-400 transition-colors"
                          onClick={() => setUserMenuOpen(false)}
                        >
                          <LayoutDashboard className="h-4 w-4 text-pink-500 shrink-0" />
                          <span>Khu vực Staff</span>
                        </Link>
                      )}
                      <Link
                        to="/orders"
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-pink-50 hover:text-pink-600 dark:hover:bg-pink-950/40 dark:hover:text-pink-400 transition-colors"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <User className="h-4 w-4 text-pink-500 shrink-0" />
                        <span>Hồ sơ</span>
                      </Link>
                      <Link
                        to="/orders"
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-pink-50 hover:text-pink-600 dark:hover:bg-pink-950/40 dark:hover:text-pink-400 transition-colors"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <Package className="h-4 w-4 text-pink-500 shrink-0" />
                        <span>{t('nav.myOrders')}</span>
                      </Link>
                      <Link
                        to="/user/vouchers"
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-pink-50 hover:text-pink-600 dark:hover:bg-pink-950/40 dark:hover:text-pink-400 transition-colors"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <TicketPercent className="h-4 w-4 text-pink-500 shrink-0" />
                        <span>{t('nav.myVouchers')}</span>
                      </Link>
                      <button
                        onClick={handleOpenAddresses}
                        data-testid="user-menu-addresses"
                        className="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-pink-50 hover:text-pink-600 dark:hover:bg-pink-950/40 dark:hover:text-pink-400 transition-colors"
                      >
                        <MapPin className="h-4 w-4 text-pink-500 shrink-0" />
                        <span>{t('nav.addresses')}</span>
                      </button>
                      <button
                        onClick={handleLogout}
                        className="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600"
                      >
                        <LogOut className="h-4 w-4 shrink-0" />
                        <span>Đăng xuất</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-primary-100 dark:border-white/10 text-ink-700 dark:text-ink-200 text-sm font-medium transition-colors hover:text-primary-600 dark:hover:text-primary-400 hover:border-primary-300 dark:hover:border-primary-400/50 hover:bg-primary-50/60 dark:hover:bg-primary-400/10 active:scale-[0.97]"
                  >
                    <LogIn className="h-4 w-4" />
                    {t('nav.login')}
                  </Link>
                )}
              </div>

              {/* Cart — always visible (phone + desktop) */}
              <Link
                to="/cart"
                aria-label={t('nav.cart', { count: totalItems })}
                className="relative p-2.5 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-full text-ink-500 dark:text-ink-300 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50/70 dark:hover:bg-primary-400/10 transition-colors touch-manipulation"
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

              {/* Hamburger — phones/tablets only (nav links appear at xl) */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label={t('nav.menu')}
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-drawer"
                data-testid="mobile-menu-toggle"
                className="xl:hidden p-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-full text-ink-600 dark:text-ink-300 hover:bg-primary-50/70 dark:hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/50 transition-colors touch-manipulation"
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </nav>

      </header>

      {/* ── Mobile slide-out drawer (phones/tablets) ────────────────────
          Opens from the right over a dimmed backdrop. Sections:
          top = profile / auth, middle = primary nav, bottom = settings
          (language + theme). Rendered only while open, so it costs no DOM
          on the storefront when closed. */}
      {mobileMenuOpen && (
        <div className="xl:hidden fixed inset-0 z-[70]" data-testid="mobile-drawer-root">
          <div
            data-testid="mobile-drawer-backdrop"
            aria-hidden="true"
            onClick={() => setMobileMenuOpen(false)}
            className="absolute inset-0 bg-ink-950/50 dark:bg-black/70 backdrop-blur-none md:backdrop-blur-sm animate-tcg-fade-in"
          />
          <aside
            id="mobile-drawer"
            data-testid="mobile-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={t('nav.menu')}
            className="absolute inset-y-0 right-0 flex h-full w-[86%] max-w-sm flex-col bg-white dark:bg-neutral-950 border-l border-pink-100/70 dark:border-white/10 shadow-2xl animate-drawer-in"
          >
            {/* Header — brand + close */}
            <div className="flex items-center justify-between gap-3 h-16 px-4 shrink-0 border-b border-pink-100/60 dark:border-white/10">
              <Link to="/" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2.5 min-w-0">
                {shopLogoUrl ? (
                  <img src={shopLogoUrl} alt={shopName} className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-primary-100 dark:ring-white/10" />
                ) : (
                  <div className="relative h-9 w-9 shrink-0 rounded-full bg-brand-gradient flex items-center justify-center shadow-soft">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                )}
                <span className="font-display text-lg font-bold tracking-tight text-ink-900 dark:text-white truncate">
                  {brandLead && <span className="mr-1">{brandLead}</span>}
                  <span className="text-gradient-brand">{brandTail}</span>
                </span>
              </Link>
              <button
                onClick={() => setMobileMenuOpen(false)}
                data-testid="mobile-drawer-close"
                aria-label={t('common.close')}
                className="p-2.5 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-full text-ink-500 dark:text-ink-300 hover:bg-pink-50 dark:hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/50 transition-colors touch-manipulation"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-4 space-y-5">
              {/* Top: active profile info OR quick login / register */}
              {isAuthenticated && user ? (
                <div data-testid="mobile-drawer-profile" className="rounded-2xl border border-pink-100/70 dark:border-white/10 bg-blush-100/60 dark:bg-primary-400/10 p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 shrink-0 rounded-full bg-gradient-to-br from-blush-100 to-primary-100 dark:from-primary-400/30 dark:to-blush-500/30 ring-1 ring-primary-200/60 dark:ring-primary-400/30 flex items-center justify-center overflow-hidden">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.fullName} className="h-11 w-11 rounded-full object-cover" />
                      ) : (
                        <User className="h-5 w-5 text-primary-700 dark:text-primary-300" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-ink-900 dark:text-white truncate">{user.fullName}</p>
                      <p className="text-xs text-ink-500 dark:text-ink-300 truncate mt-0.5">{user.email || user.phone}</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Link to="/orders" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 px-3 min-h-[44px] rounded-xl bg-white/80 dark:bg-white/5 text-sm font-medium text-ink-700 dark:text-ink-200 touch-manipulation">
                      <Package className="h-4 w-4 text-pink-500" />{t('nav.myOrders')}
                    </Link>
                    <Link to="/user/vouchers" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 px-3 min-h-[44px] rounded-xl bg-white/80 dark:bg-white/5 text-sm font-medium text-ink-700 dark:text-ink-200 touch-manipulation">
                      <TicketPercent className="h-4 w-4 text-pink-500" />{t('nav.myVouchers')}
                    </Link>
                    <button onClick={handleOpenAddresses} className="flex items-center gap-2 px-3 min-h-[44px] rounded-xl bg-white/80 dark:bg-white/5 text-sm font-medium text-ink-700 dark:text-ink-200 touch-manipulation">
                      <MapPin className="h-4 w-4 text-pink-500" />{t('nav.addresses')}
                    </button>
                    <button onClick={handleLogout} className="flex items-center gap-2 px-3 min-h-[44px] rounded-xl bg-white/80 dark:bg-white/5 text-sm font-medium text-rose-600 touch-manipulation">
                      <LogOut className="h-4 w-4" />{t('nav.logout')}
                    </button>
                  </div>
                </div>
              ) : (
                <div data-testid="mobile-drawer-auth" className="grid grid-cols-2 gap-2">
                  <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="inline-flex items-center justify-center gap-2 px-4 min-h-[44px] rounded-2xl border border-pink-200 text-pink-700 dark:border-white/10 dark:text-pink-300 text-sm font-semibold touch-manipulation">
                    <LogIn className="h-4 w-4" />{t('nav.login')}
                  </Link>
                  <Link to="/register" onClick={() => setMobileMenuOpen(false)} className="inline-flex items-center justify-center gap-2 px-4 min-h-[44px] rounded-2xl bg-gradient-to-r from-primary-600 to-primary-400 text-white text-sm font-semibold shadow-soft touch-manipulation">
                    <UserPlus className="h-4 w-4" />{t('nav.register')}
                  </Link>
                </div>
              )}

              {/* Middle: primary navigation */}
              <nav data-testid="mobile-drawer-nav" className="space-y-1">
                {navLinks.map((link) => {
                  const active = isActive(link.to);
                  return (
                    <Link
                      key={link.to}
                      to={link.to}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`block px-3.5 py-3 min-h-[44px] rounded-2xl text-sm font-medium transition-colors touch-manipulation ${
                        active
                          ? 'text-primary-700 dark:text-primary-300 bg-primary-50/70 dark:bg-primary-400/10'
                          : 'text-ink-600 dark:text-ink-300 hover:bg-primary-50/60 dark:hover:bg-white/5 hover:text-primary-600 dark:hover:text-primary-400'
                      }`}
                    >
                      {link.label}
                    </Link>
                  );
                })}
                {hasPrivilege && (
                  <Link
                    to={isAdmin ? '/admin' : '/staff'}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 px-3.5 py-3 min-h-[44px] rounded-2xl border border-primary-100 dark:border-white/10 text-ink-600 dark:text-ink-300 text-sm font-medium touch-manipulation"
                  >
                    <LayoutDashboard className="h-4 w-4 text-pink-500" />
                    {isAdmin ? t('nav.adminPortal') : t('nav.staffPortal')}
                  </Link>
                )}
              </nav>
            </div>

            {/* Bottom: settings row — language + theme */}
            <div data-testid="mobile-drawer-settings" className="shrink-0 border-t border-pink-100/60 dark:border-white/10 p-3">
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-pink-100/70 dark:border-white/10 bg-white/80 dark:bg-neutral-900/80 px-3 py-2.5">
                <span className="inline-flex items-center gap-2">
                  <Globe className="h-4 w-4 text-pink-500" aria-hidden="true" />
                  <LanguageToggle />
                </span>
                <button
                  onClick={toggleTheme}
                  data-testid="mobile-drawer-theme-toggle"
                  aria-label={theme === 'dark' ? t('common.switchToLight') : t('common.switchToDark')}
                  className="inline-flex items-center gap-2 px-3 min-h-[44px] rounded-full text-sm font-medium text-ink-600 dark:text-ink-200 hover:bg-pink-50 dark:hover:bg-white/5 transition-colors touch-manipulation"
                >
                  {theme === 'dark' ? <Sun className="h-5 w-5 text-pink-500" /> : <Moon className="h-5 w-5 text-pink-500" />}
                  {theme === 'dark' ? t('common.themeLight') : t('common.themeDark')}
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
};

export default Navbar;
