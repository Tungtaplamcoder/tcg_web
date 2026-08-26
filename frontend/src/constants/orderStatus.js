import { Clock, Package, Truck, CheckCircle2, XCircle, CreditCard } from 'lucide-react';

export const STATUS_MAP = {
  PENDING: {
    label: 'Chờ thanh toán',
    icon: Clock,
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200'
  },
  PACKAGING: {
    label: 'Đang đóng gói',
    icon: Package,
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200'
  },
  SHIPPING: {
    label: 'Đang giao hàng',
    icon: Truck,
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200'
  },
  DELIVERED: {
    label: 'Đã nhận hàng',
    icon: CheckCircle2,
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200'
  },
  CANCELLED: {
    label: 'Đã hủy',
    icon: XCircle,
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200'
  },
};

export const TIMELINE_STEPS = [
  { key: 'PENDING', label: 'Thanh toán', icon: CreditCard },
  { key: 'PACKAGING', label: 'Đóng gói', icon: Package },
  { key: 'SHIPPING', label: 'Vận chuyển', icon: Truck },
  { key: 'DELIVERED', label: 'Nhận hàng', icon: CheckCircle2 },
];