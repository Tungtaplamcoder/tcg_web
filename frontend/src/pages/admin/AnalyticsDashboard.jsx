import React, { useEffect, useMemo, useState } from 'react';
import {
  DollarSign, ShoppingCart, Users, Package, Loader2, AlertCircle, TrendingUp,
  Clock, CheckCircle2, XCircle, Truck
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import api from '../../services/api';
import { formatVND } from '../../utils/format';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS_VI = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

// Trích phần ngày "YYYY-MM-DD" từ ISO string ("2026-08-30" | "2026-08-30T00:00:00.000Z")
// để tránh lệch ngày theo timezone của browser khi parse bằng new Date().
const parseDateKey = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
};

// Chuẩn hóa dữ liệu thô thành timeline 7 ngày liên tục (kể cả ngày 0đ), tăng dần theo ngày.
// Anchor về ngày mới nhất trong dữ liệu để khớp với CURRENT_DATE phía server.
const buildRevenueChartData = (revenueByDay) => {
  const byKey = new Map();
  let latestKey = null;

  (revenueByDay || []).forEach((entry) => {
    const parts = parseDateKey(entry.date);
    if (!parts) return;
    const key = `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
    byKey.set(key, {
      revenue: Number(entry.revenue) || 0,
      orders: Number(entry.orders) || 0
    });
    if (!latestKey || key > latestKey) latestKey = key;
  });

  if (!latestKey) return [];

  const anchor = parseDateKey(latestKey);
  const anchorMs = Date.UTC(anchor.year, anchor.month - 1, anchor.day);

  return Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(anchorMs - (6 - i) * DAY_MS);
    const year = dt.getUTCFullYear();
    const month = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const day = String(dt.getUTCDate()).padStart(2, '0');
    const key = `${year}-${month}-${day}`;
    const entry = byKey.get(key) || { revenue: 0, orders: 0 };
    return {
      ...entry,
      label: `${day}/${month}`,
      labelFull: `${day}/${month}/${year}`,
      weekday: WEEKDAYS_VI[dt.getUTCDay()]
    };
  });
};

// Nhãn Y-axis gọn: 25020000 -> "25 tr", 1500000 -> "1,5 tr"
const formatVNDCompact = (value) => {
  if (value >= 1e9) return `${(value / 1e9).toFixed(1).replace(/\.0$/, '').replace('.', ',')} tỷ`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1).replace(/\.0$/, '').replace('.', ',')} tr`;
  if (value >= 1e3) return `${Math.round(value / 1e3)}k`;
  return `${value}`;
};

const RevenueTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  const day = payload[0].payload;
  return (
    <div className="bg-white/95 backdrop-blur border border-primary-100 rounded-lg shadow-card px-3.5 py-2.5">
      <p className="text-xs font-semibold text-gray-500 mb-1">{day.weekday}, {day.labelFull}</p>
      <p className="text-sm font-bold text-primary-700">{formatVND(day.revenue)}</p>
      <p className="text-xs text-gray-500 mt-0.5">{day.orders} đơn hàng</p>
    </div>
  );
};

const AnalyticsDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const revenueChartData = useMemo(
    () => buildRevenueChartData(stats?.revenueByDay),
    [stats]
  );

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.get('/admin/dashboard/stats');
        setStats(response.data.data);
      } catch (err) {
        console.error('Failed to fetch dashboard stats:', err);
        setError('Failed to load dashboard statistics.');
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-12 w-12 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-4 bg-red-50 text-red-600 rounded-lg flex items-center">
        <AlertCircle className="h-5 w-5 mr-2" />
        {error || 'Failed to load stats'}
      </div>
    );
  }

  const statCards = [
    {
      label: 'Doanh thu',
      value: formatVND(stats.totalRevenue),
      icon: DollarSign,
      color: 'bg-green-100 text-green-600'
    },
    {
      label: 'Tổng đơn hàng',
      value: stats.totalOrders,
      icon: ShoppingCart,
      color: 'bg-blue-100 text-blue-600'
    },
    {
      label: 'Khách hàng',
      value: stats.totalCustomers,
      icon: Users,
      color: 'bg-purple-100 text-purple-600'
    },
    {
      label: 'Tổng tồn kho',
      value: stats.totalStock,
      icon: Package,
      color: 'bg-orange-100 text-orange-600'
    },
    {
      label: 'Chờ thanh toán',
      value: stats.pendingOrders,
      icon: Clock,
      color: 'bg-amber-100 text-amber-600'
    },
    {
      label: 'Đang đóng gói',
      value: stats.packagingOrders,
      icon: Package,
      color: 'bg-blue-100 text-blue-600'
    },
    {
      label: 'Đang giao hàng',
      value: stats.shippingOrders,
      icon: Truck,
      color: 'bg-indigo-100 text-indigo-600'
    },
    {
      label: 'Đã nhận hàng',
      value: stats.deliveredOrders,
      icon: CheckCircle2,
      color: 'bg-emerald-100 text-emerald-600'
    },
    {
      label: 'Đã hủy',
      value: stats.cancelledOrders,
      icon: XCircle,
      color: 'bg-rose-100 text-rose-600'
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Phân tích doanh thu</h2>
        <p className="text-gray-500">Tổng quan hoạt động cửa hàng</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white rounded-lg shadow-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{card.label}</p>
                  <p className="text-2xl font-bold text-gray-800 mt-1">{card.value}</p>
                </div>
                <div className={`p-3 rounded-full ${card.color}`}>
                  <Icon className="h-6 w-6" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Revenue by day chart */}
      <div className="bg-white rounded-lg shadow-card p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          <TrendingUp className="h-5 w-5 mr-2 text-primary-600" />
          Doanh thu 7 ngày qua
        </h3>
        {revenueChartData.length > 0 ? (
          <div className="h-72 w-full">
            <ResponsiveContainer>
              <AreaChart data={revenueChartData} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ede9fe" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                  interval={0}
                  tickMargin={8}
                />
                <YAxis
                  tickFormatter={formatVNDCompact}
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                  tickMargin={4}
                />
                <Tooltip content={<RevenueTooltip />} cursor={{ stroke: '#c4b5fd', strokeWidth: 1.5 }} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#7c3aed"
                  strokeWidth={2.5}
                  fill="url(#revenueGradient)"
                  dot={{ r: 3, fill: '#7c3aed', strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#7c3aed', stroke: '#ffffff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-gray-500">Chưa có dữ liệu doanh thu.</p>
        )}
      </div>

      {/* Recent orders table */}
      <div className="bg-white rounded-lg shadow-card p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Đơn hàng gần đây</h3>
        {stats.recentOrders && stats.recentOrders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Mã đơn</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Khách hàng</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tổng tiền</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Trạng thái</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ngày</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stats.recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="px-4 py-2 font-mono text-xs">{order.orderCode}</td>
                    <td className="px-4 py-2 text-sm text-gray-700">{order.customer || order.user?.email}</td>
                    <td className="px-4 py-2 text-sm font-medium">{formatVND(order.grandTotal)}</td>
                    <td className="px-4 py-2 text-sm">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {order.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-500">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500">Không có đơn hàng gần đây.</p>
        )}
      </div>
    </div>
  );
};

export default AnalyticsDashboard;