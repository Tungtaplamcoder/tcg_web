import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Ticket, TicketPercent, Loader2, AlertCircle, Search, Copy, CheckCircle2,
  Clock, Hourglass, Sparkles, Gift, ChevronDown
} from 'lucide-react';
import api from '../services/api';
import { useLanguage } from '../i18n/LanguageContext';
import { formatVND } from '../utils/format';
import { formatVoucherValue, formatVoucherRules, formatDateTime, timeUntilExpiry } from '../utils/voucher';

const CountdownChip = ({ endAt }) => {
  const { t } = useLanguage();
  const [, forceTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => forceTick((n) => n + 1), 60000);
    return () => clearInterval(timer);
  }, []);
  const info = timeUntilExpiry(endAt, new Date(), t);
  if (!info) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ring-1 ${
      info.expired
        ? 'bg-ink-100 text-ink-500 ring-ink-200 dark:bg-white/10 dark:text-ink-300 dark:ring-white/10'
        : 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/30'
    }`}>
      <Hourglass className="h-3 w-3" />
      {info.label}
    </span>
  );
};

const VoucherCard = ({ entry, onCopy, onUse }) => {
  const { t } = useLanguage();
  const voucher = entry.voucher;
  const isActive = entry.status === 'ACTIVE';
  const rules = formatVoucherRules(voucher, t);
  const scopeLabel = voucher.scope === 'ALL'
    ? t('vouchers.scopeAll')
    : voucher.scope === 'CATEGORY' ? t('vouchers.scopeCategory') : t('vouchers.scopeProduct');

  return (
    <div className={`card-premium !translate-y-0 hover:!translate-y-0 hover:shadow-card-hover p-5 sm:p-6 ${isActive ? '' : 'opacity-60 grayscale'}`}>
      <div className="flex flex-col sm:flex-row sm:items-start gap-5">
        {/* Discount medallion */}
        <div className={`flex-shrink-0 h-16 w-16 rounded-2xl flex items-center justify-center ring-1 ${
          isActive
            ? 'bg-brand-gradient-soft ring-primary-200/60 text-primary-700 dark:text-white'
            : 'bg-ink-50 ring-ink-200 text-ink-400 dark:bg-white/5 dark:ring-white/10 dark:text-ink-300'
        }`}>
          <TicketPercent className="h-8 w-8" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <h3 className="font-display font-bold text-lg text-ink-900 dark:text-white truncate">
                {voucher.title}
              </h3>
              <p className="text-xs text-ink-400 dark:text-ink-300 mt-0.5">{scopeLabel}</p>
            </div>
            <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-bold ${
              isActive
                ? 'bg-gradient-to-r from-primary-600 to-fuchsia-600 bg-clip-text text-transparent'
                : 'text-ink-400 dark:text-ink-300'
            }`}>
              {formatVoucherValue(voucher)}
            </span>
          </div>

          {/* Code */}
          <div className="mt-3 flex items-center gap-2">
            <code className="px-3 py-1.5 rounded-lg bg-ink-50 dark:bg-white/10 ring-1 ring-ink-200 dark:ring-white/10 font-mono font-bold tracking-widest text-sm text-ink-800 dark:text-white">
              {voucher.code}
            </code>
            <button
              type="button"
              onClick={() => onCopy(voucher.code)}
              className="p-1.5 rounded-lg text-ink-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:text-white dark:hover:bg-white/10 transition-colors"
              aria-label={t('vouchers.copyAria', { code: voucher.code })}
              title={t('vouchers.copyCode')}
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>

          {/* Rules */}
          {rules.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {rules.map((rule) => (
                <span key={rule} className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-ink-50 text-ink-600 ring-1 ring-ink-200 dark:bg-white/5 dark:text-ink-200 dark:ring-white/10">
                  {rule}
                </span>
              ))}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-ink-400 dark:text-ink-300">
            {voucher.startAt && <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{t('vouchers.startsAt', { date: formatDateTime(voucher.startAt) })}</span>}
            {voucher.endAt && <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{t('vouchers.endsAt', { date: formatDateTime(voucher.endAt) })}</span>}
          </div>
        </div>

        {/* Right rail */}
        <div className="flex sm:flex-col items-center sm:items-end gap-3 flex-shrink-0 self-stretch sm:self-auto">
          {isActive ? (
            <>
              <CountdownChip endAt={voucher.endAt} />
              <button onClick={onUse} className="btn-primary !px-4 !py-2 text-sm">
                {t('vouchers.useNow')}
              </button>
            </>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-ink-100 text-ink-500 dark:bg-white/10 dark:text-ink-300">
              {entry.statusNote || (entry.status === 'USED' ? t('vouchers.usedUpNote') : t('vouchers.expiredNote'))}
            </span>
          )}
          {entry.remainingUses > 0 && (
            <span className="text-[11px] text-ink-400 dark:text-ink-300">
              {t('vouchers.remainingUses', { remaining: entry.remainingUses, total: voucher.limitPerUser })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

const Vouchers = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [wallet, setWallet] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('ACTIVE');
  const [claimCode, setClaimCode] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [claimMessage, setClaimMessage] = useState(null); // { type, text }
  const [copiedCode, setCopiedCode] = useState(null);

  const tabs = [
    { key: 'ACTIVE', label: t('vouchers.tabActive') },
    { key: 'USED', label: t('vouchers.tabUsed') },
    { key: 'EXPIRED', label: t('vouchers.tabExpired') }
  ];

  const fetchWallet = useCallback(async () => {
    setError('');
    try {
      const response = await api.get('/vouchers/wallet');
      setWallet(response.data.data || []);
    } catch (err) {
      console.error('Failed to fetch voucher wallet:', err.response?.status, err.response?.data?.error?.message || err.message);
      setError(t('vouchers.errLoad'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  useEffect(() => { fetchWallet(); }, [fetchWallet]);

  const grouped = useMemo(() => {
    const buckets = { ACTIVE: [], USED: [], EXPIRED: [] };
    for (const entry of wallet) {
      (buckets[entry.status] || buckets.EXPIRED).push(entry);
    }
    return buckets;
  }, [wallet]);

  const handleClaim = async (e) => {
    e.preventDefault();
    const code = claimCode.trim();
    if (!code) return;
    setClaiming(true);
    setClaimMessage(null);
    try {
      const response = await api.post('/vouchers/claim', { code });
      setClaimMessage({
        type: 'success',
        text: response.data?.message || t('vouchers.claimSuccess')
      });
      setClaimCode('');
      fetchWallet();
    } catch (err) {
      const message = err.response?.data?.error?.message || t('vouchers.claimFailed');
      setClaimMessage({ type: 'error', text: message });
    } finally {
      setClaiming(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  };

  const handleCopy = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      setCopiedCode(null);
    }
  };

  const goShopping = () => navigate('/catalog');

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8 animate-tcg-reveal">
      <div className="mb-7 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="section-eyebrow">{t('vouchers.walletEyebrow')}</p>
          <h1 className="heading-display text-3xl mt-1">{t('vouchers.title')}</h1>
        </div>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-50 ring-1 ring-primary-200/70 dark:bg-white/10 text-sm font-semibold text-primary-700 dark:text-white">
          <Ticket className="h-4 w-4" />
          {t('vouchers.count', { count: wallet.length })}
        </div>
      </div>

      {/* Claim form */}
      <div className="mb-7 rounded-3xl bg-white/85 dark:bg-[#1c1216]/85 backdrop-blur-xl border border-ink-100 dark:border-white/10 shadow-card p-5 sm:p-6">
        <form onSubmit={handleClaim} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Gift className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-ink-300" />
            <input
              type="text"
              value={claimCode}
              onChange={(e) => setClaimCode(e.target.value.toUpperCase())}
              placeholder={t('vouchers.claimPlaceholder')}
              className="input-premium !pl-12 font-mono tracking-widest uppercase"
              maxLength={50}
              disabled={claiming}
            />
          </div>
          <button
            type="submit"
            disabled={claiming || !claimCode.trim()}
            className="btn-primary sm:w-auto"
          >
            {claiming ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                {t('vouchers.claiming')}
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                {t('vouchers.claimBtn')}
              </>
            )}
          </button>
        </form>
        {claimMessage && (
          <div className={`mt-3 flex items-center gap-2.5 p-3 rounded-xl text-sm font-medium animate-tcg-scale-in ${
            claimMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/30'
              : 'bg-rose-50 text-rose-600 ring-1 ring-rose-200 dark:bg-rose-400/10 dark:text-rose-300 dark:ring-rose-400/30'
          }`}>
            {claimMessage.type === 'success'
              ? <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              : <AlertCircle className="h-4 w-4 flex-shrink-0" />}
            {claimMessage.text}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map((tabItem) => (
          <button
            key={tabItem.key}
            onClick={() => setTab(tabItem.key)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 ${
              tab === tabItem.key
                ? 'bg-gradient-to-r from-primary-600 to-fuchsia-600 text-white shadow-[0_6px_16px_-6px_rgba(124,58,237,0.6)]'
                : 'text-ink-500 dark:text-ink-300 hover:bg-ink-900/5 dark:hover:bg-white/10'
            }`}
          >
            {tabItem.label}
            <span className={`ml-1.5 text-xs ${tab === tabItem.key ? 'text-white/80' : 'text-ink-400 dark:text-ink-300'}`}>
              ({grouped[tabItem.key].length})
            </span>
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-5 flex items-center gap-2.5 p-4 rounded-xl bg-rose-50 text-rose-600 ring-1 ring-rose-200 text-sm font-medium animate-tcg-scale-in">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-36 rounded-3xl bg-ink-50 dark:bg-white/5 ring-1 ring-ink-100 dark:ring-white/10 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {grouped[tab].length === 0 ? (
            <div className="relative overflow-hidden text-center py-20 rounded-3xl bg-white/85 dark:bg-[#1c1216]/85 backdrop-blur-xl border border-ink-100 dark:border-white/10 shadow-card">
              <div className="pointer-events-none absolute -top-16 right-1/4 h-56 w-56 rounded-full bg-primary-300/15 blur-[80px]" />
              <div className="relative">
                <div className="mx-auto h-16 w-16 rounded-2xl bg-ink-50 dark:bg-white/5 ring-1 ring-ink-100 dark:ring-white/10 flex items-center justify-center">
                  <Search className="h-8 w-8 text-ink-300" />
                </div>
                <p className="mt-5 text-ink-600 dark:text-ink-200 font-medium">
                  {tab === 'ACTIVE' && t('vouchers.emptyActive')}
                  {tab === 'USED' && t('vouchers.emptyUsed')}
                  {tab === 'EXPIRED' && t('vouchers.emptyExpired')}
                </p>
                {tab === 'ACTIVE' && (
                  <button onClick={goShopping} className="btn-primary mt-6">
                    {t('vouchers.exploreShop')}
                  </button>
                )}
              </div>
            </div>
          ) : (
            grouped[tab].map((entry) => (
              <VoucherCard
                key={entry.id}
                entry={entry}
                onCopy={handleCopy}
                onUse={goShopping}
              />
            ))
          )}
        </div>
      )}

      {/* Copy toast */}
      {copiedCode && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-ink-900 text-white text-sm font-medium shadow-glow animate-tcg-scale-in dark:bg-white dark:text-ink-900">
          {t('vouchers.copiedToast', { code: copiedCode })}
        </div>
      )}
    </div>
  );
};

export default Vouchers;
