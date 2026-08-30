import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus, Pencil, Trash2, Search, Boxes, X, Save, AlertTriangle, Loader2,
  Layers, Link2, ImagePlus, MessageSquarePlus
} from 'lucide-react';
import api from '../../services/api';

const RARITY_ORDER = ['Common', 'Rare', 'Epic', 'Legendary'];

const RARITY_TO_ENUM = { Common: 'COMMON', Rare: 'RARE', Epic: 'EPIC', Legendary: 'LEGENDARY' };
const ENUM_TO_RARITY = { COMMON: 'Common', RARE: 'Rare', EPIC: 'Epic', LEGENDARY: 'Legendary' };

const RARITY_META = {
  Common: { abbr: 'C', chip: 'bg-gray-100 text-gray-700 ring-gray-200' },
  Rare: { abbr: 'R', chip: 'bg-blue-50 text-blue-700 ring-blue-200' },
  Epic: { abbr: 'E', chip: 'bg-purple-50 text-purple-700 ring-purple-200' },
  Legendary: { abbr: 'LGD', chip: 'bg-amber-50 text-amber-700 ring-amber-200' },
};

const STATUS_BADGES = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  DRAFT: 'bg-gray-100 text-gray-600 ring-gray-200',
  ARCHIVED: 'bg-rose-50 text-rose-600 ring-rose-200',
};

const GRADIENT_OPTIONS = [
  'from-violet-500 to-fuchsia-500',
  'from-cyan-500 to-blue-600',
  'from-slate-600 to-slate-900',
  'from-amber-400 to-orange-600',
  'from-emerald-500 to-teal-600',
  'from-rose-500 to-pink-600',
];

const EMPTY_FORM = {
  name: '',
  status: 'DRAFT',
  gradient: 'from-violet-500 to-fuchsia-500',
  dropRates: RARITY_ORDER.map((rarity) => ({ rarity, rate: rarity === 'Common' ? 100 : 0 })),
  pool: [],
};

const EMPTY_POOL_ENTRY = () => ({ name: '', imageUrl: '', rarity: 'Common' });

const formatDate = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString();
};

const BoxThumbnail = ({ gradient, size = 'normal' }) => {
  const sizeClasses = size === 'large' ? 'h-20 w-20 rounded-xl' : 'h-12 w-12 rounded-lg';
  const iconClasses = size === 'large' ? 'h-9 w-9 text-white/90' : 'h-5 w-5 text-white/90';
  return (
    <div className={`${sizeClasses} bg-gradient-to-br ${gradient} flex items-center justify-center shadow-inner ring-1 ring-black/10`}>
      <Boxes className={iconClasses} />
    </div>
  );
};

