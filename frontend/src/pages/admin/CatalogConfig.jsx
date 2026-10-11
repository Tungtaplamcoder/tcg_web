import React, { useState, useEffect, useCallback, useMemo, Suspense, lazy } from 'react';
import { Plus, Pencil, Trash2, Loader2, X, Save, AlertCircle, CheckCircle2, Layers, Sparkles, Package, Tag, PlusCircle, Edit, Languages } from 'lucide-react';
import api from '../../services/api';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useAuthStore } from '../../store/useAuthStore';

/* Heavy edit modal is code-split: its form/chunk only downloads the first
   time an admin actually opens an edit target, keeping the initial catalog
   settings bundle small on mobile. */
const CatalogEditModal = lazy(() => import('../../components/CatalogEditModal'));

/**
 * Centralized catalog configuration.
 *
 * Replaces the previously implicit/hardcoded option sources with a single
 * admin surface that manages the four catalogue dimensions side by side:
 *   • Series / Era        — Category tree nodes under "Single Cards"
 *   • Expansion Sets      — Category tree nodes under each Series
 *   • Rarities (Độ hiếm)  — the dynamic `Rarity` catalogue
 *   • Sealed Products     — the dynamic Sealed category catalogue
 *
 * Every option row exposes Edit + Delete. Editing always happens in the
 * shared floating <CatalogEditModal /> (never inline), and saving issues the
 * matching backend PUT request before refreshing the table.
 */
