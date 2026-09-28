import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus, Pencil, Trash2, Search, TicketPercent, X, Save, AlertTriangle, Loader2,
  ToggleLeft, ToggleRight, Users, UserPlus, ChevronLeft, ChevronRight,
  Percent, Coins, Ticket, Package, LayoutGrid
} from 'lucide-react';
import api from '../../services/api';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useAuthStore } from '../../store/useAuthStore';
import { useLanguage } from '../../i18n/LanguageContext';

const EMPTY_FORM = {
  code: '',
  title: '',
  discountType: 'PERCENT',
  discountValue: '',
  maxDiscountAmount: '',
  minOrderAmount: '',
  totalQuantity: '',
  limitPerUser: '1',
  startAt: '',
  endAt: '',
  isActive: true,
  scope: 'ALL',
  scopeIds: []
};

/* Trạng thái hiển thị — label được resolve qua t() tại render time */
const VOUCHER_STATUS_KEYS = {
  off: { key: 'admin.vouchers.badgeOff', chip: 'bg-gray-100 text-gray-600 ring-gray-200' },
  expired: { key: 'admin.vouchers.badgeExpired', chip: 'bg-rose-50 text-rose-600 ring-rose-200' },
  notStarted: { key: 'admin.vouchers.badgeNotStarted', chip: 'bg-amber-50 text-amber-700 ring-amber-200' },
  usedUp: { key: 'admin.vouchers.badgeUsedUp', chip: 'bg-gray-100 text-gray-600 ring-gray-200' },
  running: { key: 'admin.vouchers.badgeRunning', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200' }
};

const VOUCHER_STATUS = (voucher, now = new Date()) => {
  if (!voucher.isActive) return VOUCHER_STATUS_KEYS.off;
  if (voucher.endAt && new Date(voucher.endAt) < now) return VOUCHER_STATUS_KEYS.expired;
  if (voucher.startAt && new Date(voucher.startAt) > now) return VOUCHER_STATUS_KEYS.notStarted;
  if (voucher.totalQuantity != null && voucher.usedQuantity >= voucher.totalQuantity) {
    return VOUCHER_STATUS_KEYS.usedUp;
  }
  return VOUCHER_STATUS_KEYS.running;
};

const formatVNDNumber = (v) => (Number(v) || 0).toLocaleString('vi-VN');

const toLocalInputValue = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const AdminVouchers = () => {
  const { t } = useLanguage();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';
  const [vouchers, setVouchers] = useState([]);
  const [meta, setMeta] = useState({ totalPages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [togglingId, setTogglingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [allocateTarget, setAllocateTarget] = useState(null); // voucher object
  const [allocateMode, setAllocateMode] = useState('ids'); // 'ids' | 'all'
  const [allocateUserIds, setAllocateUserIds] = useState('');
  const [allocating, setAllocating] = useState(false);
  const [allocateError, setAllocateError] = useState('');

  const [toast, setToast] = useState(null);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [scopeSearch, setScopeSearch] = useState('');

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchVouchers = useCallback(async () => {
    setLoading(true);
    setListError('');
    try {
      const params = { page, limit: 20 };
      if (search) params.search = search;
      if (activeFilter) params.isActive = activeFilter;
      const response = await api.get('/admin/vouchers', { params });
      setVouchers(response.data.data.items || []);
      setMeta(response.data.data.meta || { totalPages: 1 });
    } catch (err) {
      console.error('Failed to fetch vouchers:', err);
      setListError(err.response?.data?.error?.message || t('admin.vouchers.errLoad'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, activeFilter, t]);

  useEffect(() => { fetchVouchers(); }, [fetchVouchers]);

  // Load danh mục + sản phẩm cho scope selectors (lazy khi mở form)
  const fetchScopeOptions = useCallback(async () => {
    try {
      const [catRes, prodRes] = await Promise.all([
        api.get('/categories'),
        api.get('/products', { params: { limit: 100, status: 'ACTIVE' } })
      ]);
      setCategories(Array.isArray(catRes.data.data) ? catRes.data.data : (catRes.data.data?.items || []));
      setProducts(prodRes.data.data?.items || []);
    } catch (err) {
      console.error('Failed to load scope options:', err);
    }
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setScopeSearch('');
    setModalOpen(true);
    fetchScopeOptions();
  };

  const openEdit = (voucher) => {
    setEditing(voucher);
    setForm({
      code: voucher.code,
      title: voucher.title,
      discountType: voucher.discountType,
      discountValue: String(Number(voucher.discountValue) || 0),
      maxDiscountAmount: voucher.maxDiscountAmount != null ? String(Number(voucher.maxDiscountAmount)) : '',
      minOrderAmount: voucher.minOrderAmount != null ? String(Number(voucher.minOrderAmount)) : '0',
      totalQuantity: voucher.totalQuantity != null ? String(voucher.totalQuantity) : '',
      limitPerUser: String(voucher.limitPerUser || 1),
      startAt: toLocalInputValue(voucher.startAt),
      endAt: toLocalInputValue(voucher.endAt),
      isActive: voucher.isActive,
      scope: voucher.scope,
      scopeIds: voucher.scopeIds || []
    });
    setFormError('');
    setScopeSearch('');
    setModalOpen(true);
    fetchScopeOptions();
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
  };

  const handleFormChange = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const toggleScopeId = (id) => {
    setForm((prev) => ({
      ...prev,
      scopeIds: prev.scopeIds.includes(id)
        ? prev.scopeIds.filter((x) => x !== id)
        : [...prev.scopeIds, id]
    }));
  };

  const validateForm = () => {
    if (!form.code.trim()) return t('admin.vouchers.errCodeRequired');
    if (form.code.trim().length < 3) return t('admin.vouchers.errCodeMin');
    if (!form.title.trim()) return t('admin.vouchers.errTitleRequired');
    if (form.discountValue === '' || Number(form.discountValue) <= 0) return t('admin.vouchers.errValuePositive');
    if (form.discountType === 'PERCENT' && Number(form.discountValue) > 100) return t('admin.vouchers.errPercentMax');
    if (form.maxDiscountAmount !== '' && form.discountType !== 'PERCENT') {
      // max discount chỉ áp dụng cho PERCENT — bỏ qua giá trị
    }
    if (form.scope !== 'ALL' && form.scopeIds.length === 0) {
      return t('admin.vouchers.errScopeRequired');
    }
    if (form.startAt && form.endAt && new Date(form.startAt) >= new Date(form.endAt)) {
      return t('admin.vouchers.errDateOrder');
    }
    if (form.totalQuantity !== '' && Number(form.totalQuantity) < 1) return t('admin.vouchers.errTotalMin');
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError) { setFormError(validationError); return; }

    const payload = {
      code: form.code.trim().toUpperCase(),
      title: form.title.trim(),
      discountType: form.discountType,
      discountValue: Number(form.discountValue),
      maxDiscountAmount: form.discountType === 'PERCENT' && form.maxDiscountAmount !== ''
        ? Number(form.maxDiscountAmount)
        : null,
      minOrderAmount: form.minOrderAmount === '' ? 0 : Number(form.minOrderAmount),
      totalQuantity: form.totalQuantity === '' ? null : Number(form.totalQuantity),
      limitPerUser: Number(form.limitPerUser) || 1,
      startAt: form.startAt ? new Date(form.startAt).toISOString() : null,
      endAt: form.endAt ? new Date(form.endAt).toISOString() : null,
      isActive: form.isActive,
      scope: form.scope,
      scopeIds: form.scope === 'ALL' ? [] : form.scopeIds
    };

    setSaving(true);
    setFormError('');
    try {
      if (editing) {
        const { code: _ignored, ...updatePayload } = payload;
        await api.put(`/admin/vouchers/${editing.id}`, updatePayload);
        showToast(t('admin.vouchers.updatedToast'));
      } else {
        await api.post('/admin/vouchers', payload);
        showToast(t('admin.vouchers.createdToast'));
      }
      closeModal();
      fetchVouchers();
    } catch (err) {
      console.error('Failed to save voucher:', err);
      const detail = err.response?.data?.error?.details?.map((d) => `${d.field}: ${d.message}`).join('. ');
      setFormError(detail || err.response?.data?.error?.message || t('admin.vouchers.errSave'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (voucher) => {
    setTogglingId(voucher.id);
    try {
      await api.patch(`/admin/vouchers/${voucher.id}/toggle`, { isActive: !voucher.isActive });
      fetchVouchers();
    } catch (err) {
      console.error('Failed to toggle voucher:', err);
      showToast(err.response?.data?.error?.message || t('admin.vouchers.errToggle'), 'error');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const response = await api.delete(`/admin/vouchers/${deleteTarget.id}`);
      showToast(response.data?.message || t('admin.vouchers.deletedToast'));
      setDeleteTarget(null);
      fetchVouchers();
    } catch (err) {
      console.error('Failed to delete voucher:', err);
      setListError(err.response?.data?.error?.message || t('admin.vouchers.errDelete'));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const openAllocate = (voucher) => {
    setAllocateTarget(voucher);
    setAllocateMode('ids');
    setAllocateUserIds('');
    setAllocateError('');
  };

  const handleAllocate = async () => {
    if (!allocateTarget) return;
    setAllocateError('');
    const userIds = allocateUserIds
      .split(/[\s,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (allocateMode === 'ids' && userIds.length === 0) {
      setAllocateError(t('admin.vouchers.errNoUserIds'));
      return;
    }
    setAllocating(true);
    try {
      const response = await api.post('/admin/vouchers/allocate', {
        voucherId: allocateTarget.id,
        ...(allocateMode === 'all' ? { allUsers: true } : { userIds })
      });
      const { newlyAllocated, alreadyOwned, requested } = response.data.data || {};
      showToast(t('admin.vouchers.allocatedToast', { newlyAllocated, alreadyOwned, requested }));
      setAllocateTarget(null);
    } catch (err) {
      console.error('Failed to allocate voucher:', err);
      setAllocateError(err.response?.data?.error?.message || t('admin.vouchers.errAllocate'));
    } finally {
      setAllocating(false);
    }
  };

  const scopeOptions = useMemo(() => {
    const source = form.scope === 'CATEGORY' ? categories : products;
    const q = scopeSearch.trim().toLowerCase();
    const filtered = q
      ? source.filter((item) => (item.name || '').toLowerCase().includes(q))
      : source;
    return filtered;
  }, [form.scope, categories, products, scopeSearch]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{t('admin.vouchers.title')}</h2>
          <p className="text-gray-500">{t('admin.vouchers.subtitle')}</p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center justify-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="h-5 w-5 mr-2" />
          {t('admin.vouchers.createBtn')}
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
            placeholder={t('admin.vouchers.searchPlaceholder')}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <select
          value={activeFilter}
          onChange={(e) => { setActiveFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">{t('admin.vouchers.allToggle')}</option>
          <option value="true">{t('admin.vouchers.activeOn')}</option>
          <option value="false">{t('admin.vouchers.activeOff')}</option>
        </select>
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div>
        ) : vouchers.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <TicketPercent className="h-10 w-10 mx-auto text-gray-300 mb-3" />
            <p>{t('admin.vouchers.empty')}</p>
            <button onClick={openCreate} className="mt-3 inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
              <Plus className="h-4 w-4 mr-2" />{t('admin.vouchers.createFirst')}
            </button>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('admin.vouchers.colVoucher')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('admin.vouchers.colDiscount')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('admin.vouchers.colRules')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('admin.vouchers.colUses')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('admin.vouchers.colTime')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('admin.vouchers.colStatus')}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">{t('admin.vouchers.colActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {vouchers.map((voucher) => {
                const status = VOUCHER_STATUS(voucher);
                const usagePercent = voucher.totalQuantity
                  ? Math.min(100, (voucher.usedQuantity / voucher.totalQuantity) * 100)
                  : 0;
                return (
                  <tr key={voucher.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900">{voucher.title}</p>
                      <p className="font-mono text-xs text-gray-500 tracking-widest">{voucher.code}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {voucher.scope === 'ALL' ? t('admin.vouchers.scopeAll') : voucher.scope === 'CATEGORY' ? t('admin.vouchers.scopeCategoryCount', { count: voucher.scopeIds.length }) : t('admin.vouchers.scopeProductCount', { count: voucher.scopeIds.length })}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-primary-700">
                        {voucher.discountType === 'PERCENT'
                          ? `-${Number(voucher.discountValue)}%`
                          : `-${formatVNDNumber(voucher.discountValue)}₫`}
                      </p>
                      {voucher.discountType === 'PERCENT' && voucher.maxDiscountAmount != null && (
                        <p className="text-xs text-gray-400">{t('admin.vouchers.maxDiscountShort', { amount: formatVNDNumber(voucher.maxDiscountAmount) })}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {Number(voucher.minOrderAmount) > 0
                        ? <span>{t('admin.vouchers.minOrderShort', { amount: formatVNDNumber(voucher.minOrderAmount) })}</span>
                        : <span className="text-gray-400">{t('admin.vouchers.unlimited')}</span>}
                      <p className="text-xs text-gray-400">{t('vouchers.rulePerUser', { count: voucher.limitPerUser })}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-800">
                        {voucher.usedQuantity}{voucher.totalQuantity != null ? ` / ${voucher.totalQuantity}` : ''}
                      </p>
                      {voucher.totalQuantity != null && (
                        <div className="mt-1 w-20 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${usagePercent >= 100 ? 'bg-rose-500' : usagePercent >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            style={{ width: `${usagePercent}%` }}
                          />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {voucher.startAt && <p>{t('admin.vouchers.fromDate', { date: new Date(voucher.startAt).toLocaleDateString('vi-VN') })}</p>}
                      {voucher.endAt && <p>{t('admin.vouchers.toDate', { date: new Date(voucher.endAt).toLocaleDateString('vi-VN') })}</p>}
                      {!voucher.startAt && !voucher.endAt && <span className="text-gray-400">{t('admin.vouchers.alwaysValid')}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold ring-1 ${status.chip}`}>
                        {t(status.key)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                         <button
                           onClick={() => handleToggle(voucher)}
                           disabled={togglingId === voucher.id}
                           title={voucher.isActive ? t('admin.vouchers.disableVoucher') : t('admin.vouchers.enableVoucher')}
                          className="transition-transform hover:scale-110 disabled:opacity-50"
                        >
                          {togglingId === voucher.id ? (
                            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                          ) : voucher.isActive ? (
                            <ToggleRight className="h-6 w-6 text-emerald-500" />
                          ) : (
                            <ToggleLeft className="h-6 w-6 text-gray-300" />
                          )}
                        </button>
                         <button
                           onClick={() => openAllocate(voucher)}
                           title={t('admin.vouchers.grantToUser')}
                          className="p-1.5 rounded-lg text-primary-600 hover:bg-primary-50 transition-colors"
                        >
                          <UserPlus className="h-4.5 w-4.5" />
                        </button>
                         <button
                            onClick={() => openEdit(voucher)}
                            title={t('admin.vouchers.editVoucher')}
                           className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
                         >
                           <Pencil className="h-4 w-4" />
                         </button>
                         {isAdmin && (
                           <button
                             onClick={() => setDeleteTarget(voucher)}
                             title={t('admin.vouchers.deleteVoucher')}
                             className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors"
                           >
                             <Trash2 className="h-4 w-4" />
                           </button>
                         )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {meta.totalPages > 1 && (
        <div className="flex justify-center items-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="p-2 rounded-lg border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-3 text-sm font-semibold text-gray-600">{t('common.page', { page, total: meta.totalPages })}</span>
          <button
            onClick={() => setPage(Math.min(meta.totalPages, page + 1))}
            disabled={page >= meta.totalPages}
            className="p-2 rounded-lg border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ===== Create/Edit Modal ===== */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-tcg-fade-in">
          <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl bg-white shadow-2xl animate-tcg-scale-in">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h3 className="font-bold text-lg text-gray-900">
                {editing ? `${t('admin.vouchers.editVoucher')} ${editing.code}` : t('admin.vouchers.createNewFull')}
              </h3>
              <button onClick={closeModal} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors" aria-label={t('common.close')}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {formError && (
                <div className="p-3.5 rounded-xl bg-red-50 text-red-600 ring-1 ring-red-200 text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />{formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    {t('admin.vouchers.codeLabel')} {!editing && <span className="text-rose-500">*</span>}
                  </label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => handleFormChange('code', e.target.value.toUpperCase())}
                    disabled={!!editing}
                    placeholder={t('admin.vouchers.codePlaceholder')}
                    className={`w-full px-3.5 py-2.5 border rounded-xl font-mono tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-primary-500 ${editing ? 'bg-gray-50 text-gray-500' : ''}`}
                  />
                  {editing && <p className="mt-1 text-xs text-gray-400">{t('admin.vouchers.codeImmutable')}</p>}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('admin.vouchers.nameLabel')}</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => handleFormChange('title', e.target.value)}
                    placeholder={t('admin.vouchers.titlePlaceholder')}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('admin.vouchers.discountTypeLabel')}</label>
                  <select
                    value={form.discountType}
                    onChange={(e) => handleFormChange('discountType', e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="PERCENT">{t('admin.vouchers.percentType')}</option>
                    <option value="FIXED">{t('admin.vouchers.fixedType')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    {t('admin.vouchers.valueLabel')} {form.discountType === 'PERCENT' ? '(%)' : '(VND)'}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      value={form.discountValue}
                      onChange={(e) => handleFormChange('discountValue', e.target.value)}
                      placeholder={form.discountType === 'PERCENT' ? '10' : '50000'}
                      className="w-full px-3.5 py-2.5 pr-9 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {form.discountType === 'PERCENT' ? <Percent className="h-4 w-4" /> : <Coins className="h-4 w-4" />}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    {t('admin.vouchers.maxDiscountLabel')} {form.discountType === 'PERCENT' ? '(VND)' : ''}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.maxDiscountAmount}
                    onChange={(e) => handleFormChange('maxDiscountAmount', e.target.value)}
                    disabled={form.discountType !== 'PERCENT'}
                    placeholder={t('admin.vouchers.valuePlaceholder')}
                    className={`w-full px-3.5 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 ${form.discountType !== 'PERCENT' ? 'bg-gray-50 text-gray-400' : 'border-gray-300'}`}
                  />
                  {form.discountType !== 'PERCENT' && <p className="mt-1 text-xs text-gray-400">{t('admin.vouchers.percentOnly')}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('admin.vouchers.minOrderLabel')}</label>
                  <input
                    type="number"
                    min="0"
                    value={form.minOrderAmount}
                    onChange={(e) => handleFormChange('minOrderAmount', e.target.value)}
                    placeholder="0"
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('admin.vouchers.totalUsesLabel')}</label>
                  <input
                    type="number"
                    min="1"
                    value={form.totalQuantity}
                    onChange={(e) => handleFormChange('totalQuantity', e.target.value)}
                    placeholder={t('admin.vouchers.unlimited')}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('admin.vouchers.perUserLabel')}</label>
                  <input
                    type="number"
                    min="1"
                    value={form.limitPerUser}
                    onChange={(e) => handleFormChange('limitPerUser', e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('admin.vouchers.startLabel')}</label>
                  <input
                    type="datetime-local"
                    value={form.startAt}
                    onChange={(e) => handleFormChange('startAt', e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('admin.vouchers.endLabel')}</label>
                  <input
                    type="datetime-local"
                    value={form.endAt}
                    onChange={(e) => handleFormChange('endAt', e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('admin.vouchers.scopeLabel')}</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'ALL', keyLabel: 'admin.vouchers.scopeAll', icon: Ticket },
                    { key: 'CATEGORY', keyLabel: 'admin.vouchers.scopeCategory', icon: LayoutGrid },
                    { key: 'PRODUCT', keyLabel: 'admin.vouchers.scopeProduct', icon: Package }
                  ].map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => handleFormChange('scope', opt.key)}
                        className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                          form.scope === opt.key
                            ? 'border-primary-500 bg-primary-50 text-primary-700 ring-2 ring-primary-500/30'
                            : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {t(opt.keyLabel)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {form.scope !== 'ALL' && (
                <div className="rounded-2xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-gray-700">
                      {form.scope === 'CATEGORY'
                        ? t('admin.vouchers.selectCategories', { count: form.scopeIds.length })
                        : t('admin.vouchers.selectProducts', { count: form.scopeIds.length })}
                    </p>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        value={scopeSearch}
                        onChange={(e) => setScopeSearch(e.target.value)}
                        placeholder={t('admin.vouchers.scopeSearch')}
                        className="pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                    {scopeOptions.length === 0 ? (
                      <p className="text-sm text-gray-400 py-4 text-center">{t('admin.vouchers.noMatch')}</p>
                    ) : scopeOptions.map((item) => (
                      <label
                        key={item.id}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer transition-colors ${
                          form.scopeIds.includes(item.id) ? 'bg-primary-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={form.scopeIds.includes(item.id)}
                          onChange={() => toggleScopeId(item.id)}
                          className="h-4 w-4 rounded text-primary-600 focus:ring-primary-500"
                        />
                        <span className="text-sm text-gray-700 truncate">{item.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => handleFormChange('isActive', e.target.checked)}
                  className="h-4 w-4 rounded text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-gray-700">{t('admin.vouchers.activateNow')}</span>
              </label>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeModal} className="px-5 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
                  {t('admin.vouchers.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? t('admin.vouchers.saving') : (editing ? t('admin.vouchers.save') : t('admin.vouchers.createBtn'))}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== Allocate Modal ===== */}
      {allocateTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-tcg-fade-in">
          <div className="relative w-full max-w-md rounded-3xl bg-white shadow-2xl animate-tcg-scale-in p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 h-12 w-12 rounded-2xl bg-primary-50 ring-1 ring-primary-200 flex items-center justify-center">
                <Users className="h-6 w-6 text-primary-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg text-gray-900">{t('admin.vouchers.grantDirect')}</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {t('admin.vouchers.colVoucher')} <span className="font-mono font-semibold text-gray-800">{allocateTarget.code}</span>
                  {' '}({allocateTarget.discountType === 'PERCENT' ? `-${Number(allocateTarget.discountValue)}%` : `-${formatVNDNumber(allocateTarget.discountValue)}₫`})
                </p>
              </div>
              <button onClick={() => setAllocateTarget(null)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100" aria-label={t('common.close')}>
                <X className="h-5 w-5" />
              </button>
            </div>

            {allocateError && (
              <div className="mt-4 p-3 rounded-xl bg-red-50 text-red-600 ring-1 ring-red-200 text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />{allocateError}
              </div>
            )}

            <div className="mt-5 space-y-3">
              <label className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${allocateMode === 'ids' ? 'border-primary-400 bg-primary-50/60' : 'border-gray-200'}`}>
                <input
                  type="radio"
                  name="alloc-mode"
                  checked={allocateMode === 'ids'}
                  onChange={() => setAllocateMode('ids')}
                  className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500"
                />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-800">{t('admin.vouchers.grantSpecificUsers')}</p>
                  <p className="text-xs text-gray-500">{t('admin.vouchers.grantUsersPlaceholder')}</p>
                  {allocateMode === 'ids' && (
                    <textarea
                      rows={4}
                      value={allocateUserIds}
                      onChange={(e) => setAllocateUserIds(e.target.value)}
                      placeholder={'uuid-1\nuuid-2'}
                      className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  )}
                </div>
              </label>

              <label className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${allocateMode === 'all' ? 'border-primary-400 bg-primary-50/60' : 'border-gray-200'}`}>
                <input
                  type="radio"
                  name="alloc-mode"
                  checked={allocateMode === 'all'}
                  onChange={() => setAllocateMode('all')}
                  className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500"
                />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-800">{t('admin.vouchers.grantAllActive')}</p>
                  <p className="text-xs text-gray-500">{t('admin.vouchers.grantAllActiveNote')}</p>
                </div>
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setAllocateTarget(null)}
                className="px-5 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                {t('admin.vouchers.cancel')}
              </button>
              <button
                type="button"
                onClick={handleAllocate}
                disabled={allocating}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                {allocating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                {t('admin.vouchers.grantBtn')}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title={t('admin.vouchers.deleteVoucher')}
        message={
          deleteTarget && deleteTarget._count?.orders > 0
            ? t('admin.vouchers.deleteDeactivateWarning', { code: deleteTarget.code })
            : t('admin.vouchers.deleteConfirm', { code: deleteTarget?.code || '' })
        }
        confirmLabel={t('admin.vouchers.deleteVoucher')}
        variant="danger"
        loading={deleting}
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default AdminVouchers;
