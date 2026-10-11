import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DollarSign, ShoppingCart, Users, Package, Loader2, AlertCircle,
  ArrowUpRight, Layers, Boxes, Warehouse
} from 'lucide-react';
import api from '../../services/api';
import { useLanguage } from '../../i18n/LanguageContext';
import { formatVND } from '../../utils/format';
import {
  TILE_CLASS,
  STATUS_PILL,
  ORDER_STATUS_BADGE,
  TrendBadge,
  RevenueLineChart,
  TopViewedWidget
} from '../../components/BentoPieces';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS_VI = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const WEEKDAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/* Stock-health thresholds (average units per active product). */
const LOW_STOCK_AVG = 3;
const HEALTHY_STOCK_AVG = 10;

const parseDateKey = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
};

/* Normalise the API's sparse day rows into a continuous 7-day timeline
   (zero-filled), anchored to the newest day present in the payload. */
const buildRevenueChartData = (revenueByDay, weekdays) => {
  const byKey = new Map();
  let latestKey = null;

  (revenueByDay || []).forEach((entry) => {
    const parts = parseDateKey(entry.date);
    if (!parts) return;
    const key = `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
    byKey.set(key, { revenue: Number(entry.revenue) || 0, orders: Number(entry.orders) || 0 });
    if (!latestKey || key > latestKey) latestKey = key;
  });

  if (!latestKey) return [];

  const anchor = parseDateKey(latestKey);
  const anchorMs = Date.UTC(anchor.year, anchor.month - 1, anchor.day);

  return Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(anchorMs - (6 - i) * DAY_MS);
    const year = dt.getUTCFullYear();
    const month = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const day = String(dt.getUTCDate()).padStart(2, '0');
    const key = `${year}-${month}-${day}`;
    const entry = byKey.get(key) || { revenue: 0, orders: 0 };
    return {
      ...entry,
      label: `${day}/${month}`,
      labelFull: `${day}/${month}/${year}`,
      weekday: weekdays[dt.getUTCDay()]
    };
  });
};

const halfWindowTrend = (series, key) => {
  if (!series || series.length < 4) return null;
  const mid = Math.floor(series.length / 2);
  const prev = series.slice(0, mid).reduce((sum, d) => sum + (Number(d[key]) || 0), 0);
  const curr = series.slice(mid).reduce((sum, d) => sum + (Number(d[key]) || 0), 0);
  if (prev <= 0) return null;
  return Math.round(((curr - prev) / prev) * 100);
};

const AnalyticsDashboard = () => {
  const { t, language } = useLanguage();
  const [stats, setStats] = useState(null);
  const [breakdown, setBreakdown] = useState([]);
  const [topViewed, setTopViewed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const revenueChartData = useMemo(
    () => buildRevenueChartData(stats?.revenueByDay, language === 'en' ? WEEKDAYS_EN : WEEKDAYS_VI),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stats, language]
  );

  const revenueTrend = useMemo(() => halfWindowTrend(revenueChartData, 'revenue'), [revenueChartData]);
  const ordersTrend = useMemo(() => halfWindowTrend(revenueChartData, 'orders'), [revenueChartData]);

  useEffect(() => {
    let cancelled = false;

    const fetchAll = async () => {
      setLoading(true);
      setError('');
      try {
        const statsRes = await api.get('/admin/dashboard/stats');
        if (cancelled) return;
        setStats(statsRes.data.data);
      } catch (err) {
        console.error('Failed to fetch dashboard stats:', err);
        if (!cancelled) setError(t('admin.analytics.noRevenue'));
        if (!cancelled) setLoading(false);
        return;
      }

      // Category & stock breakdown is composed from existing endpoints:
      // two semantic product-category counts (CARD / BOX) + the virtual-box
      // catalogue total. Any failure degrades to an empty chart, never a
      // broken dashboard.
      const safeGet = (url, params) => api.get(url, { params }).then((r) => r).catch(() => null);
      const [cardsRes, sealedRes, boxesRes, topViewedRes] = await Promise.all([
        safeGet('/products', { category: 'CARD', limit: 1 }),
        safeGet('/products', { category: 'BOX', limit: 1 }),
        // Public catalogue count works for every management role and needs
        // no `virtual_box` permission.
        safeGet('/virtual-boxes', { limit: 1 }),
        // Real-time top-viewed items (merged products + virtual boxes).
        safeGet('/admin/analytics/top-viewed', { limit: 3 })
      ]);
      if (cancelled) return;

      const cards = cardsRes?.data?.meta?.totalItems || 0;
      const sealed = sealedRes?.data?.meta?.totalItems || 0;
      const boxes = boxesRes?.data?.data?.meta?.totalItems || 0;

      setBreakdown([
        { name: t('admin.analytics.catSingleCards'), short: t('admin.analytics.catSingleCards'), value: cards, Icon: Layers },
        { name: t('admin.analytics.catSealed'), short: t('admin.analytics.catSealed'), value: sealed, Icon: Package },
        { name: t('admin.analytics.catVirtualBoxes'), short: t('admin.analytics.catVirtualBoxes'), value: boxes, Icon: Boxes }
      ]);
      setTopViewed(topViewedRes?.data?.data?.items || []);
      setLoading(false);
    };

    fetchAll();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-12 w-12 animate-spin text-[#e11d48] dark:text-pink-300" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-4 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-300 rounded-2xl flex items-center">
        <AlertCircle className="h-5 w-5 mr-2" />
        {error || t('admin.analytics.noRevenue')}
      </div>
    );
  }

  const recentOrders = stats.recentOrders || [];

  // Inventory health — average stock units per active product.
  const avgStockPerProduct = stats.totalProducts > 0 ? stats.totalStock / stats.totalProducts : 0;
  const stockHealthPct = Math.min(100, Math.round((avgStockPerProduct / HEALTHY_STOCK_AVG) * 100));
  const stockState = stats.totalStock === 0
    ? { label: t('admin.analytics.stockOut'), className: ORDER_STATUS_BADGE.PENDING }
    : avgStockPerProduct < LOW_STOCK_AVG
      ? { label: t('admin.analytics.stockLow'), className: ORDER_STATUS_BADGE.PACKAGING }
      : { label: t('admin.analytics.stockInStock'), className: ORDER_STATUS_BADGE.DELIVERED };

  return (
    <div className="space-y-5">
      {/* ── Page heading (kept on the canvas for dark-mode contrast) ── */}
      <div data-testid="admin-page-header">
        <h2 className="font-serif italic text-2xl font-bold text-neutral-900 dark:text-pink-50">
          {t('admin.analytics.title')}
        </h2>
        <p className="text-neutral-500 dark:text-pink-200/70 text-sm">{t('admin.analytics.subtitle')}</p>
      </div>

      {/* ── Bento grid — top row: revenue (left) + top-viewed (right) ── */}
      <div data-testid="admin-bento-grid" className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Top-left — Doanh Thu & Đơn Hàng */}
        <section
          data-testid="admin-bento-revenue"
          aria-label={t('admin.analytics.overviewTitle')}
          className={`${TILE_CLASS} lg:col-span-5`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-neutral-400">
                {t('admin.analytics.overviewTitle')}
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                <DollarSign className="h-5 w-5 self-center text-[#e11d48] dark:text-pink-300" />
                <span className="text-3xl font-bold tracking-tight text-ink-900 dark:text-neutral-100">
                  {formatVND(stats.totalRevenue)}
                </span>
              </div>
            </div>
            <TrendBadge value={revenueTrend} suffix={t('admin.analytics.vsPrevDays')} />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
            <span className="inline-flex items-center gap-1.5 text-ink-600 dark:text-neutral-300">
              <ShoppingCart className="h-4 w-4 text-[#ec4899] dark:text-pink-300" />
              <strong className="font-semibold text-ink-900 dark:text-neutral-100">{stats.totalOrders}</strong>
              {t('admin.analytics.orderVolume')}
            </span>
            <span className="inline-flex items-center gap-1.5 text-ink-600 dark:text-neutral-300">
              <Users className="h-4 w-4 text-[#ec4899] dark:text-pink-300" />
              <strong className="font-semibold text-ink-900 dark:text-neutral-100">{stats.totalCustomers}</strong>
              {t('admin.users.customer')}
            </span>
            <TrendBadge value={ordersTrend} />
          </div>

          <div className="mt-4">
            <RevenueLineChart data={revenueChartData} t={t} />
          </div>
        </section>

        {/* Top-right (merged) — Top Sản Phẩm Được Truy Cập Nhiều Nhất */}
        <section
          data-testid="admin-top-viewed-widget"
          aria-label={t('admin.analytics.topViewedTitle')}
          className={`${TILE_CLASS} lg:col-span-7`}
        >
          <TopViewedWidget
            items={topViewed}
            title={t('admin.analytics.topViewedTitle')}
            subtitle={t('admin.analytics.topViewedSubtitle')}
            viewsLabel={t('admin.analytics.views')}
            emptyLabel={t('admin.analytics.noViewedData')}
          />
        </section>

        {/* Bottom-left — Recent Orders */}
        <section
          data-testid="admin-bento-recent-orders"
          aria-label={t('admin.analytics.recentOrders')}
          className={`${TILE_CLASS} lg:col-span-6`}
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-neutral-400">
              {t('admin.analytics.recentOrders')}
            </p>
            <ArrowUpRight className="h-4 w-4 text-[#ec4899] dark:text-pink-300" />
          </div>
          {recentOrders.length > 0 ? (
            <div className="-mx-1 overflow-x-auto">
              <table className="min-w-full divide-y divide-neutral-200 dark:divide-white/10">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold text-ink-400 dark:text-neutral-400 uppercase tracking-wider">{t('admin.analytics.colOrder')}</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold text-ink-400 dark:text-neutral-400 uppercase tracking-wider">{t('admin.analytics.colCustomer')}</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold text-ink-400 dark:text-neutral-400 uppercase tracking-wider">{t('admin.analytics.colTotal')}</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold text-ink-400 dark:text-neutral-400 uppercase tracking-wider min-w-[120px]">{t('admin.analytics.colStatus')}</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold text-ink-400 dark:text-neutral-400 uppercase tracking-wider">{t('admin.analytics.colDate')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-white/5">
                  {recentOrders.slice(0, 5).map((order) => (
                    <tr key={order.id} className="hover:bg-primary-50/50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-3 py-2.5 font-mono text-xs text-ink-600 dark:text-neutral-300">{order.orderCode}</td>
                      <td className="px-3 py-2.5 text-sm text-ink-700 dark:text-neutral-200">{order.customer || order.user?.fullName || order.user?.email}</td>
                      <td className="px-3 py-2.5 text-sm font-semibold text-ink-800 dark:text-neutral-100">{formatVND(order.grandTotal)}</td>
                      <td className="px-3 py-2.5 text-sm whitespace-nowrap min-w-[120px]">
                        <span
                          data-testid="order-status-badge"
                          className={`${STATUS_PILL} ${ORDER_STATUS_BADGE[order.status] || ORDER_STATUS_BADGE.PENDING}`}
                        >
                          {t(`orders.status.${order.status}`) !== `orders.status.${order.status}` ? t(`orders.status.${order.status}`) : order.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-ink-500 dark:text-neutral-400">
                        {new Date(order.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-ink-500 dark:text-neutral-400">{t('admin.analytics.noRecentOrders')}</p>
          )}
        </section>

        {/* Bottom-right — Trạng Thái Tồn Kho & Sản Phẩm */}
        <section
          data-testid="admin-bento-stock-status"
          aria-label={t('admin.analytics.stockStatusTitle')}
          className={`${TILE_CLASS} lg:col-span-6`}
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Warehouse className="h-4 w-4 text-[#ec4899] dark:text-pink-300" />
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-neutral-400">
                {t('admin.analytics.stockStatusTitle')}
              </p>
            </div>
            <Link
              to="/admin/inventory"
              className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[#E11D48] dark:text-pink-300 hover:underline"
            >
              {t('admin.analytics.manageInventory')}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold tracking-tight text-ink-900 dark:text-neutral-100">
                  {stats.totalStock}
                </span>
                <span className="text-sm text-ink-500 dark:text-neutral-400">{t('admin.analytics.stockUnits')}</span>
              </div>
              <p className="mt-1 text-xs text-ink-500 dark:text-neutral-400">
                {stats.totalProducts} {t('admin.analytics.stockProducts')}
              </p>
            </div>
            <span data-testid="stock-status-badge" className={`${STATUS_PILL} ${stockState.className}`}>
              {stockState.label}
            </span>
          </div>

          <div className="mt-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#f472b6] to-[#e11d48] transition-all duration-500"
                style={{ width: `${stockHealthPct}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-ink-400 dark:text-neutral-400">
              {t('admin.analytics.stockHealth')}: {stockHealthPct}%
            </p>
          </div>

          <ul className="mt-auto grid grid-cols-3 gap-2 pt-4">
            {breakdown.map((item, index) => (
              <li key={item.name} className="flex flex-col items-center gap-1 rounded-xl bg-neutral-50 dark:bg-white/5 px-2 py-2.5 text-center">
                <item.Icon className="h-4 w-4" style={{ color: ['#e11d48', '#ec4899', '#f472b6'][index % 3] }} />
                <span className="text-sm font-semibold text-ink-900 dark:text-neutral-100">{item.value}</span>
                <span className="w-full truncate text-[10px] text-ink-500 dark:text-neutral-400" title={item.name}>{item.name}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
