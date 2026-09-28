import React from 'react';
import { ShieldCheck, Truck, BadgeCheck, RotateCcw } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

/**
 * TrustBadges — compact horizontal pill row of store guarantees
 * with clean vector icons. Rendered beneath the purchase actions.
 * Labels are i18n keys (product.trust.*) resolved at render time.
 */
const TRUST_ITEM_CONFIG = [
  { icon: ShieldCheck, key: 'product.trust.authentic', cls: 'text-emerald-600 dark:text-emerald-300', ring: 'ring-emerald-200/70 dark:ring-emerald-400/20', bg: 'bg-emerald-50/80 dark:bg-emerald-400/10' },
  { icon: Truck, key: 'product.trust.fastShipping', cls: 'text-primary-700 dark:text-primary-300', ring: 'ring-primary-200/70 dark:ring-primary-400/20', bg: 'bg-primary-50/80 dark:bg-primary-400/10' },
  { icon: BadgeCheck, key: 'product.trust.graded', cls: 'text-amber-600 dark:text-amber-300', ring: 'ring-amber-200/70 dark:ring-amber-400/20', bg: 'bg-amber-50/80 dark:bg-amber-400/10' },
  { icon: RotateCcw, key: 'product.trust.returns', cls: 'text-cyan-600 dark:text-cyan-300', ring: 'ring-cyan-200/70 dark:ring-cyan-400/20', bg: 'bg-cyan-50/80 dark:bg-cyan-400/10' }
];

const TrustBadges = ({ items }) => {
  const { t } = useLanguage();
  const list = items || TRUST_ITEM_CONFIG.map(({ key, ...rest }) => ({ ...rest, label: t(key) }));
  return (
    <div className="pd-trust-row" role="list">
      {list.map((item) => (
        <div key={item.label} className={`pd-trust-pill ${item.bg} ${item.ring}`} role="listitem">
          <item.icon className={`h-[15px] w-[15px] shrink-0 ${item.cls}`} aria-hidden="true" />
          <span className={`text-[11px] font-semibold sm:text-xs ${item.cls}`}>{item.label}</span>
        </div>
      ))}
    </div>
  );
};

export default TrustBadges;
