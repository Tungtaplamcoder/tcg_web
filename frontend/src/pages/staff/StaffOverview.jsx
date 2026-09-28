import React, { useEffect, useState } from 'react';
import {
  Package,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useLanguage } from '../../i18n/LanguageContext';
import { STATUS_MAP } from '../../constants/orderStatus';
import { formatVND } from '../../utils/format';

const StaffOverview = () => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [packagingOrders, setPackagingOrders] = useState([]);
  const [packagingOrdersTotal, setPackagingOrdersTotal] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');

      try {
        // Đơn hàng cần xử lý — các đơn đang ở trạng thái "Đang đóng gói"
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
          setError(t('staff.overview.noPackaging'));
        }
      } catch (err) {
        console.error('Unexpected error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [t]);

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
        <h2 className="text-2xl font-bold text-gray-800">{t('staff.overview.title')}</h2>
        <p className="text-gray-500">{t('staff.overview.workQueue')}</p>
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
              <p className="text-sm text-gray-500">{t('staff.overview.workQueue')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Packaging orders */}
      <div className="bg-white rounded-lg shadow-card p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-500" />
            {t('staff.overview.workQueue')}
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${packagingStatus.badgeClass}`}>
              {t(packagingStatus.labelKey)}
            </span>
          </h3>
          {packagingOrdersTotal > 0 && (
            <Link
              to="/staff/orders?status=PACKAGING"
              className="text-sm text-primary-600 hover:underline shrink-0"
            >
              {t('home.viewAll')} ({packagingOrdersTotal}) →
            </Link>
          )}
        </div>
        {!error && packagingOrders.length === 0 ? (
          <p className="text-gray-500">{t('staff.overview.noPackaging')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('staff.overview.colOrder')}</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('staff.overview.colCustomer')}</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('staff.overview.colTotal')}</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('staff.overview.colDate')}</th>
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
    </div>
  );
};

export default StaffOverview;
