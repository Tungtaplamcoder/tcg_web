import React, { useMemo, useState } from 'react';
import {
  Plus, Pencil, Trash2, Search, Boxes, X, Save, AlertTriangle
} from 'lucide-react';

const RARITY_ORDER = ['Common', 'Rare', 'Epic', 'Legendary'];

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

const INITIAL_BOXES = [
  {
    id: 1,
    name: 'Genesis Starter Box',
    price: 24.99,
    cardPoolCount: 120,
    status: 'ACTIVE',
    gradient: 'from-violet-500 to-fuchsia-500',
    updatedAt: '2026-08-20T10:30:00Z',
    dropRates: [
      { rarity: 'Common', rate: 60 },
      { rarity: 'Rare', rate: 25 },
      { rarity: 'Epic', rate: 10 },
      { rarity: 'Legendary', rate: 5 },
    ],
  },
  {
    id: 2,
    name: 'Aurora Legends Box',
    price: 49.99,
    cardPoolCount: 240,
    status: 'ACTIVE',
    gradient: 'from-cyan-500 to-blue-600',
    updatedAt: '2026-08-24T16:45:00Z',
    dropRates: [
      { rarity: 'Common', rate: 50 },
      { rarity: 'Rare', rate: 30 },
      { rarity: 'Epic', rate: 14 },
      { rarity: 'Legendary', rate: 6 },
    ],
  },
  {
    id: 3,
    name: 'Obsidian Rivals Box',
    price: 39.99,
    cardPoolCount: 180,
    status: 'DRAFT',
    gradient: 'from-slate-600 to-ink-900',
    updatedAt: '2026-08-26T09:12:00Z',
    dropRates: [
      { rarity: 'Common', rate: 58 },
      { rarity: 'Rare', rate: 27 },
      { rarity: 'Epic', rate: 11 },
      { rarity: 'Legendary', rate: 4 },
    ],
  },
  {
    id: 4,
    name: 'Solar Flare Premium Box',
    price: 79.99,
    cardPoolCount: 320,
    status: 'ACTIVE',
    gradient: 'from-amber-400 to-orange-600',
    updatedAt: '2026-08-22T14:05:00Z',
    dropRates: [
      { rarity: 'Common', rate: 45 },
      { rarity: 'Rare', rate: 30 },
      { rarity: 'Epic', rate: 17 },
      { rarity: 'Legendary', rate: 8 },
    ],
  },
  {
    id: 5,
    name: 'Mystic Grove Box',
    price: 29.99,
    cardPoolCount: 150,
    status: 'DRAFT',
    gradient: 'from-emerald-500 to-teal-600',
    updatedAt: '2026-08-27T11:20:00Z',
    dropRates: [
      { rarity: 'Common', rate: 62 },
      { rarity: 'Rare', rate: 23 },
      { rarity: 'Epic', rate: 10 },
      { rarity: 'Legendary', rate: 5 },
    ],
  },
  {
    id: 6,
    name: 'Legacy Collection Box',
    price: 59.99,
    cardPoolCount: 200,
    status: 'ARCHIVED',
    gradient: 'from-rose-500 to-pink-600',
    updatedAt: '2026-07-15T08:00:00Z',
    dropRates: [
      { rarity: 'Common', rate: 55 },
      { rarity: 'Rare', rate: 28 },
      { rarity: 'Epic', rate: 12 },
      { rarity: 'Legendary', rate: 5 },
    ],
  },
];

const EMPTY_FORM = {
  name: '',
  price: '',
  cardPoolCount: '',
  status: 'DRAFT',
  gradient: 'from-violet-500 to-fuchsia-500',
  dropRates: RARITY_ORDER.map((rarity) => ({ rarity, rate: rarity === 'Common' ? 100 : 0 })),
};

