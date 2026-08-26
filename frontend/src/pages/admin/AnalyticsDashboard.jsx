import React, { useEffect, useState } from 'react';
import {
  DollarSign, ShoppingCart, Users, Package, Loader2, AlertCircle, TrendingUp,
  Clock, CheckCircle2, XCircle, Truck
} from 'lucide-react';
import api from '../../services/api';

const AnalyticsDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
      value: `$${Number(stats.totalRevenue).toFixed(2)}`,
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
        {stats.revenueByDay && stats.revenueByDay.length > 0 ? (
          <div className="space-y-3">
            {stats.revenueByDay.map((day) => (
              <div key={day.date} className="flex items-center">
                <span className="w-24 text-sm text-gray-600">{day.date}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-6 relative">
                  <div
                    className="bg-primary-500 h-6 rounded-full flex items-center justify-end pr-2"
                    style={{ width: `${Math.min(100, (day.revenue / 100) * 2)}%` }}
                  >
                    <span className="text-xs font-medium text-white">${Number(day.revenue).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ))}
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
                    <td className="px-4 py-2 text-sm font-medium">${Number(order.grandTotal).toFixed(2)}</td>
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