import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Mail, LockKeyhole, Eye, EyeOff, Loader2, AlertCircle, ArrowRight, Sparkles } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }
    const result = await login(email, password);
    if (result.success) {
      // Redirect based on role
      const role = result.user?.role;
      if (role === 'ADMIN') navigate('/admin');
      else if (role === 'STAFF') navigate('/staff');
      else navigate(from, { replace: true });
    } else {
      setError(result.error || 'Login failed');
    }
  };

  return (
    <div className="relative overflow-hidden min-h-[80vh] flex items-center justify-center px-4 py-12">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0 bg-radial-fade" />
      <div className="pointer-events-none absolute -top-24 -left-20 h-96 w-96 rounded-full bg-primary-400/20 blur-[120px] animate-tcg-float" />
      <div className="pointer-events-none absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-fuchsia-400/20 blur-[120px] animate-tcg-float-slow" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'linear-gradient(rgba(124,88,237,0.55) 1px, transparent 1px), linear-gradient(90deg, rgba(124,88,237,0.55) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />

      <div className="relative w-full max-w-md animate-tcg-reveal">
        <div className="rounded-3xl bg-white/80 dark:bg-[#12121a]/80 backdrop-blur-xl border border-white/60 shadow-2xl shadow-primary-900/10 p-8 sm:p-10">
          <div className="text-center mb-8">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-brand-gradient flex items-center justify-center shadow-glow">
              <Sparkles className="h-7 w-7 text-white" />
            </div>
            <h1 className="mt-5 heading-display text-2xl">Welcome Back</h1>
            <p className="text-ink-500 dark:text-ink-300 text-sm mt-1.5">Login to access your collection</p>
          </div>

          {error && (
            <div className="mb-5 flex items-center gap-2.5 p-3.5 rounded-xl bg-rose-50 text-rose-600 ring-1 ring-rose-200 text-sm font-medium animate-tcg-scale-in">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label-premium">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-ink-400 dark:text-ink-300" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="input-premium !pl-11"
                />
              </div>
            </div>
            <div>
              <label className="label-premium">Password</label>
              <div className="relative">
                <LockKeyhole className="absolute left-4 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-ink-400 dark:text-ink-300" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="input-premium !pl-11 !pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-ink-400 dark:text-ink-300 hover:text-ink-700 dark:text-ink-100 transition-colors"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={isLoading} className="btn-primary w-full">
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Logging in...
                </>
              ) : (
                <>
                  Login <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-7 text-center text-sm text-ink-500 dark:text-ink-300">
            Don't have an account?{' '}
            <Link
              to="/register"
              className="font-semibold bg-gradient-to-r from-primary-600 to-fuchsia-600 bg-clip-text text-transparent hover:from-primary-700 hover:to-fuchsia-700"
            >
              Register
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
