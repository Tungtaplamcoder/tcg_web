import React, { useState, useEffect, useCallback } from 'react';
import {
  ScrollText,
  Search,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  ChevronLeft,
  ChevronRight,
  Eye,
  Check,
  X
} from 'lucide-react';
import api from '../../services/api';

const PaymentLogAudit = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ totalPages: 1 });
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);
  const [reconciling, setReconciling] = useState(false);
  const [reconcileNote, setReconcileNote] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit: 20 };
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;
      const response = await api.get('/admin/payments/logs', { params });
      setLogs(response.data.data.items || []);
      setMeta(response.data.data.meta || { totalPages: 1 });
    } catch (err) {
      console.error('Failed to fetch payment logs:', err);
      setError('Failed to load payment logs.');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleReconcile = async (action) => {
    if (!selectedLog) return;
    setReconciling(true);
    setError('');
    try {
      await api.post('/admin/payments/reconcile', {
        paymentLogId: selectedLog.id,
        action,
        note: reconcileNote
      });
      setSelectedLog(null);
      setReconcileNote('');
      fetchLogs();
    } catch (err) {
      console.error('Reconciliation failed:', err);
      setError('Failed to reconcile payment log.');
    } finally {
      setReconciling(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'MISMATCH':
      case 'AMOUNT_MISMATCH':
      case 'SIGNATURE_MISMATCH':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'INVALID_PAYLOAD':
      case 'ERROR':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'DUPLICATE':
        return <Info className="h-5 w-5 text-blue-500" />;
      default:
        return <ScrollText className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusBadgeClasses = (status) => {
    if (status === 'COMPLETED') return 'bg-green-100 text-green-800';
    if (['MISMATCH', 'AMOUNT_MISMATCH', 'SIGNATURE_MISMATCH'].includes(status)) return 'bg-red-100 text-red-800';
    if (['INVALID_PAYLOAD', 'ERROR'].includes(status)) return 'bg-yellow-100 text-yellow-800';
    if (status === 'DUPLICATE') return 'bg-blue-100 text-blue-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Payment Log Audit</h2>
        <p className="text-gray-500">Review and reconcile SePay payment logs</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by transaction ID, content, order code..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="COMPLETED">Completed</option>
          <option value="MISMATCH">Mismatch</option>
          <option value="AMOUNT_MISMATCH">Amount Mismatch</option>
          <option value="SIGNATURE_MISMATCH">Signature Mismatch</option>
          <option value="INVALID_PAYLOAD">Invalid Payload</option>
          <option value="DUPLICATE">Duplicate</option>
          <option value="ERROR">Error</option>
        </select>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-600 rounded-lg flex items-center">
          <AlertCircle className="h-5 w-5 mr-2" />
          {error}
        </div>
      )}

      {/* Logs table */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No payment logs found.</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transaction ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Content</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-mono">{log.sepayTransactionId || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{log.content || '-'}</td>
                  <td className="px-4 py-3 text-sm font-medium">${log.amount ? Number(log.amount).toFixed(2) : '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClasses(log.status)}`}>
                      {getStatusIcon(log.status)}
                      <span className="ml-1">{log.status}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setSelectedLog(log)}
                      className="p-1 text-blue-600 hover:text-blue-800"
                      title="View details"
                    >
                      <Eye className="h-5 w-5" />
                    </button>
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
            className="p-2 border border-gray-300 rounded-lg text-gray-700 disabled:opacity-50 hover:bg-gray-50"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-gray-700">Page {page} of {meta.totalPages}</span>
          <button
            onClick={() => setPage(Math.min(meta.totalPages, page + 1))}
            disabled={page >= meta.totalPages}
            className="p-2 border border-gray-300 rounded-lg text-gray-700 disabled:opacity-50 hover:bg-gray-50"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Payment Log Details</h3>
                <button onClick={() => setSelectedLog(null)} className="text-gray-500 hover:text-gray-700">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">ID</span>
                  <span className="font-mono">{selectedLog.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Transaction ID</span>
                  <span className="font-mono">{selectedLog.sepayTransactionId || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Content</span>
                  <span>{selectedLog.content || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Amount</span>
                  <span className="font-medium">${selectedLog.amount ? Number(selectedLog.amount).toFixed(2) : '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Status</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClasses(selectedLog.status)}`}>
                    {selectedLog.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Order</span>
                  <span>{selectedLog.order?.orderCode || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Created At</span>
                  <span>{new Date(selectedLog.createdAt).toLocaleString()}</span>
                </div>
                {selectedLog.errorMessage && (
                  <div className="p-3 bg-gray-50 rounded">
                    <p className="text-gray-700"><strong>Error:</strong> {selectedLog.errorMessage}</p>
                  </div>
                )}
                <div>
                  <p className="text-gray-500 mb-1">Raw Payload</p>
                  <pre className="bg-gray-50 p-3 rounded text-xs overflow-x-auto max-h-40">
                    {JSON.stringify(selectedLog.rawPayload, null, 2)}
                  </pre>
                </div>
              </div>

              {/* Reconciliation actions */}
              <div className="mt-6 border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Reconciliation Note</label>
                <textarea
                  value={reconcileNote}
                  onChange={(e) => setReconcileNote(e.target.value)}
                  rows={2}
                  placeholder="Optional note..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <div className="mt-4 flex justify-end space-x-3">
                  <button
                    onClick={() => handleReconcile('MARK_AS_MISMATCH')}
                    disabled={reconciling}
                    className="inline-flex items-center px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Mark as Mismatch
                  </button>
                  <button
                    onClick={() => handleReconcile('MARK_AS_COMPLETED')}
                    disabled={reconciling || !selectedLog.orderId}
                    className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {reconciling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                    Mark as Completed
                  </button>
                </div>
                {!selectedLog.orderId && (
                  <p className="mt-2 text-xs text-gray-500">Mark as Completed is disabled because no order is associated.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentLogAudit;