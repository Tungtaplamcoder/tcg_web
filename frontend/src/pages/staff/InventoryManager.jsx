import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Package, Search, Pencil, Save, X, Loader2, Plus, Trash2, Eye, ImagePlus, Link2, CheckCircle2, AlertCircle, PlusCircle, Tag
} from 'lucide-react';
import api from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';
import ConfirmDialog from '../../components/ConfirmDialog';
import CreatableSelect from '../../components/CreatableSelect';
import { formatVND } from '../../utils/format';
import { PRODUCT_CATEGORIES, resolveCategoryKey, getProductCategory } from '../../constants/productCategories';
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
  // Dynamic rarity options ("Độ hiếm") — database-backed, managed like
  // Series/Era and Expansion Sets (CreatableSelect with quick-add).
  const [rarityOptions, setRarityOptions] = useState([]);
  // Dynamic sealed-product categories ("Danh mục Sealed Product") — fetched
  // from GET /sealed-categories and bound to the BOX sub-type dropdown.
  const [sealedCategoryOptions, setSealedCategoryOptions] = useState([]);
  // Dynamic card conditions ("Tình trạng thẻ") — fetched from
  // GET /admin/card-conditions and bound to the single-card variant dropdown.
  // Admin AND Staff may quick-add a brand-new condition inline.
  const [conditionOptions, setConditionOptions] = useState([]);
  // Dynamic product languages ("Ngôn ngữ") — fetched from GET /languages and
  // bound to the "Ngôn ngữ (Language)" modal dropdown AND the "Tất cả ngôn ngữ"
  // filter. Full canonical names (e.g. "English", "Japanese") only — never the
  // legacy short codes (JP/ENG/CN/KR).
  const [languageOptions, setLanguageOptions] = useState([]);
  // Inline "+ Thêm tình trạng mới" quick-add popup state.
  const [showConditionQuickAdd, setShowConditionQuickAdd] = useState(false);
  const [conditionQuickAddValue, setConditionQuickAddValue] = useState('');
  const [conditionQuickAddSaving, setConditionQuickAddSaving] = useState(false);
  const [conditionQuickAddError, setConditionQuickAddError] = useState('');
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
  const imageFileInputRef = useRef(null);
  const [inputImageUrl, setInputImageUrl] = useState('');
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
      const [catsRes, setsRes, facetsRes, raritiesRes] = await Promise.all([
        api.get('/admin/categories'),
        api.get('/admin/sets', { params: { prune: 'active' } }),
        api.get('/products/facets'),
        api.get('/rarities')
      ]);
      setCategories(catsRes.data.data || []);
      setSets(setsRes.data.data || []);
      setArtistOptions((facetsRes.data.data?.artists || []).map((a) => a.value));
      setRarityOptions(toRarityOptions(raritiesRes.data.data || []));
    } catch (err) { console.error('Failed to load category/set metadata', err); }
  }, []);

  // The "Loại sản phẩm niêm phong" dropdown is ALWAYS fed by the live
  // SealedCategory catalogue (GET /sealed-categories) — never a hardcoded
  // list. Re-fetching on every modal open and whenever "Sealed Products" is
  // selected guarantees create/update/delete in Catalog Settings is reflected
  // immediately (no stale options).
  const loadSealedCategories = useCallback(async () => {
    try {
      const res = await api.get('/sealed-categories');
      setSealedCategoryOptions(
        (res.data.data || []).map((c) => ({
          value: c.name,
          label: c.name
        }))
      );
    } catch (err) { console.error('Failed to load sealed categories', err); }
  }, []);

  // The "TÌNH TRẠNG" variant dropdown is ALWAYS fed by the live dynamic
  // card-condition catalogue (GET /admin/card-conditions) — never a hardcoded
  // array. `name` is the sole field, used as both the option value and label.
  const loadCardConditions = useCallback(async () => {
    try {
      const res = await api.get('/admin/card-conditions');
      setConditionOptions(
        (res.data.data || []).map((c) => ({ value: c.name, label: c.name }))
      );
    } catch (err) { console.error('Failed to load card conditions', err); }
  }, []);

  // The "Ngôn ngữ (Language)" dropdown and the "Tất cả ngôn ngữ" filter are
  // ALWAYS fed by the live CardLanguage catalogue (GET /languages) — never the
  // hardcoded JP/ENG/CN/KR list. `name` is the sole field, used as both the
  // option value and label.
  const loadLanguages = useCallback(async () => {
    try {
      const res = await api.get('/languages');
      setLanguageOptions(
        (res.data.data || []).map((l) => ({ value: l.name, label: l.name }))
      );
    } catch (err) { console.error('Failed to load languages', err); }
  }, []);

  useEffect(() => {
    loadMeta();
    loadSealedCategories();
    loadCardConditions();
    loadLanguages();
  }, [loadMeta, loadSealedCategories, loadCardConditions, loadLanguages]);

  // Fetch fresh options when the Edit/Create modal opens to ensure
  // all active Series, Expansion Sets, and Sealed Product Types are available
  // for the creatable selects (fixes empty dropdowns on first open).
  useEffect(() => {
    if (editingProduct !== null) {
      loadMeta();
      loadSealedCategories();
      loadCardConditions();
      loadLanguages();
    }
  }, [editingProduct, loadMeta, loadSealedCategories, loadCardConditions, loadLanguages]);

  // Bind the sealed sub-type dropdown to the dynamic endpoint the moment
  // "Sealed Products (Sản phẩm niêm phong)" is chosen as the main category.
  useEffect(() => {
    if (formData.mainCategory === 'BOX') {
      loadSealedCategories();
    }
  }, [formData.mainCategory, loadSealedCategories]);

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

  // The "Loại sản phẩm niêm phong" dropdown is bound EXCLUSIVELY to the
  // dynamic `SealedCategory` catalogue (GET /sealed-categories). We
  // deliberately do NOT merge category-tree children here: legacy
  // product-derived category nodes (e.g. "E2E Booster Box 1790017813744") are
  // NOT sealed categories and must never leak into this picker. When the
  // catalogue is empty the select renders an explicit empty-state message.
  const getSealedTypes = () => sealedCategoryOptions;

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

  // ---- Dynamic Rarity helpers ----
  // Map the API rows into CreatableSelect options. `name` is the sole field,
  // used as both the option value and label.
  const toRarityOptions = (rows) =>
    (rows || []).map((r) => ({ value: r.name, label: r.name }));

  const findRarityOption = (value) => {
    if (!value) return null;
    const v = String(value).trim().toLowerCase();
    return (
      rarityOptions.find(
        (o) => String(o.value).toLowerCase() === v || String(o.label).toLowerCase() === v
      ) || { value: String(value), label: String(value) }
    );
  };

  const resolveRarityValue = (value) => findRarityOption(value);

  // Keep the saved product value visible even before the options list loads.
  const ensureRarityOption = (options, currentValue) => {
    if (!currentValue) return options;
    const v = String(currentValue).trim().toLowerCase();
    if (options.some((o) => String(o.value).toLowerCase() === v || String(o.label).toLowerCase() === v)) {
      return options;
    }
    return [...options, findRarityOption(currentValue)];
  };

  // The rarity catalogue is name-only — the typed text IS the stored name.
  const parseRarityInput = (text) => ({ name: String(text || '').trim() });

  // Quick-add: persist the typed rarity through the admin API and inject it
  // into the options list so it stays selectable without closing the modal.
  const handleCreateRarityOption = async (opt) => {
    const { name } = parseRarityInput(opt?.value || opt?.label);
    if (!name) return;
    setRarityOptions((prev) => {
      if (prev.some((o) => String(o.value).toLowerCase() === name.toLowerCase())) return prev;
      return [...prev, { value: name, label: name }];
    });
    try {
      await api.post('/admin/rarities', { name });
      showToast(`Đã thêm độ hiếm "${name}".`);
    } catch (err) {
      // Conflict (already exists) is harmless — the option remains selectable.
      console.error('Failed to create rarity', err);
    }
  };

  // ---- Dynamic Card Condition helpers (Tình trạng thẻ) ----
  // Default value for a fresh single-card variant (first dynamic option).
  const defaultConditionValue = () => conditionOptions[0]?.value || 'NEAR_MINT';

  // Keep a saved/legacy variant value visible even if the catalogue hasn't
  // loaded yet or the condition was since renamed/removed.
  const ensureConditionOption = (options, currentValue) => {
    if (!currentValue) return options;
    const v = String(currentValue).trim().toLowerCase();
    if (options.some((o) => String(o.value).toLowerCase() === v || String(o.label).toLowerCase() === v)) {
      return options;
    }
    return [...options, { value: String(currentValue), label: String(currentValue) }];
  };

  // The card-condition catalogue is name-only — the typed text IS the name.
  const parseConditionInput = (text) => ({ name: String(text || '').trim() });

  // Persist a condition by name (allowed for Admin AND Staff) and inject it
  // into the live options. Returns the stored name (or throws on hard error).
  // A 409 (already exists) is treated as success — the option stays selectable.
  const persistCondition = async (rawName) => {
    const { name } = parseConditionInput(rawName);
    if (!name) return null;
    let finalName = name;
    try {
      const res = await api.post('/admin/card-conditions', { name });
      const created = res.data?.data;
      if (created?.name) finalName = created.name;
    } catch (err) {
      if (err.response?.status !== 409) throw err;
    }
    setConditionOptions((prev) => {
      const exists = prev.some((o) => String(o.value).toLowerCase() === finalName.toLowerCase());
      if (exists) return prev;
      return [...prev, { value: finalName, label: finalName }];
    });
    return finalName;
  };

  // Inline CreatableSelect create — persist the typed name and auto-select it
  // on the variant row that triggered it (no page reload).
  const handleCreateConditionOption = async (rawName, index) => {
    try {
      const finalName = await persistCondition(rawName);
      if (!finalName) return;
      setFormData((prev) => {
        const variants = prev.variants.length
          ? [...prev.variants]
          : [{ price: 0, stockQuantity: 0 }];
        const target = (index != null && index >= 0 && index < variants.length)
          ? index
          : variants.length - 1;
        variants[target] = { ...variants[target], condition: finalName };
        return { ...prev, variants };
      });
      showToast(`Đã thêm tình trạng "${finalName}".`);
    } catch (err) {
      console.error('Failed to create condition', err);
      setError(err.response?.data?.error?.message || 'Không thể lưu tình trạng.');
    }
  };

  const openConditionQuickAdd = () => {
    setConditionQuickAddValue('');
    setConditionQuickAddError('');
    setShowConditionQuickAdd(true);
  };

  const closeConditionQuickAdd = () => {
    if (conditionQuickAddSaving) return;
    setShowConditionQuickAdd(false);
    setConditionQuickAddError('');
  };

  // Quick-add modal: persist the typed condition and auto-select it on the
  // last variant row without a page reload.
  const handleCreateCondition = async () => {
    const { name } = parseConditionInput(conditionQuickAddValue);
    if (!name) { setConditionQuickAddError('Vui lòng nhập tên tình trạng.'); return; }
    setConditionQuickAddSaving(true);
    setConditionQuickAddError('');
    try {
      const finalName = await persistCondition(name);
      setFormData((prev) => {
        const nextVariants = prev.variants.length
          ? [...prev.variants]
          : [{ condition: finalName, price: 0, stockQuantity: 0 }];
        const lastIndex = nextVariants.length - 1;
        nextVariants[lastIndex] = { ...nextVariants[lastIndex], condition: finalName };
        return { ...prev, variants: nextVariants };
      });
      setConditionQuickAddSaving(false);
      setShowConditionQuickAdd(false);
      setConditionQuickAddValue('');
      showToast(`Đã thêm tình trạng "${finalName}".`);
    } catch (err) {
      setConditionQuickAddSaving(false);
      setConditionQuickAddError(err.response?.data?.error?.message || 'Không thể lưu tình trạng.');
    }
  };

  // ---- Dynamic Language helpers (Ngôn ngữ) ----
  // Default language for a fresh single-card product: prefer "English" when
  // present in the catalogue, otherwise the first option (or empty while the
  // catalogue is still loading).
  const defaultLanguageValue = () =>
    languageOptions.find((o) => String(o.value).toLowerCase() === 'english')?.value
    || languageOptions[0]?.value
    || '';

  // Keep a saved/legacy value visible even before the catalogue loads or if the
  // language was since removed.
  const ensureLanguageOption = (options, currentValue) => {
    if (!currentValue) return options;
    const v = String(currentValue).trim().toLowerCase();
    if (options.some((o) => String(o.value).toLowerCase() === v || String(o.label).toLowerCase() === v)) {
      return options;
    }
    return [...options, { value: String(currentValue), label: String(currentValue) }];
  };

  // The language catalogue is name-only — the typed text IS the stored name.
  const parseLanguageInput = (text) => ({ name: String(text || '').trim() });

  // Persist a language by its full name (Admin AND Staff) and inject it into
  // the live options. Returns the stored name (or null). A 409 (already exists)
  // is treated as success — the option stays selectable.
  const persistLanguage = async (rawName) => {
    const { name } = parseLanguageInput(rawName);
    if (!name) return null;
    let finalName = name;
    try {
      const res = await api.post('/admin/catalog-settings/languages', { name });
      if (res.data?.data?.name) finalName = res.data.data.name;
    } catch (err) {
      if (err.response?.status !== 409) throw err;
    }
    setLanguageOptions((prev) => {
      const exists = prev.some((o) => String(o.value).toLowerCase() === finalName.toLowerCase());
      if (exists) return prev;
      return [...prev, { value: finalName, label: finalName }];
    });
    return finalName;
  };

  // Inline CreatableSelect create — persist the typed full name and auto-select
  // it on the product form (no page reload).
  const handleCreateLanguageOption = async (rawName) => {
    try {
      const finalName = await persistLanguage(rawName);
      if (!finalName) return;
      setFormData((prev) => ({ ...prev, language: finalName }));
      showToast(`Đã thêm ngôn ngữ "${finalName}".`);
    } catch (err) {
      console.error('Failed to create language', err);
      setError(err.response?.data?.error?.message || 'Không thể lưu ngôn ngữ.');
    }
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
        return { condition: v.condition || defaultConditionValue(), price: Number(v.price), stockQuantity: v.stockQuantity };
      }
      return { price: Number(v.price), stockQuantity: v.stockQuantity };
    });

    const defaultVariant = isSingleCard
      ? { condition: defaultConditionValue(), price: 0, stockQuantity: 0 }
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
      images: (() => {
        let imgs = Array.isArray(product.images) ? [...product.images] : [];
        if (!imgs.length && product.frontImage) imgs.push(product.frontImage);
        if (product.backImage && !imgs.includes(product.backImage)) imgs.push(product.backImage);
        return imgs.filter((img) => typeof img === 'string' && img.trim().length > 0);
      })(),
      backImage: product.backImage || '',
      variants: variants.length > 0 ? variants : [defaultVariant]
    };
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setInputImageUrl('');
    setFormData(buildFormDataFromProduct(product, categories));
  };

  const handleCreate = () => {
    setEditingProduct({});
    setInputImageUrl('');
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
    setInputImageUrl('');
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

  const handleImageFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true); setError('');
    try {
      const uploadedUrls = [];
      for (const file of files) {
        const form = new FormData();
        form.append('image', file);
        const response = await api.post('/admin/upload-image', form, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        const url = response.data?.data?.url;
        if (url) uploadedUrls.push(url);
      }
      if (uploadedUrls.length > 0) {
        setFormData((prev) => {
          const updated = [...(prev.images || []), ...uploadedUrls];
          return {
            ...prev,
            images: updated,
            backImage: updated[1] || ''
          };
        });
        showToast(`Đã thêm ${uploadedUrls.length} ảnh vào thư viện.`);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error?.message || 'Không thể upload ảnh. Bạn có thể dán link ảnh trực tiếp.');
    } finally {
      setUploading(false);
      if (imageFileInputRef.current) imageFileInputRef.current.value = '';
    }
  };

  const isValidUrl = (value) => {
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const handleAddImageUrl = () => {
    const url = inputImageUrl.trim();
    if (!url) return;
    if (!isValidUrl(url) && !url.startsWith('/')) {
      setError('Link ảnh không hợp lệ (phải bắt đầu bằng http://, https:// hoặc /).');
      return;
    }
    setError('');
    setFormData((prev) => {
      const updated = [...(prev.images || []), url];
      return {
        ...prev,
        images: updated,
        backImage: updated[1] || ''
      };
    });
    setInputImageUrl('');
    showToast('Đã thêm ảnh từ link.');
  };

  const handleRemoveImage = (indexToRemove) => {
    setFormData((prev) => {
      const updated = (prev.images || []).filter((_, idx) => idx !== indexToRemove);
      return {
        ...prev,
        images: updated,
        backImage: updated[1] || ''
      };
    });
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAddVariant = () => {
    setFormData(prev => {
      // Single Cards are validated on a UNIQUE condition per product, so a new
      // row must not inherit the same default as an existing one. Pick the
      // first dynamic condition option not already used and only fall back to
      // the first option once all are used.
      if (prev.mainCategory === 'CARD') {
        const usedConditions = new Set(prev.variants.map(v => v.condition));
        const nextCondition = conditionOptions.find(c => !usedConditions.has(c.value))?.value
          || defaultConditionValue();
        return { ...prev, variants: [...prev.variants, { condition: nextCondition, price: 0, stockQuantity: 0 }] };
      }
      return { ...prev, variants: [...prev.variants, { price: 0, stockQuantity: 0 }] };
    });
  };

  const handleVariantChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      // Immutable row update — mutating the shared variant object could leave
      // React and the payload out of sync when multiple rows are edited fast.
      variants: prev.variants.map((v, i) => (i === index ? { ...v, [field]: value } : v))
    }));
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
      const seenConditions = new Set();
      let hasDuplicateCondition = false;
      formData.variants.forEach((v, idx) => {
        if (usesConditionLanguageVariants) {
          if (!v.condition) {
            errors.push(`Biến thể ${idx + 1}: Tình trạng là bắt buộc`);
          } else if (seenConditions.has(v.condition)) {
            // Report the duplicate once, with a clear product-level message,
            // instead of a vague backend "Invalid input".
            hasDuplicateCondition = true;
          } else {
            seenConditions.add(v.condition);
          }
        }
        const price = Number(v.price);
        const stock = Number(v.stockQuantity);
        if (!Number.isFinite(price) || price < 0) {
          errors.push(`Biến thể ${idx + 1}: Giá phải là số >= 0`);
        }
        if (!Number.isInteger(stock) || stock < 0) {
          errors.push(`Biến thể ${idx + 1}: Tồn kho phải là số nguyên >= 0`);
        }
      });
      if (hasDuplicateCondition) {
        errors.push('Các biến thể không được trùng tình trạng thẻ');
      }
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

      // Normalise variant numerics before they reach the API. Number inputs
      // hand back strings; strip them to clean numbers (or 0) so the backend
      // never receives "" / NaN and fails with a vague "Invalid input".
      const formattedVariants = formData.variants.map(v => ({
        condition: v.condition,
        price: Number(v.price) || 0,
        stockQuantity: Number(v.stockQuantity) || 0
      }));

      // Prepare variants for API
      const apiVariants = formattedVariants.map(v => {
        if (usesConditionLanguageVariants) {
          // Single Cards: condition + language (stored in variant field)
          return {
            condition: v.condition,
            variant: formData.language, // language at form level
            price: v.price,
            stockQuantity: v.stockQuantity
          };
        }
        // Sealed Products: simplified — only price and stock
        return {
          price: v.price,
          stockQuantity: v.stockQuantity
        };
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
      const cleanImages = (formData.images || []).filter(
        (img) => typeof img === 'string' && img.trim().length > 0
      );
      const payload = {
        ...formData,
        slug,
        images: cleanImages,
        frontImage: cleanImages[0] || null,
        backImage: cleanImages[1] || (formData.backImage ? formData.backImage.trim() : null) || null,
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
      if (!payload.backImage) payload.backImage = null;
      if (!payload.frontImage) payload.frontImage = null;
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

  // Dynamic sealed-category options. Edit hydration may inject the saved slug
  // so an existing product never renders blank, but the empty-state message is
  // driven purely by the live catalogue (no hardcoded product-name fallback).
  const sealedTypeOptions = ensureValueInOptions(getSealedTypes(), formData.sealedType);
  const sealedCatalogueEmpty = getSealedTypes().length === 0;
  const SEALED_EMPTY_MESSAGE = '-- Chưa có danh mục sealed --';

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
          data-testid="language-filter"
          aria-label={t('staff.inventory.filterLanguage')}
          value={languageFilter}
          onChange={(e) => { setLanguageFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 min-w-[150px]"
        >
          <option value="">{t('staff.inventory.filterLanguage')}</option>
          {languageOptions.map((lang) => (
            <option key={lang.value} value={lang.value}>{lang.label}</option>
          ))}
        </select>
        <select
          value={rarityFilter}
          onChange={(e) => { setRarityFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 min-w-[150px]"
        >
          <option value="">{t('staff.inventory.filterRarity')}</option>
          {rarityOptions.map((rarity) => (
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
                    <td className="px-4 py-3 text-gray-700">
                      {product.variants?.length ? (
                        minPrice === 0 ? (
                          <span
                            data-testid="contact-price-badge"
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-pink-50 text-pink-600 dark:bg-pink-950/40 dark:text-pink-400 border border-pink-200 dark:border-pink-800"
                          >
                            0 đ (Liên hệ)
                          </span>
                        ) : (
                          formatVND(minPrice)
                        )
                      ) : (
                        'Chưa có'
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-2">
                        <button onClick={() => handleEdit(product)} className="p-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-pink-600 hover:text-pink-800 touch-manipulation" title={t('staff.inventory.edit')}><Pencil className="h-5 w-5" /></button>
                        <Link to={`/product/${product.id}`} className="p-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-gray-500 hover:text-gray-700 touch-manipulation" title={t('staff.inventory.view')}><Eye className="h-5 w-5" /></Link>
                        <button onClick={() => openDeleteDialog(product)} className="p-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-rose-500 hover:text-rose-700 touch-manipulation" title={t('staff.inventory.delete')}><Trash2 className="h-5 w-5" /></button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-none md:backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          {/* Modal card: fixed viewport budget, header + scrollable body + sticky footer.
              Without the max-height + overflow-y body, many variant rows push the
              Save/Cancel actions below the fold and they become unreachable. */}
          <div className="w-full max-w-4xl max-h-[88vh] flex flex-col bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
              <h3 id="modal-title" className="text-lg font-semibold text-gray-800 dark:text-gray-200">{editingProduct.id ? t('staff.inventory.editTitle') : t('staff.inventory.addProduct')}</h3>
              <button onClick={handleCloseModal} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"><X className="h-5 w-5" /></button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
              {/* Scrollable form body — all fields + variant list live here. */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
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
                              language: val === 'CARD' ? (prev.language || defaultLanguageValue()) : '',
                              category: '', // will be computed on submit
                              variants: prev.variants.map(v => {
                                if (val === 'BOX') return { price: v.price || 0, stockQuantity: v.stockQuantity || 0 };
                                if (val === 'CARD') return { condition: defaultConditionValue(), price: v.price || 0, stockQuantity: v.stockQuantity || 0 };
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
                        options={sealedTypeOptions}
                        onChange={(v) => setFormData(prev => ({ ...prev, sealedType: v }))}
                        onNewOptionCreated={(opt) => addCategoryToTree(opt.value, opt.label, 'sealed-products')}
                        placeholder={sealedCatalogueEmpty ? SEALED_EMPTY_MESSAGE : '-- Chọn loại --'}
                        emptyMessage={SEALED_EMPTY_MESSAGE}
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
                          <CreatableSelect
                            name="rarity"
                            testId="field-rarity"
                            value={resolveRarityValue(formData.rarity) || ''}
                            options={ensureRarityOption(rarityOptions, formData.rarity)}
                            onChange={(v) => setFormData(prev => ({ ...prev, rarity: v }))}
                            onNewOptionCreated={handleCreateRarityOption}
                            placeholder="-- Chọn độ hiếm --"
                            createLabel={(text) => `Thêm độ hiếm: "${text}"`}
                            required
                            className="w-full"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Ngôn ngữ (Language)</label>
                          <CreatableSelect
                            name="language"
                            testId="field-language"
                            value={formData.language}
                            options={ensureLanguageOption(languageOptions, formData.language)}
                            onChange={(v) => setFormData(prev => ({ ...prev, language: v }))}
                            onNewOptionCreated={(opt) => handleCreateLanguageOption(opt.value)}
                            placeholder="-- Chọn ngôn ngữ --"
                            createLabel={(text) => `Thêm ngôn ngữ: "${text}"`}
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
                            testId="field-artist"
                            value={formData.artist}
                            options={ensureValueInOptions(artistOptions.map((a) => ({ value: a, label: a })), formData.artist)}
                            onChange={(v) => setFormData((prev) => ({ ...prev, artist: v }))}
                            onNewOptionCreated={(opt) => setArtistOptions((prev) => [...prev, opt.value])}
                            placeholder="VD: Yuka Morii"
                            createLabel={(text) => `Thêm họa sĩ: "${text}"`}
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
                   <textarea name="description" value={formData.description} onChange={handleInputChange} rows={4} className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
                 </div>

                {/* Dynamic Multi-Image Gallery Uploader */}
                <div className="space-y-3 p-4 bg-gray-50/80 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200">
                        Thư viện ảnh sản phẩm ({formData.images?.length || 0})
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Ảnh tải lên đầu tiên sẽ tự động làm <span className="font-semibold text-pink-600 dark:text-pink-400">Ảnh bìa / Chính</span> (Cover).
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        ref={imageFileInputRef}
                        onChange={handleImageFileUpload}
                        accept="image/*"
                        multiple
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => imageFileInputRef.current?.click()}
                        disabled={uploading}
                        data-testid="add-image-btn"
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50 cursor-pointer shadow-sm"
                      >
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                        + Thêm ảnh
                      </button>
                    </div>
                  </div>

                  {/* Paste Image URL Input Row */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Link2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="url"
                        value={inputImageUrl}
                        onChange={(e) => setInputImageUrl(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddImageUrl();
                          }
                        }}
                        data-testid="image-url-input"
                        placeholder="Hoặc dán URL ảnh (https://... hoặc /uploads/...) rồi nhấn Thêm"
                        className="w-full pl-8 pr-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddImageUrl}
                      data-testid="add-image-url-btn"
                      className="px-3.5 py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg text-xs font-semibold shrink-0 cursor-pointer transition"
                    >
                      + Thêm URL
                    </button>
                  </div>

                  {/* Gallery Thumbnails Grid */}
                  {formData.images && formData.images.length > 0 ? (
                    <div
                      data-testid="product-gallery-uploader-list"
                      className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3 pt-2"
                    >
                      {formData.images.map((imgUrl, index) => (
                        <div
                          key={index}
                          data-testid={`gallery-upload-item-${index}`}
                          className={`group relative aspect-[3/4] rounded-xl overflow-hidden border-2 bg-white dark:bg-gray-800 transition shadow-sm ${
                            index === 0
                              ? 'border-pink-500 ring-2 ring-pink-500/25 shadow-pink-500/10'
                              : 'border-gray-200 dark:border-gray-700 hover:border-primary-400'
                          }`}
                        >
                          <img
                            src={imgUrl}
                            alt={`Ảnh ${index + 1}`}
                            className="w-full h-full object-contain p-1.5"
                          />

                          {/* Cover Badge on first image */}
                          {index === 0 ? (
                            <span
                              data-testid="cover-image-badge"
                              className="absolute top-1.5 left-1.5 z-10 bg-gradient-to-r from-pink-600 to-rose-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm uppercase tracking-wider"
                            >
                              Ảnh bìa / Chính
                            </span>
                          ) : (
                            <span className="absolute top-1.5 left-1.5 z-10 bg-gray-900/75 backdrop-blur-xs text-white text-[9px] font-semibold px-1.5 py-0.5 rounded shadow-sm">
                              #{index + 1}
                            </span>
                          )}

                          {/* Hover Overlay with "Xóa" (Remove) button */}
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 z-20">
                            <button
                              type="button"
                              onClick={() => handleRemoveImage(index)}
                              data-testid={`remove-image-btn-${index}`}
                              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-xs font-semibold flex items-center gap-1 shadow-md cursor-pointer transition transform hover:scale-105"
                              title="Xóa ảnh"
                              aria-label="Xóa"
                            >
                              <X className="h-3.5 w-3.5" /> Xóa
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div
                      onClick={() => imageFileInputRef.current?.click()}
                      className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-5 text-center cursor-pointer hover:border-primary-500 dark:hover:border-primary-400 transition bg-white/50 dark:bg-gray-800/40"
                    >
                      <ImagePlus className="h-7 w-7 mx-auto text-gray-400 mb-1.5" />
                      <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                        Chưa có ảnh nào trong thư viện
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Bấm "+ Thêm ảnh" để tải file từ máy hoặc dán link ảnh vào ô trên
                      </p>
                    </div>
                  )}
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
                    {usesConditionLanguageVariants && (
                      <span className="flex items-center gap-2 normal-case">
                        {t('staff.inventory.conditionLabel')}
                        <button
                          type="button"
                          data-testid="add-condition-btn"
                          onClick={openConditionQuickAdd}
                          className="text-xs text-pink-600 hover:text-pink-700 font-medium flex items-center gap-1 cursor-pointer"
                        >
                          <PlusCircle className="h-3.5 w-3.5" /> Thêm tình trạng mới
                        </button>
                      </span>
                    )}
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
                          <div className="flex-1 min-w-0">
                            <CreatableSelect
                              name="condition"
                              testId={`variant-condition-${idx}`}
                              value={v.condition}
                              options={ensureConditionOption(conditionOptions, v.condition)}
                              onChange={(val) => handleVariantChange(idx, 'condition', val)}
                              onNewOptionCreated={(opt) => handleCreateConditionOption(opt.value, idx)}
                              placeholder="-- Chọn tình trạng --"
                              createLabel={(text) => `Thêm tình trạng: "${text}"`}
                            />
                          </div>
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
              </div>

              {/* Validation / save errors must surface INSIDE the modal (the
                  page-level error banner sits behind the backdrop overlay). */}
              {error && (
                <div role="alert" className="mx-6 mt-3 shrink-0 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}

              {/* Sticky footer — always reachable regardless of variant row count. */}
              <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 flex justify-end gap-3 shrink-0">
                <button type="button" onClick={handleCloseModal} className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">{t('staff.inventory.cancel')}</button>
                <button type="submit" disabled={saving} className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
                  {saving ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Save className="h-5 w-5 mr-2" />}
                  {saving ? 'Đang lưu...' : 'Lưu sản phẩm'}
                </button>
              </div>

              {/* Inline quick-add condition popup — Admin + Staff can create a
                  new "Tình trạng thẻ" on the fly; it is persisted to the DB and
                  auto-selected in the variant dropdown without a page reload. */}
              {showConditionQuickAdd && (
                <div
                  data-testid="condition-quick-add-modal"
                  className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-ink-950/50 dark:bg-black/70 backdrop-blur-sm"
                  onMouseDown={(e) => { if (e.target === e.currentTarget) closeConditionQuickAdd(); }}
                >
                  <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-900 border border-pink-100 dark:border-pink-900/40 shadow-2xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Tag className="h-5 w-5 text-pink-600" />
                      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Thêm tình trạng thẻ mới</h3>
                    </div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Tên / mã tình trạng *</label>
                    <input
                      autoFocus
                      type="text"
                      data-testid="condition-quick-add-input"
                      value={conditionQuickAddValue}
                      onChange={(e) => setConditionQuickAddValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreateCondition(); } }}
                      placeholder="VD: PSA 10, Ungraded"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                    {conditionQuickAddError && <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{conditionQuickAddError}</p>}
                    <div className="mt-4 flex justify-end gap-2">
                      <button type="button" onClick={closeConditionQuickAdd} disabled={conditionQuickAddSaving} className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50">Hủy</button>
                      <button type="button" data-testid="condition-quick-add-save" onClick={handleCreateCondition} disabled={conditionQuickAddSaving} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white rounded-lg bg-pink-600 hover:bg-pink-700 disabled:opacity-50">
                        {conditionQuickAddSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />} Lưu
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryManager;