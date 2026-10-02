import React, { useEffect, useState } from 'react';
import {
  X, Mail, Phone, Shield, Calendar, Clock, Wallet, BadgeCheck, MapPin,
  Package, Ticket, Loader2, AlertCircle, UserCog, Check, Star
} from 'lucide-react';
import api from '../services/api';
import { useLanguage } from '../i18n/LanguageContext';
import { PERMISSION_MODULES, resolvePermissions } from '../utils/permissions';

/* ── UserDetailModal ──────────────────────────────────────────────────────
   Read-only admin drawer that aggregates a target user's complete account
   data from GET /admin/users/:id: identity, saved shipping addresses
   (derived from order snapshots), order history summary and owned vouchers.
   Purely presentational — no mutations ever originate from here. */

const ROLE_KEYS = {
  CUSTOMER: 'admin.users.customer',
  STAFF: 'admin.users.staff',
  ADMIN: 'admin.users.admin'
};

const STATUS_KEYS = {
  ACTIVE: 'admin.users.active',
  BANNED: 'admin.users.banned',
  DELETED: 'admin.users.deleted'
};

const ORDER_STATUS_LABELS = {
  PENDING: 'Chờ thanh toán',
  PACKAGING: 'Đang đóng gói',
  SHIPPING: 'Đang giao',
  DELIVERED: 'Đã giao',
  CANCELLED: 'Đã hủy'
};

const ORDER_STATUS_BADGE = {
  PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  PACKAGING: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300',
  SHIPPING: 'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300',
  DELIVERED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  CANCELLED: 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300'
};

const VOUCHER_STATUS_BADGE = {
  ACTIVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  USED: 'bg-gray-200 text-gray-700 dark:bg-white/10 dark:text-gray-300',
  EXPIRED: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
};

const formatCurrency = (value) =>
  `${Number(value || 0).toLocaleString('vi-VN')}₫`;

const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const getRoleBadge = (role) => {
  if (role === 'ADMIN') return 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300';
  if (role === 'STAFF') return 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300';
  return 'bg-gray-100 text-gray-800 dark:bg-white/10 dark:text-gray-300';
};

const getStatusBadge = (status) => {
  if (status === 'ACTIVE') return 'bg-green-100 text-green-800 dark:bg-emerald-500/15 dark:text-emerald-300';
  if (status === 'BANNED') return 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300';
  return 'bg-gray-100 text-gray-800 dark:bg-white/10 dark:text-gray-300';
};

const InfoRow = ({ icon: Icon, label, children }) => (
  <div className="flex items-start gap-3 rounded-2xl border border-pink-100/70 dark:border-neutral-800 bg-white/60 dark:bg-neutral-900/40 px-4 py-3">
    <span className="mt-0.5 h-8 w-8 shrink-0 rounded-xl bg-blush-100 dark:bg-white/5 ring-1 ring-pink-100/80 dark:ring-neutral-700 flex items-center justify-center">
      <Icon className="h-4 w-4 text-primary-600 dark:text-primary-300" />
    </span>
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-ink-400 dark:text-ink-400 font-semibold">{label}</p>
      <div className="mt-0.5 text-sm font-medium text-ink-800 dark:text-gray-100 break-words">{children}</div>
    </div>
  </div>
);

const StatCard = ({ value, label }) => (
  <div className="rounded-2xl border border-pink-100/70 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/50 px-3 py-3 text-center">
    <p className="text-lg font-bold text-ink-900 dark:text-white leading-tight">{value}</p>
    <p className="mt-0.5 text-[11px] font-medium text-ink-400 dark:text-ink-400">{label}</p>
  </div>
);

