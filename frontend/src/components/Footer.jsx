import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Mail, Phone, MapPin, ShieldCheck } from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { useLanguage } from '../i18n/LanguageContext';

const Footer = () => {
  const { shop } = useShop();
  const { t } = useLanguage();

  const shopName = shop?.shop_name || 'TCG Store';
  const supportEmail = shop?.support_email || 'support@tcgstore.com';
  const supportPhone = shop?.support_phone || '+84 123 456 789';
  const supportAddress = shop?.support_address || '123 Main St, Hanoi, Vietnam';
  const shopLogoUrl = shop?.shop_logo_url || '';

  const quickLinks = [
    { to: '/', label: t('nav.home') },
    { to: '/catalog', label: t('nav.catalog') },
    { to: '/news', label: t('nav.news') },
    { to: '/order-lookup', label: t('nav.orderLookup') }
  ];

  return (
    <footer data-testid="site-footer" className="relative mt-auto overflow-hidden border-t border-primary-100/70 bg-gradient-to-b from-cream-100 via-blush-100/60 to-blush-200/50 text-ink-600 dark:border-white/10 dark:from-[#170e12] dark:via-[#1a1014] dark:to-[#120b0e] dark:text-ink-300">
      {/* Ambient pastel washes */}
      <div className="pointer-events-none absolute -top-32 left-1/4 h-72 w-72 rounded-full bg-primary-400/15 blur-[110px]" />
      <div className="pointer-events-none absolute -bottom-24 right-1/5 h-64 w-64 rounded-full bg-blush-400/20 blur-[100px]" />

      <div className="relative max-w-7xl mx-auto px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          {/* Brand */}
          <div className="md:col-span-5">
            <Link to="/" className="inline-flex items-center gap-2.5 group">
              {shopLogoUrl ? (
                <img data-testid="footer-shop-logo" src={shopLogoUrl} alt={shopName} className="h-10 w-10 rounded-full object-cover shadow-soft transition-transform duration-300 group-hover:scale-105" />
              ) : (
                <div className="relative h-10 w-10 rounded-full bg-brand-gradient flex items-center justify-center shadow-soft transition-transform duration-300 group-hover:scale-105">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
              )}
              <span data-testid="footer-shop-name" className="font-display text-2xl font-bold tracking-tight text-ink-900 dark:text-white">
                {shopName}
              </span>
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-ink-500 dark:text-ink-300 max-w-sm">
              {t('footer.tagline')}
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/70 ring-1 ring-primary-100 px-4 py-2 text-xs font-medium text-ink-600 dark:bg-white/5 dark:ring-white/10 dark:text-ink-300">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              {t('footer.authenticity')}
            </div>
          </div>

          {/* Quick Links */}
          <div className="md:col-span-3">
            <h4 className="text-[11px] font-bold text-ink-900 dark:text-white uppercase tracking-[0.22em]">{t('footer.quickLinks')}</h4>
            <ul className="mt-4 space-y-2.5">
              {quickLinks.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="group inline-flex items-center text-sm text-ink-500 dark:text-ink-300 hover:text-primary-700 dark:hover:text-primary-300 transition-colors duration-300"
                  >
                    <span className="h-px w-0 bg-gradient-to-r from-primary-500 to-primary-300 group-hover:w-3 mr-0 group-hover:mr-2 transition-all duration-300" />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div className="md:col-span-4">
            <h4 className="text-[11px] font-bold text-ink-900 dark:text-white uppercase tracking-[0.22em]">{t('footer.contact')}</h4>
            <ul className="mt-4 space-y-3 text-sm text-ink-500 dark:text-ink-300">
              <li className="flex items-start gap-3">
                <span className="mt-0.5 h-8 w-8 shrink-0 rounded-full bg-white/70 ring-1 ring-primary-100 dark:bg-white/5 dark:ring-white/10 flex items-center justify-center">
                  <Mail className="h-4 w-4 text-primary-500" />
                </span>
                <a data-testid="footer-support-email" href={`mailto:${supportEmail}`} className="pt-1.5 hover:text-primary-700 dark:hover:text-white transition-colors duration-300">{supportEmail}</a>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 h-8 w-8 shrink-0 rounded-full bg-white/70 ring-1 ring-primary-100 dark:bg-white/5 dark:ring-white/10 flex items-center justify-center">
                  <Phone className="h-4 w-4 text-primary-500" />
                </span>
                <a href={`tel:${supportPhone.replace(/\s+/g, '')}`} className="pt-1.5 hover:text-primary-700 dark:hover:text-white transition-colors duration-300">{supportPhone}</a>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 h-8 w-8 shrink-0 rounded-full bg-white/70 ring-1 ring-primary-100 dark:bg-white/5 dark:ring-white/10 flex items-center justify-center">
                  <MapPin className="h-4 w-4 text-primary-500" />
                </span>
                <span className="pt-1.5">{supportAddress}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-primary-100 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-[13px] text-ink-400">
          <p>&copy; {new Date().getFullYear()} {shopName}. {t('footer.rights')}</p>
          <p className="flex items-center gap-1.5">
            {t('footer.craftedFor')}
            <span className="editorial-serif text-primary-600 dark:text-primary-400">{t('footer.collectors')}</span>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
