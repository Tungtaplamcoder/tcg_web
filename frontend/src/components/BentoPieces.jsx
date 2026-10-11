import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, TrendingDown, Eye, Image as ImageIcon } from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  RadialBarChart, RadialBar, PolarAngleAxis, BarChart, Bar, Cell
} from 'recharts';
import { formatVND } from '../utils/format';

/* ── Mobile chart discipline ───────────────────────────────────────────
   Recharts' mount/entrance animation + animated tooltip are pure JS/SVG
   paint work, which is the #1 cause of first-paint frame drops on phone
   GPUs and of layout thrash during touch scroll. On narrow/touch viewports
   every series renders statically (`isAnimationActive=false`) and each
   chart lives in a fixed-height box so the container never re-measures. */
const useIsNarrow = () => {
  const [narrow, setNarrow] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 768px)').matches
      : false
  );
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia('(max-width: 768px)');
    const onChange = (e) => setNarrow(e.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);
  return narrow;
};

/* ── NeuroBento design tokens ──────────────────────────────────────────
   Strict editorial pastel-pink palette only. No blue / green / gold /
   yellow anywhere — every accent resolves to a rose/pink shade. */

export const ROSE = Object.freeze({
  strong: '#ec4899',
  deep: '#e11d48',
  soft: '#f472b6',
  light: '#fda4ba',
  berry: '#be123c',
  muted: '#fbcfe8'
});

/* Bar series share one pink family so the chart reads as a single hue. */
export const CATEGORY_COLORS = Object.freeze(['#e11d48', '#ec4899', '#f472b6']);

/* Shared fixed bento tile chrome: light = white + neutral hairline,
   dark = neutral-900/90 + neutral-800 hairline (brand constraint). */
export const TILE_CLASS =
  'relative flex flex-col rounded-3xl bg-white dark:bg-neutral-900/90 border border-neutral-200 dark:border-neutral-800 shadow-soft p-5 dark:text-neutral-100 transition-all duration-300 hover:shadow-soft-lg';

/* Order-status pill typography shared by every dashboard table. `nowrap`
   + fixed horizontal padding guarantee the label never wraps onto a second
   line (which would stretch the pill into an oval) at any viewport width. */
export const STATUS_PILL =
  'whitespace-nowrap inline-flex items-center justify-center px-2.5 py-1 text-xs font-medium rounded-full';

/* Pastel-pink / neutral status chips — dual-theme, high-contrast. */
export const ORDER_STATUS_BADGE = Object.freeze({
  PENDING: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700',
  PACKAGING: 'bg-pink-50 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300 border border-pink-200 dark:border-pink-800',
  SHIPPING: 'bg-pink-100 text-pink-700 dark:bg-pink-950/80 dark:text-pink-300 border border-pink-200 dark:border-pink-800',
  DELIVERED: 'bg-pink-100 text-pink-700 dark:bg-pink-950/80 dark:text-pink-300 border border-pink-200 dark:border-pink-800',
  CANCELLED: 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700 line-through'
});

/* 25020000 → "25 tr", 1500000 → "1,5 tr" (Vietnamese compact money). */
export const formatVNDCompact = (value) => {
  const n = Number(value) || 0;
  if (n >= 1e9) return `${(n / 1e9).toFixed(1).replace(/\.0$/, '').replace('.', ',')} tỷ`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '').replace('.', ',')} tr`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}k`;
  return `${n}`;
};

/* Percentage badge — pink in both directions; the icon carries meaning
   so the palette never leaks a green/red theme. */
