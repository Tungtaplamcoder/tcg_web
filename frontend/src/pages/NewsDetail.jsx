import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Calendar, User } from 'lucide-react';
import api from '../services/api';

const NewsDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchArticle = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.get(`/news/${id}`);
        setArticle(response.data.data);
      } catch (err) {
        console.error('Failed to fetch article:', err);
        setError('Article not found or unavailable.');
      } finally {
        setLoading(false);
      }
    };
    fetchArticle();
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="h-8 bg-ink-100 rounded-lg w-2/3 mb-6 animate-pulse" />
        <div className="h-64 rounded-3xl bg-ink-50 ring-1 ring-ink-100 animate-pulse" />
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <p className="text-rose-500 font-medium">{error || 'Article not found'}</p>
        <Link to="/news" className="btn-ghost mt-4">
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to News
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:px-6 lg:px-8 animate-tcg-reveal">
      <button onClick={() => navigate('/news')} className="btn-ghost mb-6 !px-3">
        <ArrowLeft className="h-4 w-4 mr-1.5" /> All Articles
      </button>

      <article className="relative overflow-hidden rounded-3xl bg-white/90 backdrop-blur-xl border border-ink-100 shadow-card p-6 sm:p-10">
        <div className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full bg-fuchsia-400/10 blur-[90px]" />
        <div className="relative">
          <h1 className="heading-display text-3xl sm:text-4xl leading-tight">{article.title}</h1>

          <div className="mt-5 flex items-center flex-wrap gap-x-5 gap-y-2 text-sm text-ink-500">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-primary-600" />
              {new Date(article.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </span>
            {article.author && (
              <span className="flex items-center gap-1.5">
                <User className="h-4 w-4 text-primary-600" />
                {article.author.fullName || article.author.email}
              </span>
            )}
          </div>

          {article.thumbnailUrl && (
            <div className="mt-7 overflow-hidden rounded-2xl ring-1 ring-ink-100 shadow-card">
              <img
                src={article.thumbnailUrl}
                alt={article.title}
                className="w-full h-64 sm:h-80 object-cover"
              />
            </div>
          )}

          <div className="mt-7 text-[15px] text-ink-700 leading-[1.85] whitespace-pre-wrap">
            {article.content}
          </div>
        </div>
      </article>
    </div>
  );
};

export default NewsDetail;
