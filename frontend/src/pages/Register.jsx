import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, LockKeyhole, Eye, EyeOff, Loader2, AlertCircle, UserRound, Sparkles, ArrowRight, Phone, MapPin } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useLanguage } from '../i18n/LanguageContext';

const VN_PHONE_REGEX = /^(84|0[3|5|7|8|9])+([0-9]{8})\b/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const [errors, setErrors] = useState({});
  const { register, isLoading } = useAuthStore();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    // Clear the field's error as the user edits it
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const validateForm = () => {
    const fieldErrors = {};

    if (!formData.fullName.trim()) {
      fieldErrors.fullName = t('auth.errFullNameRequired');
    }

    // Email is optional — only validate syntax when a value is entered
    if (formData.email.trim() && !EMAIL_REGEX.test(formData.email.trim())) {
      fieldErrors.email = t('auth.errEmailInvalid');
    }

    if (!formData.password) {
      fieldErrors.password = t('auth.errPasswordRequired');
    } else if (formData.password.length < 8) {
      fieldErrors.password = t('auth.errPasswordShort');
    }

    if (!formData.confirmPassword) {
      fieldErrors.confirmPassword = t('auth.errConfirmRequired');
    } else if (formData.confirmPassword !== formData.password) {
      fieldErrors.confirmPassword = t('auth.errConfirmMismatch');
    }

    if (!formData.phone.trim()) {
      fieldErrors.phone = t('auth.errPhoneRequired');
    } else if (!VN_PHONE_REGEX.test(formData.phone.trim())) {
      fieldErrors.phone = t('auth.errPhoneInvalid');
    }

    return fieldErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const fieldErrors = validateForm();
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;

    const payload = {
      email: formData.email.trim() || undefined,
      password: formData.password,
      confirmPassword: formData.confirmPassword,
      fullName: formData.fullName.trim(),
      phone: formData.phone.trim(),
      address: formData.address.trim() || undefined
    };

    const result = await register(payload);
    if (result.success) {
      /* Always navigate to homepage on successful registration regardless of user role */
      navigate('/');
    } else {
      setErrors(result.errors || {});
      if (!result.errors && result.error) {
        setErrors({ form: result.error });
      }
    }
  };

  const fieldError = (name) =>
    errors[name] ? (
      <p className="mt-1.5 flex items-center gap-1.5 text-[13px] font-medium text-rose-600 dark:text-rose-400 animate-tcg-scale-in">
        <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
        {errors[name]}
      </p>
    ) : null;

  const inputClass = (name) =>
    `input-premium !pl-11${errors[name] ? ' !border-rose-400 !ring-4 !ring-rose-500/10' : ''}`;

  return (
    <div className="relative overflow-x-clip min-h-[80vh] flex items-center justify-center px-4 py-12">
      {/* Ambient background.
          The full-bleed wash/grid are viewport-fixed and the glow orbs are
          allowed to bleed vertically (overflow-x-clip, not overflow-hidden) so
          the ambient light flows past the in-flow header boundary to the very
          top edge instead of being clipped into a hard horizontal band. */}
      <div className="pointer-events-none fixed inset-0 bg-radial-fade" />
      <div className="pointer-events-none absolute -top-24 -right-20 h-96 w-96 rounded-full bg-fuchsia-400/20 blur-[120px] animate-tcg-float" />
      <div className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-primary-400/20 blur-[120px] animate-tcg-float-slow" />
      <div className="pointer-events-none fixed inset-0 opacity-[0.05]" style={{ backgroundImage: 'linear-gradient(rgba(124,88,237,0.55) 1px, transparent 1px), linear-gradient(90deg, rgba(124,88,237,0.55) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />

      <div className="relative w-full max-w-lg animate-tcg-reveal">
        <div className="rounded-3xl bg-white/80 dark:bg-[#1c1216]/80 backdrop-blur-xl border border-white/60 shadow-2xl shadow-primary-900/10 p-8 sm:p-10">
          <div className="text-center mb-8">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-brand-gradient flex items-center justify-center shadow-glow">
              <Sparkles className="h-7 w-7 text-white" />
            </div>
            <h1 className="mt-5 heading-display text-2xl">{t('auth.registerTitle')}</h1>
            <p className="text-ink-500 dark:text-ink-300 text-sm mt-1.5">{t('auth.registerSubtitle')}</p>
          </div>

          {errors.form && (
            <div className="mb-5 flex items-center gap-2.5 p-3.5 rounded-xl bg-rose-50 text-rose-600 ring-1 ring-rose-200 text-sm font-medium animate-tcg-scale-in">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {errors.form}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div>
              <label className="label-premium">{t('auth.fullName')} *</label>
              <div className="relative">
                <UserRound className="absolute left-4 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-ink-400 dark:text-ink-300" />
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  placeholder={t('checkout.namePlaceholder')}
                  className={inputClass('fullName')}
                />
              </div>
              {fieldError('fullName')}
            </div>
            <div>
              <label className="label-premium">{t('auth.email')}</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-ink-400 dark:text-ink-300" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  className={inputClass('email')}
                />
              </div>
              {fieldError('email')}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="label-premium">{t('auth.password')} *</label>
                <div className="relative">
                  <LockKeyhole className="absolute left-4 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-ink-400 dark:text-ink-300" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className={inputClass('password') + ' !pr-12'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-ink-400 dark:text-ink-300 hover:text-ink-700 dark:text-ink-100 transition-colors"
                    aria-label={t('common.showPassword')}
                  >
                    {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                  </button>
                </div>
                {fieldError('password')}
              </div>
              <div>
                <label className="label-premium">{t('auth.confirmPassword')} *</label>
                <div className="relative">
                  <LockKeyhole className="absolute left-4 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-ink-400 dark:text-ink-300" />
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className={inputClass('confirmPassword')}
                  />
                </div>
                {fieldError('confirmPassword')}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="label-premium">{t('auth.phone')} *</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-ink-400 dark:text-ink-300" />
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="0901234567"
                    className={inputClass('phone')}
                  />
                </div>
                {fieldError('phone')}
              </div>
              <div>
                <label className="label-premium">{t('auth.address')}</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-ink-400 dark:text-ink-300" />
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    placeholder={t('checkout.addressLine1Placeholder')}
                    className={inputClass('address')}
                  />
                </div>
                {fieldError('address')}
              </div>
            </div>

            <button type="submit" disabled={isLoading} className="btn-primary w-full">
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {t('auth.creatingAccount')}
                </>
              ) : (
                <>
                  {t('auth.registerTitle')} <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-7 text-center text-sm text-ink-500 dark:text-ink-300">
            {t('auth.hasAccount')}{' '}
            <Link
              to="/login"
              className="font-semibold bg-gradient-to-r from-primary-600 to-fuchsia-600 bg-clip-text text-transparent hover:from-primary-700 hover:to-fuchsia-700"
            >
              {t('auth.loginBtn')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
