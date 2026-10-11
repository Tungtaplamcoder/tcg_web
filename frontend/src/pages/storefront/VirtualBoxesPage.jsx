import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Boxes, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';
import { useLanguage } from '../../i18n/LanguageContext';
import VirtualBoxCard from '../../components/gacha/VirtualBoxCard';
import { boxBackground } from '../../utils/boxBackground';

export { boxBackground };

const VirtualBoxesPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuthStore();
  const { t } = useLanguage();

  const [boxes, setBoxes] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 12, totalItems: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  /* Listing cards open the free detail/opening page. Viewing is public —
     the sign-in gate lives on the detail page's open CTA. */
  const handlePlay = (box) => {
    navigate(`/virtual-boxes/${box.id}`);
  };

  return (
    <div className="relative min-h-screen">
      <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-16">
        {/* ===================== HEADER — clean, high-contrast ===================== */}
        <header className="mb-10 flex flex-col items-start justify-between gap-5 sm:mb-12 sm:flex-row sm:items-end lg:mb-14">
          <div>
            <h1 className="font-display text-3xl font-extrabold leading-none tracking-tightest text-ink-950 dark:text-white sm:text-[2.6rem]">
              {t('virtualBox.arcadeTitle')}
            </h1>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-500 dark:text-ink-300">
              {t('virtualBox.intro')}
            </p>
          </div>
          {!isAuthenticated && (
            <button
              type="button"
              onClick={() => navigate('/login', { state: { from: location } })}
              className="inline-flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-pink-500/25 ring-1 ring-inset ring-white/20 touch-manipulation transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-pink-500/30 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 active:translate-y-0 active:scale-[0.98]"
            >
              {t('virtualBox.signInToPlay')}
            </button>
          )}
        </header>

        {/* ===================== GRID ===================== */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300" role="alert">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, idx) => (
              <div
                key={idx}
                className="animate-pulse overflow-hidden rounded-2xl border border-purple-100/60 bg-white/90 md:bg-white/80 dark:border-white/10 dark:bg-[#1c1216]/90 md:dark:bg-[#1c1216]/80 shadow-xl shadow-purple-500/5 backdrop-blur-sm"
              >
                <div className="aspect-[4/5] bg-ink-100/70 dark:bg-white/5" />
                <div className="space-y-3 p-5 text-left">
                  <div className="h-4 w-5/6 rounded bg-ink-200/80 dark:bg-white/10" />
                  <div className="h-3 w-2/3 rounded bg-ink-200/60 dark:bg-white/10" />
                  <div className="h-2 w-full rounded-full bg-ink-200/60 dark:bg-white/10" />
                  <div className="h-10 w-full rounded-xl bg-ink-200/60 dark:bg-white/10" />
                </div>
              </div>
            ))}
          </div>
        ) : boxes.length === 0 ? (
          <div className="py-24 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white/80 shadow-lg shadow-purple-500/10 ring-1 ring-purple-100 dark:bg-[#1c1216]/80 dark:shadow-purple-500/20 dark:ring-white/10">
              <Boxes className="h-10 w-10 text-violet-400" />
            </div>
            <p className="mt-5 text-lg font-medium text-ink-900 dark:text-white">{t('virtualBox.noBoxes')}</p>
            <p className="mt-1 text-sm text-ink-500 dark:text-ink-300">{t('virtualBox.noBoxesHint')}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
              {boxes.map((box, index) => (
                <VirtualBoxCard key={box.id} box={box} index={index} onPlay={handlePlay} />
              ))}
            </div>
            {meta.totalPages > 1 && (
              <div className="mt-12 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="inline-flex items-center rounded-xl border border-purple-100/80 bg-white/90 md:bg-white/80 dark:border-white/10 dark:bg-[#1c1216]/90 md:dark:bg-[#1c1216]/80 p-2.5 text-ink-700 dark:text-ink-200 shadow-sm shadow-purple-500/5 backdrop-blur-sm touch-manipulation transition-all duration-300 hover:-translate-y-0.5 hover:bg-white hover:shadow-md hover:shadow-purple-500/10 dark:hover:bg-[#1a1a26] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#0a050f] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="text-sm font-medium tabular-nums text-ink-500 dark:text-ink-300">
                  {t('common.page', { page: meta.page, total: meta.totalPages })}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                  disabled={page >= meta.totalPages}
                  className="inline-flex items-center rounded-xl border border-purple-100/80 bg-white/90 md:bg-white/80 dark:border-white/10 dark:bg-[#1c1216]/90 md:dark:bg-[#1c1216]/80 p-2.5 text-ink-700 dark:text-ink-200 shadow-sm shadow-purple-500/5 backdrop-blur-sm touch-manipulation transition-all duration-300 hover:-translate-y-0.5 hover:bg-white hover:shadow-md hover:shadow-purple-500/10 dark:hover:bg-[#1a1a26] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#0a050f] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
                  aria-label="Next page"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default VirtualBoxesPage;
