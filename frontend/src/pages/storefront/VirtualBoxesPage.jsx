import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Boxes, ChevronLeft, ChevronRight, Layers, Loader2, PackageOpen,
  ShieldCheck, Sparkles
} from 'lucide-react';
import api from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';
import ProductImage from '../../components/ProductImage';

const RARITY_ORDER = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'];

const RARITY_META = {
  COMMON: {
    label: 'Common',
    dot: 'bg-gradient-to-r from-slate-400 to-slate-500',
    bar: 'linear-gradient(90deg, #94a3b8, #64748b)',
    chip: 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200',
    flash: 'rgba(226, 232, 240, 0.85)',
    text: 'text-slate-500 dark:text-slate-300'
  },
  RARE: {
    label: 'Rare',
    dot: 'bg-gradient-to-r from-sky-400 to-blue-500',
    bar: 'linear-gradient(90deg, #38bdf8, #3b82f6)',
    chip: 'bg-sky-50 text-sky-700 dark:bg-sky-400/10 dark:text-sky-300',
    flash: 'rgba(56, 189, 248, 0.9)',
    text: 'text-sky-600 dark:text-sky-300'
  },
  EPIC: {
    label: 'Epic',
    dot: 'bg-gradient-to-r from-violet-500 to-fuchsia-500',
    bar: 'linear-gradient(90deg, #8b5cf6, #d946ef)',
    chip: 'bg-primary-50 text-primary-700 dark:bg-primary-400/10 dark:text-primary-300',
    flash: 'rgba(217, 70, 239, 0.9)',
    text: 'text-fuchsia-600 dark:text-fuchsia-300'
  },
  LEGENDARY: {
    label: 'Legendary',
    dot: 'bg-gradient-to-r from-amber-400 to-orange-500',
    bar: 'linear-gradient(90deg, #fbbf24, #f97316)',
    chip: 'bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300',
    flash: 'rgba(233, 196, 106, 0.95)',
    text: 'text-amber-600 dark:text-amber-300'
  }
};

const TOKEN_GRADIENTS = {
  'from-violet-500 to-fuchsia-500': 'linear-gradient(135deg, #8b5cf6, #d946ef)',
  'from-cyan-500 to-blue-600': 'linear-gradient(135deg, #06b6d4, #2563eb)',
  'from-slate-600 to-ink-900': 'linear-gradient(135deg, #475569, #0f172a)',
  'from-amber-400 to-orange-600': 'linear-gradient(135deg, #fbbf24, #ea580c)',
  'from-emerald-500 to-teal-600': 'linear-gradient(135deg, #10b981, #0d9488)',
  'from-rose-500 to-pink-600': 'linear-gradient(135deg, #f43f5e, #db2777)',
  'from-sky-400 to-violet-500': 'linear-gradient(135deg, #38bdf8, #8b5cf6)',
  'from-fuchsia-500 to-amber-400': 'linear-gradient(135deg, #d946ef, #fbbf24)'
};

const FALLBACK_GRADIENTS = [
  'linear-gradient(135deg, #7c3aed 0%, #d946ef 60%, #f43f5e 110%)',
  'linear-gradient(135deg, #0ea5e9 0%, #6366f1 55%, #8b5cf6 100%)',
  'linear-gradient(135deg, #0f766e 0%, #10b981 55%, #a3e635 110%)',
  'linear-gradient(135deg, #b45309 0%, #f59e0b 55%, #fbbf24 100%)',
  'linear-gradient(135deg, #be185d 0%, #ec4899 55%, #f9a8d4 110%)',
  'linear-gradient(135deg, #1e293b 0%, #475569 55%, #8b5cf6 120%)'
];

const hashId = (id) => {
  let h = 0;
  const s = String(id || '');
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
};

const boxBackground = (box, index = 0) => {
  const raw = (box.gradient || '').trim();
  if (raw.includes('gradient(') || raw.startsWith('radial')) return raw;
  if (TOKEN_GRADIENTS[raw]) return TOKEN_GRADIENTS[raw];
  return FALLBACK_GRADIENTS[(hashId(box.id) + index) % FALLBACK_GRADIENTS.length];
};

const normalizeRates = (dropRates = []) =>
  RARITY_ORDER
    .map((rarity) => {
      const entry = (dropRates || []).find(
        (d) => String(d?.rarity).toUpperCase() === rarity
      );
      return entry ? { rarity, rate: Number(entry.rate) || 0 } : null;
    })
    .filter(Boolean)
    .sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity));