const DropRateChips = ({ dropRates }) => (
  <div className="flex flex-wrap gap-1.5">
    {(dropRates || []).map(({ rarity, rate }) => {
      const label = ENUM_TO_RARITY[rarity] || rarity;
      return (
        <span
          key={rarity}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 ${RARITY_META[label]?.chip || RARITY_META.Common.chip}`}
        >
          <span className="font-semibold">{RARITY_META[label]?.abbr || label}</span>
          {rate}%
        </span>
      );
    })}
  </div>
);

const VirtualBoxes = () => {
  const [boxes, setBoxes] = useState([]);
  const [meta, setMeta] = useState({ totalPages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchBoxes = useCallback(async () => {
    setLoading(true);
    setListError('');
    try {
      const params = { page, limit: 20 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const response = await api.get('/admin/virtual-boxes', { params });
      setBoxes(response.data.data.items || []);
      setMeta(response.data.data.meta || { totalPages: 1 });
    } catch (err) {
      console.error('Failed to fetch virtual boxes:', err);
      setListError(err.response?.data?.error?.message || 'Không thể tải danh sách virtual boxes.');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => { fetchBoxes(); }, [fetchBoxes]);

  const filtered = useMemo(() => {
    const sorted = [...boxes];
    if (sortBy === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === 'pool-desc') sorted.sort((a, b) => (b.cardPoolCount || 0) - (a.cardPoolCount || 0));
    else sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return sorted;
  }, [boxes, sortBy]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, dropRates: EMPTY_FORM.dropRates.map((r) => ({ ...r })), pool: [] });
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (box) => {
    setEditing(box);
    const rates = RARITY_ORDER.map((label) => {
      const enumRarity = RARITY_TO_ENUM[label];
      const entry = (box.dropRates || []).find((d) => d.rarity === enumRarity);
      return { rarity: label, rate: entry ? Number(entry.rate) : 0 };
    });
    // Prefer poolItems (used by the gacha opener), fall back to the pool table
    const poolSource = (box.poolItems && box.poolItems.length > 0 ? box.poolItems : box.pool) || [];
    const pool = poolSource.map((item) => ({
      name: item.product?.name || item.product?.shortName || item.card?.sku || '',
      imageUrl: item.product?.images?.[0] || '',
      rarity: ENUM_TO_RARITY[item.rarity] || 'Common',
    }));
    setForm({
      name: box.name,
      status: box.status,
      gradient: box.gradient || 'from-violet-500 to-fuchsia-500',
      dropRates: rates,
      pool,
    });
    setFormError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setForm({ ...EMPTY_FORM, dropRates: EMPTY_FORM.dropRates.map((r) => ({ ...r })), pool: [] });
    setFormError('');
  };

  const handleFormChange = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleRateChange = (index, value) => {
    setForm((prev) => {
      const dropRates = prev.dropRates.map((item, i) =>
        i === index ? { ...item, rate: value } : item
      );
      return { ...prev, dropRates };
    });
  };

  const rateTotal = form.dropRates.reduce((sum, r) => sum + (Number(r.rate) || 0), 0);

  // ---- Card Pool Manager ----
  const handleAddPoolCard = () => {
    setForm((prev) => ({ ...prev, pool: [...prev.pool, EMPTY_POOL_ENTRY()] }));
  };

  const handlePoolCardChange = (index, field, value) => {
    setForm((prev) => {
      const pool = prev.pool.map((item, i) => (i === index ? { ...item, [field]: value } : item));
      return { ...prev, pool };
    });
  };

  const handleRemovePoolCard = (index) => {
    setForm((prev) => ({ ...prev, pool: prev.pool.filter((_, i) => i !== index) }));
  };

  const handlePoolCardUpload = async (index, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = new FormData();
      data.append('image', file);
      const response = await api.post('/admin/upload-image', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      handlePoolCardChange(index, 'imageUrl', response.data.data.url);
      showToast('Đã upload ảnh thẻ.');
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.error?.message || 'Không thể upload ảnh thẻ. Dán link ảnh vào ô Image URL.', 'error');
    } finally {
      e.target.value = '';
    }
  };

  const validatePool = () => {
    for (let i = 0; i < form.pool.length; i += 1) {
      const entry = form.pool[i];
      if (!entry.name.trim()) {
        return `Thẻ #${i + 1}: thiếu tên thẻ.`;
      }
      if (entry.imageUrl && !/^https?:\/\//.test(entry.imageUrl.trim())) {
        return `Thẻ #${i + 1}: link ảnh phải bắt đầu bằng http:// hoặc https://.`;
      }
    }
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.name.trim()) { setFormError('Box name is required.'); return; }
    if (rateTotal !== 100) { setFormError(`Drop rates must total 100% (currently ${rateTotal}%).`); return; }
    const poolError = validatePool();
    if (poolError) { setFormError(poolError); return; }

    const payload = {
      name: form.name.trim(),
      status: form.status,
      gradient: form.gradient,
      dropRates: form.dropRates.map((r) => ({ rarity: RARITY_TO_ENUM[r.rarity], rate: Number(r.rate) || 0 })),
      pool: form.pool.map((entry) => ({
        name: entry.name.trim(),
        imageUrl: entry.imageUrl.trim() || null,
        rarity: RARITY_TO_ENUM[entry.rarity],
      })),
    };

    setSaving(true);
    try {
      if (editing) {
        await api.put(`/admin/virtual-boxes/${editing.id}`, payload);
        showToast('Đã cập nhật virtual box.');
      } else {
        await api.post('/admin/virtual-boxes', payload);
        showToast('Đã tạo virtual box mới.');
      }
      closeModal();
      fetchBoxes();
    } catch (err) {
      console.error('Failed to save virtual box:', err);
      const detail = err.response?.data?.error?.details?.map((d) => `${d.field}: ${d.message}`).join('. ');
      setFormError(detail || err.response?.data?.error?.message || 'Không thể lưu virtual box.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setListError('');
    try {
      await api.delete(`/admin/virtual-boxes/${deleteTarget.id}`);
      showToast(deleteTarget.status === 'ARCHIVED' ? 'Đã xóa vĩnh viễn virtual box.' : 'Đã lưu trữ virtual box.');
      setDeleteTarget(null);
      fetchBoxes();
    } catch (err) {
      console.error('Failed to delete virtual box:', err);
      setListError(err.response?.data?.error?.message || 'Không thể xóa virtual box.');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const activeCount = boxes.filter((b) => b.status === 'ACTIVE').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Virtual Boxes</h2>
          <p className="text-gray-500">{boxes.length} boxes total · {activeCount} active</p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center justify-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="h-5 w-5 mr-2" />
          Create New Box
        </button>
      </div>

      {toast && (
        <div className={`p-3 rounded-lg flex items-center ${toast.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
          <AlertTriangle className="h-5 w-5 mr-2 shrink-0" />
          {toast.message}
        </div>
      )}

      {listError && (
        <div className="p-3 bg-red-50 text-red-600 rounded-lg flex items-center">
          <AlertTriangle className="h-5 w-5 mr-2" />
          {listError}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search boxes by name..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="DRAFT">Draft</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="newest">Newest first</option>
          <option value="name">Name (A–Z)</option>
          <option value="pool-desc">Card Pool: Largest</option>
        </select>
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <Boxes className="h-10 w-10 mx-auto text-gray-300 mb-3" />
            {boxes.length === 0 ? (
              <>
                <p>No virtual boxes yet.</p>
                <button onClick={openCreate} className="mt-3 inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
                  <Plus className="h-4 w-4 mr-2" />Create your first box
                </button>
              </>
            ) : (
              <>
                <p>No boxes match your filters.</p>
                <button
                  onClick={() => { setSearch(''); setStatusFilter(''); }}
                  className="mt-3 text-sm text-primary-600 hover:underline"
                >
                  Clear filters
                </button>
              </>
            )}
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Box Image</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Card Pool Count</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Drop Rate Config</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filtered.map((box) => (
                <tr key={box.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <BoxThumbnail gradient={box.gradient} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">{box.name}</div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 ${STATUS_BADGES[box.status] || STATUS_BADGES.DRAFT}`}>
                        {box.status}
                      </span>
                      <span className="text-xs text-gray-400">Updated {formatDate(box.updatedAt)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-sm text-gray-600">
                      <Layers className="h-4 w-4 text-gray-400" />
                      {box.cardPoolCount ?? 0} cards
                    </span>
                  </td>
                  <td className="px-4 py-3"><DropRateChips dropRates={box.dropRates} /></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end space-x-1">
                      <button onClick={() => openEdit(box)} className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg" title="Edit">
                        <Pencil className="h-5 w-5" />
                      </button>
                      <button onClick={() => setDeleteTarget(box)} className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg" title="Delete">
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {meta.totalPages > 1 && (
        <div className="flex justify-center items-center space-x-2">
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="p-2 border border-gray-300 rounded-lg disabled:opacity-40"><span className="px-2">Prev</span></button>
          <span className="text-sm text-gray-700">Page {meta.page || page} / {meta.totalPages}</span>
          <button onClick={() => setPage(Math.min(meta.totalPages, page + 1))} disabled={page >= meta.totalPages} className="p-2 border border-gray-300 rounded-lg disabled:opacity-40"><span className="px-2">Next</span></button>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center px-6 pt-6 sticky top-0 bg-white z-10">
              <h3 className="text-lg font-semibold">{editing ? 'Edit Virtual Box' : 'Create New Box'}</h3>
              <button onClick={closeModal} className="text-gray-500 hover:text-gray-700"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 pb-6 pt-4 space-y-4">
              <div className="flex items-center gap-3">
                <BoxThumbnail gradient={form.gradient} size="large" />
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700">Gradient</label>
                  <select
                    value={form.gradient}
                    onChange={(e) => handleFormChange('gradient', e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {GRADIENT_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => handleFormChange('name', e.target.value)}
                    required
                    placeholder="e.g. Genesis Starter Box"
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => handleFormChange('status', e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="DRAFT">Draft</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700">Drop Rate Config (%) *</label>
                  <span className={`text-xs font-medium ${rateTotal === 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    Total: {rateTotal}%
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  {form.dropRates.map((item, index) => (
                    <div key={item.rarity} className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-medium ring-1 ${RARITY_META[item.rarity]?.chip || ''}`}>
                        {item.rarity}
                      </span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={item.rate}
                        onChange={(e) => handleRateChange(index, e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* ============ Card Pool Manager ============ */}
              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                      <Layers className="h-4 w-4 text-primary-600" />
                      Card Pool Manager
                    </h4>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {form.pool.length} thẻ trong pool — số thẻ này quyết định card pool count.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddPoolCard}
                    className="inline-flex items-center px-3 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700"
                  >
                    <MessageSquarePlus className="h-4 w-4 mr-1" /> Thêm thẻ
                  </button>
                </div>

                {form.pool.length === 0 ? (
                  <div className="text-center py-6 text-sm text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                    Chưa có thẻ nào. Nhấn "Thêm thẻ" để bắt đầu xây dựng pool.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {form.pool.map((entry, index) => (
                      <div key={index} className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-semibold text-gray-500">Thẻ #{index + 1}</span>
                          <button
                            type="button"
                            onClick={() => handleRemovePoolCard(index)}
                            className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                            title="Xóa thẻ khỏi pool"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div className="sm:col-span-1">
                            <label className="block text-[11px] font-medium text-gray-500 mb-1">Card Name *</label>
                            <input
                              type="text"
                              value={entry.name}
                              onChange={(e) => handlePoolCardChange(index, 'name', e.target.value)}
                              placeholder="VD: Charizard VMAX"
                              className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                          </div>
                          <div className="sm:col-span-1">
                            <label className="block text-[11px] font-medium text-gray-500 mb-1">Rarity</label>
                            <select
                              value={entry.rarity}
                              onChange={(e) => handlePoolCardChange(index, 'rarity', e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                            >
                              {RARITY_ORDER.map((r) => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </select>
                          </div>
                          <div className="sm:col-span-1">
                            <label className="block text-[11px] font-medium text-gray-500 mb-1">Image URL / Upload</label>
                            <div className="flex gap-1.5">
                              <input
                                type="url"
                                value={entry.imageUrl}
                                onChange={(e) => handlePoolCardChange(index, 'imageUrl', e.target.value)}
                                placeholder="https://..."
                                className="flex-1 min-w-0 px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                              />
                              <label
                                className="inline-flex items-center justify-center px-2 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 cursor-pointer shrink-0"
                                title="Upload ảnh thẻ"
                              >
                                <ImagePlus className="h-4 w-4" />
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => handlePoolCardUpload(index, e)}
                                />
                              </label>
                            </div>
                          </div>
                        </div>
                        {entry.imageUrl && (
                          <div className="flex items-center gap-2">
                            <img src={entry.imageUrl} alt={entry.name || 'Card'} className="h-12 w-12 object-contain rounded border border-gray-200" />
                            <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
                              <Link2 className="h-3 w-3" /> Ảnh đã gắn
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {formError && (
                <div className="p-3 bg-red-50 text-red-600 rounded-lg flex items-center text-sm">
                  <AlertTriangle className="h-5 w-5 mr-2 shrink-0" />{formError}
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-2">
                <button type="button" onClick={closeModal} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
                  {saving ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Save className="h-5 w-5 mr-2" />}
                  {saving ? 'Đang lưu...' : editing ? 'Save Changes' : 'Create Box'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-800">Delete Virtual Box</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {deleteTarget.status === 'ARCHIVED' ? (
                    <>Bạn sắp xóa vĩnh viễn <span className="font-medium text-gray-700">"{deleteTarget.name}"</span>. Hành động này không thể hoàn tác.</>
                  ) : (
                    <>Bạn sắp lưu trữ <span className="font-medium text-gray-700">"{deleteTarget.name}"</span>. Box sẽ bị ẩn khỏi storefront.</>
                  )}
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleDeleteConfirmed} disabled={deleting} className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
                {deleting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Trash2 className="h-5 w-5 mr-2" />}
                {deleteTarget.status === 'ARCHIVED' ? 'Delete' : 'Archive'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VirtualBoxes;
