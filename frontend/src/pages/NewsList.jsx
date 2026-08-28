import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Newspaper, AlertCircle, ArrowRight, Calendar, User } from 'lucide-react';
import api from '../services/api';

const NewsList = () => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ totalPages: 1 });

  const fetchNews = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get(`/news?page=${page}&limit=10`);
      setArticles(response.data.data.items || []);
      setMeta(response.data.data.meta || { totalPages: 1 });
    } catch (err) {
      console.error('Failed to fetch news:', err);
      setError('Failed to load articles. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, [page]);

  if (loading && articles.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="h-8 bg-ink-100 dark:bg-white/10 rounded-lg w-64 mb-8 animate-pulse" />
        <div className="space-y-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 rounded-3xl bg-ink-50 dark:bg-white/5 ring-1 ring-ink-100 dark:ring-white/10 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8 animate-tcg-reveal">
      <div className="mb-7">
        <p className="section-eyebrow">Insights</p>
        <div className="flex items-center justify-between mt-1">
          <h1 className="heading-display text-3xl">News & Updates</h1>
          <div className="h-11 w-11 rounded-xl bg-brand-gradient-soft ring-1 ring-primary-200/50 hidden sm:flex items-center justify-center">
            <Newspaper className="h-5 w-5 text-primary-700" />
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-5 flex items-center gap-2.5 p-4 rounded-xl bg-rose-50 text-rose-600 ring-1 ring-rose-200 text-sm font-medium animate-tcg-scale-in">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {articles.length === 0 ? (
        <div className="relative overflow-hidden text-center py-20 rounded-3xl bg-white/85 dark:bg-[#12121a]/85 backdrop-blur-xl border border-ink-100 dark:border-white/10 shadow-card">
          <div className="pointer-events-none absolute -top-16 right-1/4 h-56 w-56 rounded-full bg-primary-300/15 blur-[80px]" />
          <div className="relative">
            <Newspaper className="h-12 w-12 mx-auto text-ink-300" />
            <p className="mt-4 text-ink-500 dark:text-ink-300 font-medium">No articles published yet.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {articles.map((article, i) => (
            <Link
              key={article.id}
              to={`/news/${article.id}`}
              className="group block card-premium p-6 sm:p-7 animate-tcg-reveal"
              style={{ animationDelay: `${Math.min(i, 6) * 0.05}s` }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-display font-bold text-ink-900 dark:text-white group-hover:text-primary-700 transition-colors duration-300">
                    {article.title}
                  </h2>
                  <p className="mt-2 text-ink-500 dark:text-ink-300 leading-relaxed line-clamp-2">
                    {article.excerpt || (article.content ? article.content.substring(0, 150) + '...' : '')}
                  </p>
                  <div className="mt-4 flex items-center flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-ink-400 dark:text-ink-300">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4" />
                      {new Date(article.createdAt).toLocaleDateString()}
                    </span>
                    {article.author && (
                      <span className="flex items-center gap-1.5">
                        <User className="h-4 w-4" />
                        {article.author.fullName || article.author.email}
                      </span>
                    )}
                  </div>
                </div>
                <span className="h-10 w-10 shrink-0 rounded-full bg-ink-50 dark:bg-white/5 ring-1 ring-ink-100 dark:ring-white/10 flex items-center justify-center transition-all duration-300 group-hover:bg-gradient-to-r group-hover:from-primary-600 group-hover:to-fuchsia-600 group-hover:ring-transparent group-hover:shadow-glow">
                  <ArrowRight className="h-5 w-5 text-ink-400 dark:text-ink-300 transition-colors duration-300 group-hover:text-white" />
                </span>
              </div>
              {article.thumbnailUrl && (
                <div className="mt-5 overflow-hidden rounded-2xl ring-1 ring-ink-100 dark:ring-white/10">
                  <img
                    src={article.thumbnailUrl}
                    alt={article.title}
                    className="w-full h-48 object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                  />
                </div>
              )}
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="mt-10 flex justify-center items-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="btn-secondary !px-5 !py-2 text-sm"
          >
            Previous
          </button>
          <span className="px-3 text-sm font-semibold text-ink-600 dark:text-ink-200">Page {page} of {meta.totalPages}</span>
          <button
            onClick={() => setPage(Math.min(meta.totalPages, page + 1))}
            disabled={page >= meta.totalPages}
            className="btn-secondary !px-5 !py-2 text-sm"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default NewsList;
