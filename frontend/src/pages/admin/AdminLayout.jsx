import React, { useState } from 'react';
import { NavLink, Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Users, Settings, LogOut, Menu, X, Shield, Store, Truck,
  BarChart3, ScrollText, Package, ClipboardList, FileText, Boxes, TicketPercent,
  ArrowLeft, Layers
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useLanguage } from '../../i18n/LanguageContext';
import ThemeToggle from '../../components/ThemeToggle';

/* Route path → i18n key for the sidebar nav labels */
const PAGE_TITLE_KEYS = {
  '/admin': 'admin.pageTitles./admin',
  '/admin/orders': 'admin.pageTitles./admin/orders',
  '/admin/inventory': 'admin.pageTitles./admin/inventory',
  '/admin/catalog': 'admin.pageTitles./admin/catalog',
  '/admin/virtual-boxes': 'admin.pageTitles./admin/virtual-boxes',
  '/admin/posts': 'admin.pageTitles./admin/posts',
  '/admin/users': 'admin.pageTitles./admin/users',
  '/admin/vouchers': 'admin.pageTitles./admin/vouchers',
  '/admin/payment-logs': 'admin.pageTitles./admin/payment-logs',
  '/admin/sepay-config': 'admin.pageTitles./admin/sepay-config',
  '/admin/shop-settings': 'admin.pageTitles./admin/shop-settings',
  '/admin/shipping-settings': 'admin.pageTitles./admin/shipping-settings'
};

const AdminLayout = () => {
  const { user, logout } = useAuthStore();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => { await logout(); navigate('/'); };

  const navItems = [
    { to: '/admin/dashboard', labelKey: PAGE_TITLE_KEYS['/admin'], icon: BarChart3, end: true },
    { to: '/admin/orders', labelKey: PAGE_TITLE_KEYS['/admin/orders'], icon: ClipboardList },
    { to: '/admin/inventory', labelKey: PAGE_TITLE_KEYS['/admin/inventory'], icon: Package },
    { to: '/admin/catalog-settings', labelKey: PAGE_TITLE_KEYS['/admin/catalog'], icon: Layers },
    { to: '/admin/virtual-boxes', labelKey: PAGE_TITLE_KEYS['/admin/virtual-boxes'], icon: Boxes },
    { to: '/admin/posts', labelKey: PAGE_TITLE_KEYS['/admin/posts'], icon: FileText },
    { to: '/admin/users', labelKey: PAGE_TITLE_KEYS['/admin/users'], icon: Users },
    { to: '/admin/vouchers', labelKey: PAGE_TITLE_KEYS['/admin/vouchers'], icon: TicketPercent },
    { to: '/admin/payment-logs', labelKey: PAGE_TITLE_KEYS['/admin/payment-logs'], icon: ScrollText },
    { to: '/admin/sepay-config', labelKey: PAGE_TITLE_KEYS['/admin/sepay-config'], icon: Settings },
    { to: '/admin/shop-settings', labelKey: PAGE_TITLE_KEYS['/admin/shop-settings'], icon: Store },
    { to: '/admin/shipping-settings', labelKey: PAGE_TITLE_KEYS['/admin/shipping-settings'], icon: Truck },
  ].map((item) => ({ ...item, label: t(item.labelKey) }));

  return (
    <div
      data-testid="admin-shell"
      className="min-h-screen app-bg flex bg-gradient-to-b from-[#FFF0F5] via-[#FDFBF7] to-[#FFF0F5] dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950"
    >
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 lg:hidden animate-tcg-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Left Sidebar — white rounded editorial container ─────────── */}
      <aside
        data-testid="admin-sidebar"
        className={`fixed lg:sticky top-0 lg:h-screen inset-y-0 left-0 z-40 w-72 shrink-0 p-3 transform transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="h-full flex flex-col rounded-2xl bg-white dark:bg-neutral-900/90 border border-pink-100/60 dark:border-neutral-800 shadow-soft overflow-hidden dark:text-neutral-100">
          {/* Branding */}
          <div className="flex items-center justify-between px-5 h-16 border-b border-pink-100/60 dark:border-white/10">
            <Link to="/admin" className="flex items-center gap-2.5 group">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#E11D48] to-[#F472B6] flex items-center justify-center shadow-[0_6px_18px_-6px_rgba(225,29,72,0.6)] transition-transform duration-300 group-hover:scale-105">
                <Shield className="h-4 w-4 text-white" />
              </div>
              <span className="font-serif italic text-lg font-bold tracking-tight text-[#9F1239] dark:text-white">
                {t('admin.portalTitle')}
              </span>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1 text-ink-400 hover:text-[#E11D48] transition-colors"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation — mt-6 preserves the intentional gap below the logo */}
          <nav className="mt-6 flex-1 px-3 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
                    isActive
                      ? 'bg-gradient-to-r from-[#E11D48] to-[#F472B6] text-white shadow-[0_8px_20px_-8px_rgba(225,29,72,0.7)]'
                      : 'text-ink-600 dark:text-ink-300 hover:bg-pink-50 dark:hover:bg-white/5 hover:text-[#E11D48] dark:hover:text-white'
                  }`
                }
              >
                <item.icon className="h-[18px] w-[18px]" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Footer — identity + logout (the storefront back-link lives in
              the top-right header only). */}
          <div className="p-3 border-t border-pink-100/60 dark:border-white/10 space-y-2">
            <div data-testid="admin-sidebar-profile" className="flex items-center gap-3 px-2 py-1.5">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#E11D48] to-[#F472B6] ring-1 ring-pink-100 dark:ring-white/15 flex items-center justify-center overflow-hidden shrink-0">
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user?.fullName} className="h-9 w-9 object-cover" />
                ) : (
                  <Shield className="h-4 w-4 text-white/85" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink-800 dark:text-white truncate">{user?.fullName}</p>
                <p className="text-xs text-ink-400 dark:text-ink-300 truncate">{user?.email}</p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3.5 py-2 text-sm font-medium text-ink-500 dark:text-ink-300 hover:text-rose-600 hover:bg-pink-50 dark:hover:bg-rose-500/10 rounded-xl transition-all duration-300"
            >
              <LogOut className="h-[18px] w-[18px]" />
              {t('admin.logout')}
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main column ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Seamless header — transparent, no box, actions right-aligned */}
        <header
          data-testid="admin-header-banner"
          data-variant="seamless"
          className="flex items-center gap-2 sm:gap-3 bg-transparent border-none shadow-none px-4 lg:px-6 pt-4 pb-1"
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 -ml-2 rounded-full text-pink-700 hover:bg-white/70 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Spacer — pushes the action cluster to the top-right corner */}
          <div className="flex-1" />

          <ThemeToggle />
          <Link
            data-testid="admin-back-to-store"
            to="/"
            className="inline-flex items-center gap-1.5 bg-white/80 hover:bg-pink-100/60 text-pink-700 border border-pink-200/60 rounded-full px-4 py-1.5 text-sm font-medium shadow-sm transition-all backdrop-blur-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('admin.backToStore')}
          </Link>
        </header>

        <main className="dash-scope flex-1 p-3 lg:p-4 overflow-y-auto">
          {/* Route-keyed so every navigation replays the GPU slide & fade. */}
          <div
            key={location.pathname}
            data-testid="admin-route-transition"
            className="dash-route-transition"
          >
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
