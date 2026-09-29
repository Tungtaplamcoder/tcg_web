import React, { useEffect, useMemo, useState } from 'react';
import {
  DollarSign, ShoppingCart, Users, Package, Loader2, AlertCircle, TrendingUp, TrendingDown,
  Clock, CheckCircle2, XCircle, Truck, PieChart as PieIcon
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import api from '../../services/api';
import { useLanguage } from '../../i18n/LanguageContext';
import { formatVND } from '../../utils/format';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS_VI = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const WEEKDAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/* Editorial rose / berry / pastel chart palette */
const ROSE_BAR_TOP = '#E11D48';
const ROSE_BAR_BOTTOM = '#F472B6';
const DONUT_COLORS = ['#F472B6', '#E11D48', '#BE123C', '#FDA4BA', '#C084FC'];

// Trích phần ngày "YYYY-MM-DD" từ ISO string ("2026-08-30" | "2026-08-30T00:00:00.000Z")
// để tránh lệch ngày theo timezone của browser khi parse bằng new Date().
const parseDateKey = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
};

// Chuẩn hóa dữ liệu thô thành timeline 7 ngày liên tục (kể cả ngày 0đ), tăng dần theo ngày.
// Anchor về ngày mới nhất trong dữ liệu để khớp với CURRENT_DATE phía server.
const buildRevenueChartData = (revenueByDay, weekdays) => {
  const byKey = new Map();
  let latestKey = null;

  (revenueByDay || []).forEach((entry) => {
    const parts = parseDateKey(entry.date);
    if (!parts) return;
    const key = `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
    byKey.set(key, {
      revenue: Number(entry.revenue) || 0,
      orders: Number(entry.orders) || 0
    });
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

// Nhãn Y-axis gọn: 25020000 -> "25 tr", 1500000 -> "1,5 tr"
const formatVNDCompact = (value) => {
  if (value >= 1e9) return `${(value / 1e9).toFixed(1).replace(/\.0$/, '').replace('.', ',')} tỷ`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1).replace(/\.0$/, '').replace('.', ',')} tr`;
  if (value >= 1e3) return `${Math.round(value / 1e3)}k`;
  return `${value}`;
};

/* Percentage change between the older and newer half of the 7-day series.
   Real, derived from the API payload — never a hardcoded figure. */
const halfWindowTrend = (series, key) => {
  if (!series || series.length < 4) return null;
  const mid = Math.floor(series.length / 2);
  const prev = series.slice(0, mid).reduce((sum, d) => sum + (Number(d[key]) || 0), 0);
  const curr = series.slice(mid).reduce((sum, d) => sum + (Number(d[key]) || 0), 0);
  if (prev <= 0) return null;
  return Math.round(((curr - prev) / prev) * 100);
};

const RevenueTooltip = ({ active, payload, t }) => {
  if (!active || !payload || !payload.length) return null;
  const day = payload[0].payload;
  return (
    <div className="bg-white/95 dark:bg-neutral-900/95 backdrop-blur border border-pink-100 rounded-xl shadow-soft px-3.5 py-2.5">
      <p className="text-xs font-semibold text-ink-500 mb-1">{day.weekday}, {day.labelFull}</p>
      <p className="text-sm font-bold text-[#E11D48] dark:text-pink-300">{formatVND(day.revenue)}</p>
      <p className="text-xs text-ink-500 mt-0.5">{t('admin.analytics.totalOrders')} {day.orders}</p>
    </div>
  );
};

const DonutTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0];
  return (
    <div className="bg-white/95 dark:bg-neutral-900/95 backdrop-blur border border-pink-100 rounded-xl shadow-soft px-3 py-2">
      <p className="text-xs font-semibold text-ink-500">{item.name}</p>
      <p className="text-sm font-bold text-[#E11D48] dark:text-pink-300">{item.value}</p>
    </div>
  );
};

