import React, { useState } from 'react';
import { NavLink, Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Users, Settings, LogOut, Menu, X, Shield,
  BarChart3, ScrollText, Package, ClipboardList, FileText, Boxes
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import ThemeToggle from '../../components/ThemeToggle';

const PAGE_TITLES = {
  '/admin': 'Dashboard',
  '/admin/orders': 'Orders',
  '/admin/inventory': 'Inventory',
  '/admin/virtual-boxes': 'Virtual Boxes',
  '/admin/posts': 'Posts',
  '/admin/users': 'User Management',
  '/admin/payment-logs': 'Payment Logs',
  '/admin/sepay-config': 'SePay Configuration'
};

const AdminLayout = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => { await logout(); navigate('/'); };

  const navItems = [
    { to: '/admin', label: 'Dashboard', icon: BarChart3, end: true },
    { to: '/admin/orders', label: 'Orders', icon: ClipboardList },
    { to: '/admin/inventory', label: 'Inventory', icon: Package },
    { to: '/admin/virtual-boxes', label: 'Virtual Boxes', icon: Boxes },
    { to: '/admin/posts', label: 'Posts', icon: FileText },
    { to: '/admin/users', label: 'User Management', icon: Users },
    { to: '/admin/payment-logs', label: 'Payment Logs', icon: ScrollText },
    { to: '/admin/sepay-config', label: 'SePay Configuration', icon: Settings },
  ];

  return (
    <div className="min-h-screen app-bg flex">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden animate-tcg-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={`fixed lg:sticky top-0 lg:h-screen inset-y-0 left-0 z-40 w-64 flex flex-col glass-panel-strong !rounded-none border-r border-subtle transform transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex items-center justify-between h-16 px-5 border-b border-subtle">
          <Link to="/admin" className="flex items-center gap-2.5 group">
            <div className="h-8 w-8 rounded-lg bg-brand-gradient flex items-center justify-center shadow-glow transition-transform duration-300 group-hover:scale-105">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <span className="font-display text-lg font-bold tracking-tight text-strong">Admin Portal</span>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 text-muted hover:text-strong transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-4 border-b border-subtle flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary-500/30 to-fuchsia-500/30 ring-1 ring-primary-300/30 dark:ring-white/15 flex items-center justify-center overflow-hidden">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user?.fullName} className="h-10 w-10 object-cover" />
            ) : (
              <Shield className="h-5 w-5 text-primary-700 dark:text-white/80" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-strong truncate">{user?.fullName}</p>
            <p className="text-xs text-faint truncate">{user?.email}</p>
          </div>
        </div>

        <nav className="mt-4 flex-1 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
                  isActive
                    ? 'bg-gradient-to-r from-primary-600 to-fuchsia-600 text-white shadow-[0_6px_20px_-6px_rgba(124,58,237,0.6)]'
                    : 'text-muted hover:bg-primary-50 dark:hover:bg-white/5 hover:text-strong dark:hover:text-white'
                }`
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-subtle">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium text-muted hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-all duration-300"
          >
            <LogOut className="h-5 w-5" />
            Logout
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 bg-[var(--bg-app-2)] dark:bg-[var(--bg-app-2)]">
        <header className="glass-panel !rounded-none border-b border-subtle h-16 flex items-center gap-3 px-4 lg:px-6 sticky top-16 lg:top-[72px] z-20">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg text-muted hover:bg-ink-900/5 dark:hover:bg-white/10 transition-colors"
          >
            <Menu className="h-6 w-6" />
          </button>
          <h1 className="font-display text-lg font-bold text-strong tracking-tight flex-1 truncate">
            {PAGE_TITLES[location.pathname] || 'Admin Dashboard'}
          </h1>
          <Link to="/" className="hidden sm:inline-flex text-sm font-medium text-muted hover:text-primary-700 dark:hover:text-aura-cyan transition-colors">
            ← Storefront
          </Link>
          <ThemeToggle className="p-2" iconClassName="h-5 w-5" />
        </header>
        <main className="dash-scope flex-1 p-4 lg:p-6 overflow-y-auto"><Outlet /></main>
      </div>
    </div>
  );
};

export default AdminLayout;
