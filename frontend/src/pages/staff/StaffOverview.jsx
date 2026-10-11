import React, { useCallback, useEffect, useState } from 'react';
import {
  Package, AlertCircle, Loader2, CheckCircle2, Gift, Eye,
  ClipboardCheck, Boxes, Truck
} from 'lucide-react';
import api from '../../services/api';
import { useLanguage } from '../../i18n/LanguageContext';
import { formatVND } from '../../utils/format';
import { TILE_CLASS, RadialGauge, STATUS_PILL, ORDER_STATUS_BADGE } from '../../components/BentoPieces';

const StaffOverview = () => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [packing, setPacking] = useState(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await api.get('/admin/staff-dashboard');
      setData(res.data.data);
    } catch (err) {
      console.error('Failed to fetch staff dashboard:', err);
      setError(t('staff.overview.packingEmpty'));
    }
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await load();
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [load]);

  // Quick action: advance a packed order from PACKAGING → SHIPPING.
  const confirmPack = async (order) => {
    setPacking(order.id);
    try {
      await api.patch(`/admin/orders/${order.id}/status`, {
        status: 'SHIPPING',
        note: 'Xác nhận đóng gói từ bảng điều khiển Staff'
      });
      await load();
    } catch (err) {
      console.error('Failed to confirm packing:', err);
      setError(t('staff.overview.packingEmpty'));
    } finally {
      setPacking(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-12 w-12 animate-spin text-[#E11D48] dark:text-pink-300" />
      </div>
    );
  }

  const packingQueue = data?.packingQueue || [];
  const activeBoxes = data?.activeBoxes || [];
  const recentlyCompleted = data?.recentlyCompleted || [];
  const todayTotal = data?.todayTotal || 0;
  const todayProcessed = data?.todayProcessed || 0;
  const processedRate = data?.processedRate || 0;

  return (
    <div className="space-y-5 dark:text-neutral-100">
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

      {/* ── Operational Bento grid — 2 top + 2 bottom ───────────────── */}
      <div data-testid="staff-bento-grid" className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Widget 1 (top-left, large) — Hàng Đợi Đóng Gói */}
        <section
          data-testid="staff-packing-queue"
          aria-label={t('staff.overview.workQueueTitle')}
          className={`${TILE_CLASS} lg:col-span-7`}
        >
          <div className="mb-3 flex items-center gap-2">
            <Package className="h-4 w-4 text-[#ec4899] dark:text-pink-300" />
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-neutral-400">
              {t('staff.overview.workQueueTitle')}
            </p>
            <span className="ml-auto inline-flex items-center rounded-full bg-primary-50 dark:bg-primary-500/15 px-2 py-0.5 text-[11px] font-semibold text-[#be123c] dark:text-pink-200">
              {data?.packingTotal ?? packingQueue.length}
            </span>
          </div>

          {packingQueue.length === 0 ? (
            <p className="text-ink-500 dark:text-neutral-400">{t('staff.overview.noPackaging')}</p>
          ) : (
            <div className="-mx-1 overflow-x-auto">
              <table className="min-w-full divide-y divide-neutral-200 dark:divide-white/10">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold text-ink-400 dark:text-neutral-400 uppercase tracking-wider">{t('staff.overview.colOrder')}</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold text-ink-400 dark:text-neutral-400 uppercase tracking-wider">{t('staff.overview.colCustomer')}</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold text-ink-400 dark:text-neutral-400 uppercase tracking-wider">{t('staff.overview.columnTime')}</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold text-ink-400 dark:text-neutral-400 uppercase tracking-wider">{t('staff.overview.columnAction')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-white/5">
                  {packingQueue.map((order) => (
                    <tr key={order.id} className="hover:bg-primary-50/50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-3 py-2.5 font-mono text-xs text-ink-600 dark:text-neutral-300">{order.orderCode}</td>
                      <td className="px-3 py-2.5 text-sm text-ink-700 dark:text-neutral-200">{order.customer || '—'}</td>
                      <td className="px-3 py-2.5 text-xs text-ink-500 dark:text-neutral-400">
                        {new Date(order.createdAt).toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          data-testid={`staff-confirm-pack-${order.id}`}
                          onClick={() => confirmPack(order)}
                          disabled={packing === order.id}
                          className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-pink-600 to-rose-500 px-3 py-1.5 text-[11px] font-semibold text-white shadow-md transition-all hover:opacity-95 disabled:opacity-60"
                        >
                          {packing === order.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <ClipboardCheck className="h-3.5 w-3.5" />}
                          {t('staff.overview.quickPack')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Widget 2 (top-right) — Tiến Độ Xử Lý Đơn Trong Ngày */}
        <section
          data-testid="staff-fulfillment"
          aria-label={t('staff.overview.fulfillmentTitle')}
          className={`${TILE_CLASS} lg:col-span-5`}
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-neutral-400">
            {t('staff.overview.fulfillmentTitle')}
          </p>
          <RadialGauge
            percent={processedRate}
            completedLabel={t('staff.overview.fulfilled')}
            caption={`${todayProcessed} / ${todayTotal}`}
          />
        </section>

        {/* Widget 3 (bottom-left) — Hộp Áo Hoạt Động & Lượt Mở Hôm Nay */}
        <section
          data-testid="staff-active-boxes"
          aria-label={t('staff.overview.activeBoxesTitle')}
          className={`${TILE_CLASS} lg:col-span-6`}
        >
          <div className="mb-3 flex items-center gap-2">
            <Boxes className="h-4 w-4 text-[#ec4899] dark:text-pink-300" />
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-neutral-400">
              {t('staff.overview.activeBoxesTitle')}
            </p>
          </div>
          {activeBoxes.length === 0 ? (
            <p className="text-ink-500 dark:text-neutral-400">{t('staff.overview.noActiveBoxes')}</p>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {activeBoxes.map((box) => (
                <li
                  key={box.id}
                  data-testid="staff-active-box"
                  className="flex items-center gap-3 rounded-2xl border border-pink-100 dark:border-neutral-800 bg-neutral-50 dark:bg-white/5 p-2.5"
                >
                  <span
                    className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white dark:bg-neutral-900/60"
                    style={box.gradient ? { backgroundImage: box.gradient } : undefined}
                  >
                    {box.imageUrl ? (
                      <img src={box.imageUrl} alt={box.name} loading="lazy" className="h-full w-full object-contain p-1" />
                    ) : (
                      <Gift className="h-5 w-5 text-pink-400" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink-800 dark:text-neutral-100" title={box.name}>
                      {box.name}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 dark:bg-primary-500/15 px-2 py-0.5 text-[11px] font-semibold text-[#be123c] dark:text-pink-200">
                        <Gift className="h-3.5 w-3.5 text-pink-500" />
                        {box.todayOpenings} {t('staff.overview.todayOpenings')}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] text-ink-400 dark:text-neutral-400">
                        <Eye className="h-3.5 w-3.5 text-pink-400" />
                        {box.viewCount}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Widget 4 (bottom-right) — Đơn Hàng Đã Xử Lý Gần Đây */}
        <section
          data-testid="staff-recent-completed"
          aria-label={t('staff.overview.recentCompletedTitle')}
          className={`${TILE_CLASS} lg:col-span-6`}
        >
          <div className="mb-3 flex items-center gap-2">
            <Truck className="h-4 w-4 text-[#ec4899] dark:text-pink-300" />
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-neutral-400">
              {t('staff.overview.recentCompletedTitle')}
            </p>
          </div>
          {recentlyCompleted.length === 0 ? (
            <p className="text-ink-500 dark:text-neutral-400">{t('staff.overview.noCompleted')}</p>
          ) : (
            <ul className="space-y-2">
              {recentlyCompleted.map((order) => (
                <li
                  key={order.id}
                  className="flex items-center gap-3 rounded-2xl bg-neutral-50 dark:bg-white/5 px-3 py-2.5"
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#ec4899] dark:text-pink-300" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-xs text-ink-600 dark:text-neutral-300">{order.orderCode}</p>
                    <p className="truncate text-[11px] text-ink-400 dark:text-neutral-400">{order.customer || '—'}</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-ink-800 dark:text-neutral-100">
                    {formatVND(order.grandTotal)}
                  </span>
                  <span
                    data-testid="order-status-badge"
                    className={`${STATUS_PILL} shrink-0 ${ORDER_STATUS_BADGE[order.status] || ORDER_STATUS_BADGE.PENDING}`}
                  >
                    {t(`orders.status.${order.status}`) !== `orders.status.${order.status}` ? t(`orders.status.${order.status}`) : order.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};

export default StaffOverview;
