import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Package, Search, Pencil, Save, X, Loader2, Plus, Trash2, Eye, ImagePlus, Link2, CheckCircle2, AlertCircle
} from 'lucide-react';
import api from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';
import ConfirmDialog from '../../components/ConfirmDialog';
import CreatableSelect from '../../components/CreatableSelect';
import { formatVND } from '../../utils/format';
import { PRODUCT_CATEGORIES, resolveCategoryKey, getProductCategory } from '../../constants/productCategories';
import { TCG_LANGUAGES, TCG_RARITIES, CARD_CONDITIONS, SINGLE_CARD_LANGUAGES } from '../../constants/tcgMetadata';
import { useLanguage } from '../../i18n/LanguageContext';

const InventoryManager = () => {
  const { t } = useLanguage();
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
  const [categoryFilter, setCategoryFilter] = useState('');
  const [languageFilter, setLanguageFilter] = useState('');
  const [rarityFilter, setRarityFilter] = useState('');
  const [setFilter, setSetFilter] = useState('');
  // Hierarchical category tree + expansion sets + artist facet values for
  // the creatable comboboxes in the product modal.
  const [categories, setCategories] = useState([]);
  const [sets, setSets] = useState([]);
  const [artistOptions, setArtistOptions] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    shortName: '',
    description: '',
    cardNumber: '',
    tcgplayerId: '',
    // Cascading category fields
    mainCategory: '',     // 'CARD' or 'BOX'
    sealedType: '',       // slug for sealed product type (booster-box, etc.)
    seriesEra: '',     // slug for series/era (sun-moon, scarlet-violet, etc.)
    expansionSet: '',     // slug for expansion set (cosmic-eclipse, etc.)
    // Legacy category field (for backend compatibility)
    category: '',
    // Other fields
    setValue: '',
    artist: '',
    rarity: '',
    language: '',
    setIds: [],
    images: [],
    backImage: '',
    variants: []
  });
  const fileInputRef = useRef(null);
  const backFileInputRef = useRef(null);
  const [frontImageUrl, setFrontImageUrl] = useState('');
  const [backImageUrl, setBackImageUrl] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const generateSlug = (name) => name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const fetchProducts = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = { page, limit: 20 };
      if (search) params.search = search;
      if (categoryFilter) params.category = categoryFilter;
      if (languageFilter) params.language = languageFilter;
      if (rarityFilter) params.rarity = rarityFilter;
      if (setFilter) params.setId = setFilter;
      const response = await api.get('/admin/products', { params });
      setProducts(response.data.data.items || []);
      setMeta(response.data.data.meta || { totalPages: 1 });
    } catch (err) { console.error(err); setError('Không thể tải sản phẩm.'); } finally { setLoading(false); }
  }, [page, search, categoryFilter, languageFilter, rarityFilter, setFilter]);

  // Category tree (full master data — source for the modal's cascading
  // creatables), expansion sets (filtered by ACTIVE product count),
  // artist facet values.
  const loadMeta = useCallback(async () => {
    try {
      const [catsRes, setsRes, facetsRes] = await Promise.all([
        api.get('/admin/categories'),
        api.get('/admin/sets', { params: { prune: 'active' } }),
        api.get('/products/facets')
      ]);
      setCategories(catsRes.data.data || []);
      setSets(setsRes.data.data || []);
      setArtistOptions((facetsRes.data.data?.artists || []).map((a) => a.value));
    } catch (err) { console.error('Failed to load category/set metadata', err); }
  }, []);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  // Fetch fresh options when the Edit/Create modal opens to ensure
  // all active Series, Expansion Sets, and Sealed Product Types are available
  // for the creatable selects (fixes empty dropdowns on first open).
  useEffect(() => {
    if (editingProduct !== null) {
      loadMeta();
    }
  }, [editingProduct, loadMeta]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // ---- Cascading Category Helpers ----
  // Top-level merchandising categories
  const MAIN_CATEGORIES = [
    { value: 'CARD', label: 'Single Cards (Thẻ lẻ)', description: 'Authenticated singles and chase cards' },
    { value: 'BOX', label: 'Sealed Products (Sản phẩm niêm phong)', description: 'Booster boxes, ETBs, blister packs, decks' }
  ];

  // Option sources for the product modal's cascading creatables are the
  // FULL MASTER DATA tree (`categories`) — every existing Series, Expansion
  // Set and Sealed Product Type is present the moment the modal opens, and
  // saved values can always be re-hydrated (spec: "ensure all Creatable
  // Select options are properly fetched from Master Data upon opening the
  // modal, and automatically inject/pre-fill saved option labels and
  // values"). Dynamic pruning of zero-product tags applies to the
  // STOREFRONT sidebar (pruned facet counts) and the admin FILTER dropdowns
  // (pruned `sets`), not to the form — pruning the form would break editing
  // products whose branch currently owns the only ACTIVE product.
  const findTreeCategory = (value) => {
    if (!value) return undefined;
    const v = String(value);
    return categories.find((c) => c.slug === v || c.name === v);
  };

  const childTreeOptions = (parent) =>
    parent
      ? categories.filter((c) => c.parentId === parent.id).map((c) => ({ value: c.slug || c.name, label: c.name }))
      : [];

  const getSealedTypes = () => childTreeOptions(findTreeCategory('sealed-products'));

  const getSeriesEras = () => childTreeOptions(findTreeCategory('single-cards'));

  const getExpansionSets = (seriesValue) => childTreeOptions(findTreeCategory(seriesValue));

  // Ensure the current form value is present in the options array for CreatableSelect.
  // This prevents the selected value from rendering as blank (--) when the value
  // exists in the database but isn't in the currently loaded category tree.
  const ensureValueInOptions = (options, currentValue) => {
    if (!currentValue) return options;
    const normalizedCurrent = typeof currentValue === 'object' && currentValue !== null
      ? String(currentValue.value)
      : String(currentValue);
    const exists = options.some(o => o.value === normalizedCurrent);
    if (exists) return options;
    let label = normalizedCurrent;
    const cat = categories.find(c => c.slug === normalizedCurrent);
    if (cat) label = cat.name;
    return [...options, { value: normalizedCurrent, label }];
  };

  // Resolve a category slug to a { value, label } object using the
  // loaded category tree (or the raw slug as fallback label).
  const resolveCategoryValue = (slug) => {
    if (!slug) return null;
    const cat = categories.find(c => c.slug === slug);
    return { value: slug, label: cat ? cat.name : slug };
  };

  // Optimistically insert a newly typed category into the master tree so it
  // stays selectable and cascades correctly until the refetch after save.
  // Category ids are UUID strings, so the local id must be a collision-safe
  // string (Math.max over UUIDs used to produce NaN, which detached every
  // child lookup underneath the new node — the empty-dropdown hydration bug).
  const addCategoryToTree = (value, name, parentValue) => {
    setCategories((prev) => {
      if (prev.some((c) => c.slug === value || c.name === value)) return prev;
      const parent = prev.find((c) => c.slug === parentValue || c.name === parentValue);
      return [...prev, { id: `local-${Date.now()}`, slug: value, name, parentId: parent ? parent.id : null }];
    });
  };

  // Map a leaf category slug to the backend bucket key
  const getBucketKeyFromSelection = (mainCategory, sealedType, seriesEra, expansionSet) => {
    if (mainCategory === 'BOX') return 'BOX';
    if (mainCategory === 'CARD') return 'CARD';
    // Fallback: resolve from any selected leaf
    return expansionSet ? resolveCategoryKey(expansionSet) :
           seriesEra ? resolveCategoryKey(seriesEra) :
           sealedType ? resolveCategoryKey(sealedType) : null;
  };

  // Derive the variant mode from mainCategory
  const usesConditionLanguageVariants = formData.mainCategory === 'CARD';

  const buildFormDataFromProduct = (product, categoriesList) => {
    const productCategoryKey = resolveCategoryKey(product.category);
    let mainCategory = productCategoryKey === 'CARD' ? 'CARD' : (productCategoryKey === 'BOX' ? 'BOX' : '');
    let sealedType = '';
    let seriesEra = '';
    let expansionSet = '';

    if (product.category && categoriesList.length > 0) {
      const cat = categoriesList.find(c => c.id === product.category.id || c.slug === product.category.slug);
      if (cat) {
        const parent = cat.parentId ? categoriesList.find(c => c.id === cat.parentId) : null;
        const grandparent = parent?.parentId ? categoriesList.find(c => c.id === parent.parentId) : null;
        if (grandparent && grandparent.slug === 'sealed-products') {
          mainCategory = 'BOX'; sealedType = cat.slug;
        } else if (grandparent && grandparent.slug === 'single-cards') {
          mainCategory = 'CARD'; seriesEra = parent.slug; expansionSet = cat.slug;
        } else if (parent && parent.slug === 'sealed-products') {
          mainCategory = 'BOX'; sealedType = cat.slug;
        } else if (parent && parent.slug === 'single-cards') {
          mainCategory = 'CARD'; seriesEra = cat.slug;
        } else if (cat.slug === 'sealed-products') {
          mainCategory = 'BOX';
        } else if (cat.slug === 'single-cards') {
          mainCategory = 'CARD';
        }
      }
    }

     // Fallback: when the category tree hasn't loaded yet (race condition)
     // or the product's leaf category wasn't found in the tree, infer the
     // bucket (CARD vs BOX) from the root slug or the product's TCG attributes.
     if (!mainCategory) {
       const catSlug = typeof product.category === 'string'
         ? product.category
         : (product.category?.slug || product.category?.name || '');
       if (catSlug === 'single-cards') mainCategory = 'CARD';
       else if (catSlug === 'sealed-products') mainCategory = 'BOX';
       else if (product.cardNumber || product.language || product.rarity || product.artist) mainCategory = 'CARD';
       else mainCategory = 'BOX';
     }

     // Fallback: if it's a BOX product but sealedType wasn't resolved from
     // the tree, use the product's category slug directly.
     if (mainCategory === 'BOX' && !sealedType) {
       const catSlug = typeof product.category === 'string'
         ? product.category
         : product.category?.slug;
       if (catSlug && catSlug !== 'sealed-products') sealedType = catSlug;
     }

    const isSingleCard = mainCategory === 'CARD';

    const variants = (product.variants || []).map(v => {
      if (isSingleCard) {
        return { condition: v.condition || 'NEAR_MINT', price: Number(v.price), stockQuantity: v.stockQuantity };
      }
      return { price: Number(v.price), stockQuantity: v.stockQuantity };
    });

    const defaultVariant = isSingleCard
      ? { condition: 'NEAR_MINT', price: 0, stockQuantity: 0 }
      : { price: 0, stockQuantity: 0 };

    return {
      name: product.name,
      shortName: product.shortName || '',
      description: product.description || '',
      cardNumber: product.cardNumber || '',
      tcgplayerId: product.tcgplayerId || '',
      mainCategory, sealedType, seriesEra, expansionSet,
      category: product.category?.slug || productCategoryKey || '',
      setValue: product.sets?.[0]?.slug || '',
      artist: product.artist || '',
      rarity: product.rarity || '',
      language: isSingleCard ? (product.variants?.[0]?.language || product.variants?.[0]?.variant || '') : '',
      setIds: product.sets?.map(s => s.id) || [],
      images: product.images || [],
      backImage: product.backImage || '',
      variants: variants.length > 0 ? variants : [defaultVariant]
    };
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFrontImageUrl(''); setBackImageUrl('');
    setFormData(buildFormDataFromProduct(product, categories));
  };

  const handleCreate = () => {
    setEditingProduct({});
    setFrontImageUrl(''); setBackImageUrl('');
      setFormData({
        name: '',
        shortName: '',
        description: '',
        cardNumber: '',
        tcgplayerId: '',
        mainCategory: '',
        sealedType: '',
        seriesEra: '',
        expansionSet: '',
        category: '',
        setValue: '',
        artist: '',
        rarity: '',
        language: '',
        setIds: [],
        images: [],
        backImage: '',
        variants: []
      });
    };

  const handleCloseModal = () => {
    setEditingProduct(null);
    setFormData({
      name: '', shortName: '', description: '', cardNumber: '', tcgplayerId: '',
      mainCategory: '', sealedType: '', seriesEra: '', expansionSet: '',
      category: '', setValue: '', artist: '', rarity: '', language: '',
      setIds: [], images: [], backImage: '', variants: []
    });
  };

  // When categories finish loading after an Edit was opened, re-hydrate
  // the form so the cascading tree-walk (mainCategory, sealedType,
  // seriesEra, expansionSet) is populated correctly.
  // Only hydrate when we have categories loaded to ensure proper cascading.
  useEffect(() => {
    if (editingProduct?.id && categories.length > 0) {
      setFormData(buildFormDataFromProduct(editingProduct, categories));
    }
  }, [editingProduct, categories]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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
      showToast('Đã upload ảnh mặt trước.');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error?.message || 'Không thể upload ảnh mặt trước. Bạn có thể dán link ảnh trực tiếp vào ô "Image URL".');
    } finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
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
      showToast('Đã upload ảnh mặt sau.');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error?.message || 'Không thể upload ảnh mặt sau. Bạn có thể dán link ảnh trực tiếp vào ô "Image URL".');
    } finally { setUploading(false); if (backFileInputRef.current) backFileInputRef.current.value = ''; }
  };

  const handleRemoveFrontImage = () => setFormData(prev => ({ ...prev, images: [] }));
  const handleRemoveBackImage = () => setFormData(prev => ({ ...prev, backImage: '' }));

  const isValidUrl = (value) => {
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const handleApplyFrontImageUrl = () => {
    const url = frontImageUrl.trim();
    if (!url) return;
    if (!isValidUrl(url)) {
      setError('Link ảnh mặt trước không hợp lệ (phải bắt đầu bằng http:// hoặc https://).');
      return;
    }
    setError('');
    setFormData(prev => ({ ...prev, images: [url] }));
    setFrontImageUrl('');
  };

  const handleApplyBackImageUrl = () => {
    const url = backImageUrl.trim();
    if (!url) return;
    if (!isValidUrl(url)) {
      setError('Link ảnh mặt sau không hợp lệ (phải bắt đầu bằng http:// hoặc https://).');
      return;
    }
    setError('');
    setFormData(prev => ({ ...prev, backImage: url }));
    setBackImageUrl('');
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAddVariant = () => {
    setFormData(prev => {
      const newVariant = usesConditionLanguageVariants
        ? { condition: 'NEAR_MINT', price: 0, stockQuantity: 0 }
        : { price: 0, stockQuantity: 0 };
      return { ...prev, variants: [...prev.variants, newVariant] };
    });
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

  const validateForm = () => {
    const errors = [];

    if (!formData.name.trim()) errors.push('Tên sản phẩm là bắt buộc');
    if (!formData.mainCategory) errors.push('Danh mục chính là bắt buộc');
    if (formData.mainCategory === 'BOX' && !formData.sealedType) errors.push('Loại sản phẩm niêm phong là bắt buộc');
    if (formData.mainCategory === 'CARD' && !formData.seriesEra) errors.push('Series / Era là bắt buộc');
    if (formData.mainCategory === 'CARD' && !formData.expansionSet) errors.push('Expansion Set là bắt buộc');

    if (formData.variants.length === 0) {
      errors.push('Cần ít nhất một biến thể');
    } else {
      formData.variants.forEach((v, idx) => {
        if (usesConditionLanguageVariants) {
          if (!v.condition) errors.push(`Biến thể ${idx + 1}: Tình trạng là bắt buộc`);
        }
        if (v.price < 0) errors.push(`Biến thể ${idx + 1}: Giá phải >= 0`);
        if (v.stockQuantity < 0) errors.push(`Biến thể ${idx + 1}: Tồn kho phải >= 0`);
      });
    }

    if (formData.mainCategory === 'CARD' && !formData.language) {
      errors.push('Ngôn ngữ là bắt buộc');
    }

    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      setError(validationErrors.join('. '));
      return;
    }
setSaving(true); setError('');
    try {
      const slug = generateSlug(formData.name);

      // Compute the leaf category slug from the cascading selection
      let categorySlug = '';
      if (formData.mainCategory === 'BOX') {
        categorySlug = formData.sealedType;
      } else if (formData.mainCategory === 'CARD') {
        categorySlug = formData.expansionSet || formData.seriesEra;
      }
      // Fallback to previously stored slug (e.g. when editing)
      if (!categorySlug) categorySlug = formData.category;

      // Prepare variants for API
      const apiVariants = formData.variants.map(v => {
        if (usesConditionLanguageVariants) {
          // Single Cards: condition + language (stored in variant field)
          return {
            condition: v.condition,
            variant: formData.language, // language at form level
            price: Number(v.price),
            stockQuantity: Number(v.stockQuantity) || 0
          };
        } else {
          // Sealed Products: simplified — only price and stock
          return {
            price: Number(v.price),
            stockQuantity: Number(v.stockQuantity) || 0
          };
        }
      });

      // Expansion Set: picking an existing option links by id; a brand-new
      // name goes through newSetName and is created server-side. When the
      // Set combobox is untouched, the typed Expansion Set name doubles as
      // the new catalogue Set name so the two never drift apart.
      const setSource = formData.setValue || (formData.mainCategory === 'CARD' ? formData.expansionSet : '');
      const matchedSet = sets.find((s) => s.slug === setSource || s.name === setSource);
      // Cascading path (bucket → series → expansion / bucket → sealed type)
      // so the server nests new creatable categories correctly instead of
      // dumping them at root — without the link, edit hydration can't
      // re-derive Series/Type and pruning can't roll counts up ancestors.
      const categoryPath = formData.mainCategory === 'BOX'
        ? [formData.mainCategory, formData.sealedType].filter(Boolean)
        : formData.mainCategory === 'CARD'
          ? [formData.mainCategory, formData.seriesEra, formData.expansionSet].filter(Boolean)
          : [];
      const payload = {
        ...formData,
        slug,
        images: formData.images || [],
        backImage: formData.backImage || null,
        shortName: formData.shortName || null,
        tcgplayerId: formData.tcgplayerId || null,
        setIds: matchedSet ? [matchedSet.id] : [],
        newSetName: !matchedSet && setSource ? setSource : null,
        artist: formData.artist || null,
        rarity: formData.rarity || null,
        category: categorySlug,
        categoryPath: categoryPath.length > 1 ? categoryPath : undefined,
        variants: apiVariants
      };
      delete payload.setValue;
      if (editingProduct?.id) await api.patch(`/admin/products/${editingProduct.id}`, payload);
      else await api.post('/admin/products', payload);
      handleCloseModal(); loadMeta(); fetchProducts();
      showToast(editingProduct?.id ? 'Đã cập nhật sản phẩm.' : 'Đã tạo sản phẩm mới.');
    } catch (err) {
      console.error(err);
      const detail = err.response?.data?.error?.details?.map((d) => d.message).join('. ');
      setError(detail || err.response?.data?.error?.message || 'Lỗi khi lưu sản phẩm');
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
        title={t('staff.inventory.deleteProduct')}
        message={`Bạn có chắc chắn muốn xóa "${deleteTarget?.name}"?`}
        confirmLabel={t('staff.inventory.delete')}
        cancelLabel={t('staff.inventory.cancel')}
        variant="danger"
        loading={deleteLoading}
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setDeleteTarget(null)}
      />

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{t('staff.inventory.title')}</h2>
          <p className="text-gray-500">{t('staff.inventory.subtitle')}</p>
        </div>
        <button onClick={handleCreate} className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
          <Plus className="h-5 w-5 mr-2" /> {t('staff.inventory.addProduct')}
        </button>
      </div>

      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('staff.inventory.searchPlaceholder')}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 min-w-[180px]"
        >
          <option value="">{t('staff.inventory.allCategories')}</option>
          {PRODUCT_CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>{cat.label}</option>
          ))}
        </select>
        <select
          value={languageFilter}
          onChange={(e) => { setLanguageFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 min-w-[150px]"
        >
          <option value="">{t('staff.inventory.filterLanguage')}</option>
          {TCG_LANGUAGES.map((lang) => (
            <option key={lang.value} value={lang.value}>{lang.label}</option>
          ))}
        </select>
        <select
          value={rarityFilter}
          onChange={(e) => { setRarityFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 min-w-[150px]"
        >
          <option value="">{t('staff.inventory.filterRarity')}</option>
          {TCG_RARITIES.map((rarity) => (
            <option key={rarity.value} value={rarity.value}>{rarity.label}</option>
          ))}
        </select>
        {/* Expansion Set filter — backed by the Set catalogue */}
        <select
          name="setFilter"
          aria-label="Set"
          value={setFilter}
          onChange={(e) => { setSetFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 min-w-[170px]"
        >
          <option value="">Tất cả Set</option>
          {sets.map((set) => (
            <option key={set.id} value={set.id}>{set.name}</option>
          ))}
        </select>
      </div>

      {toast && (
        <div className={`p-3 rounded-lg flex items-center ${toast.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'}`}>
          {toast.type === 'success' ? <CheckCircle2 className="h-5 w-5 mr-2" /> : <AlertCircle className="h-5 w-5 mr-2" />}
          {toast.message}
        </div>
      )}

      {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">{error}</div>}

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 text-gray-500">{t('staff.inventory.empty')}</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('staff.inventory.colProduct')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('staff.inventory.colSku')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('staff.inventory.colCategory')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('staff.inventory.colPrice')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('staff.inventory.colStock')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('staff.inventory.colActions')}</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {products.map((product) => {
                const totalStock = product.variants?.reduce((sum, v) => sum + v.stockQuantity, 0) || 0;
                const minPrice = product.variants?.length ? Math.min(...product.variants.map(v => Number(v.price))) : 0;
                const productCategory = getProductCategory(product);
                return (
                  <tr key={product.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-3">
                        {product.images?.[0] ? <img src={product.images[0]} alt="" className="h-10 w-10 rounded object-cover" /> : <div className="h-10 w-10 bg-gray-100 rounded flex items-center justify-center"><Package className="h-5 w-5 text-gray-400" /></div>}
                        <div>
                          <p className="font-medium text-gray-800">{product.shortName || product.name}</p>
                          <p className="text-xs text-gray-500">{product.cardNumber || product.slug}</p>
                          {/* Expansion Set badge(s) under the product name */}
                          {product.sets?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {product.sets.map((s) => (
                                <span key={s.id} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  {s.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{product.cardNumber || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5 max-w-[280px]">
                        {productCategory ? (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${productCategory.badgeClass}`}>
                            {productCategory.label}
                          </span>
                        ) : product.category?.name ? (
                          /* Tree leaf (series / expansion set) created via the
                             creatable combobox — show its actual name */
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border bg-sky-50 text-sky-700 border-sky-200">
                            {product.category.name}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                        {product.language && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-emerald-50 text-emerald-700 border-emerald-200" title={t('staff.inventory.languageBadge')}>
                            {product.language}
                          </span>
                        )}
                        {product.rarity && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-violet-50 text-violet-700 border-violet-200" title={t('staff.inventory.rarityBadge')}>
                            {product.rarity}
                          </span>
                        )}
                        {product.cardSet && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium text-gray-600 bg-gray-100 border-gray-200" title={t('staff.inventory.cardSetLabel')}>
                            {product.cardSet}
                          </span>
                        )}
                        {product.artist && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200" title="Artist">
                            {product.artist}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{product.variants?.length ? formatVND(minPrice) : 'Chưa có'}</td>
                    <td className="px-4 py-3"><span className={`font-medium ${totalStock === 0 ? 'text-red-600' : 'text-gray-800'}`}>{totalStock}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-2">
                        <button onClick={() => handleEdit(product)} className="p-1 text-blue-600 hover:text-blue-800" title={t('staff.inventory.edit')}><Pencil className="h-5 w-5" /></button>
                        <Link to={`/product/${product.id}`} className="p-1 text-gray-500 hover:text-gray-700" title={t('staff.inventory.view')}><Eye className="h-5 w-5" /></Link>
                        <button onClick={() => openDeleteDialog(product)} className="p-1 text-red-500 hover:text-red-700" title={t('staff.inventory.delete')}><Trash2 className="h-5 w-5" /></button>
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{editingProduct.id ? t('staff.inventory.editTitle') : t('staff.inventory.addProduct')}</h3>
                <button onClick={handleCloseModal} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"><X className="h-5 w-5" /></button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('staff.inventory.fullNameLabel')}</label>
                    <input type="text" name="name" value={formData.name} onChange={handleInputChange} required className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('staff.inventory.shortNameLabel')}</label>
                    <input type="text" name="shortName" value={formData.shortName} onChange={handleInputChange} className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
                  </div>
                </div>

{/* ===================== CASCADING CATEGORY PICKER ===================== */}
                 <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50">
                   <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('staff.inventory.categoryLabel') || 'Danh mục'}</label>

                  {/* Step 1: Main Type */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Loại chính</label>
                       <select
                         name="category"
                        value={formData.mainCategory}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormData(prev => ({
                              ...prev,
                              mainCategory: val,
                              sealedType: val === 'BOX' ? prev.sealedType : '',
                              seriesEra: val === 'CARD' ? prev.seriesEra : '',
                              expansionSet: val === 'CARD' ? prev.expansionSet : '',
                              language: val === 'CARD' ? (prev.language || 'ENG') : '',
                              category: '', // will be computed on submit
                              variants: prev.variants.map(v => {
                                if (val === 'BOX') return { price: v.price || 0, stockQuantity: v.stockQuantity || 0 };
                                if (val === 'CARD') return { condition: 'NEAR_MINT', price: v.price || 0, stockQuantity: v.stockQuantity || 0 };
                                return v;
                              })
                            }));
                          }}
                        required
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      >
                        <option value="">-- Chọn danh mục --</option>
                        {MAIN_CATEGORIES.map((cat) => (
                          <option key={cat.value} value={cat.value}>{cat.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Step 2: Conditional sub-fields based on Main Type */}
                  {formData.mainCategory === 'BOX' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Loại sản phẩm niêm phong</label>
                      <CreatableSelect
                        name="sealedType"
                        value={resolveCategoryValue(formData.sealedType) || ''}
                        options={ensureValueInOptions(getSealedTypes(), formData.sealedType)}
                        onChange={(v) => setFormData(prev => ({ ...prev, sealedType: v }))}
                        onNewOptionCreated={(opt) => addCategoryToTree(opt.value, opt.label, 'sealed-products')}
                        placeholder="-- Chọn loại --"
                        required
                        className="w-full"
                      />
                    </div>
                  )}

{formData.mainCategory === 'CARD' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Series / Era</label>
                          <CreatableSelect
                            name="seriesEra"
                            value={resolveCategoryValue(formData.seriesEra) || ''}
                            options={ensureValueInOptions(getSeriesEras(), formData.seriesEra)}
                            onChange={(v) => setFormData(prev => ({ ...prev, seriesEra: v, expansionSet: '' }))}
                            onNewOptionCreated={(opt) => addCategoryToTree(opt.value, opt.label, 'single-cards')}
                            placeholder="-- Chọn series --"
                            required
                            className="w-full"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Expansion Set</label>
                          <CreatableSelect
                            name="expansionSet"
                            value={resolveCategoryValue(formData.expansionSet) || ''}
                            options={ensureValueInOptions(getExpansionSets(formData.seriesEra), formData.expansionSet)}
                            onChange={(v) => setFormData(prev => ({ ...prev, expansionSet: v }))}
                            onNewOptionCreated={(opt) => {
                              const parent = categories.find(c => c.slug === formData.seriesEra);
                              if (parent) addCategoryToTree(opt.value, opt.label, formData.seriesEra);
                            }}
                            placeholder="-- Chọn expansion set --"
                            required
                            disabled={!formData.seriesEra}
                            className="w-full disabled:bg-gray-100 disabled:cursor-not-allowed"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Độ hiếm (Rarity)</label>
                          <select
                            name="rarity"
                            value={formData.rarity}
                            onChange={(e) => setFormData(prev => ({ ...prev, rarity: e.target.value }))}
                            required
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                          >
                            <option value="">-- Chọn độ hiếm --</option>
                            {TCG_RARITIES.map((r) => (
                              <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Ngôn ngữ (Language)</label>
                          <CreatableSelect
                            name="language"
                            value={formData.language}
                            options={ensureValueInOptions(SINGLE_CARD_LANGUAGES, formData.language)}
                            onChange={(v) => setFormData(prev => ({ ...prev, language: v }))}
                            onNewOptionCreated={(opt) => setFormData(prev => ({ ...prev, language: opt.value }))}
                            placeholder="-- Chọn ngôn ngữ --"
                            required
                            className="w-full"
                          />
                        </div>
                      </div>
                    )}

                   {/* Hidden category field for backend compatibility — computed on submit */}
                   <input type="hidden" name="category" value={formData.category} />
                 </div>

{/* Artist (Họa sĩ) — hidden for Sealed Products */}
                  {formData.mainCategory !== 'BOX' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Artist (Họa sĩ)</label>
                          <CreatableSelect
                            name="artist"
                            value={formData.artist}
                            options={ensureValueInOptions(artistOptions.map((a) => ({ value: a, label: a })), formData.artist)}
                            onChange={(v) => setFormData((prev) => ({ ...prev, artist: v }))}
                            onNewOptionCreated={(opt) => setArtistOptions((prev) => [...prev, opt.value])}
                            placeholder="VD: Yuka Morii"
                            createLabel={(text) => ` thêm họa sĩ: "${text}"`}
                          />
                      </div>
                    </div>
                  )}

                 {/* TCG metadata block removed — language/rarity/expansion are no longer editable here. */}

                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                   <div>
                     <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('staff.inventory.skuLabel')}</label>
                     <input type="text" name="cardNumber" value={formData.cardNumber} onChange={handleInputChange} className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
                   </div>
                   <div className="sm:col-span-2">
                     <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('staff.inventory.tcgIdLabel')}</label>
                     <input type="text" name="tcgplayerId" value={formData.tcgplayerId} onChange={handleInputChange} placeholder={t('staff.inventory.skuPlaceholder')} className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
                   </div>
                 </div>
                 <div>
                   <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('staff.inventory.descLabel')}</label>
                   <textarea name="description" value={formData.description} onChange={handleInputChange} rows={3} className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
                 </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('staff.inventory.frontImage')}</label>
                    <div className="flex items-center gap-3 mb-2">
                      {formData.images.length > 0 ? <img src={formData.images[0]} alt="Front" className="h-20 w-20 object-contain rounded-lg border border-gray-200 dark:border-gray-700" /> : <div className="h-20 w-20 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center text-gray-400 dark:text-gray-500">{t('staff.inventory.emptyImage')}</div>}
                      <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50">
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} Upload
                      </button>
                      {formData.images.length > 0 && <button type="button" onClick={handleRemoveFrontImage} className="text-red-500 hover:text-red-700" title={t('staff.inventory.removeImage')}><X className="h-4 w-4" /></button>}
                      <input type="file" ref={fileInputRef} onChange={handleFrontImageUpload} accept="image/*" className="hidden" />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Link2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          type="url"
                          value={frontImageUrl}
                          onChange={(e) => setFrontImageUrl(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleApplyFrontImageUrl(); } }}
                          placeholder={t('staff.inventory.imageUrlHint')}
                          className="w-full pl-8 pr-20 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        />
                      </div>
                      <button type="button" onClick={handleApplyFrontImageUrl} className="px-3 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 shrink-0">{t('staff.inventory.useLink')}</button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('staff.inventory.backImage')}</label>
                    <div className="flex items-center gap-3 mb-2">
                      {formData.backImage ? <img src={formData.backImage} alt="Back" className="h-20 w-20 object-contain rounded-lg border border-gray-200 dark:border-gray-700" /> : <div className="h-20 w-20 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center text-gray-400 dark:text-gray-500">{t('staff.inventory.emptyImage')}</div>}
                      <button type="button" onClick={() => backFileInputRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50">
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} Upload
                      </button>
                      {formData.backImage && <button type="button" onClick={handleRemoveBackImage} className="text-red-500 hover:text-red-700" title={t('staff.inventory.removeImage')}><X className="h-4 w-4" /></button>}
                      <input type="file" ref={backFileInputRef} onChange={handleBackImageUpload} accept="image/*" className="hidden" />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Link2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          type="url"
                          value={backImageUrl}
                          onChange={(e) => setBackImageUrl(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleApplyBackImageUrl(); } }}
                          placeholder={t('staff.inventory.imageUrlHint')}
                          className="w-full pl-8 pr-20 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        />
                      </div>
                      <button type="button" onClick={handleApplyBackImageUrl} className="px-3 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 shrink-0">{t('staff.inventory.useLink')}</button>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700">{usesConditionLanguageVariants ? t('staff.inventory.variantsLabelSingleCard') : t('staff.inventory.variantsLabelSealedProduct')}</label>
                    <button type="button" onClick={handleAddVariant} className="inline-flex items-center px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"><Plus className="h-4 w-4 mr-1" /> {t('staff.inventory.addVariant')}</button>
                  </div>

                  {/* Variant column headers */}
                  <div className="grid gap-2 px-2 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-800 rounded-t-lg"
                    style={{
                      gridTemplateColumns: usesConditionLanguageVariants
                        ? '1.5fr 1fr 1fr 40px'
                        : '1fr 1fr 40px'
                    }}>
                    {usesConditionLanguageVariants && <span>{t('staff.inventory.conditionLabel')}</span>}
                    <span>{t('staff.inventory.priceLabel')}</span>
                    <span>{t('staff.inventory.stockLabel')}</span>
                    <span></span>
                  </div>

                  <div className="space-y-2 border border-gray-200 rounded-b-lg p-2">
                    {formData.variants.map((v, idx) => (
                      <div key={idx} className="flex gap-2 items-center"
                        style={{
                          gridTemplateColumns: usesConditionLanguageVariants
                            ? '1.5fr 1fr 1fr 40px'
                            : '1fr 1fr 40px'
                        }}>
                        {usesConditionLanguageVariants && (
                          <select
                            value={v.condition}
                            onChange={(e) => handleVariantChange(idx, 'condition', e.target.value)}
                            className="flex-1 px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                          >
                            {CARD_CONDITIONS.map((cond) => (
                              <option key={cond.value} value={cond.value}>{cond.label}</option>
                            ))}
                          </select>
                        )}
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={v.price}
                          onChange={(e) => handleVariantChange(idx, 'price', e.target.value)}
                          placeholder={t('staff.inventory.priceLabel')}
                          className="flex-1 px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        />
                        <input
                          type="number"
                          min="0"
                          value={v.stockQuantity}
                          onChange={(e) => handleVariantChange(idx, 'stockQuantity', e.target.value)}
                          placeholder={t('staff.inventory.stockLabel')}
                          className="px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        />
                        <button type="button" onClick={() => handleRemoveVariant(idx)} className="p-1 text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    ))}
                    {formData.variants.length === 0 && (
                      <div className="text-center py-4 text-gray-500 text-sm">
                        {t('staff.inventory.noVariants')}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end space-x-3">
                  <button type="button" onClick={handleCloseModal} className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">{t('staff.inventory.cancel')}</button>
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