export const TrendBadge = ({ value, suffix }) => {
  if (value === null || value === undefined) return null;
  const up = value >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
        up
          ? 'bg-primary-50 text-[#be123c] dark:bg-primary-500/15 dark:text-pink-200'
          : 'bg-neutral-100 text-neutral-500 dark:bg-white/5 dark:text-neutral-400'
      }`}
    >
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? '+' : ''}{value}%{suffix ? ` ${suffix}` : ''}
    </span>
  );
};

const RevenueTooltip = ({ active, payload, t }) => {
  if (!active || !payload || !payload.length) return null;
  const day = payload[0].payload;
  return (
    <div className="bg-white/95 dark:bg-neutral-900/95 backdrop-blur border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-soft px-3.5 py-2.5">
      <p className="text-xs font-semibold text-ink-500 dark:text-neutral-300 mb-1">{day.weekday}, {day.labelFull}</p>
      <p className="text-sm font-bold text-[#e11d48] dark:text-pink-300">{formatVND(day.revenue)}</p>
      <p className="text-xs text-ink-500 dark:text-neutral-300 mt-0.5">
        {t('admin.analytics.totalOrders')} {day.orders}
      </p>
    </div>
  );
};

/* GPU-light Recharts area line — the "Balance & Revenue" widget body. */
export const RevenueLineChart = ({ data, t }) => {
  const isNarrow = useIsNarrow();
  return (
    <div className="h-[220px] md:h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="bentoRevenueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ROSE.strong} stopOpacity={0.35} />
              <stop offset="100%" stopColor={ROSE.strong} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#b8a6ae' }}
            axisLine={{ stroke: 'var(--chart-axis)' }}
            tickLine={false}
            interval={0}
            tickMargin={8}
          />
          <YAxis
            tickFormatter={formatVNDCompact}
            tick={{ fontSize: 11, fill: '#b8a6ae' }}
            axisLine={false}
            tickLine={false}
            width={52}
            tickMargin={4}
          />
          <Tooltip
            content={<RevenueTooltip t={t} />}
            cursor={{ stroke: 'rgba(244,114,182,0.45)' }}
            isAnimationActive={false}
            animationDuration={0}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke={ROSE.strong}
            strokeWidth={2.5}
            fill="url(#bentoRevenueFill)"
            dot={false}
            activeDot={{ r: 4, fill: ROSE.deep, stroke: '#fff', strokeWidth: 1.5 }}
            isAnimationActive={!isNarrow}
            animationDuration={isNarrow ? 0 : 600}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

/* Semi-circle radial gauge (Recharts RadialBar, 180°→0°). */
export const RadialGauge = ({ percent = 0, completedLabel, caption }) => {
  const isNarrow = useIsNarrow();
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const data = [{ name: 'goal', value: clamped }];
  return (
    <div className="relative h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          innerRadius="74%"
          outerRadius="102%"
          data={data}
          startAngle={180}
          endAngle={0}
          cy="82%"
        >
          <defs>
            <linearGradient id="bentoGaugeFill" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={ROSE.soft} />
              <stop offset="100%" stopColor={ROSE.deep} />
            </linearGradient>
          </defs>
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar
            dataKey="value"
            cornerRadius={999}
            barSize={18}
            background={{ fill: 'rgba(244,114,182,0.14)' }}
            fill="url(#bentoGaugeFill)"
            isAnimationActive={!isNarrow}
            animationDuration={isNarrow ? 0 : 800}
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex flex-col items-center">
        <span className="text-3xl font-bold tracking-tight text-ink-900 dark:text-neutral-100">{clamped}%</span>
        <span className="text-[11px] uppercase tracking-wider text-ink-400 dark:text-neutral-400">{completedLabel}</span>
        {caption && <span className="mt-0.5 text-xs text-ink-500 dark:text-neutral-400">{caption}</span>}
      </div>
    </div>
  );
};

/* Vertical bar breakdown — Single Cards / Sealed / Virtual Boxes. */
export const CategoryBars = ({ data }) => {
  const isNarrow = useIsNarrow();
  return (
    <div className="h-[220px] md:h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
          <XAxis
            dataKey="short"
            tick={{ fontSize: 11, fill: '#b8a6ae' }}
            axisLine={{ stroke: 'var(--chart-axis)' }}
            tickLine={false}
            interval={0}
            tickMargin={8}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#b8a6ae' }}
            axisLine={false}
            tickLine={false}
            width={40}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: 'rgba(244,114,182,0.10)' }}
            contentStyle={{
              background: 'rgba(255,255,255,0.96)',
              border: '1px solid #e5e5e5',
              borderRadius: 12,
              fontSize: 12
            }}
            labelStyle={{ color: '#78706a', fontWeight: 600 }}
            formatter={(value, name, props) => [value, props?.payload?.name || name]}
            isAnimationActive={false}
            animationDuration={0}
          />
          <Bar
            dataKey="value"
            radius={[8, 8, 0, 0]}
            maxBarSize={52}
            isAnimationActive={!isNarrow}
            animationDuration={isNarrow ? 0 : 600}
          >
            {data.map((entry, index) => (
              <Cell key={entry.name} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

/* Real-time Top-3 most-viewed items (products + virtual boxes). Renders a
   horizontal showcase: rank pill, compact slab thumbnail (object-contain),
   title, set/rarity tag, category and the live view counter. */
export const TopViewedWidget = ({ items = [], title, subtitle, viewsLabel, emptyLabel }) => (
  <div className="flex h-full flex-col">
    <div className="mb-4 flex items-start gap-2.5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-50 dark:bg-primary-500/15">
        <TrendingUp className="w-5 h-5 text-pink-500" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink-800 dark:text-neutral-100">{title}</p>
        <p className="text-xs text-ink-400 dark:text-neutral-400">{subtitle}</p>
      </div>
    </div>

    {items.length === 0 ? (
      <p className="text-sm text-ink-500 dark:text-neutral-400">{emptyLabel}</p>
    ) : (
      <div data-testid="top-viewed-list" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {items.slice(0, 3).map((item, index) => (
          <Link
            key={`${item.type}-${item.id}`}
            to={item.href || '#'}
            data-testid={`top-viewed-item-${index + 1}`}
            className="group flex flex-col rounded-2xl border border-pink-100 dark:border-neutral-800 bg-neutral-50 dark:bg-white/5 p-3 transition-all duration-300 hover:shadow-soft-lg hover:-translate-y-0.5"
          >
            <div className="relative flex h-28 w-full items-center justify-center overflow-hidden rounded-xl bg-white dark:bg-neutral-900/60">
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  loading="lazy"
                  className="h-full w-full object-contain p-2"
                />
              ) : (
                <ImageIcon className="h-8 w-8 text-pink-300" />
              )}
              <span className="absolute left-2 top-2 inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-rose-500 px-1.5 text-[11px] font-bold text-white shadow-md">
                #{index + 1}
              </span>
            </div>

            <p className="mt-2.5 truncate text-sm font-semibold text-ink-800 dark:text-neutral-100" title={item.name}>
              {item.name}
            </p>

            <div className="mt-1 flex min-w-0 items-center gap-1.5">
              {item.tag && (
                <span className="shrink-0 rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-semibold text-[#be123c] dark:bg-primary-500/15 dark:text-pink-200">
                  {item.tag}
                </span>
              )}
              <span className="truncate text-[11px] text-ink-400 dark:text-neutral-400">{item.category}</span>
            </div>

            <span className="mt-2 inline-flex items-center gap-1 self-start rounded-full bg-primary-50 dark:bg-primary-500/15 px-2 py-0.5 text-[11px] font-semibold text-[#be123c] dark:text-pink-200">
              <Eye className="w-3.5 h-3.5 text-pink-500" />
              {item.viewCount} {viewsLabel}
            </span>
          </Link>
        ))}
      </div>
    )}
  </div>
);

/* Highlight card body — one strong accent block with a vector icon. */
export const InsightTile = ({ Icon, title, body, stat, statLabel, footer }) => (
  <div className="flex h-full flex-col">
    <div className="flex items-center gap-2.5">
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#e11d48] to-[#f472b6] shadow-[0_8px_20px_-8px_rgba(225,29,72,0.7)]">
        {Icon ? <Icon className="h-5 w-5 text-white" /> : null}
      </span>
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-neutral-400">{title}</p>
    </div>
    {stat !== undefined && stat !== null && (
      <p className="mt-4 text-3xl font-bold tracking-tight text-ink-900 dark:text-neutral-100">{stat}</p>
    )}
    {statLabel && <p className="text-sm text-ink-500 dark:text-ink-300">{statLabel}</p>}
    <p className="mt-auto pt-4 text-sm leading-relaxed text-ink-600 dark:text-neutral-300">{body}</p>
    {footer}
  </div>
);

export default {
  ROSE,
  CATEGORY_COLORS,
  TILE_CLASS,
  STATUS_PILL,
  ORDER_STATUS_BADGE,
  formatVNDCompact,
  TrendBadge,
  RevenueLineChart,
  RadialGauge,
  CategoryBars,
  TopViewedWidget,
  InsightTile
};
