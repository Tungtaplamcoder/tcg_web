import React, { useEffect, useState } from 'react';
import {
  Clock,
  Package,
  MessageSquare,
  AlertTriangle,
  Loader2,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import api from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';

const StaffOverview = () => {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingOrders, setPendingOrders] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [chatRooms, setChatRooms] = useState([]);

  // Kiểm tra quyền của staff dựa trên user object (đã có permissions từ backend)
  const canManageInventory = user?.role === 'ADMIN' || user?.canManageInventory;
  const canAccessChat = user?.role === 'ADMIN' || user?.canAccessChat;

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');

      try {
        // 1. Đơn hàng chờ xử lý (luôn hiển thị vì staff có quyền xem orders)
        try {
          const ordersRes = await api.get('/admin/orders', {
            params: { page: 1, limit: 5, status: 'PENDING' }
          });
          setPendingOrders(ordersRes.data.data?.items || []);
        } catch (err) {
          console.error('Failed to fetch pending orders:', err);
          setPendingOrders([]);
        }

        // 2. Sản phẩm sắp hết hàng (chỉ khi có quyền quản lý inventory)
        if (canManageInventory) {
          try {
            const productsRes = await api.get('/admin/products', {
              params: { page: 1, limit: 100 }
            });
            const allProducts = productsRes.data.data?.items || [];
            setLowStockProducts(allProducts.filter(p => p.stockQuantity <= 5));
          } catch (err) {
            console.error('Failed to fetch low stock products:', err);
            setLowStockProducts([]);
          }
        }

        // 3. Phòng chat hỗ trợ (chỉ khi có quyền truy cập chat)
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Staff Dashboard</h2>
        <p className="text-gray-500">Công việc cần xử lý</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-card p-4">
          <div className="flex items-center space-x-3">
            <Clock className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-2xl font-bold text-gray-800">{pendingOrders.length}</p>
              <p className="text-sm text-gray-500">Đơn hàng chờ xử lý</p>
            </div>
          </div>
        </div>

        {canManageInventory && (
          <div className="bg-white rounded-lg shadow-card p-4">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-2xl font-bold text-gray-800">{lowStockProducts.length}</p>
                <p className="text-sm text-gray-500">Sản phẩm sắp hết hàng</p>
              </div>
            </div>
          </div>
        )}

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

      {/* Pending orders */}
      <div className="bg-white rounded-lg shadow-card p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          <Clock className="h-5 w-5 mr-2 text-yellow-500" />
          Đơn hàng cần xử lý
        </h3>
        {pendingOrders.length === 0 ? (
          <p className="text-gray-500">Không có đơn hàng chờ xử lý.</p>
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
                {pendingOrders.map(order => (
                  <tr key={order.id}>
                    <td className="px-4 py-2 font-mono text-xs">{order.orderCode}</td>
                    <td className="px-4 py-2 text-sm">{order.user?.fullName || order.user?.email}</td>
                    <td className="px-4 py-2 text-sm font-medium">${Number(order.grandTotal).toFixed(2)}</td>
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

      {/* Low stock products */}
      {canManageInventory && (
        <div className="bg-white rounded-lg shadow-card p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2 text-red-500" />
            Sản phẩm sắp hết hàng
          </h3>
          {lowStockProducts.length === 0 ? (
            <p className="text-gray-500">Không có sản phẩm nào sắp hết.</p>
          ) : (
            <ul className="space-y-2">
              {lowStockProducts.map(product => (
                <li key={product.id} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">{product.name}</span>
                  <span className="text-sm font-bold text-red-600">Còn {product.stockQuantity}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

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