const CatalogConfig = () => {
  const { user } = useAuthStore();
  // Card-condition management ("Tình trạng thẻ") is strictly Admin-only — the
  // tab is hidden for Staff accounts even if they reach this surface.
  const isAdmin = String(user?.role || '').toLowerCase() === 'admin';

  const [tab, setTab] = useState('rarity');
  const [categories, setCategories] = useState([]);
  const [rarities, setRarities] = useState([]);
  const [sealedCategories, setSealedCategories] = useState([]);
  const [conditions, setConditions] = useState([]);
  const [languages, setLanguages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Unified edit modal target: { kind: 'rarity'|'sealed'|'category'|'condition', variant?, ...row }
  const [editTarget, setEditTarget] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // Add-only inline forms (editing always goes through the modal).
  // Each catalogue is name-only — `code` / `description` were dropped.
  const [rarityForm, setRarityForm] = useState({ name: '' });
  const [sealedForm, setSealedForm] = useState({ name: '' });
  const [conditionForm, setConditionForm] = useState({ name: '' });
  const [languageForm, setLanguageForm] = useState({ name: '' });
  const [seriesName, setSeriesName] = useState('');
  const [expansionForm, setExpansionForm] = useState({ name: '', seriesId: '' });

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    // Errors stay a touch longer so they are readable (and screenshot-stable).
    setTimeout(() => setToast(null), type === 'error' ? 5000 : 3000);
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [catsRes, raritiesRes, sealedRes, conditionsRes, languagesRes] = await Promise.all([
        api.get('/admin/categories?activeOnly=false'),
        api.get('/admin/rarities', { params: { activeOnly: 'false' } }),
        api.get('/admin/sealed-categories', { params: { activeOnly: 'false' } }),
        api.get('/admin/card-conditions', { params: { activeOnly: 'false' } }),
        api.get('/admin/catalog-settings/languages', { params: { activeOnly: 'false' } })
      ]);
      setCategories(catsRes.data.data || []);
      setRarities(raritiesRes.data.data || []);
      setSealedCategories(sealedRes.data.data || []);
      setConditions(conditionsRes.data.data || []);
      setLanguages(languagesRes.data.data || []);
    } catch (err) {
      console.error(err);
      showToast('Không thể tải cấu hình danh mục.', 'error');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const singleCardsRoot = categories.find((c) => c.slug === 'single-cards');
  const seriesList = singleCardsRoot ? categories.filter((c) => c.parentId === singleCardsRoot.id) : [];
  const seriesIds = new Set(seriesList.map((s) => s.id));
  const expansionList = categories.filter((c) => c.parentId && seriesIds.has(c.parentId));

  // ===================== ADD (inline) =====================
  const resetRarityForm = () => setRarityForm({ name: '' });

  const handleRaritySubmit = async (e) => {
    e.preventDefault();
    if (!rarityForm.name.trim()) return;
    setSaving(true);
    try {
      await api.post('/admin/rarities', { name: rarityForm.name.trim() });
      resetRarityForm();
      await loadAll();
      showToast('Đã thêm độ hiếm mới.');
    } catch (err) {
      showToast(err.response?.data?.error?.message || 'Lỗi lưu độ hiếm.', 'error');
    } finally { setSaving(false); }
  };

  const resetSealedForm = () => setSealedForm({ name: '' });

  const handleSealedSubmit = async (e) => {
    e.preventDefault();
    if (!sealedForm.name.trim()) return;
    setSaving(true);
    try {
      await api.post('/admin/sealed-categories', { name: sealedForm.name.trim() });
      resetSealedForm();
      await loadAll();
      showToast('Đã thêm danh mục sealed mới.');
    } catch (err) {
      showToast(err.response?.data?.error?.message || 'Lỗi lưu danh mục sealed.', 'error');
    } finally { setSaving(false); }
  };

  const resetConditionForm = () => setConditionForm({ name: '' });

  const handleConditionSubmit = async (e) => {
    e.preventDefault();
    if (!conditionForm.name.trim()) return;
    setSaving(true);
    try {
      await api.post('/admin/card-conditions', { name: conditionForm.name.trim() });
      resetConditionForm();
      await loadAll();
      showToast('Đã thêm tình trạng thẻ mới.');
    } catch (err) {
      showToast(err.response?.data?.error?.message || 'Lỗi lưu tình trạng thẻ.', 'error');
    } finally { setSaving(false); }
  };

  const resetLanguageForm = () => setLanguageForm({ name: '' });

  const handleLanguageSubmit = async (e) => {
    e.preventDefault();
    if (!languageForm.name.trim()) return;
    setSaving(true);
    try {
      await api.post('/admin/catalog-settings/languages', { name: languageForm.name.trim() });
      resetLanguageForm();
      await loadAll();
      showToast('Đã thêm ngôn ngữ mới.');
    } catch (err) {
      showToast(err.response?.data?.error?.message || 'Lỗi lưu ngôn ngữ.', 'error');
    } finally { setSaving(false); }
  };

  const handleCreateSeries = async (e) => {
    e.preventDefault();
    if (!seriesName.trim() || !singleCardsRoot) return;
    setSaving(true);
    try {
      await api.post('/admin/categories', { name: seriesName.trim(), parentId: singleCardsRoot.id });
      setSeriesName('');
      await loadAll();
      showToast('Đã thêm Series / Era mới.');
    } catch (err) {
      showToast(err.response?.data?.error?.message || 'Lỗi thêm Series / Era.', 'error');
    } finally { setSaving(false); }
  };

  const handleCreateExpansion = async (e) => {
    e.preventDefault();
    if (!expansionForm.name.trim() || !expansionForm.seriesId) return;
    setSaving(true);
    try {
      await api.post('/admin/categories', { name: expansionForm.name.trim(), parentId: expansionForm.seriesId });
      setExpansionForm({ name: '', seriesId: '' });
      await loadAll();
      showToast('Đã thêm Expansion Set mới.');
    } catch (err) {
      showToast(err.response?.data?.error?.message || 'Lỗi thêm Expansion Set.', 'error');
    } finally { setSaving(false); }
  };

  // ===================== EDIT (unified floating modal) =====================
  const openEditRarity = (r) => {
    setEditError('');
    setEditTarget({ kind: 'rarity', id: r.id, name: r.name });
  };
  const openEditSealed = (c) => {
    setEditError('');
    setEditTarget({ kind: 'sealed', id: c.id, name: c.name });
  };
  const openEditCategory = (variant, r) => {
    setEditError('');
    setEditTarget({ kind: 'category', variant, id: r.id, name: r.name, parentId: r.parentId });
  };
  const openEditCondition = (c) => {
    setEditError('');
    setEditTarget({ kind: 'condition', id: c.id, name: c.name });
  };
  const openEditLanguage = (l) => {
    setEditError('');
    setEditTarget({ kind: 'language', id: l.id, name: l.name });
  };

  const editModal = useMemo(() => {
    if (!editTarget) return null;
    if (editTarget.kind === 'rarity') {
      return {
        title: `Chỉnh sửa ${editTarget.name}`,
        fields: [
          { name: 'name', label: 'Tên (name)', required: true, placeholder: 'Hyper Rare' }
        ],
        initialValues: { name: editTarget.name || '' }
      };
    }
    if (editTarget.kind === 'sealed') {
      return {
        title: `Chỉnh sửa ${editTarget.name}`,
        fields: [
          { name: 'name', label: 'Tên danh mục', required: true, placeholder: 'Booster Bundle' }
        ],
        initialValues: { name: editTarget.name || '' }
      };
    }
    if (editTarget.kind === 'condition') {
      return {
        title: `Chỉnh sửa ${editTarget.name}`,
        fields: [
          { name: 'name', label: 'Tên tình trạng', required: true, placeholder: 'Near Mint' }
        ],
        initialValues: { name: editTarget.name || '' }
      };
    }
    if (editTarget.kind === 'language') {
      return {
        title: `Chỉnh sửa ${editTarget.name}`,
        fields: [
          { name: 'name', label: 'Tên ngôn ngữ', required: true, placeholder: 'Japanese' }
        ],
        initialValues: { name: editTarget.name || '' }
      };
    }
    const fields = [{ name: 'name', label: 'Tên', required: true, placeholder: 'VD: Mega Evolution' }];
    if (editTarget.variant === 'expansion') {
      fields.push({
        name: 'parentId',
        label: 'Thuộc Series',
        type: 'select',
        required: true,
        placeholder: '-- Chọn series --',
        options: seriesList.map((s) => ({ value: s.id, label: s.name }))
      });
    }
    return {
      title: `Chỉnh sửa ${editTarget.name}`,
      fields,
      initialValues: { name: editTarget.name || '', parentId: editTarget.parentId || '' }
    };
  }, [editTarget, seriesList]);

  const closeEditModal = () => {
    if (editSaving) return;
    setEditTarget(null);
    setEditError('');
  };

  const handleEditSubmit = async (values) => {
    if (!editTarget) return;
    setEditSaving(true);
    setEditError('');
    try {
      if (editTarget.kind === 'rarity') {
        await api.put(`/admin/rarities/${editTarget.id}`, { name: values.name.trim() });
      } else if (editTarget.kind === 'sealed') {
        await api.put(`/admin/sealed-categories/${editTarget.id}`, { name: values.name.trim() });
      } else if (editTarget.kind === 'condition') {
        await api.put(`/admin/card-conditions/${editTarget.id}`, { name: values.name.trim() });
      } else if (editTarget.kind === 'language') {
        await api.put(`/admin/catalog-settings/languages/${editTarget.id}`, { name: values.name.trim() });
      } else {
        const payload = { name: values.name.trim() };
        if (editTarget.variant === 'expansion') payload.parentId = values.parentId;
        await api.put(`/admin/categories/${editTarget.id}`, payload);
      }
      setEditTarget(null);
      await loadAll();
      showToast('Đã cập nhật.');
    } catch (err) {
      setEditError(err.response?.data?.error?.message || 'Lỗi cập nhật.');
    } finally { setEditSaving(false); }
  };

  // ===================== DELETE =====================
  const openDelete = (target) => setDeleteTarget(target);

  const handleDirectDeleteLanguage = async (l) => {
    if (Number(l.productCount) > 0) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/admin/catalog-settings/languages/${l.id}`);
      await loadAll();
      showToast('Đã xóa.');
    } catch (err) {
      const message = err.response?.data?.error?.message || 'Lỗi xóa.';
      showToast(message, 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      if (deleteTarget.kind === 'rarity') await api.delete(`/admin/rarities/${deleteTarget.id}`);
      else if (deleteTarget.kind === 'sealed') await api.delete(`/admin/sealed-categories/${deleteTarget.id}`);
      else if (deleteTarget.kind === 'condition') await api.delete(`/admin/card-conditions/${deleteTarget.id}`);
      else if (deleteTarget.kind === 'language') await api.delete(`/admin/catalog-settings/languages/${deleteTarget.id}`);
      else await api.delete(`/admin/categories/${deleteTarget.id}`);
      setDeleteTarget(null);
      await loadAll();
      showToast('Đã xóa.');
    } catch (err) {
      const message = err.response?.data?.error?.message || 'Lỗi xóa.';
      // Single notification per action: close the confirm dialog and surface
      // the guard message via the toast ONLY — no duplicate inline banner.
      setDeleteTarget(null);
      showToast(message, 'error');
    } finally { setDeleteLoading(false); }
  };

  const tabs = [
    { key: 'series', label: 'Series / Era', icon: Layers },
    { key: 'expansions', label: 'Expansion Sets', icon: Layers },
    { key: 'rarity', label: 'Quản lý Độ hiếm (Rarity)', icon: Sparkles },
    { key: 'sealed', label: 'Sealed Products', icon: Package },
    { key: 'language', label: 'Ngôn ngữ', icon: Languages },
    // Admin-only: card-condition management.
    ...(isAdmin ? [{ key: 'conditions', label: 'Tình trạng thẻ', icon: Tag }] : [])
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

      {editTarget && (
        <Suspense fallback={null}>
          <CatalogEditModal
            isOpen={editTarget !== null}
            title={editModal?.title || ''}
            fields={editModal?.fields || []}
            initialValues={editModal?.initialValues || {}}
            saving={editSaving}
            error={editError}
            onSubmit={handleEditSubmit}
            onClose={closeEditModal}
          />
        </Suspense>
      )}

      <div>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Cấu hình Danh mục</h2>
        <p className="text-gray-500 dark:text-gray-400">
          Quản lý tập trung Series / Era, Expansion Sets, Độ hiếm (Rarity){isAdmin ? ', Tình trạng thẻ' : ''}, Ngôn ngữ và Danh mục Sealed Product dùng trong sản phẩm.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            data-testid={`tab-${tb.key}`}
            onClick={() => setTab(tb.key)}
            className={`inline-flex items-center gap-2 px-4 py-2 min-h-[44px] -mb-px border-b-2 text-sm font-medium touch-manipulation transition-colors ${
              tab === tb.key
                ? 'text-pink-600 border-b-2 border-pink-500 font-semibold dark:text-pink-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <tb.icon className="h-4 w-4" /> {tb.label}
          </button>
        ))}
      </div>

      {toast && (
        <div
          data-testid="catalog-toast"
          data-toast-type={toast.type}
          className={`p-3 rounded-lg flex items-center ${toast.type === 'success' ? 'bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-300' : 'bg-red-50 text-red-600'}`}
        >
          {toast.type === 'success' ? <CheckCircle2 className="h-5 w-5 mr-2" /> : <AlertCircle className="h-5 w-5 mr-2" />}
          {toast.message}
        </div>
      )}

      {/* ===================== RARITY TAB ===================== */}
      {tab === 'rarity' && (
        <div className="space-y-4">
          <form onSubmit={handleRaritySubmit} data-testid="rarity-form" className="bg-white dark:bg-gray-900 rounded-lg shadow p-4 flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">Tên (name) *</label>
              <input type="text" data-testid="rarity-name-input" value={rarityForm.name} onChange={(e) => setRarityForm((p) => ({ ...p, name: e.target.value }))} placeholder="Hyper Rare" required className={inputCls} />
            </div>
            <button type="submit" disabled={saving} className={btnPrimary}>
              {saving ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Save className="h-5 w-5 mr-2" />}
              Thêm
            </button>
          </form>

          <div className="bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden">
            {loading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div> : (
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700" data-testid="rarity-table">
                <thead className="bg-gray-50 dark:bg-gray-800"><tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tên</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Thao tác</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {rarities.length === 0 && <tr><td colSpan={2} className="text-center py-8 text-gray-500">Chưa có độ hiếm.</td></tr>}
                  {rarities.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{r.name}</td>
                      <td className="px-4 py-3">
                        <div className="flex space-x-2">
                          <button onClick={() => openEditRarity(r)} className="p-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-pink-600 hover:text-pink-800 touch-manipulation" title="Sửa"><Pencil className="h-5 w-5" /></button>
                          <button onClick={() => openDelete({ kind: 'rarity', id: r.id, name: r.name })} className="p-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-rose-500 hover:text-rose-700 touch-manipulation" title="Xóa"><Trash2 className="h-5 w-5" /></button>
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

      {/* ===================== SEALED PRODUCTS TAB ===================== */}
      {tab === 'sealed' && (
        <div className="space-y-4" data-testid="sealed-categories-tab">
          <form onSubmit={handleSealedSubmit} className="bg-white dark:bg-gray-900 rounded-lg shadow p-4 flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">Tên danh mục *</label>
              <input
                type="text"
                data-testid="sealed-name-input"
                value={sealedForm.name}
                onChange={(e) => setSealedForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Booster Bundle"
                required
                className={inputCls}
              />
            </div>
            <button type="submit" data-testid="sealed-submit" disabled={saving} className={btnPrimary}>
              {saving ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Save className="h-5 w-5 mr-2" />}
              Thêm
            </button>
          </form>

          <div className="bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden">
            {loading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div> : (
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700" data-testid="sealed-table">
                <thead className="bg-gray-50 dark:bg-gray-800"><tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tên danh mục</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SỐ SẢN PHẨM</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Thao tác</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {sealedCategories.length === 0 && <tr><td colSpan={3} className="text-center py-8 text-gray-500">Chưa có danh mục sealed.</td></tr>}
                  {sealedCategories.map((c) => {
                    return (
                      <tr key={c.id}>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{c.name}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <ProductCountBadge value={c.productCount} testId="sealed-product-count" />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex space-x-2">
                            <button onClick={() => openEditSealed(c)} className="p-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-pink-600 hover:text-pink-800 touch-manipulation" title="Sửa"><Pencil className="h-5 w-5" /></button>
                            <button onClick={() => openDelete({ kind: 'sealed', id: c.id, name: c.name })} className="p-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-rose-500 hover:text-rose-700 touch-manipulation" title="Xóa"><Trash2 className="h-5 w-5" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ===================== LANGUAGES TAB (Ngôn ngữ) ==================== */}
      {tab === 'language' && (
        <div className="space-y-4" data-testid="language-tab">
          <form onSubmit={handleLanguageSubmit} data-testid="language-form" className="bg-white dark:bg-gray-900 rounded-lg shadow p-4 flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">Tên ngôn ngữ *</label>
              <input
                type="text"
                data-testid="language-name-input"
                value={languageForm.name}
                onChange={(e) => setLanguageForm((p) => ({ ...p, name: e.target.value }))}
                placeholder='VD: "Japanese", "English"'
                required
                className={inputCls}
              />
            </div>
            <button type="submit" data-testid="language-submit" disabled={saving} className={btnPrimary}>
              {saving ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Languages className="h-5 w-5 mr-2" />}
              Thêm
            </button>
          </form>

          <div className="bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden">
            {loading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-pink-600" /></div> : (
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700" data-testid="language-table">
                <thead className="bg-gray-50 dark:bg-gray-800"><tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">TÊN NGÔN NGỮ</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SỐ SẢN PHẨM</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">THAO TÁC</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {languages.length === 0 && <tr><td colSpan={3} className="text-center py-8 text-gray-500">Chưa có ngôn ngữ.</td></tr>}
                  {languages.map((l) => {
                    const hasLinkedProducts = Number(l.productCount) > 0;
                    return (
                      <tr key={l.id} data-testid={`language-row-${l.name}`}>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{l.name}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <ProductCountBadge value={l.productCount} testId="language-product-count" />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => openEditLanguage(l)}
                              data-testid={`language-edit-${l.name}`}
                              className="p-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-pink-600 hover:text-pink-800 touch-manipulation"
                              title="Sửa"
                            >
                              <Edit className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => !hasLinkedProducts && handleDirectDeleteLanguage(l)}
                              disabled={hasLinkedProducts}
                              data-testid={`language-delete-${l.name}`}
                              className={`p-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-rose-500 touch-manipulation ${
                                hasLinkedProducts
                                  ? 'opacity-30 cursor-not-allowed'
                                  : 'hover:text-rose-700'
                              }`}
                              title={
                                hasLinkedProducts
                                  ? 'Không thể xoá khi còn sản phẩm liên kết'
                                  : 'Xóa'
                              }
                            >
                              <Trash2 className="h-5 w-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ===================== CARD CONDITIONS TAB (Admin only) ============ */}
      {tab === 'conditions' && isAdmin && (
        <div className="space-y-4" data-testid="card-conditions-tab">
          <form onSubmit={handleConditionSubmit} data-testid="condition-form" className="bg-white dark:bg-gray-900 rounded-lg shadow p-4 flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">Tên tình trạng *</label>
              <input
                type="text"
                data-testid="condition-name-input"
                value={conditionForm.name}
                onChange={(e) => setConditionForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Near Mint"
                required
                className={inputCls}
              />
            </div>
            <button type="submit" data-testid="condition-submit" disabled={saving} className={btnPrimary}>
              {saving ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <PlusCircle className="h-5 w-5 mr-2" />}
              Thêm
            </button>
          </form>

          <div className="bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden">
            {loading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-pink-600" /></div> : (
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700" data-testid="condition-table">
                <thead className="bg-gray-50 dark:bg-gray-800"><tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tên tình trạng</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Thao tác</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {conditions.length === 0 && <tr><td colSpan={2} className="text-center py-8 text-gray-500">Chưa có tình trạng thẻ.</td></tr>}
                  {conditions.map((c) => (
                    <tr key={c.id} data-testid={`condition-row-${c.name}`}>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{c.name}</td>
                      <td className="px-4 py-3">
                        <div className="flex space-x-2">
                          <button onClick={() => openEditCondition(c)} data-testid={`condition-edit-${c.name}`} className="p-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-pink-600 hover:text-pink-800 touch-manipulation" title="Sửa"><Edit className="h-5 w-5" /></button>
                          <button onClick={() => openDelete({ kind: 'condition', id: c.id, name: c.name })} data-testid={`condition-delete-${c.name}`} className="p-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-rose-500 hover:text-rose-700 touch-manipulation" title="Xóa"><Trash2 className="h-5 w-5" /></button>
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
        <div className="space-y-4" data-testid="series-tab">
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
            onEdit={(r) => openEditCategory('series', r)}
            onDelete={(r) => openDelete({ kind: 'category', id: r.id, name: r.name })}
          />
        </div>
      )}

      {/* ===================== EXPANSIONS TAB ===================== */}
      {tab === 'expansions' && (
        <div className="space-y-4" data-testid="expansions-tab">
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
            showCount
            onEdit={(r) => openEditCategory('expansion', r)}
            onDelete={(r) => openDelete({ kind: 'category', id: r.id, name: r.name })}
          />
        </div>
      )}
    </div>
  );
};

const ProductCountBadge = ({ value, testId }) => (
  <span
    data-testid={testId}
    className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-pink-100/80 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300 border border-pink-200/50 dark:border-pink-900/40"
  >
    {Number(value) || 0} sản phẩm
  </span>
);

/**
 * Series / Expansion option table.
 *
 * Series / Era shows strictly TÊN | THAO TÁC. Expansion Sets additionally
 * surfaces the linked-product count (TÊN | SERIES | SỐ SẢN PHẨM | THAO TÁC)
 * rendered with the shared pastel badge. Every row carries both the Edit
 * (Pencil) and Delete (Trash2) lucide-icon actions.
 */
const OptionTable = ({ loading, rows, empty, onEdit, onDelete, parentLookup, showCount }) => (
  <div className="bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden">
    {loading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div> : (
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800"><tr>
          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tên</th>
          {parentLookup && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Series</th>}
          {showCount && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SỐ SẢN PHẨM</th>}
          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Thao tác</th>
        </tr></thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {rows.length === 0 && <tr><td colSpan={(parentLookup ? 1 : 0) + (showCount ? 1 : 0) + 2} className="text-center py-8 text-gray-500">{empty}</td></tr>}
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">{r.name}</td>
              {parentLookup && <td className="px-4 py-3 text-gray-500">{parentLookup[r.parentId] || '-'}</td>}
              {showCount && (
                <td className="px-4 py-3 whitespace-nowrap">
                  <ProductCountBadge value={r._count?.products} testId="option-product-count" />
                </td>
              )}
              <td className="px-4 py-3">
                <div className="flex space-x-2">
                  <button onClick={() => onEdit(r)} className="p-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-pink-600 hover:text-pink-800 touch-manipulation" title="Sửa"><Pencil className="h-5 w-5" /></button>
                  <button onClick={() => onDelete(r)} className="p-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-rose-500 hover:text-rose-700 touch-manipulation" title="Xóa"><Trash2 className="h-5 w-5" /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </div>
);

export default CatalogConfig;
