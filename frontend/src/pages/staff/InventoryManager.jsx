import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Package, Search, Pencil, Save, X, Loader2, Plus, Trash2, Eye, ImagePlus
} from 'lucide-react';
import api from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';
import ConfirmDialog from '../../components/ConfirmDialog';
import { formatVND } from '../../utils/format';

const InventoryManager = () => {
  const { user } = useAuthStore();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ totalPages: 1 });
  const [editingProduct, setEditingProduct] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sets, setSets] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    shortName: '',
    description: '',
    cardNumber: '',
    tcgplayerId: '',
    setIds: [],
    images: [],
    backImage: '',
    variants: []
  });
  const fileInputRef = useRef(null);
  const backFileInputRef = useRef(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const generateSlug = (name) => name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const fetchProducts = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = { page, limit: 20 };
      if (search) params.search = search;
      const response = await api.get('/admin/products', { params });
      setProducts(response.data.data.items || []);
      setMeta(response.data.data.meta || { totalPages: 1 });
    } catch (err) { console.error(err); setError('Không thể tải sản phẩm.'); } finally { setLoading(false); }
  }, [page, search]);

  const fetchSets = async () => {
    try {
      const response = await api.get('/sets');
      setSets(response.data.data || []);
    } catch (err) { console.error('Không thể tải danh mục sản phẩm:', err); }
  };

  useEffect(() => { fetchProducts(); fetchSets(); }, [fetchProducts]);

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      shortName: product.shortName || '',
      description: product.description || '',
      cardNumber: product.cardNumber || '',
      tcgplayerId: product.tcgplayerId || '',
      setIds: product.sets?.map(s => s.id) || [],
      images: product.images || [],
      backImage: product.backImage || '',
      variants: product.variants?.map(v => ({
        condition: v.condition,
        variant: v.variant,
        price: Number(v.price),
        stockQuantity: v.stockQuantity
      })) || []
    });
  };

  const handleCreate = () => {
    setEditingProduct({});
    setFormData({
      name: '',
      shortName: '',
      description: '',
      cardNumber: '',
      tcgplayerId: '',
      setIds: [],
      images: [],
      backImage: '',
      variants: []
    });
  };

  const handleCloseModal = () => setEditingProduct(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSetToggle = (setId) => {
    setFormData(prev => {
      const current = prev.setIds || [];
      if (current.includes(setId)) return { ...prev, setIds: current.filter(id => id !== setId) };
      return { ...prev, setIds: [...current, setId] };
    });
  };

  const handleFrontImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError('');
    try {
      const form = new FormData(); form.append('image', file);
      const response = await api.post('/admin/upload-image', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      const url = response.data.data.url;
      setFormData(prev => ({ ...prev, images: [url] }));
    } catch (err) { console.error(err); setError('Không thể upload ảnh mặt trước.'); } finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const handleBackImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError('');
    try {
      const form = new FormData(); form.append('image', file);
      const response = await api.post('/admin/upload-image', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      const url = response.data.data.url;
      setFormData(prev => ({ ...prev, backImage: url }));
    } catch (err) { console.error(err); setError('Không thể upload ảnh mặt sau.'); } finally { setUploading(false); if (backFileInputRef.current) backFileInputRef.current.value = ''; }
  };

  const handleRemoveFrontImage = () => setFormData(prev => ({ ...prev, images: [] }));
  const handleRemoveBackImage = () => setFormData(prev => ({ ...prev, backImage: '' }));

  const handleAddVariant = () => {
    setFormData(prev => ({
      ...prev,
      variants: [...prev.variants, { condition: 'NEAR_MINT', variant: 'Normal', price: 0, stockQuantity: 0 }]
    }));
  };

  const handleVariantChange = (index, field, value) => {
    setFormData(prev => {
      const variants = [...prev.variants];
      variants[index][field] = value;
      return { ...prev, variants };
    });
  };

  const handleRemoveVariant = (index) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const slug = generateSlug(formData.name);
      const payload = {
        ...formData,
        slug,
        images: formData.images || [],
        backImage: formData.backImage || null,
        shortName: formData.shortName || null,
        tcgplayerId: formData.tcgplayerId || null,
        setIds: formData.setIds,
        variants: formData.variants.map(v => ({
          condition: v.condition,
          variant: v.variant,
          price: Number(v.price),
          stockQuantity: Number(v.stockQuantity) || 0
        }))
      };
      if (editingProduct?.id) await api.patch(`/admin/products/${editingProduct.id}`, payload);
      else await api.post('/admin/products', payload);
      handleCloseModal(); fetchProducts();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error?.message || 'Lỗi khi lưu sản phẩm');
    } finally { setSaving(false); }
  };

  const openDeleteDialog = (product) => setDeleteTarget(product);
  const handleDeleteConfirmed = async () => {
    if (!deleteTarget) return; setDeleteLoading(true); setError('');
    try {
      await api.delete(`/admin/products/${deleteTarget.id}`);
      setDeleteTarget(null); fetchProducts();
    } catch (err) { console.error(err); setError('Không thể xóa sản phẩm.'); } finally { setDeleteLoading(false); }
  };

  return (
    <div className="space-y-6">
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Xóa sản phẩm"
        message={`Bạn có chắc chắn muốn xóa "${deleteTarget?.name}"?`}
        confirmLabel="Xóa"
        cancelLabel="Hủy"
        variant="danger"
        loading={deleteLoading}
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setDeleteTarget(null)}
      />

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Quản lý sản phẩm</h2>
          <p className="text-gray-500">Quản lý thẻ bài, biến thể, tồn kho, giá</p>
        </div>
        <button onClick={handleCreate} className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
          <Plus className="h-5 w-5 mr-2" /> Thêm sản phẩm
        </button>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm sản phẩm..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg">{error}</div>}

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 text-gray-500">Không có sản phẩm.</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sản phẩm</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mã SP</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Giá (từ variant)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tổng tồn kho</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Thao tác</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {products.map((product) => {
                const totalStock = product.variants?.reduce((sum, v) => sum + v.stockQuantity, 0) || 0;
                const minPrice = product.variants?.length ? Math.min(...product.variants.map(v => Number(v.price))) : 0;
                return (
                  <tr key={product.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-3">
                        {product.images?.[0] ? <img src={product.images[0]} alt="" className="h-10 w-10 rounded object-cover" /> : <div className="h-10 w-10 bg-gray-100 rounded flex items-center justify-center"><Package className="h-5 w-5 text-gray-400" /></div>}
                        <div>
                          <p className="font-medium text-gray-800">{product.shortName || product.name}</p>
                          <p className="text-xs text-gray-500">{product.cardNumber || product.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{product.cardNumber || '-'}</td>
                    <td className="px-4 py-3 text-gray-700">{product.variants?.length ? formatVND(minPrice) : 'Chưa có'}</td>
                    <td className="px-4 py-3"><span className={`font-medium ${totalStock === 0 ? 'text-red-600' : 'text-gray-800'}`}>{totalStock}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-2">
                        <button onClick={() => handleEdit(product)} className="p-1 text-blue-600 hover:text-blue-800" title="Sửa"><Pencil className="h-5 w-5" /></button>
                        <Link to={`/product/${product.id}`} className="p-1 text-gray-500 hover:text-gray-700" title="Xem"><Eye className="h-5 w-5" /></Link>
                        <button onClick={() => openDeleteDialog(product)} className="p-1 text-red-500 hover:text-red-700" title="Xóa"><Trash2 className="h-5 w-5" /></button>
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
        <div className="flex justify-center items-center space-x-2">
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 disabled:opacity-50 hover:bg-gray-50">Trước</button>
          <span className="text-gray-700">Trang {page} / {meta.totalPages}</span>
          <button onClick={() => setPage(Math.min(meta.totalPages, page + 1))} disabled={page >= meta.totalPages} className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 disabled:opacity-50 hover:bg-gray-50">Sau</button>
        </div>
      )}

      {editingProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">{editingProduct.id ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}</h3>
                <button onClick={handleCloseModal} className="text-gray-500 hover:text-gray-700"><X className="h-5 w-5" /></button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Tên thẻ (đầy đủ) *</label>
                    <input type="text" name="name" value={formData.name} onChange={handleInputChange} required className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Tên ngắn</label>
                    <input type="text" name="shortName" value={formData.shortName} onChange={handleInputChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Mã thẻ</label>
                    <input type="text" name="cardNumber" value={formData.cardNumber} onChange={handleInputChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">TCGplayer ID</label>
                    <input type="text" name="tcgplayerId" value={formData.tcgplayerId} onChange={handleInputChange} placeholder="VD: 509980" className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Mô tả</label>
                  <textarea name="description" value={formData.description} onChange={handleInputChange} rows={3} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Bộ/Series (chọn nhiều)</label>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                    {sets.map(set => (
                      <label key={set.id} className="flex items-center space-x-2 p-2 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                        <input type="checkbox" checked={formData.setIds.includes(set.id)} onChange={() => handleSetToggle(set.id)} className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                        <span className="text-sm">{set.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Ảnh mặt trước</label>
                    <div className="flex items-center gap-3">
                      {formData.images.length > 0 ? <img src={formData.images[0]} alt="Front" className="h-20 w-20 object-contain rounded-lg border border-gray-200" /> : <div className="h-20 w-20 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400">Trống</div>}
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Upload'}</button>
                      {formData.images.length > 0 && <button type="button" onClick={handleRemoveFrontImage} className="text-red-500 hover:text-red-700"><X className="h-4 w-4" /></button>}
                      <input type="file" ref={fileInputRef} onChange={handleFrontImageUpload} accept="image/*" className="hidden" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Ảnh mặt sau</label>
                    <div className="flex items-center gap-3">
                      {formData.backImage ? <img src={formData.backImage} alt="Back" className="h-20 w-20 object-contain rounded-lg border border-gray-200" /> : <div className="h-20 w-20 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400">Trống</div>}
                      <button type="button" onClick={() => backFileInputRef.current?.click()} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Upload'}</button>
                      {formData.backImage && <button type="button" onClick={handleRemoveBackImage} className="text-red-500 hover:text-red-700"><X className="h-4 w-4" /></button>}
                      <input type="file" ref={backFileInputRef} onChange={handleBackImageUpload} accept="image/*" className="hidden" />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700">Danh sách biến thể (Condition, Variant, Giá, Tồn kho)</label>
                    <button type="button" onClick={handleAddVariant} className="inline-flex items-center px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"><Plus className="h-4 w-4 mr-1" /> Thêm variant</button>
                  </div>
                  <div className="space-y-2">
                    {formData.variants.map((v, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <select value={v.condition} onChange={(e) => handleVariantChange(idx, 'condition', e.target.value)} className="flex-1 px-2 py-2 border border-gray-300 rounded-lg text-sm">
                          <option value="NEAR_MINT">Near Mint</option>
                          <option value="LIGHTLY_PLAYED">Lightly Played</option>
                          <option value="MODERATELY_PLAYED">Moderately Played</option>
                          <option value="HEAVILY_PLAYED">Heavily Played</option>
                          <option value="MINT">Mint</option>
                        </select>
                        <input type="text" value={v.variant} onChange={(e) => handleVariantChange(idx, 'variant', e.target.value)} placeholder="Variant (Holofoil, Normal...)" className="flex-1 px-2 py-2 border border-gray-300 rounded-lg text-sm" />
                        <input type="number" min="0" step="1" value={v.price} onChange={(e) => handleVariantChange(idx, 'price', e.target.value)} placeholder="Giá VNĐ" className="w-32 px-2 py-2 border border-gray-300 rounded-lg text-sm" />
                        <input type="number" min="0" value={v.stockQuantity} onChange={(e) => handleVariantChange(idx, 'stockQuantity', e.target.value)} placeholder="Tồn kho" className="w-24 px-2 py-2 border border-gray-300 rounded-lg text-sm" />
                        <button type="button" onClick={() => handleRemoveVariant(idx)} className="p-1 text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end space-x-3">
                  <button type="button" onClick={handleCloseModal} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Hủy</button>
                  <button type="submit" disabled={saving} className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
                    {saving ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Save className="h-5 w-5 mr-2" />}
                    {saving ? 'Đang lưu...' : 'Lưu sản phẩm'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryManager;