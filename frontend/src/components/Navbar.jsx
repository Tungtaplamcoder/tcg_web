import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ShoppingCart, Menu, X, User, LogOut, Package, LayoutDashboard, ChevronDown, Sparkles } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useCartStore } from '../store/useCartStore';
import ThemeToggle from './ThemeToggle';

const Navbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user, isAuthenticated, logout } = useAuthStore();
  const { totalItems } = useCartStore();
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
    { to: '/', label: 'Home' },
    { to: '/catalog', label: 'Catalog' },
    { to: '/news', label: 'News' },
    { to: '/order-lookup', label: 'Order Lookup' }
  ];

  const isAdmin = user?.role === 'ADMIN';
  const isStaff = user?.role === 'STAFF';
  const hasPrivilege = isAdmin || isStaff;

  const isActive = (to) => (to === '/' ? location.pathname === '/' : location.pathname.startsWith(to));

  return (
    <nav
      className={`sticky top-0 z-40 transition-all duration-500 ${
        scrolled
          ? 'glass-panel shadow-[0_8px_30px_-12px_rgba(15,23,42,0.18)] dark:shadow-[0_8px_40px_-10px_rgba(0,0,0,0.6)]'
          : 'glass-panel'
      } border-b border-subtle`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 lg:h-[72px]">
          {/* Logo */}
          <Link to="/" className="group flex items-center gap-2.5">
            <div className="relative h-9 w-9 rounded-xl bg-brand-gradient flex items-center justify-center shadow-glow transition-transform duration-300 group-hover:scale-105">
              <Sparkles className="h-5 w-5 text-white" />
              <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/25" />
            </div>
            <span className="font-display text-[22px] font-bold tracking-tight text-ink-900 dark:text-white">
              TCG<span className="text-gradient-brand">Store</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`relative px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 ${
                  isActive(link.to)
                    ? 'text-primary-700 bg-primary-50 ring-1 ring-primary-200/70 dark:bg-white/10 dark:text-white'
                    : 'text-ink-500 dark:text-ink-300 hover:text-ink-900 dark:text-white hover:bg-ink-900/5 dark:text-ink-300 dark:hover:text-white dark:hover:bg-white/10'
                }`}
              >
                {link.label}
              </Link>
            ))}
            {hasPrivilege && (
              <Link
                to={isAdmin ? '/admin' : '/staff'}
                className="ml-1 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-primary-600 to-fuchsia-600 shadow-[0_6px_16px_-6px_rgba(124,58,237,0.6)] transition-all duration-300 hover:shadow-glow hover:brightness-110"
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>{isAdmin ? 'Admin Portal' : 'Staff Portal'}</span>
              </Link>
            )}
          </div>

          {/* Right icons */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Theme toggle — animated icon morph */}
            <ThemeToggle />

            {/* Cart */}
            <Link
              to="/cart"
              aria-label={`Cart with ${totalItems} items`}
              className="relative p-2.5 rounded-full text-ink-500 hover:text-primary-700 hover:bg-primary-50 transition-all duration-300 dark:text-ink-300 dark:hover:text-white dark:hover:bg-white/10"
            >
              <ShoppingCart className="h-[22px] w-[22px]" />
              {totalItems > 0 && (
                <span
                  key={totalItems}
                  className="absolute -top-0.5 -right-0.5 min-w-[20px] h-5 px-1 flex items-center justify-center bg-gradient-to-r from-fuchsia-600 to-pink-500 text-white text-[11px] font-bold rounded-full ring-2 ring-white dark:ring-[#0a0a0f] shadow-glow animate-tcg-badge-pop"
                >
                  {totalItems}
                </span>
              )}
            </Link>

            {/* User menu or login */}
            {isAuthenticated && user ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className={`flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full transition-all duration-300 focus:outline-none ${
                    userMenuOpen ? 'bg-primary-50 ring-1 ring-primary-200 dark:bg-white/10' : 'hover:bg-ink-900/5 dark:hover:bg-white/10'
                  }`}
                >
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary-100 to-fuchsia-100 ring-1 ring-primary-200/60 flex items-center justify-center overflow-hidden">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user.fullName} className="h-8 w-8 rounded-full object-cover" />
                    ) : (
                      <User className="h-[18px] w-[18px] text-primary-700" />
                    )}
                  </div>
                  <span className="hidden sm:inline text-sm font-semibold text-ink-700 dark:text-ink-100 max-w-[140px] truncate">
                    {user.fullName}
                  </span>
                  <ChevronDown className={`h-4 w-4 text-ink-400 dark:text-ink-300 transition-transform duration-300 ${userMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 rounded-2xl glass-panel-strong p-1.5 z-50 animate-tcg-scale-in origin-top-right">
                    <div className="px-4 py-3 rounded-xl bg-brand-gradient-soft mb-1">
                      <p className="text-sm font-bold text-strong truncate">{user.fullName}</p>
                      <p className="text-xs text-muted truncate mt-0.5">{user.email}</p>
                    </div>
                    <Link
                      to="/orders"
                      className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium text-muted hover:bg-primary-50 hover:text-primary-700 dark:hover:bg-white/10 dark:hover:text-white transition-colors"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <Package className="h-4 w-4" />
                      My Orders
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/login"
                className="hidden sm:inline-flex items-center px-5 py-2.5 rounded-full bg-ink-900 text-white text-sm font-semibold transition-all duration-300 hover:bg-ink-800 hover:shadow-glow active:scale-[0.97] dark:bg-white/10 dark:text-white dark:ring-1 dark:ring-white/15 dark:hover:bg-white/20"
              >
                Login
              </Link>
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl text-ink-600 dark:text-ink-200 hover:bg-ink-900/5 dark:hover:bg-white/10 focus:outline-none transition-colors"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-300 ease-out ${
          mobileMenuOpen ? 'max-h-[480px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-4 pb-5 pt-2 space-y-1.5 glass-panel border-t border-subtle">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`block px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                isActive(link.to)
                  ? 'bg-primary-50 text-primary-700 ring-1 ring-primary-200/70 dark:bg-white/10 dark:text-white'
                  : 'text-ink-600 dark:text-ink-200 hover:bg-ink-900/5 dark:text-ink-300 dark:hover:bg-white/10'
              }`}
              onClick={() => setMobileMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          {hasPrivilege && (
            <Link
              to={isAdmin ? '/admin' : '/staff'}
              className="block px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-primary-600 to-fuchsia-600"
              onClick={() => setMobileMenuOpen(false)}
            >
              {isAdmin ? 'Admin Portal' : 'Staff Portal'}
            </Link>
          )}
          {!isAuthenticated && (
            <Link
              to="/login"
              className="block px-4 py-2.5 rounded-xl text-sm font-semibold text-primary-700 bg-primary-50 ring-1 ring-primary-200/70"
              onClick={() => setMobileMenuOpen(false)}
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
