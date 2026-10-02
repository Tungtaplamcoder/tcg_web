import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Loader2, X, Save, AlertCircle, CheckCircle2, Layers, Sparkles } from 'lucide-react';
import api from '../../services/api';
import ConfirmDialog from '../../components/ConfirmDialog';

/**
 * Centralized catalog configuration.
 *
 * Replaces the previously implicit/hardcoded option sources with a single
 * admin surface that manages the three catalogue dimensions side by side:
 *   • Series / Era      — Category tree nodes under "Single Cards"
 *   • Expansion Sets    — Category tree nodes under each Series
 *   • Rarities (Độ hiếm) — the dynamic `Rarity` catalogue
 *
 * Rarities mirror the Series/Expansion dynamic behaviour: create, edit,
 * disable and delete options that the product modal reads from the API.
 */
const CatalogConfig = () => {
  const [tab, setTab] = useState('rarity');
  const [categories, setCategories] = useState([]);
  const [rarities, setRarities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Rarity form
  const [rarityForm, setRarityForm] = useState({ id: '', code: '', name: '', description: '' });
  // Series form
  const [seriesName, setSeriesName] = useState('');
  // Expansion form
  const [expansionForm, setExpansionForm] = useState({ name: '', seriesId: '' });

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadAll = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [catsRes, raritiesRes] = await Promise.all([
        api.get('/admin/categories?activeOnly=false'),
        api.get('/admin/rarities', { params: { activeOnly: 'false' } })
      ]);
      setCategories(catsRes.data.data || []);
      setRarities(raritiesRes.data.data || []);
    } catch (err) {
      console.error(err);
      setError('Không thể tải cấu hình danh mục.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const singleCardsRoot = categories.find((c) => c.slug === 'single-cards');
  const seriesList = singleCardsRoot ? categories.filter((c) => c.parentId === singleCardsRoot.id) : [];
  const seriesIds = new Set(seriesList.map((s) => s.id));
  const expansionList = categories.filter((c) => c.parentId && seriesIds.has(c.parentId));

  const resetRarityForm = () => setRarityForm({ id: '', code: '', name: '', description: '' });

  const handleRaritySubmit = async (e) => {
    e.preventDefault();
    if (!rarityForm.name.trim()) return;
    setSaving(true); setError('');
    try {
      const payload = {
        name: rarityForm.name.trim(),
        code: (rarityForm.code.trim() || rarityForm.name.trim()),
        description: rarityForm.description.trim() || null
      };
      if (rarityForm.id) await api.put(`/admin/rarities/${rarityForm.id}`, payload);
      else await api.post('/admin/rarities', payload);
      resetRarityForm();
      await loadAll();
      showToast(rarityForm.id ? 'Đã cập nhật độ hiếm.' : 'Đã thêm độ hiếm mới.');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Lỗi lưu độ hiếm.');
    } finally { setSaving(false); }
  };

  const handleCreateSeries = async (e) => {
    e.preventDefault();
    if (!seriesName.trim() || !singleCardsRoot) return;
    setSaving(true); setError('');
    try {
      await api.post('/admin/categories', { name: seriesName.trim(), parentId: singleCardsRoot.id });
      setSeriesName('');
      await loadAll();
      showToast('Đã thêm Series / Era mới.');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Lỗi thêm Series / Era.');
    } finally { setSaving(false); }
  };

  const handleCreateExpansion = async (e) => {
    e.preventDefault();
    if (!expansionForm.name.trim() || !expansionForm.seriesId) return;
    setSaving(true); setError('');
    try {
      await api.post('/admin/categories', { name: expansionForm.name.trim(), parentId: expansionForm.seriesId });
      setExpansionForm({ name: '', seriesId: '' });
      await loadAll();
      showToast('Đã thêm Expansion Set mới.');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Lỗi thêm Expansion Set.');
    } finally { setSaving(false); }
  };

  const openDelete = (target) => setDeleteTarget(target);

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true); setError('');
    try {
      if (deleteTarget.kind === 'rarity') await api.delete(`/admin/rarities/${deleteTarget.id}`);
      else await api.delete(`/admin/categories/${deleteTarget.id}`);
      setDeleteTarget(null);
      await loadAll();
      showToast('Đã xóa.');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Lỗi xóa.');
    } finally { setDeleteLoading(false); }
  };

  const tabs = [
    { key: 'series', label: 'Series / Era', icon: Layers },
    { key: 'expansions', label: 'Expansion Sets', icon: Layers },
    { key: 'rarity', label: 'Quản lý Độ hiếm (Rarity)', icon: Sparkles }
  ];

  const btnPrimary = 'inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50';
  const inputCls = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100';

  return (
    <div className="space-y-6" data-testid="catalog-config">
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Xóa tùy chọn"
        message={`Bạn chắc chắn muốn xóa "${deleteTarget?.name}"?`}
        confirmLabel="Xóa"
        cancelLabel="Hủy"
        variant="danger"
        loading={deleteLoading}
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setDeleteTarget(null)}
      />

      <div>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Cấu hình Danh mục</h2>
        <p className="text-gray-500 dark:text-gray-400">
          Quản lý tập trung Series / Era, Expansion Sets và Độ hiếm (Rarity) dùng trong sản phẩm.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={`inline-flex items-center gap-2 px-4 py-2 -mb-px border-b-2 text-sm font-medium transition-colors ${
              tab === tb.key
                ? 'border-primary-600 text-primary-700 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <tb.icon className="h-4 w-4" /> {tb.label}
          </button>
        ))}
      </div>

      {toast && (
        <div className={`p-3 rounded-lg flex items-center ${toast.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-red-50 text-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle2 className="h-5 w-5 mr-2" /> : <AlertCircle className="h-5 w-5 mr-2" />}
          {toast.message}
        </div>
      )}
      {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg flex items-center"><AlertCircle className="h-5 w-5 mr-2" />{error}</div>}

      {/* ===================== RARITY TAB ===================== */}
      {tab === 'rarity' && (
        <div className="space-y-4">
          <form onSubmit={handleRaritySubmit} className="bg-white dark:bg-gray-900 rounded-lg shadow p-4 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Mã (code) *</label>
              <input type="text" value={rarityForm.code} onChange={(e) => setRarityForm((p) => ({ ...p, code: e.target.value }))} placeholder="HR" required className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Tên (name) *</label>
              <input type="text" value={rarityForm.name} onChange={(e) => setRarityForm((p) => ({ ...p, name: e.target.value }))} placeholder="Hyper Rare" required className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Mô tả</label>
              <input type="text" value={rarityForm.description} onChange={(e) => setRarityForm((p) => ({ ...p, description: e.target.value }))} placeholder="Tùy chọn" className={inputCls} />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className={btnPrimary}>
                {saving ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Save className="h-5 w-5 mr-2" />}
                {rarityForm.id ? 'Cập nhật' : 'Thêm'}
              </button>
              {rarityForm.id && (
                <button type="button" onClick={resetRarityForm} className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
          </form>

          <div className="bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden">
            {loading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div> : (
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800"><tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mã</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tên</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mô tả</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Thao tác</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {rarities.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-gray-500">Chưa có độ hiếm.</td></tr>}
                  {rarities.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-3 font-semibold text-gray-800 dark:text-gray-100">{r.code}</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{r.name}</td>
                      <td className="px-4 py-3 text-gray-500">{r.description || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex space-x-2">
                          <button onClick={() => setRarityForm({ id: r.id, code: r.code, name: r.name, description: r.description || '' })} className="p-1 text-blue-600 hover:text-blue-800" title="Sửa"><Pencil className="h-5 w-5" /></button>
                          <button onClick={() => openDelete({ kind: 'rarity', id: r.id, name: `${r.code} - ${r.name}` })} className="p-1 text-red-500 hover:text-red-700" title="Xóa"><Trash2 className="h-5 w-5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ===================== SERIES TAB ===================== */}
      {tab === 'series' && (
        <div className="space-y-4">
          <form onSubmit={handleCreateSeries} className="bg-white dark:bg-gray-900 rounded-lg shadow p-4 flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">Tên Series / Era mới *</label>
              <input type="text" value={seriesName} onChange={(e) => setSeriesName(e.target.value)} placeholder="VD: Mega Evolution" required className={inputCls} />
            </div>
            <button type="submit" disabled={saving || !singleCardsRoot} className={btnPrimary}><Plus className="h-5 w-5 mr-2" />Thêm Series</button>
          </form>
          <OptionTable
            loading={loading}
            rows={seriesList}
            empty="Chưa có Series / Era."
            onDelete={(r) => openDelete({ kind: 'category', id: r.id, name: r.name })}
          />
        </div>
      )}

      {/* ===================== EXPANSIONS TAB ===================== */}
      {tab === 'expansions' && (
        <div className="space-y-4">
          <form onSubmit={handleCreateExpansion} className="bg-white dark:bg-gray-900 rounded-lg shadow p-4 flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">Tên Expansion Set mới *</label>
              <input type="text" value={expansionForm.name} onChange={(e) => setExpansionForm((p) => ({ ...p, name: e.target.value }))} placeholder="VD: Surging Sparks (SSP)" required className={inputCls} />
            </div>
            <div className="sm:w-64">
              <label className="block text-xs font-medium text-gray-500 mb-1">Thuộc Series *</label>
              <select value={expansionForm.seriesId} onChange={(e) => setExpansionForm((p) => ({ ...p, seriesId: e.target.value }))} required className={inputCls}>
                <option value="">-- Chọn series --</option>
                {seriesList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <button type="submit" disabled={saving} className={btnPrimary}><Plus className="h-5 w-5 mr-2" />Thêm Expansion</button>
          </form>
          <OptionTable
            loading={loading}
            rows={expansionList}
            empty="Chưa có Expansion Set."
            parentLookup={Object.fromEntries(seriesList.map((s) => [s.id, s.name]))}
            onDelete={(r) => openDelete({ kind: 'category', id: r.id, name: r.name })}
          />
        </div>
      )}
    </div>
  );
};

const OptionTable = ({ loading, rows, empty, onDelete, parentLookup }) => (
  <div className="bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden">
    {loading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div> : (
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800"><tr>
          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tên</th>
          {parentLookup && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Series</th>}
          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sản phẩm</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Thao tác</th>
        </tr></thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {rows.length === 0 && <tr><td colSpan={parentLookup ? 4 : 3} className="text-center py-8 text-gray-500">{empty}</td></tr>}
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">{r.name}</td>
              {parentLookup && <td className="px-4 py-3 text-gray-500">{parentLookup[r.parentId] || '-'}</td>}
              <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{r._count?.products || 0}</td>
              <td className="px-4 py-3">
                <button onClick={() => onDelete(r)} className="p-1 text-red-500 hover:text-red-700" title="Xóa"><Trash2 className="h-5 w-5" /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </div>
);

export default CatalogConfig;
