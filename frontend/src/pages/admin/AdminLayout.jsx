import React, { useState } from 'react';
import { NavLink, Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Users, Settings, LogOut, Menu, X, Shield,
  BarChart3, ScrollText, Package, ClipboardList, FileText, Tags
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

const PAGE_TITLES = {
  '/admin': 'Dashboard',
  '/admin/orders': 'Orders',
  '/admin/inventory': 'Inventory',
  '/admin/sets': 'Sản phẩm',
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
    { to: '/admin/sets', label: 'Sản phẩm', icon: Tags },
    { to: '/admin/posts', label: 'Posts', icon: FileText },
    { to: '/admin/users', label: 'User Management', icon: Users },
    { to: '/admin/payment-logs', label: 'Payment Logs', icon: ScrollText },
    { to: '/admin/sepay-config', label: 'SePay Configuration', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#0b0716] flex">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden animate-tcg-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 flex flex-col bg-[#100a1f]/95 backdrop-blur-xl border-r border-white/10 text-white transform transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex items-center justify-between h-16 px-5 border-b border-white/10">
          <Link to="/admin" className="flex items-center gap-2.5 group">
            <div className="h-8 w-8 rounded-lg bg-brand-gradient flex items-center justify-center shadow-glow transition-transform duration-300 group-hover:scale-105">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <span className="font-display text-lg font-bold tracking-tight">Admin Portal</span>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 text-white/60 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-4 border-b border-white/10 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary-500/30 to-fuchsia-500/30 ring-1 ring-white/15 flex items-center justify-center">
            <Shield className="h-5 w-5 text-white/80" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{user?.fullName}</p>
            <p className="text-xs text-white/50 truncate">{user?.email}</p>
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
                    : 'text-white/60 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium text-white/60 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-all duration-300"
          >
            <LogOut className="h-5 w-5" />
            Logout
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 bg-[#faf9fe] lg:rounded-tl-3xl lg:shadow-2xl lg:shadow-black/20">
        <header className="bg-white/80 backdrop-blur-xl border-b border-ink-100 h-16 flex items-center gap-3 px-4 lg:px-6 sticky top-16 lg:top-[72px] z-20">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg text-ink-600 hover:bg-ink-900/5 transition-colors"
          >
            <Menu className="h-6 w-6" />
          </button>
          <h1 className="font-display text-lg font-bold text-ink-900 tracking-tight">
            {PAGE_TITLES[location.pathname] || 'Admin Dashboard'}
          </h1>
        </header>
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto"><Outlet /></main>
      </div>
    </div>
  );
};

export default AdminLayout;