const UserDetailModal = ({ user, onClose }) => {
  const { t } = useLanguage();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('info');

  useEffect(() => {
    let active = true;
    const fetchDetail = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.get(`/admin/users/${user.id}`);
        if (active) setDetail(response.data.data);
      } catch (err) {
        console.error('Failed to fetch user detail:', err);
        if (active) setError(t('admin.users.detail.error'));
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchDetail();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  const profile = detail?.user || user;
  const summary = detail?.orderSummary || { totalOrders: 0, totalSpent: 0, totalOrderValue: 0 };
  const addresses = detail?.addresses || [];
  const recentOrders = detail?.recentOrders || [];
  const vouchers = detail?.vouchers || [];

  const tabs = [
    { key: 'info', label: t('admin.users.detail.tabInfo') },
    { key: 'addresses', label: t('admin.users.detail.tabAddresses'), count: addresses.length },
    { key: 'orders', label: t('admin.users.detail.tabOrders'), count: summary.totalOrders },
    { key: 'vouchers', label: t('admin.users.detail.tabVouchers'), count: vouchers.length }
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/50 dark:bg-black/70 backdrop-blur-sm animate-tcg-fade-in"
      onMouseDown={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}
    >
      <div
        data-testid="user-detail-modal"
        className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-3xl p-6 shadow-xl bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md border border-pink-100/70 dark:border-neutral-800 animate-tcg-scale-in"
      >
        <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-pink-300/70 to-transparent" />

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-12 w-12 shrink-0 rounded-2xl overflow-hidden bg-gray-100 dark:bg-white/5 ring-1 ring-pink-100/80 dark:ring-neutral-700 flex items-center justify-center">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt="" className="h-12 w-12 object-cover" />
              ) : (
                <UserCog className="h-6 w-6 text-gray-500 dark:text-gray-300" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="font-display font-bold text-lg text-ink-900 dark:text-white truncate">
                {profile.fullName}
              </h3>
              <p data-testid="user-detail-email" className="text-sm text-ink-500 dark:text-ink-300 truncate">
                {profile.email || profile.phone}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${getRoleBadge(profile.role)}`}>
                  {t(ROLE_KEYS[profile.role]) || profile.role}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${getStatusBadge(profile.status)}`}>
                  {t(STATUS_KEYS[profile.status]) || profile.status}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            data-testid="user-detail-close"
            className="p-1.5 rounded-lg text-ink-400 dark:text-ink-300 hover:text-ink-700 dark:hover:text-ink-100 hover:bg-ink-900/5 dark:hover:bg-white/10 transition-colors"
            aria-label={t('common.close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Summary strip */}
        <div data-testid="user-detail-summary" className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatCard value={summary.totalOrders} label={t('admin.users.detail.statOrders')} />
          <StatCard value={formatCurrency(summary.totalSpent)} label={t('admin.users.detail.statSpent')} />
          <StatCard value={addresses.length} label={t('admin.users.detail.statAddresses')} />
          <StatCard value={vouchers.length} label={t('admin.users.detail.statVouchers')} />
        </div>

        {/* Tabs */}
        <div className="mt-4 flex flex-wrap gap-1 border-b border-pink-100/70 dark:border-neutral-800">
          {tabs.map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              data-testid={`detail-tab-${item.key}`}
              className={`relative px-3.5 py-2 text-sm font-semibold rounded-t-lg transition-colors ${
                tab === item.key
                  ? 'text-primary-700 dark:text-primary-300'
                  : 'text-ink-400 dark:text-ink-400 hover:text-ink-700 dark:hover:text-ink-200'
              }`}
            >
              {item.label}
              {typeof item.count === 'number' && (
                <span className="ml-1.5 text-[11px] text-ink-400 dark:text-ink-400">({item.count})</span>
              )}
              {tab === item.key && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-primary-600 to-primary-400" />
              )}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto pt-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-ink-400 dark:text-ink-300">
              <Loader2 className="h-7 w-7 animate-spin text-primary-500" />
              <p className="mt-3 text-sm">{t('admin.users.detail.loading')}</p>
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 p-4 rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-rose-200 text-sm dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30">
              <AlertCircle className="h-5 w-5 shrink-0" />
              {error}
            </div>
          ) : tab === 'info' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="detail-info-panel">
              <InfoRow icon={Mail} label={t('admin.users.detail.email')}>{profile.email || '—'}</InfoRow>
              <InfoRow icon={Phone} label={t('admin.users.detail.phone')}>{profile.phone || '—'}</InfoRow>
              <InfoRow icon={Shield} label={t('admin.users.detail.role')}>
                {t(ROLE_KEYS[profile.role]) || profile.role}
              </InfoRow>
              <InfoRow icon={Shield} label={t('admin.users.detail.status')}>
                {t(STATUS_KEYS[profile.status]) || profile.status}
              </InfoRow>
              <InfoRow icon={Calendar} label={t('admin.users.detail.createdAt')}>{formatDate(profile.createdAt)}</InfoRow>
              <InfoRow icon={Clock} label={t('admin.users.detail.lastActive')}>{formatDate(profile.updatedAt)}</InfoRow>
              <InfoRow icon={Wallet} label={t('admin.users.detail.balance')}>{formatCurrency(profile.balance)}</InfoRow>
              <InfoRow icon={BadgeCheck} label={t('admin.users.detail.emailVerified')}>
                {profile.emailVerified ? t('admin.users.detail.verified') : t('admin.users.detail.unverified')}
              </InfoRow>
              {profile.role !== 'CUSTOMER' && (
                <InfoRow icon={Shield} label={t('admin.users.detail.permissions')}>
                  {PERMISSION_MODULES.map((module, idx) => (
                    <span key={module.key}>
                      {idx > 0 && ' · '}
                      {t(module.labelKey)}: {resolvePermissions(profile)[module.key]
                        ? t('admin.users.detail.yes')
                        : t('admin.users.detail.no')}
                    </span>
                  ))}
                </InfoRow>
              )}
            </div>
          ) : tab === 'addresses' ? (
            <div className="space-y-3" data-testid="detail-addresses-panel">
              {addresses.length === 0 ? (
                <div className="py-12 text-center text-ink-400 dark:text-ink-300">
                  <MapPin className="mx-auto h-7 w-7 text-pink-300" />
                  <p className="mt-3 text-sm">{t('admin.users.detail.noAddresses')}</p>
                </div>
              ) : (
                addresses.map((addr, idx) => (
                  <div
                    key={`${addr.phone}-${idx}`}
                    className="rounded-2xl border border-pink-100/70 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/50 p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-ink-900 dark:text-white">{addr.fullName}</p>
                      <span className="text-ink-300">·</span>
                      <p className="text-sm text-ink-500 dark:text-ink-300">{addr.phone}</p>
                      {addr.isDefault && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300">
                          <Star className="h-3 w-3" />
                          {t('admin.users.detail.defaultAddress')}
                        </span>
                      )}
                      <span className="ml-auto text-[11px] text-ink-400 dark:text-ink-400">
                        {addr.orderCount} {t('admin.users.detail.ordersFromAddress')}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-ink-600 dark:text-ink-200 leading-relaxed">
                      <MapPin className="inline h-3.5 w-3.5 mr-1 text-primary-500" />
                      {[addr.addressLine1, addr.addressLine2, addr.wardName, addr.provinceName].filter(Boolean).join(', ')}
                    </p>
                  </div>
                ))
              )}
            </div>
          ) : tab === 'orders' ? (
            <div className="space-y-4" data-testid="detail-orders-panel">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-pink-100/70 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/50 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400 dark:text-ink-400">{t('admin.users.detail.totalOrders')}</p>
                  <p className="mt-1 text-lg font-bold text-ink-900 dark:text-white">{summary.totalOrders}</p>
                </div>
                <div className="rounded-2xl border border-pink-100/70 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/50 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400 dark:text-ink-400">{t('admin.users.detail.totalSpent')}</p>
                  <p className="mt-1 text-lg font-bold text-ink-900 dark:text-white">{formatCurrency(summary.totalSpent)}</p>
                </div>
                <div className="rounded-2xl border border-pink-100/70 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/50 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400 dark:text-ink-400">{t('admin.users.detail.totalValue')}</p>
                  <p className="mt-1 text-lg font-bold text-ink-900 dark:text-white">{formatCurrency(summary.totalOrderValue)}</p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-ink-700 dark:text-ink-200">{t('admin.users.detail.recentOrders')}</p>
                {recentOrders.length === 0 ? (
                  <div className="py-10 text-center text-ink-400 dark:text-ink-300">
                    <Package className="mx-auto h-7 w-7 text-pink-300" />
                    <p className="mt-3 text-sm">{t('admin.users.detail.noOrders')}</p>
                  </div>
                ) : (
                  <div className="space-y-2" data-testid="detail-order-list">
                    {recentOrders.map((order) => (
                      <div
                        key={order.id}
                        data-testid="detail-order-row"
                        className="flex flex-wrap items-center gap-3 rounded-2xl border border-pink-100/70 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/50 px-4 py-2.5"
                      >
                        <Package className="h-4 w-4 text-primary-500 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-mono text-xs font-semibold text-ink-800 dark:text-gray-100 truncate">{order.orderCode}</p>
                          <p className="text-[11px] text-ink-400 dark:text-ink-400">
                            {formatDate(order.createdAt)} · {order.itemCount} {t('admin.users.detail.orderItems').toLowerCase()}
                          </p>
                        </div>
                        <span className={`ml-auto px-2.5 py-1 rounded-full text-[11px] font-semibold ${ORDER_STATUS_BADGE[order.status] || 'bg-gray-100 text-gray-700'}`}>
                          {ORDER_STATUS_LABELS[order.status] || order.status}
                        </span>
                        <span className="w-full sm:w-auto text-sm font-bold text-ink-900 dark:text-white text-right">
                          {formatCurrency(order.grandTotal)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3" data-testid="detail-vouchers-panel">
              {vouchers.length === 0 ? (
                <div className="py-12 text-center text-ink-400 dark:text-ink-300">
                  <Ticket className="mx-auto h-7 w-7 text-pink-300" />
                  <p className="mt-3 text-sm">{t('admin.users.detail.noVouchers')}</p>
                </div>
              ) : (
                vouchers.map((voucher) => (
                  <div
                    key={voucher.id}
                    className="flex flex-wrap items-center gap-3 rounded-2xl border border-pink-100/70 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/50 p-4"
                  >
                    <span className="h-9 w-9 shrink-0 rounded-xl bg-blush-100 dark:bg-white/5 ring-1 ring-pink-100/80 dark:ring-neutral-700 flex items-center justify-center">
                      <Ticket className="h-4 w-4 text-primary-600 dark:text-primary-300" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-ink-900 dark:text-white truncate">{voucher.title}</p>
                      <p className="font-mono text-xs text-ink-500 dark:text-ink-300">{voucher.code}</p>
                    </div>
                    <span className={`ml-auto px-2.5 py-1 rounded-full text-[11px] font-semibold ${VOUCHER_STATUS_BADGE[voucher.status] || 'bg-gray-100 text-gray-700'}`}>
                      {voucher.status === 'ACTIVE' && t('admin.users.detail.voucherActive')}
                      {voucher.status === 'USED' && t('admin.users.detail.voucherUsed')}
                      {voucher.status === 'EXPIRED' && t('admin.users.detail.voucherExpired')}
                    </span>
                    <span className="text-xs text-ink-400 dark:text-ink-400">
                      {t('admin.users.detail.usageCount')}: {voucher.usageCount}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-pink-100/70 dark:border-neutral-800 pt-4">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-400 dark:text-ink-400">
            <Check className="h-3.5 w-3.5" />
            {t('admin.users.detail.subtitle')}
          </span>
          <button
            onClick={onClose}
            data-testid="user-detail-footer-close"
            className="btn-secondary !px-5 !py-2.5 text-sm"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserDetailModal;
