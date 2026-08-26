import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Loader2, X, Save, AlertCircle } from 'lucide-react';
import api from '../services/api';
import ConfirmDialog from '../components/ConfirmDialog';

const CategoryManagement = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchCategories = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await api.get('/admin/categories');
      setCategories(response.data.data || []);
    } catch (err) { console.error(err); setError('Không thể tải danh mục.'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const handleCreate = () => {
    setEditing({});
    setName('');
  };

  const handleEdit = (cat) => {
    setEditing(cat);
    setName(cat.name);
  };

  const handleClose = () => setEditing(null);

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      if (editing?.id) await api.patch(`/admin/categories/${editing.id}`, { name });
      else await api.post('/admin/categories', { name });
      handleClose(); fetchCategories();
    } catch (err) { console.error(err); setError(err.response?.data?.error?.message || 'Lỗi lưu danh mục.'); } finally { setSaving(false); }
  };

  const openDelete = (cat) => setDeleteTarget(cat);

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget) return; setDeleteLoading(true); setError('');
    try { await api.delete(`/admin/categories/${deleteTarget.id}`); setDeleteTarget(null); fetchCategories(); }
    catch (err) { console.error(err); setError(err.response?.data?.error?.message || 'Lỗi xóa danh mục.'); } finally { setDeleteLoading(false); }
  };

  return (
    <div className="space-y-6">
      <ConfirmDialog isOpen={deleteTarget !== null} title="Xóa danh mục"
        message={`Bạn chắc chắn muốn xóa danh mục "${deleteTarget?.name}"? Sản phẩm thuộc danh mục sẽ bị xóa nếu không còn hàng.`}
        confirmLabel="Xóa" cancelLabel="Hủy" variant="danger" loading={deleteLoading}
        onConfirm={handleDeleteConfirmed} onCancel={() => setDeleteTarget(null)} />

      <div className="flex justify-between items-center">
        <div><h2 className="text-2xl font-bold text-gray-800">Quản lý danh mục</h2></div>
        <button onClick={handleCreate} className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"><Plus className="h-5 w-5 mr-2" />Thêm danh mục</button>
      </div>

      {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg flex items-center"><AlertCircle className="h-5 w-5 mr-2" />{error}</div>}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div> :
          categories.length === 0 ? <div className="text-center py-12 text-gray-500">Chưa có danh mục.</div> :
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50"><tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tên danh mục</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Số sản phẩm</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Thao tác</th>
            </tr></thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {categories.map((cat) => (
                <tr key={cat.id}>
                  <td className="px-4 py-3 font-medium text-gray-800">{cat.name}</td>
                  <td className="px-4 py-3 text-gray-600">{cat._count?.products || 0}</td>
                  <td className="px-4 py-3"><div className="flex space-x-2">
                    <button onClick={() => handleEdit(cat)} className="p-1 text-blue-600 hover:text-blue-800"><Pencil className="h-5 w-5" /></button>
                    <button onClick={() => openDelete(cat)} className="p-1 text-red-500 hover:text-red-700"><Trash2 className="h-5 w-5" /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">{editing.id ? 'Sửa danh mục' : 'Thêm danh mục'}</h3>
              <button onClick={handleClose} className="text-gray-500 hover:text-gray-700"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <label className="block text-sm font-medium text-gray-700">Tên *</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
              <div className="mt-4 flex justify-end space-x-3">
                <button type="button" onClick={handleClose} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Hủy</button>
                <button type="submit" disabled={saving} className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">{saving ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Save className="h-5 w-5 mr-2" />}{saving ? 'Đang lưu...' : 'Lưu'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoryManagement;