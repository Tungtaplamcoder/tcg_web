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
    <footer
      data-testid="site-footer"
      className="relative mt-auto overflow-hidden border-t border-pink-100 bg-white/90 text-neutral-800 shadow-inner dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200"
    >
      {/* Ambient pastel pink washes — subtle on the light paper, richer on dark */}
      <div className="pointer-events-none absolute -top-32 left-1/4 h-72 w-72 rounded-full bg-pink-500/10 blur-[110px] dark:bg-pink-500/15" />
      <div className="pointer-events-none absolute -bottom-24 right-1/5 h-64 w-64 rounded-full bg-rose-500/10 blur-[100px] dark:bg-rose-500/15" />

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
              <span data-testid="footer-shop-name" className="font-display text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
                {shopName}
              </span>
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400 max-w-sm">
              {t('footer.tagline')}
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-pink-500/10 ring-1 ring-pink-500/20 px-4 py-2 text-xs font-medium text-neutral-600 dark:bg-white/5 dark:text-neutral-300">
              <ShieldCheck className="h-4 w-4 text-pink-500 dark:text-pink-400" />
              {t('footer.authenticity')}
            </div>
          </div>

          {/* Quick Links */}
          <div className="md:col-span-3">
            <h4 className="text-[11px] font-bold text-neutral-900 uppercase tracking-[0.22em] dark:text-white">{t('footer.quickLinks')}</h4>
            <ul className="mt-4 space-y-2.5">
              {quickLinks.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="group inline-flex items-center text-sm text-neutral-600 hover:text-pink-600 transition-colors duration-300 dark:text-neutral-400 dark:hover:text-pink-300"
                  >
                    <span className="h-px w-0 bg-gradient-to-r from-pink-500 to-pink-300 group-hover:w-3 mr-0 group-hover:mr-2 transition-all duration-300" />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div className="md:col-span-4">
            <h4 className="text-[11px] font-bold text-neutral-900 uppercase tracking-[0.22em] dark:text-white">{t('footer.contact')}</h4>
            <ul className="mt-4 space-y-3 text-sm text-neutral-600 dark:text-neutral-400">
              <li className="flex items-start gap-3">
                <span className="mt-0.5 h-8 w-8 shrink-0 rounded-full bg-pink-500/10 ring-1 ring-pink-500/20 flex items-center justify-center dark:bg-white/5">
                  <Mail className="h-4 w-4 text-pink-500 dark:text-pink-400" />
                </span>
                <a data-testid="footer-support-email" href={`mailto:${supportEmail}`} className="pt-1.5 hover:text-pink-600 transition-colors duration-300 dark:hover:text-pink-300">{supportEmail}</a>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 h-8 w-8 shrink-0 rounded-full bg-pink-500/10 ring-1 ring-pink-500/20 flex items-center justify-center dark:bg-white/5">
                  <Phone className="h-4 w-4 text-pink-500 dark:text-pink-400" />
                </span>
                <a href={`tel:${supportPhone.replace(/\s+/g, '')}`} className="pt-1.5 hover:text-pink-600 transition-colors duration-300 dark:hover:text-pink-300">{supportPhone}</a>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 h-8 w-8 shrink-0 rounded-full bg-pink-500/10 ring-1 ring-pink-500/20 flex items-center justify-center dark:bg-white/5">
                  <MapPin className="h-4 w-4 text-pink-500 dark:text-pink-400" />
                </span>
                <span className="pt-1.5">{supportAddress}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-pink-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-[13px] text-neutral-500 dark:border-white/10 dark:text-neutral-500">
          <p>&copy; {new Date().getFullYear()} {shopName}. {t('footer.rights')}</p>
          <p className="flex items-center gap-1.5">
            {t('footer.craftedFor')}
            <span className="editorial-serif text-pink-500 dark:text-pink-400">{t('footer.collectors')}</span>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
