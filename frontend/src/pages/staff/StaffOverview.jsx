import React, { useEffect, useState } from 'react';
import {
  Package,
  MessageSquare,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';
import { STATUS_MAP } from '../../constants/orderStatus';
import { formatVND } from '../../utils/format';

const StaffOverview = () => {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [packagingOrders, setPackagingOrders] = useState([]);
  const [packagingOrdersTotal, setPackagingOrdersTotal] = useState(0);
  const [chatRooms, setChatRooms] = useState([]);

  // Kiểm tra quyền của staff dựa trên user object (đã có permissions từ backend)
  const canAccessChat = user?.role === 'ADMIN' || user?.canAccessChat;

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');

      try {
        // 1. Đơn hàng cần xử lý — các đơn đang ở trạng thái "Đang đóng gói"
        try {
          const ordersRes = await api.get('/admin/orders', {
            params: { page: 1, limit: 5, status: 'PACKAGING' }
          });
          setPackagingOrders(ordersRes.data.data?.items || []);
          setPackagingOrdersTotal(ordersRes.data.data?.meta?.totalItems || 0);
        } catch (err) {
          console.error('Failed to fetch packaging orders:', err);
          setPackagingOrders([]);
          setPackagingOrdersTotal(0);
          setError('Không thể tải danh sách đơn hàng đang đóng gói.');
        }

        // 2. Phòng chat hỗ trợ (chỉ khi có quyền truy cập chat)
        if (canAccessChat) {
          try {
            const chatRes = await api.get('/admin/chat/rooms');
            // Backend trả về data là mảng trực tiếp
            setChatRooms(chatRes.data.data || []);
          } catch (err) {
            console.error('Failed to fetch chat rooms:', err);
            setChatRooms([]);
          }
        }
      } catch (err) {
        // Lỗi tổng thể (không xảy ra vì đã catch từng phần)
        console.error('Unexpected error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-12 w-12 animate-spin text-primary-600" />
      </div>
    );
  }

  const packagingStatus = STATUS_MAP.PACKAGING;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Staff Dashboard</h2>
        <p className="text-gray-500">Công việc cần xử lý</p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-600 rounded-lg flex items-center">
          <AlertCircle className="h-5 w-5 mr-2 shrink-0" />
          {error}
        </div>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow-card p-4">
          <div className="flex items-center space-x-3">
            <Package className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold text-gray-800">{packagingOrdersTotal}</p>
              <p className="text-sm text-gray-500">Đơn hàng cần xử lý (Đang đóng gói)</p>
            </div>
          </div>
        </div>

        {canAccessChat && (
          <div className="bg-white rounded-lg shadow-card p-4">
            <div className="flex items-center space-x-3">
              <MessageSquare className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold text-gray-800">{chatRooms.length}</p>
                <p className="text-sm text-gray-500">Phòng chat đang mở</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Packaging orders */}
      <div className="bg-white rounded-lg shadow-card p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-500" />
            Đơn hàng cần xử lý
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${packagingStatus.badgeClass}`}>
              {packagingStatus.label}
            </span>
          </h3>
          {packagingOrdersTotal > 0 && (
            <Link
              to="/staff/orders?status=PACKAGING"
              className="text-sm text-primary-600 hover:underline shrink-0"
            >
              Xem tất cả ({packagingOrdersTotal}) →
            </Link>
          )}
        </div>
        {!error && packagingOrders.length === 0 ? (
          <p className="text-gray-500">Không có đơn hàng đang đóng gói.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Mã đơn</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Khách hàng</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tổng tiền</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ngày tạo</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {packagingOrders.map(order => (
                  <tr key={order.id}>
                    <td className="px-4 py-2 font-mono text-xs">{order.orderCode}</td>
                    <td className="px-4 py-2 text-sm">{order.user?.fullName || order.user?.email}</td>
                    <td className="px-4 py-2 text-sm font-medium">{formatVND(order.grandTotal)}</td>
                    <td className="px-4 py-2 text-sm text-gray-500">
                      {new Date(order.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Open chat rooms */}
      {canAccessChat && (
        <div className="bg-white rounded-lg shadow-card p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <MessageSquare className="h-5 w-5 mr-2 text-blue-500" />
            Hỗ trợ khách hàng
          </h3>
          {chatRooms.length === 0 ? (
            <p className="text-gray-500">Không có phòng chat đang mở.</p>
          ) : (
            <ul className="space-y-2">
              {chatRooms.map(room => (
                <li key={room.id} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">{room.subject}</span>
                  <span className="text-sm text-gray-500">
                    {room.user?.fullName || room.user?.email}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default StaffOverview;