/* Percentage badge — green for growth, soft rose for decline, neutral otherwise */
const TrendBadge = ({ value, suffix }) => {
  if (value === null || value === undefined) return null;
  const up = value >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
        up
          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300'
          : 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300'
      }`}
    >
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? '+' : ''}{value}% {suffix}
    </span>
  );
};

const AnalyticsDashboard = () => {
  const { t, language } = useLanguage();
  const [stats, setStats] = useState(null);
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
    const fetchStats = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.get('/admin/dashboard/stats');
        setStats(response.data.data);
      } catch (err) {
        console.error('Failed to fetch dashboard stats:', err);
        setError(t('admin.analytics.noRevenue'));
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-12 w-12 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-4 bg-red-50 text-red-600 rounded-lg flex items-center">
        <AlertCircle className="h-5 w-5 mr-2" />
        {error || 'Failed to load stats'}
      </div>
    );
  }

  const totalOrderStatuses =
    (stats.pendingOrders || 0) +
    (stats.packagingOrders || 0) +
    (stats.shippingOrders || 0) +
    (stats.deliveredOrders || 0) +
    (stats.cancelledOrders || 0);

  const statusShare = (count) => (totalOrderStatuses > 0 ? Math.round((count / totalOrderStatuses) * 100) : 0);

  const statCards = [
    {
      label: t('admin.analytics.revenue'),
      value: formatVND(stats.totalRevenue),
      icon: DollarSign,
      trend: revenueTrend,
      trendSuffix: t('admin.analytics.vsPrevDays')
    },
    {
      label: t('admin.analytics.totalOrders'),
      value: stats.totalOrders,
      icon: ShoppingCart,
      trend: ordersTrend,
      trendSuffix: t('admin.analytics.vsPrevDays')
    },
    { label: t('admin.users.customer'), value: stats.totalCustomers, icon: Users },
    { label: t('admin.analytics.totalStock'), value: stats.totalStock, icon: Package },
    { label: t('orders.status.PENDING'), value: stats.pendingOrders, icon: Clock, badge: `${statusShare(stats.pendingOrders)}% ${t('admin.analytics.ofOrders')}` },
    { label: t('orders.status.PACKAGING'), value: stats.packagingOrders, icon: Package, badge: `${statusShare(stats.packagingOrders)}% ${t('admin.analytics.ofOrders')}` },
    { label: t('orders.status.SHIPPING'), value: stats.shippingOrders, icon: Truck, badge: `${statusShare(stats.shippingOrders)}% ${t('admin.analytics.ofOrders')}` },
    { label: t('orders.status.DELIVERED'), value: stats.deliveredOrders, icon: CheckCircle2, badge: `${statusShare(stats.deliveredOrders)}% ${t('admin.analytics.ofOrders')}` },
    { label: t('orders.status.CANCELLED'), value: stats.cancelledOrders, icon: XCircle, badge: `${statusShare(stats.cancelledOrders)}% ${t('admin.analytics.ofOrders')}` }
  ];

  const donutData = [
    { name: t('orders.status.PENDING'), value: stats.pendingOrders || 0 },
    { name: t('orders.status.PACKAGING'), value: stats.packagingOrders || 0 },
    { name: t('orders.status.SHIPPING'), value: stats.shippingOrders || 0 },
    { name: t('orders.status.DELIVERED'), value: stats.deliveredOrders || 0 },
    { name: t('orders.status.CANCELLED'), value: stats.cancelledOrders || 0 }
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif italic text-2xl font-bold text-[#9F1239] dark:text-white">{t('admin.analytics.title')}</h2>
        <p className="text-ink-500 dark:text-ink-300 text-sm">{t('admin.analytics.subtitle')}</p>
      </div>

      {/* ── Metric cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="rounded-2xl bg-white dark:bg-neutral-900 border border-pink-100/60 dark:border-white/10 shadow-soft p-5 transition-all duration-300 hover:shadow-soft-lg hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-rose-50 to-pink-100 dark:from-[#E11D48]/35 dark:to-[#F472B6]/25 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-[#E11D48] dark:text-pink-300" />
                </div>
                {card.trend !== undefined && card.trend !== null ? (
                  <TrendBadge value={card.trend} suffix={card.trendSuffix} />
                ) : card.badge ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-[#E11D48] dark:bg-white/5 dark:text-pink-300">
                    {card.badge}
                  </span>
                ) : null}
              </div>
              <p className="mt-4 text-2xl sm:text-[27px] font-bold tracking-tight text-ink-900 dark:text-white">{card.value}</p>
              <p className="mt-1 text-sm text-ink-500 dark:text-ink-300">{card.label}</p>
            </div>
          );
        })}
      </div>

      {/* ── Charts row ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Bar chart — revenue by day */}
        <div className="xl:col-span-2 rounded-2xl bg-white dark:bg-neutral-900 border border-pink-100/60 dark:border-white/10 shadow-soft p-6">
          <h3 className="text-lg font-semibold text-ink-800 dark:text-white mb-4 flex items-center">
            <TrendingUp className="h-5 w-5 mr-2 text-[#E11D48] dark:text-pink-300" />
            {t('admin.analytics.revenue7d')}
          </h3>
          {revenueChartData.length > 0 ? (
            <div className="h-72 w-full">
              <ResponsiveContainer>
                <BarChart data={revenueChartData} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="roseBarGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={ROSE_BAR_TOP} stopOpacity={0.95} />
                      <stop offset="100%" stopColor={ROSE_BAR_BOTTOM} stopOpacity={0.55} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12, fill: '#b8a6ae' }}
                    axisLine={{ stroke: 'var(--chart-axis)' }}
                    tickLine={false}
                    interval={0}
                    tickMargin={8}
                  />
                  <YAxis
                    tickFormatter={formatVNDCompact}
                    tick={{ fontSize: 12, fill: '#b8a6ae' }}
                    axisLine={false}
                    tickLine={false}
                    width={56}
                    tickMargin={4}
                  />
                  <Tooltip content={<RevenueTooltip t={t} />} cursor={{ fill: 'rgba(244,114,182,0.10)' }} />
                  <Bar
                    dataKey="revenue"
                    fill="url(#roseBarGradient)"
                    radius={[8, 8, 2, 2]}
                    maxBarSize={46}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-ink-500">{t('admin.analytics.noRevenue')}</p>
          )}
        </div>

        {/* Donut — order status distribution */}
        <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-pink-100/60 dark:border-white/10 shadow-soft p-6">
          <h3 className="text-lg font-semibold text-ink-800 dark:text-white mb-4 flex items-center">
            <PieIcon className="h-5 w-5 mr-2 text-[#E11D48] dark:text-pink-300" />
            {t('admin.analytics.orderDistribution')}
          </h3>
          {donutData.length > 0 ? (
            <>
              <div className="relative h-52 w-full">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={donutData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={62}
                      outerRadius={92}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {donutData.map((entry, index) => (
                        <Cell key={entry.name} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<DonutTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-ink-900 dark:text-white">{totalOrderStatuses}</span>
                  <span className="text-[11px] uppercase tracking-wider text-ink-400">{t('admin.analytics.totalOrders')}</span>
                </div>
              </div>
              <ul className="mt-4 space-y-2">
                {donutData.map((entry, index) => (
                  <li key={entry.name} className="flex items-center gap-2.5 text-sm">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: DONUT_COLORS[index % DONUT_COLORS.length] }}
                    />
                    <span className="text-ink-500 dark:text-ink-300 flex-1 truncate">{entry.name}</span>
                    <span className="font-semibold text-ink-800 dark:text-white">{entry.value}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-ink-500">{t('admin.analytics.noRecentOrders')}</p>
          )}
        </div>
      </div>

      {/* ── Recent orders table ──────────────────────────────────── */}
      <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-pink-100/60 dark:border-white/10 shadow-soft p-6">
        <h3 className="text-lg font-semibold text-ink-800 dark:text-white mb-4">{t('admin.analytics.recentOrders')}</h3>
        {stats.recentOrders && stats.recentOrders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-pink-100/70 dark:divide-white/10">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-[11px] font-semibold text-ink-400 uppercase tracking-wider">{t('admin.analytics.colOrder')}</th>
                  <th className="px-4 py-2 text-left text-[11px] font-semibold text-ink-400 uppercase tracking-wider">{t('admin.analytics.colCustomer')}</th>
                  <th className="px-4 py-2 text-left text-[11px] font-semibold text-ink-400 uppercase tracking-wider">{t('admin.analytics.colTotal')}</th>
                  <th className="px-4 py-2 text-left text-[11px] font-semibold text-ink-400 uppercase tracking-wider">{t('admin.analytics.colStatus')}</th>
                  <th className="px-4 py-2 text-left text-[11px] font-semibold text-ink-400 uppercase tracking-wider">{t('admin.analytics.colDate')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pink-100/60 dark:divide-white/5">
                {stats.recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-rose-50/50 dark:hover:bg-white/5 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-xs text-ink-600 dark:text-ink-300">{order.orderCode}</td>
                    <td className="px-4 py-2.5 text-sm text-ink-700 dark:text-ink-200">{order.customer || order.user?.email}</td>
                    <td className="px-4 py-2.5 text-sm font-semibold text-ink-800 dark:text-white">{formatVND(order.grandTotal)}</td>
                    <td className="px-4 py-2.5 text-sm">
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-[#E11D48] dark:bg-white/5 dark:text-pink-300">
                        {t(`orders.status.${order.status}`) !== `orders.status.${order.status}` ? t(`orders.status.${order.status}`) : order.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-ink-500 dark:text-ink-300">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-ink-500">{t('admin.analytics.noRecentOrders')}</p>
        )}
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