/* ── Rarity spectrum bar: one proportional strip + legend chips ── */
const DropRatePreview = ({ dropRates }) => {
  const rates = normalizeRates(dropRates);
  if (rates.length === 0) {
    return <p className="text-xs text-faint">Drop rates hidden until launch.</p>;
  }
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">Drop Rates</span>
        <span className="text-[11px] font-semibold text-muted">{rates.length} tiers</span>
      </div>
      <div
        className="flex h-2.5 w-full overflow-hidden rounded-full bg-ink-100 ring-1 ring-black/5 dark:bg-white/10 dark:ring-white/10"
        role="img"
        aria-label={rates.map((r) => `${RARITY_META[r.rarity].label} ${r.rate}%`).join(', ')}
      >
        {rates.map((r) => (
          <div
            key={r.rarity}
            className="h-full transition-[width] duration-500"
            style={{ width: `${Math.max(r.rate, 0)}%`, backgroundImage: RARITY_META[r.rarity].bar }}
            title={`${RARITY_META[r.rarity].label} ${r.rate}%`}
          />
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {rates.map((r) => (
          <span
            key={r.rarity}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${RARITY_META[r.rarity].chip}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${RARITY_META[r.rarity].dot}`} />
            {RARITY_META[r.rarity].label}
            <span className="tabular-nums opacity-80">{r.rate}%</span>
          </span>
        ))}
      </div>
    </div>
  );
};

/* ── Storefront card for one virtual box ── */
const BoxCard = ({ box, index, onPlay }) => {
  const background = boxBackground(box, index);
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-3xl glass-panel transition-all duration-300 hover:-translate-y-1.5 hover:ring-iridescent animate-tcg-reveal" style={{ animationDelay: `${Math.min(index * 0.06, 0.42)}s` }}>
      {/* Box art */}
      <div className="relative aspect-[16/10] overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 transition-transform duration-500 group-hover:scale-[1.04]"
          style={{ backgroundImage: background }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.14]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.75) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.75) 1px, transparent 1px)', backgroundSize: '22px 22px' }}
        />
        {box.imageUrl ? (
          <div className="absolute inset-0">
            <ProductImage
              src={box.imageUrl}
              alt={box.name}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              fallbackClassName="h-full w-full"
              label={box.name}
            />
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur-sm shadow-glass transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3">
              <Boxes className="h-10 w-10 text-white drop-shadow" />
            </div>
          </div>
        )}
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
        {/* pool count badge */}
        <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/35 px-2.5 py-1 text-[11px] font-bold text-white ring-1 ring-white/25 backdrop-blur-md">
          <Layers className="h-3.5 w-3.5" />
          <span className="tabular-nums">{box.cardPoolCount ?? 0}</span>
          <span className="font-medium opacity-80">cards</span>
        </span>
        {/* title strip over art */}
        <div className="absolute inset-x-0 bottom-0 p-4">
          <h3 className="font-display text-lg font-bold leading-tight text-white drop-shadow [text-wrap:balance]">{box.name}</h3>
        </div>
        {/* hover sheen sweep */}
        <div aria-hidden="true" className="sheen-sweep absolute inset-0 rounded-none" />
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-4 p-5">
        {box.description ? (
          <p className="line-clamp-2 text-sm leading-relaxed text-muted">{box.description}</p>
        ) : (
          <p className="line-clamp-2 text-sm italic text-faint">A sealed virtual drop — open it to reveal your pull.</p>
        )}

        <DropRatePreview dropRates={box.dropRates} />

        <div className="mt-auto flex items-end justify-between gap-3 border-t border-subtle pt-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">Entry</p>
            <span className="mt-0.5 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-violet-500 px-3 py-1 font-display text-lg font-bold uppercase tracking-wide text-white shadow-lg">
              <Sparkles className="h-4 w-4" />
              Free
            </span>
          </div>
          <button
            type="button"
            onClick={() => onPlay(box)}
            className="btn-aura shrink-0 !px-5 !py-2.5 text-sm"
            aria-label={`Play or open ${box.name}`}
          >
            <PackageOpen className="h-4 w-4" />
            Play / Open Box
          </button>
        </div>
      </div>
    </article>
  );
};

const VirtualBoxesPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuthStore();

  const [boxes, setBoxes] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 12, totalItems: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [pendingBox, setPendingBox] = useState(null);
  const [opening, setOpening] = useState(false);
  const [flowError, setFlowError] = useState('');
  const [result, setResult] = useState(null);

  const fetchBoxes = useCallback(async (targetPage) => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/virtual-boxes', { params: { page: targetPage, limit: 12 } });
      setBoxes(response.data.data.items || []);
      setMeta(response.data.data.meta || { page: 1, limit: 12, totalItems: 0, totalPages: 1 });
    } catch (err) {
      console.error(err);
      setError('Failed to load virtual boxes. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBoxes(page); }, [fetchBoxes, page]);

  /* Lock body scroll while a flow modal is open */
  useEffect(() => {
    if (pendingBox || result) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
    return undefined;
  }, [pendingBox, result]);

  /* Escape closes the modals */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !opening) { setPendingBox(null); setResult(null); setFlowError(''); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [opening]);

  const handlePlay = (box) => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: location } });
      return;
    }
    setFlowError('');
    setPendingBox(box);
  };

  const closeFlow = () => {
    if (opening) return;
    setPendingBox(null);
    setResult(null);
    setFlowError('');
  };

  const confirmOpen = async () => {
    if (!pendingBox || opening) return;
    setOpening(true);
    setFlowError('');
    try {
      const response = await api.post(`/virtual-boxes/${pendingBox.id}/open`);
      const data = response.data.data;
      setResult({ ...data, boxName: data.opening?.boxName || pendingBox.name });
      setPendingBox(null);
    } catch (err) {
      const apiError = err.response?.data?.error;
      setFlowError(apiError?.message || 'Opening failed. Please try again.');
    } finally {
      setOpening(false);
    }
  };

  const openAnother = () => {
    if (!result) return;
    const box = boxes.find((b) => b.id === result.opening?.boxId);
    setFlowError('');
    setResult(null);
    if (box) setPendingBox(box);
  };

  const rarityMeta = result ? RARITY_META[String(result.card?.rarity).toUpperCase()] || RARITY_META.COMMON : null;

  return (
    <div className="app-bg min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* ===================== HEADER ===================== */}
        <div className="relative overflow-hidden rounded-[2rem] glass-panel p-8 sm:p-10 mb-10">
          <div className="pointer-events-none absolute -top-20 -right-12 h-56 w-56 rounded-full bg-aura-violet/25 blur-[90px] dark:bg-aura-magenta/25" />
          <div className="pointer-events-none absolute -bottom-24 left-1/4 h-48 w-48 rounded-full bg-aura-cyan/15 blur-[80px]" />
          <div className="relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5">
            <div>
              <p className="section-eyebrow">Gacha Arcade</p>
              <h1 className="mt-2 text-3xl sm:text-4xl font-extrabold font-display tracking-tight text-strong flex items-center">
                <Sparkles className="h-8 w-8 mr-3 text-fuchsia-500 dark:text-aura-cyan" />
                Virtual Boxes
              </h1>
              <p className="mt-2 max-w-xl text-muted">
                Crack open a sealed virtual box for free. Every pull is instant,
                provably weighted, and added straight to your collection.
              </p>
            </div>
            {!isAuthenticated && (
              <button type="button" onClick={() => navigate('/login', { state: { from: location } })} className="btn-secondary shrink-0">
                Sign in to play
              </button>
            )}
          </div>
          <div aria-hidden="true" className="absolute bottom-0 left-8 right-8 h-px bg-iridescent opacity-60" />
        </div>

        {/* ===================== GRID ===================== */}
        {error && <div className="alert-error mb-6">{error}</div>}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {[...Array(6)].map((_, idx) => (
              <div key={idx} className="surface rounded-3xl overflow-hidden animate-pulse">
                <div className="aspect-[16/10] bg-ink-100 dark:bg-white/5" />
                <div className="p-5 space-y-3">
                  <div className="h-4 bg-ink-100 dark:bg-white/5 rounded w-5/6" />
                  <div className="h-3 bg-ink-100 dark:bg-white/5 rounded w-2/3" />
                  <div className="h-2.5 bg-ink-100 dark:bg-white/5 rounded-full w-full" />
                  <div className="h-11 bg-ink-100 dark:bg-white/5 rounded-xl w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : boxes.length === 0 ? (
          <div className="text-center py-24 text-muted">
            <div className="h-20 w-20 mx-auto rounded-full bg-ink-100 dark:bg-white/5 flex items-center justify-center">
              <Boxes className="h-10 w-10 text-ink-300 dark:text-ink-500" />
            </div>
            <p className="mt-5 text-lg font-medium text-strong">No boxes are live right now.</p>
            <p className="mt-1 text-sm text-muted">New drops land soon — check back shortly.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {boxes.map((box, index) => (
                <BoxCard key={box.id} box={box} index={index} onPlay={handlePlay} />
              ))}
            </div>
            {meta.totalPages > 1 && (
              <div className="mt-10 flex justify-center items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="inline-flex items-center p-2.5 rounded-xl surface text-strong disabled:opacity-40 hover:ring-iridescent transition-all"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="text-sm font-medium text-muted">Page {meta.page} / {meta.totalPages}</span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                  disabled={page >= meta.totalPages}
                  className="inline-flex items-center p-2.5 rounded-xl surface text-strong disabled:opacity-40 hover:ring-iridescent transition-all"
                  aria-label="Next page"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ===================== CONFIRM OPEN MODAL ===================== */}
      {pendingBox && (
        <div className="dash-overlay" onClick={closeFlow} role="presentation">
          <div
            className="dash-modal max-w-md p-0 overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-label={`Open ${pendingBox.name}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative h-28 overflow-hidden">
              <div aria-hidden="true" className="absolute inset-0" style={{ backgroundImage: boxBackground(pendingBox) }} />
              <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
              {pendingBox.imageUrl && (
                <ProductImage src={pendingBox.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" fallbackClassName="h-full w-full" label={pendingBox.name} />
              )}
              <div className="absolute inset-x-0 bottom-0 p-5">
                <h2 className="font-display text-xl font-bold text-white drop-shadow">{pendingBox.name}</h2>
              </div>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between rounded-2xl surface-2 px-4 py-3">
                <span className="text-sm font-medium text-muted">Entry</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-violet-500 px-3 py-0.5 font-display text-sm font-bold uppercase tracking-wide text-white shadow">
                  <Sparkles className="h-3.5 w-3.5" />
                  Free
                </span>
              </div>
              <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-faint px-1">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                One random card is drawn from {pendingBox.cardPoolCount ?? 'the'} pool using the published drop rates and added to your collection.
              </p>

              {flowError && <div className="alert-error mt-4">{flowError}</div>}

              <div className="mt-6 flex gap-3">
                <button type="button" onClick={closeFlow} disabled={opening} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button type="button" onClick={confirmOpen} disabled={opening} className="btn-aura flex-1">
                  {opening ? (<><Loader2 className="h-4 w-4 animate-spin" /> Opening…</>) : (<><PackageOpen className="h-4 w-4" /> Open Box</>)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== REVEAL MODAL ===================== */}
      {result && rarityMeta && (
        <div className="dash-overlay" role="presentation">
          <div
            className="dash-modal relative max-w-md overflow-hidden p-0"
            role="dialog"
            aria-modal="true"
            aria-label="Your pull"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative flex h-44 items-center justify-center overflow-hidden bg-obsidian-300">
              <div className="pack-god-rays" aria-hidden="true" />
              <div className="pack-flash" style={{ '--flash-c': rarityMeta.flash }} aria-hidden="true" />
              <div className="relative z-10 pack-card-rise text-center px-6">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] ${rarityMeta.chip}`}>
                  <span className={`h-2 w-2 rounded-full ${rarityMeta.dot}`} />
                  {rarityMeta.label} pull
                </span>
                <h2 className="mt-3 font-display text-2xl font-bold text-white drop-shadow [text-wrap:balance]">
                  {result.card?.product?.shortName || result.card?.product?.name || 'Mystery Card'}
                </h2>
                {result.card?.product?.cardNumber && (
                  <p className="mt-1 text-xs font-semibold text-white/70">#{result.card.product.cardNumber} · {result.boxName}</p>
                )}
              </div>
            </div>
            <div className="p-6">
              <div className="mx-auto w-40 pack-card-rise" style={{ animationDelay: '0.25s' }}>
                <div className="rounded-2xl p-[1.5px]" style={{ backgroundImage: RARITY_META[result.card?.rarity]?.bar || RARITY_META.COMMON.bar }}>
                  <div className="overflow-hidden rounded-[calc(1rem-1.5px)] bg-white dark:bg-obsidian-100">
                    <ProductImage
                      src={result.card?.product?.images?.[0]}
                      alt={result.card?.product?.name || 'Pulled card'}
                      className="aspect-[3/4] w-full object-contain p-2"
                      fallbackClassName="aspect-[3/4] w-full"
                      label={result.card?.product?.shortName || result.card?.product?.name || 'Pulled Card'}
                    />
                  </div>
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button type="button" onClick={closeFlow} className="btn-secondary flex-1">Done</button>
                <button type="button" onClick={openAnother} className="btn-aura flex-1">
                  <PackageOpen className="h-4 w-4" /> Open Another
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VirtualBoxesPage;
