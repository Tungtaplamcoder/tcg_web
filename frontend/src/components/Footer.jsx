import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Mail, Phone, MapPin, ShieldCheck } from 'lucide-react';

const Footer = () => {
  const quickLinks = [
    { to: '/', label: 'Home' },
    { to: '/catalog', label: 'Catalog' },
    { to: '/news', label: 'News' },
    { to: '/order-lookup', label: 'Order Lookup' }
  ];

  return (
    <footer className="relative mt-auto overflow-hidden bg-ink-950 text-ink-300">
      {/* Ambient gradient washes */}
      <div className="pointer-events-none absolute -top-32 left-1/4 h-72 w-72 rounded-full bg-primary-600/20 blur-[110px]" />
      <div className="pointer-events-none absolute -bottom-24 right-1/5 h-64 w-64 rounded-full bg-fuchsia-600/15 blur-[100px]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />

      <div className="relative max-w-7xl mx-auto px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          {/* Brand */}
          <div className="md:col-span-5">
            <Link to="/" className="inline-flex items-center gap-2.5 group">
              <div className="relative h-10 w-10 rounded-xl bg-brand-gradient flex items-center justify-center shadow-glow transition-transform duration-300 group-hover:scale-105">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <span className="font-display text-2xl font-bold tracking-tight text-white">
                TCG<span className="text-gradient-brand">Store</span>
              </span>
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-ink-400 max-w-sm">
              Your premier destination for Trading Card Game collectibles, booster boxes, and
              singles. Every card is verified, authenticated, and shipped with care.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/5 ring-1 ring-white/10 px-4 py-2 text-xs font-medium text-ink-300">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              100% Authenticity Guaranteed
            </div>
          </div>

          {/* Quick Links */}
          <div className="md:col-span-3">
            <h4 className="text-[11px] font-bold text-white uppercase tracking-[0.22em]">Quick Links</h4>
            <ul className="mt-4 space-y-2.5">
              {quickLinks.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="group inline-flex items-center text-sm text-ink-400 hover:text-white transition-colors duration-300"
                  >
                    <span className="h-px w-0 bg-gradient-to-r from-primary-400 to-fuchsia-400 group-hover:w-3 mr-0 group-hover:mr-2 transition-all duration-300" />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div className="md:col-span-4">
            <h4 className="text-[11px] font-bold text-white uppercase tracking-[0.22em]">Contact</h4>
            <ul className="mt-4 space-y-3 text-sm text-ink-400">
              <li className="flex items-start gap-3">
                <span className="mt-0.5 h-8 w-8 shrink-0 rounded-lg bg-white/5 ring-1 ring-white/10 flex items-center justify-center">
                  <Mail className="h-4 w-4 text-primary-300" />
                </span>
                <span className="pt-1.5">support@tcgstore.com</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 h-8 w-8 shrink-0 rounded-lg bg-white/5 ring-1 ring-white/10 flex items-center justify-center">
                  <Phone className="h-4 w-4 text-primary-300" />
                </span>
                <span className="pt-1.5">+84 123 456 789</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 h-8 w-8 shrink-0 rounded-lg bg-white/5 ring-1 ring-white/10 flex items-center justify-center">
                  <MapPin className="h-4 w-4 text-primary-300" />
                </span>
                <span className="pt-1.5">123 Main St, Hanoi, Vietnam</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-[13px] text-ink-500">
          <p>&copy; {new Date().getFullYear()} TCG Store. All rights reserved.</p>
          <p className="flex items-center gap-1.5">
            Crafted for collectors
            <span className="text-gradient-brand font-semibold">worldwide</span>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
