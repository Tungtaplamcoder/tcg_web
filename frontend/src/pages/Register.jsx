import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, LockKeyhole, Eye, EyeOff, Loader2, AlertCircle, UserRound, Sparkles, ArrowRight, Phone, MapPin } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

const Register = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    phone: '',
    address: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const { register, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const validateForm = () => {
    if (!formData.email || !formData.password || !formData.fullName) {
      return 'Email, password and full name are required.';
    }
    if (formData.password.length < 8) {
      return 'Password must be at least 8 characters.';
    }
    if (formData.password !== formData.confirmPassword) {
      return 'Passwords do not match.';
    }
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    const payload = {
      email: formData.email,
      password: formData.password,
      fullName: formData.fullName,
      phone: formData.phone || undefined,
      address: formData.address || undefined
    };

    const result = await register(payload);
    if (result.success) {
      const role = result.user?.role;
      if (role === 'ADMIN') navigate('/admin');
      else if (role === 'STAFF') navigate('/staff');
      else navigate('/');
    } else {
      setError(result.error || 'Registration failed');
    }
  };

  return (
    <div className="relative overflow-hidden min-h-[80vh] flex items-center justify-center px-4 py-12">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0 bg-radial-fade" />
      <div className="pointer-events-none absolute -top-24 -right-20 h-96 w-96 rounded-full bg-fuchsia-400/20 blur-[120px] animate-tcg-float" />
      <div className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-primary-400/20 blur-[120px] animate-tcg-float-slow" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'linear-gradient(rgba(124,88,237,0.55) 1px, transparent 1px), linear-gradient(90deg, rgba(124,88,237,0.55) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />

      <div className="relative w-full max-w-lg animate-tcg-reveal">
        <div className="rounded-3xl bg-white/80 dark:bg-[#12121a]/80 backdrop-blur-xl border border-white/60 shadow-2xl shadow-primary-900/10 p-8 sm:p-10">
          <div className="text-center mb-8">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-brand-gradient flex items-center justify-center shadow-glow">
              <Sparkles className="h-7 w-7 text-white" />
            </div>
            <h1 className="mt-5 heading-display text-2xl">Create Account</h1>
            <p className="text-ink-500 dark:text-ink-300 text-sm mt-1.5">Join the TCG collector community</p>
          </div>

          {error && (
            <div className="mb-5 flex items-center gap-2.5 p-3.5 rounded-xl bg-rose-50 text-rose-600 ring-1 ring-rose-200 text-sm font-medium animate-tcg-scale-in">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label-premium">Full Name *</label>
              <div className="relative">
                <UserRound className="absolute left-4 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-ink-400 dark:text-ink-300" />
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  required
                  placeholder="Nguyễn Văn A"
                  className="input-premium !pl-11"
                />
              </div>
            </div>
            <div>
              <label className="label-premium">Email *</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-ink-400 dark:text-ink-300" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="you@example.com"
                  className="input-premium !pl-11"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="label-premium">Password *</label>
                <div className="relative">
                  <LockKeyhole className="absolute left-4 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-ink-400 dark:text-ink-300" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    placeholder="••••••••"
                    className="input-premium !pl-11 !pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-ink-400 dark:text-ink-300 hover:text-ink-700 dark:text-ink-100 transition-colors"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="label-premium">Confirm Password *</label>
                <div className="relative">
                  <LockKeyhole className="absolute left-4 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-ink-400 dark:text-ink-300" />
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    placeholder="••••••••"
                    className="input-premium !pl-11"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="label-premium">Phone</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-ink-400 dark:text-ink-300" />
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="0123 456 789"
                    className="input-premium !pl-11"
                  />
                </div>
              </div>
              <div>
                <label className="label-premium">Address</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-ink-400 dark:text-ink-300" />
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    placeholder="123 Main St"
                    className="input-premium !pl-11"
                  />
                </div>
              </div>
            </div>

            <button type="submit" disabled={isLoading} className="btn-primary w-full">
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Creating account...
                </>
              ) : (
                <>
                  Create Account <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-7 text-center text-sm text-ink-500 dark:text-ink-300">
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-semibold bg-gradient-to-r from-primary-600 to-fuchsia-600 bg-clip-text text-transparent hover:from-primary-700 hover:to-fuchsia-700"
            >
              Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
