import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  ShoppingCart, Menu, X, User, LogOut, Package, LayoutDashboard,
  ChevronDown, Sparkles, TicketPercent, LogIn
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useCartStore } from '../store/useCartStore';
import { useShop } from '../context/ShopContext';
import { useLanguage } from '../i18n/LanguageContext';
import ThemeToggle from './ThemeToggle';
import LanguageToggle from './LanguageToggle';

/* ── Top Navbar — glassmorphism 3-column redesign ────────────────────────
    Fixed h-16 glass header (backdrop-blur, slate hairline border).
    Layout: [brand | centered nav | utility group] on md+, flex
    justify-between below. Nav links are minimalist text links with a
    gradient underline that scales in on hover and stays on the active
    route. Order Lookup is a plain text link; Admin/Staff Portal is a
    compact ghost/outline action. Utility group: language segment,
    theme toggle, cart badge, profile dropdown — gap-3, right-aligned.
    A flow spacer (h-16) keeps page content below the fixed bar with
    zero layout shift for every existing route/layout. */

const Navbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user, isAuthenticated, logout } = useAuthStore();
  const { totalItems } = useCartStore();
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

  const handleLogout = async () => {
    setUserMenuOpen(false);
    await logout();
    navigate('/');
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
    `absolute left-2 right-2 -bottom-0.5 h-0.5 rounded-full bg-gradient-to-r from-purple-600 to-fuchsia-500 origin-left transition-transform duration-300 ${
      active ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
    }`;

  return (
    <>
      {/* Flow spacer — the header itself is fixed; this reserves its 64px */}
      <div className="h-16" aria-hidden="true" />

      <nav
        data-testid="site-navbar"
        className={`fixed top-0 inset-x-0 z-40 h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-800/60 transition-shadow duration-300 ${
          scrolled
            ? 'shadow-[0_8px_30px_-12px_rgba(15,23,42,0.18)] dark:shadow-[0_8px_40px_-10px_rgba(0,0,0,0.6)]'
            : 'shadow-none'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* 3-column grid: [brand | nav | utilities] — flex fallback on mobile */}
          <div className="flex justify-between items-center h-16 md:grid md:grid-cols-[1fr_auto_1fr]">
            {/* ── Left: Brand ── */}
            <Link to="/" data-testid="navbar-brand" className="group flex items-center gap-2.5 min-w-0">
              {shopLogoUrl ? (
                <img
                  data-testid="navbar-shop-logo"
                  src={shopLogoUrl}
                  alt={shopName}
                  className="relative h-9 w-9 rounded-xl object-cover ring-1 ring-slate-200 dark:ring-slate-700 transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="relative h-9 w-9 rounded-xl bg-brand-gradient flex items-center justify-center shadow-glow transition-transform duration-300 group-hover:scale-105">
                  <Sparkles className="h-5 w-5 text-white" />
                  <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/25" />
                </div>
              )}
              <span
                data-testid="navbar-shop-name"
                className="font-display text-xl font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap"
              >
                {brandLead && <span className="mr-1">{brandLead}</span>}
                {brandLead && ' '}
                <span className="text-gradient-brand">{brandTail}</span>
              </span>
            </Link>

            {/* ── Center: Primary navigation — minimalist text links ── */}
            <div className="hidden md:flex items-center justify-self-center gap-1">
              {navLinks.map((link) => {
                const active = isActive(link.to);
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`group relative px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      active
                        ? 'text-purple-700 dark:text-purple-300'
                        : 'text-slate-600 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-400'
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
                  className="ml-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium transition-colors hover:text-purple-600 dark:hover:text-purple-400 hover:border-purple-300 dark:hover:border-purple-500/60 hover:bg-purple-50/60 dark:hover:bg-purple-500/10"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span>{isAdmin ? t('nav.adminPortal') : t('nav.staffPortal')}</span>
                </Link>
              )}
            </div>

            {/* ── Right: Utility controls + profile ── */}
            <div className="flex items-center gap-3 md:justify-self-end">
              {/* Language — compact VI | EN segment control */}
              <LanguageToggle />

              {/* Theme — icon morph toggle */}
              <ThemeToggle />

              {/* Cart — icon action link with counter badge */}
              <Link
                to="/cart"
                aria-label={t('nav.cart', { count: totalItems })}
                className="relative p-2 rounded-full text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50/70 dark:hover:bg-purple-500/10 transition-colors"
              >
                <ShoppingCart className="h-5 w-5" />
                {totalItems > 0 && (
                  <span
                    key={totalItems}
                    className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-gradient-to-r from-purple-600 to-fuchsia-500 text-white text-[10px] font-bold rounded-full ring-2 ring-white dark:ring-slate-900 animate-tcg-badge-pop"
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
                    className={`flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50 ${
                      userMenuOpen
                        ? 'bg-purple-50 dark:bg-purple-500/10'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-100 to-fuchsia-100 dark:from-purple-500/30 dark:to-fuchsia-500/30 ring-1 ring-purple-200/60 dark:ring-purple-500/30 flex items-center justify-center overflow-hidden">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.fullName} className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <User className="h-[18px] w-[18px] text-purple-700 dark:text-purple-300" />
                      )}
                    </div>
                    <span className="hidden lg:inline text-sm font-medium text-slate-700 dark:text-slate-200 max-w-[120px] truncate">
                      {user.fullName}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 text-slate-400 dark:text-slate-500 transition-transform duration-300 ${userMenuOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {userMenuOpen && (
                    <div className="absolute right-0 mt-2 w-60 rounded-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 p-1.5 shadow-xl z-50 animate-tcg-scale-in origin-top-right">
                      <div className="px-3.5 py-3 rounded-lg bg-brand-gradient-soft mb-1">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{user.fullName}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{user.email || user.phone}</p>
                      </div>
                      <Link
                        to="/orders"
                        className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <Package className="h-4 w-4" />
                        {t('nav.myOrders')}
                      </Link>
                      <Link
                        to="/user/vouchers"
                        className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <TicketPercent className="h-4 w-4" />
                        {t('nav.myVouchers')}
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="w-full text-left flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-sm font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
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
                  className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium transition-colors hover:text-purple-600 dark:hover:text-purple-400 hover:border-purple-300 dark:hover:border-purple-500/60 hover:bg-purple-50/60 dark:hover:bg-purple-500/10 active:scale-[0.97]"
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
                className="md:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none transition-colors"
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu — slides below the fixed bar */}
        <div
          className={`md:hidden absolute top-full inset-x-0 overflow-hidden transition-all duration-300 ease-out bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-800/60 ${
            mobileMenuOpen ? 'max-h-[480px] opacity-100 shadow-lg' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="px-4 py-3 space-y-1">
            {navLinks.map((link) => {
              const active = isActive(link.to);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'text-purple-700 dark:text-purple-300 bg-purple-50/70 dark:bg-purple-500/10'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-purple-600 dark:hover:text-purple-400'
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
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                <LayoutDashboard className="h-4 w-4" />
                {isAdmin ? t('nav.adminPortal') : t('nav.staffPortal')}
              </Link>
            )}
            {!isAuthenticated && (
              <Link
                to="/login"
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-purple-300 dark:border-purple-500/60 text-purple-700 dark:text-purple-300 text-sm font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                <LogIn className="h-4 w-4" />
                {t('nav.login')}
              </Link>
            )}
          </div>
        </div>
      </nav>
    </>
  );
};

export default Navbar;