const formatUSD = (value) => `$${Number(value || 0).toFixed(2)}`;

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
    {dropRates.map(({ rarity, rate }) => (
      <span
        key={rarity}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 ${RARITY_META[rarity]?.chip || RARITY_META.Common.chip}`}
      >
        <span className="font-semibold">{RARITY_META[rarity]?.abbr || rarity}</span>
        {rate}%
      </span>
    ))}
  </div>
);

const VirtualBoxes = () => {
  const [boxes, setBoxes] = useState(INITIAL_BOXES);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const filtered = useMemo(() => {
    let result = boxes;
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (b) => b.name.toLowerCase().includes(q) || String(b.id).toLowerCase().includes(q)
      );
    }
    if (statusFilter) {
      result = result.filter((b) => b.status === statusFilter);
    }
    const sorted = [...result];
    if (sortBy === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === 'price-desc') sorted.sort((a, b) => b.price - a.price);
    else if (sortBy === 'price-asc') sorted.sort((a, b) => a.price - b.price);
    else if (sortBy === 'pool-desc') sorted.sort((a, b) => b.cardPoolCount - a.cardPoolCount);
    else sorted.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    return sorted;
  }, [boxes, search, statusFilter, sortBy]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (box) => {
    setEditing(box);
    setForm({
      name: box.name,
      price: String(box.price),
      cardPoolCount: String(box.cardPoolCount),
      status: box.status,
      gradient: box.gradient,
      dropRates: box.dropRates.map(({ rarity, rate }) => ({ rarity, rate })),
    });
    setFormError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
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

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.name.trim()) { setFormError('Box name is required.'); return; }
    if (Number(form.price) < 0 || form.price === '') { setFormError('Please enter a valid price.'); return; }
    if (Number(form.cardPoolCount) < 0 || form.cardPoolCount === '') {
      setFormError('Please enter a valid card pool count.'); return;
    }
    if (rateTotal !== 100) { setFormError(`Drop rates must total 100% (currently ${rateTotal}%).`); return; }

    const payload = {
      name: form.name.trim(),
      price: Number(form.price),
      cardPoolCount: Number(form.cardPoolCount),
      status: form.status,
      gradient: form.gradient,
      dropRates: form.dropRates.map((r) => ({ rarity: r.rarity, rate: Number(r.rate) || 0 })),
      updatedAt: new Date().toISOString(),
    };

    if (editing) {
      setBoxes((prev) => prev.map((b) => (b.id === editing.id ? { ...b, ...payload } : b)));
    } else {
      setBoxes((prev) => [{ ...payload, id: Math.max(0, ...prev.map((b) => b.id)) + 1 }, ...prev]);
    }
    closeModal();
  };

  const handleDeleteConfirmed = () => {
    setBoxes((prev) => prev.filter((b) => b.id !== deleteTarget.id));
    setDeleteTarget(null);
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

      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search boxes by name or ID..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
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
          <option value="price-desc">Price: High → Low</option>
          <option value="price-asc">Price: Low → High</option>
          <option value="pool-desc">Card Pool: Largest</option>
        </select>
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        {filtered.length === 0 ? (
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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
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
                  <td className="px-4 py-3 text-sm font-semibold text-gray-800">{formatUSD(box.price)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{box.cardPoolCount} cards</td>
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

      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center px-6 pt-6">
              <h3 className="text-lg font-semibold">{editing ? 'Edit Virtual Box' : 'Create New Box'}</h3>
              <button onClick={closeModal} className="text-gray-500 hover:text-gray-700"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 pb-6 pt-4 space-y-4">
              <div className="flex items-center gap-3">
                <BoxThumbnail gradient={form.gradient} size="large" />
                <div className="text-xs text-gray-500">Auto-generated thumbnail previews the box artwork.</div>
              </div>

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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Price (USD) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={(e) => handleFormChange('price', e.target.value)}
                    required
                    placeholder="0.00"
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Card Pool Count *</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.cardPoolCount}
                    onChange={(e) => handleFormChange('cardPoolCount', e.target.value)}
                    required
                    placeholder="0"
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
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

              {formError && (
                <div className="p-3 bg-red-50 text-red-600 rounded-lg flex items-center text-sm">
                  <AlertTriangle className="h-5 w-5 mr-2 shrink-0" />{formError}
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-2">
                <button type="button" onClick={closeModal} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
                  <Save className="h-5 w-5 mr-2" />
                  {editing ? 'Save Changes' : 'Create Box'}
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
                  You are about to delete <span className="font-medium text-gray-700">"{deleteTarget.name}"</span>. This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleDeleteConfirmed} className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                <Trash2 className="h-5 w-5 mr-2" />Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VirtualBoxes;
