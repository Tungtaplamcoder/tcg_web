import React, { useEffect, useState } from 'react';
import {
  Package,
  AlertCircle,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useLanguage } from '../../i18n/LanguageContext';
import { STATUS_MAP } from '../../constants/orderStatus';
import { formatVND } from '../../utils/format';

const CARD_CLASS =
  'bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md border border-pink-100/70 dark:border-neutral-800 rounded-3xl p-6';

const StaffOverview = () => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [packagingOrders, setPackagingOrders] = useState([]);
  const [packagingOrdersTotal, setPackagingOrdersTotal] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');

      try {
        // Đơn hàng cần xử lý — các đơn đang ở trạng thái "Đang đóng gói"
        try {
          const ordersRes = await api.get('/admin/orders', {
            params: { page: 1, limit: 5, status: 'PACKAGING' }
          });
          setPackagingOrders(ordersRes.data.data?.items || []);
          setPackagingOrdersTotal(ordersRes.data.data?.meta?.totalItems || 0);
        } catch (err) {
          console.error('Failed to fetch packaging orders:', err);
          setPackagingOrders([]);
          setPackagingOrdersTotal(0);
          setError(t('staff.overview.noPackaging'));
        }
      } catch (err) {
        console.error('Unexpected error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [t]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-12 w-12 animate-spin text-[#E11D48] dark:text-pink-300" />
      </div>
    );
  }

  const packagingStatus = STATUS_MAP.PACKAGING;

  return (
    <div className="space-y-6 dark:text-neutral-100">
      {/* ── Page title — single clean heading + subtitle ─────────────── */}
      <div data-testid="staff-page-header">
        <h1
          data-testid="staff-page-title"
          className="text-2xl font-bold text-neutral-900 dark:text-pink-50"
        >
          {t('staff.overview.title')}
        </h1>
        <p className="text-sm text-neutral-500 dark:text-pink-200/70">
          {t('staff.overview.subtitle')}
        </p>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-300 rounded-2xl flex items-center text-sm">
          <AlertCircle className="h-5 w-5 mr-2 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Quick stats ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className={CARD_CLASS}>
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[#E11D48] to-[#F472B6] flex items-center justify-center shadow-[0_8px_20px_-8px_rgba(225,29,72,0.7)]">
              <Package className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-900 dark:text-pink-50">{packagingOrdersTotal}</p>
              <p className="text-sm text-neutral-500 dark:text-pink-200/70">{t('staff.overview.workQueue')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Packaging orders work queue ──────────────────────────────── */}
      <div className={CARD_CLASS}>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-pink-50 flex items-center gap-2">
            <Package className="h-5 w-5 text-[#E11D48] dark:text-pink-300" />
            {t('staff.overview.workQueue')}
            {packagingStatus && (
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${packagingStatus.badgeClass}`}>
                {t(packagingStatus.labelKey)}
              </span>
            )}
          </h2>
          {packagingOrdersTotal > 0 && (
            <Link
              to="/staff/orders?status=PACKAGING"
              className="inline-flex items-center gap-1 text-sm font-medium text-[#E11D48] dark:text-pink-300 hover:underline shrink-0"
            >
              {t('home.viewAll')} ({packagingOrdersTotal})
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
        {!error && packagingOrders.length === 0 ? (
          <p className="text-neutral-500 dark:text-neutral-400">{t('staff.overview.noPackaging')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-pink-100/70 dark:divide-white/10">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-[11px] font-semibold text-ink-400 dark:text-neutral-400 uppercase tracking-wider">{t('staff.overview.colOrder')}</th>
                  <th className="px-4 py-2 text-left text-[11px] font-semibold text-ink-400 dark:text-neutral-400 uppercase tracking-wider">{t('staff.overview.colCustomer')}</th>
                  <th className="px-4 py-2 text-left text-[11px] font-semibold text-ink-400 dark:text-neutral-400 uppercase tracking-wider">{t('staff.overview.colTotal')}</th>
                  <th className="px-4 py-2 text-left text-[11px] font-semibold text-ink-400 dark:text-neutral-400 uppercase tracking-wider">{t('staff.overview.colDate')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pink-100/60 dark:divide-white/5">
                {packagingOrders.map(order => (
                  <tr key={order.id} className="hover:bg-rose-50/50 dark:hover:bg-white/5 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-xs text-ink-600 dark:text-ink-300">{order.orderCode}</td>
                    <td className="px-4 py-2.5 text-sm text-ink-700 dark:text-ink-200">{order.user?.fullName || order.user?.email}</td>
                    <td className="px-4 py-2.5 text-sm font-semibold text-ink-800 dark:text-neutral-100">{formatVND(order.grandTotal)}</td>
                    <td className="px-4 py-2.5 text-sm text-ink-500 dark:text-ink-300">
                      {new Date(order.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default StaffOverview;
