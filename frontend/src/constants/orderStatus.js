import { Clock, Package, Truck, CheckCircle2, XCircle, CreditCard } from 'lucide-react';

/* Labels live in the i18n dictionaries (orders.status.* / orders.timeline.*).
   This module keeps only the static presentation config (icon + badge
   classes); components resolve the translated label via t(). */

export const STATUS_MAP = {
  PENDING: {
    labelKey: 'orders.status.PENDING',
    icon: Clock,
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200'
  },
  PACKAGING: {
    labelKey: 'orders.status.PACKAGING',
    icon: Package,
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200'
  },
  SHIPPING: {
    labelKey: 'orders.status.SHIPPING',
    icon: Truck,
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200'
  },
  DELIVERED: {
    labelKey: 'orders.status.DELIVERED',
    icon: CheckCircle2,
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200'
  },
  CANCELLED: {
    labelKey: 'orders.status.CANCELLED',
    icon: XCircle,
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200'
  },
};

export const TIMELINE_STEPS = [
  { key: 'PENDING', labelKey: 'orders.timeline.PENDING', icon: CreditCard },
  { key: 'PACKAGING', labelKey: 'orders.timeline.PACKAGING', icon: Package },
  { key: 'SHIPPING', labelKey: 'orders.timeline.SHIPPING', icon: Truck },
  { key: 'DELIVERED', labelKey: 'orders.timeline.DELIVERED', icon: CheckCircle2 },
];
