import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, Loader2, AlertCircle, ChevronLeft, ChevronRight, Eye, XCircle, Loader
} from 'lucide-react';
import api from '../services/api';
import { STATUS_MAP } from '../constants/orderStatus';

const OrderManagement = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ totalPages: 1 });
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit: 20 };
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;
      const response = await api.get('/admin/orders', { params });
      setOrders(response.data.data.items || []);
      setMeta(response.data.data.meta || { totalPages: 1 });
    } catch (err) {
      console.error('Failed to fetch orders:', err);
      setError('Failed to load orders.');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleStatusChange = async (orderId, newStatus) => {
    setUpdatingId(orderId);
    setError('');
    try {
      await api.patch(`/admin/orders/${orderId}/status`, { status: newStatus, note: 'Cập nhật từ trang quản lý' });
      fetchOrders();
      setSelectedOrder(null);
    } catch (err) {
      console.error('Failed to update status:', err);
      setError(err.response?.data?.error?.message || 'Failed to update order status.');
    } finally {
      setUpdatingId(null);
    }
  };

  const getStatusBadge = (status) => {
    const config = STATUS_MAP[status] || {
      label: status,
      icon: Loader,
      badgeClass: 'bg-gray-50 text-gray-700 border-gray-200'
    };
    const Icon = config.icon;
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${config.badgeClass}`}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </span>
    );
  };

  const openOrderDetail = (order) => setSelectedOrder(order);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Quản lý đơn hàng</h2>
        <p className="text-gray-500">Xem và cập nhật trạng thái đơn hàng</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo mã đơn..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="PENDING">Chờ thanh toán</option>
          <option value="PACKAGING">Đang đóng gói</option>
          <option value="SHIPPING">Đang giao hàng</option>
          <option value="DELIVERED">Đã nhận hàng</option>
          <option value="CANCELLED">Đã hủy</option>
        </select>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-600 rounded-lg flex items-center">
          <AlertCircle className="h-5 w-5 mr-2" />
          {error}
        </div>
      )}

      {/* Orders Table */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12 text-gray-500">Không có đơn hàng nào.</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mã đơn</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Khách hàng</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tổng tiền</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trạng thái</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ngày tạo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Thao tác</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{order.orderCode}</td>
                  <td className="px-4 py-3 text-sm">
                    <p className="font-medium">{order.user?.fullName || 'N/A'}</p>
                    <p className="text-xs text-gray-500">{order.user?.email}</p>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold">${Number(order.grandTotal).toFixed(2)}</td>
                  <td className="px-4 py-3">{getStatusBadge(order.status)}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{new Date(order.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => openOrderDetail(order)}
                        className="p-1 text-gray-600 hover:text-gray-800"
                        title="Xem chi tiết"
                      >
                        <Eye className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="flex justify-center items-center space-x-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="p-2 border border-gray-300 rounded-lg"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span>Page {page} of {meta.totalPages}</span>
          <button
            onClick={() => setPage(Math.min(meta.totalPages, page + 1))}
            disabled={page >= meta.totalPages}
            className="p-2 border border-gray-300 rounded-lg"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Chi tiết đơn hàng</h3>
                <button onClick={() => setSelectedOrder(null)} className="text-gray-500 hover:text-gray-700">
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3">
                <p><strong>Mã đơn:</strong> {selectedOrder.orderCode}</p>
                <p><strong>Khách hàng:</strong> {selectedOrder.user?.fullName} ({selectedOrder.user?.email})</p>
                <p><strong>Tổng tiền:</strong> ${Number(selectedOrder.grandTotal).toFixed(2)}</p>
                <p><strong>Trạng thái:</strong> {getStatusBadge(selectedOrder.status)}</p>
                <p><strong>Địa chỉ:</strong> {selectedOrder.shippingAddress?.fullName}, {selectedOrder.shippingAddress?.addressLine1}, {selectedOrder.shippingAddress?.city}</p>
                <p><strong>SĐT:</strong> {selectedOrder.shippingAddress?.phone}</p>

                {/* Items */}
                <div className="mt-4">
                  <h4 className="font-medium text-sm mb-2">Sản phẩm</h4>
                  <ul className="space-y-2">
                    {selectedOrder.items?.map((item, idx) => (
                      <li key={idx} className="flex justify-between text-sm">
                        <span>{item.product?.name || item.card?.sku || 'Sản phẩm'} x {item.quantity}</span>
                        <span>${Number(item.totalPrice).toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Action buttons dựa trên trạng thái */}
                <div className="mt-6 flex flex-wrap gap-2">
                  {selectedOrder.status === 'PENDING' && (
                    <>
                      <button
                        onClick={() => handleStatusChange(selectedOrder.id, 'PACKAGING')}
                        disabled={updatingId === selectedOrder.id}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                      >
                        {updatingId === selectedOrder.id ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Xác nhận thanh toán'}
                      </button>
                      <button
                        onClick={() => handleStatusChange(selectedOrder.id, 'CANCELLED')}
                        disabled={updatingId === selectedOrder.id}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                      >
                        Hủy đơn
                      </button>
                    </>
                  )}
                  {selectedOrder.status === 'PACKAGING' && (
                    <>
                      <button
                        onClick={() => handleStatusChange(selectedOrder.id, 'SHIPPING')}
                        disabled={updatingId === selectedOrder.id}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        Bắt đầu vận chuyển
                      </button>
                      <button
                        onClick={() => handleStatusChange(selectedOrder.id, 'CANCELLED')}
                        disabled={updatingId === selectedOrder.id}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                      >
                        Hủy đơn
                      </button>
                    </>
                  )}
                  {selectedOrder.status === 'SHIPPING' && (
                    <button
                      onClick={() => handleStatusChange(selectedOrder.id, 'DELIVERED')}
                      disabled={updatingId === selectedOrder.id}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                    >
                      Đã giao hàng
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderManagement;