import React, { useEffect, useState } from 'react';
import {
  Store,
  Loader2,
  AlertCircle,
  Save,
  Mail,
  Phone,
  MapPin,
  Image as ImageIcon,
  Upload,
  Check,
  MessageCircle,
  Type
} from 'lucide-react';
import api from '../../services/api';
import { useLanguage } from '../../i18n/LanguageContext';
import { useShop, pickShopSettings } from '../../context/ShopContext';

const ShopSettings = () => {
  const { t } = useLanguage();
  const { updateShopInfo } = useShop();
  const [config, setConfig] = useState({
    shop_name: '',
    shop_logo_url: '',
    support_email: '',
    support_phone: '',
    support_address: ''
  });
  const [siteConfig, setSiteConfig] = useState({
    site_title: '',
    site_favicon_url: '',
    support_chat_url: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const fetchConfig = async () => {
      setLoading(true);
      setError('');
      try {
        const [shopRes, siteRes] = await Promise.all([
          api.get('/admin/settings/shop'),
          api.get('/admin/settings/site').catch((err) => {
            console.error('Failed to fetch site settings:', err);
            return null;
          })
        ]);
        const data = shopRes.data.data || {};
        setConfig({
          shop_name: data.shop_name || '',
          shop_logo_url: data.shop_logo_url || '',
          support_email: data.support_email || '',
          support_phone: data.support_phone || '',
          support_address: data.support_address || ''
        });
        const site = siteRes?.data?.data || {};
        setSiteConfig({
          site_title: site.site_title || '',
          site_favicon_url: site.site_favicon_url || '',
          support_chat_url: site.support_chat_url || ''
        });
      } catch (err) {
        console.error('Failed to fetch shop settings:', err);
        setError(err.response?.data?.error?.message || t('admin.shopSettings.loadFailed'));
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name in siteConfig) {
      setSiteConfig((prev) => ({ ...prev, [name]: value }));
    } else {
      setConfig((prev) => ({ ...prev, [name]: value }));
    }
  };

  const uploadImage = async (file, onDone) => {
    const data = new FormData();
    data.append('image', file);
    const response = await api.post('/admin/upload-image', data, { headers: { 'Content-Type': 'multipart/form-data' } });
    onDone(response.data.data.url);
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      await uploadImage(file, (url) => setConfig((prev) => ({ ...prev, shop_logo_url: url })));
      showToast(t('admin.shopSettings.uploadOk'));
    } catch (err) {
      console.error('Logo upload failed:', err);
      showToast(err.response?.data?.error?.message || t('admin.shopSettings.uploadFailed'), 'error');
    } finally {
      setUploadingLogo(false);
      e.target.value = '';
    }
  };

  const handleFaviconUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFavicon(true);
    try {
      await uploadImage(file, (url) => setSiteConfig((prev) => ({ ...prev, site_favicon_url: url })));
      showToast(t('admin.shopSettings.faviconUploadOk'));
    } catch (err) {
      console.error('Favicon upload failed:', err);
      showToast(err.response?.data?.error?.message || t('admin.shopSettings.uploadFailed'), 'error');
    } finally {
      setUploadingFavicon(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const shopPayload = {
      shop_name: config.shop_name.trim(),
      shop_logo_url: (config.shop_logo_url || '').trim(),
      support_email: config.support_email.trim(),
      support_phone: config.support_phone.trim(),
      support_address: config.support_address.trim()
    };
    const sitePayload = {
      site_title: siteConfig.site_title.trim(),
      site_favicon_url: (siteConfig.site_favicon_url || '').trim(),
      support_chat_url: (siteConfig.support_chat_url || '').trim()
    };
    try {
      const [shopResponse] = await Promise.all([
        api.put('/admin/settings/shop', shopPayload),
        api.put('/admin/settings/site', sitePayload)
      ]);
      const saved = pickShopSettings(shopResponse.data.data || shopPayload);
      setConfig((prev) => ({ ...prev, ...saved }));
      // Push the saved values into global shop state so Navbar / Footer
      // (and any other ShopContext consumer) re-render immediately.
      updateShopInfo(saved);
      showToast(shopResponse.data.message || t('admin.shopSettings.saved'));
    } catch (err) {
      console.error('Failed to save shop settings:', err);
      const detail = err.response?.data?.error?.details?.map((d) => `${d.field}: ${d.message}`).join('. ');
      setError(detail || err.response?.data?.error?.message || t('admin.shopSettings.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-12 w-12 animate-spin text-primary-600" />
      </div>
    );
  }

  const inputClass = 'w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 flex items-center">
          <Store className="h-6 w-6 mr-2 text-primary-600" />
          {t('admin.shopSettings.title')}
        </h2>
        <p className="text-gray-500">{t('admin.shopSettings.subtitle')}</p>
      </div>

      {toast && (
        <div
          data-testid="shop-settings-toast"
          role="status"
          className={`p-3 rounded-lg flex items-center ${toast.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}
        >
          {toast.type === 'success' ? <Check className="h-5 w-5 mr-2" /> : <AlertCircle className="h-5 w-5 mr-2" />}
          {toast.message}
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 text-red-600 rounded-lg flex items-center">
          <AlertCircle className="h-5 w-5 mr-2" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-card p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.shopSettings.shopName')}</label>
          <div className="relative">
            <Store className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              name="shop_name"
              value={config.shop_name}
              onChange={handleChange}
              required
              maxLength={200}
              className={inputClass}
              placeholder="TCG Store"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.shopSettings.logoUrl')}</label>
          <div className="relative">
            <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              name="shop_logo_url"
              value={config.shop_logo_url}
              onChange={handleChange}
              className={inputClass}
              placeholder="https://example.com/logo.png"
            />
            <label
              className={`absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                uploadingLogo
                  ? 'bg-gray-100 text-gray-400 pointer-events-none'
                  : 'bg-primary-50 text-primary-700 hover:bg-primary-100'
              }`}
            >
              {uploadingLogo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {t('admin.shopSettings.upload')}
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                disabled={uploadingLogo}
                className="hidden"
              />
            </label>
          </div>
          {config.shop_logo_url && (
            <div className="mt-2 flex items-center gap-2">
              <img src={config.shop_logo_url} alt={t('admin.shopSettings.logoPreview')} className="h-10 w-10 rounded-lg object-cover ring-1 ring-gray-200" />
              <span className="text-xs text-gray-500">{t('admin.shopSettings.logoPreview')}</span>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.shopSettings.siteTitle')}</label>
          <div className="relative">
            <Type className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              name="site_title"
              value={siteConfig.site_title}
              onChange={handleChange}
              required
              maxLength={200}
              className={inputClass}
              placeholder="TCG Store — Premium Pokémon TCG"
            />
          </div>
          <p className="mt-1 text-xs text-gray-400">{t('admin.shopSettings.siteTitleHint')}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.shopSettings.faviconUrl')}</label>
          <div className="relative">
            <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              name="site_favicon_url"
              value={siteConfig.site_favicon_url}
              onChange={handleChange}
              className={inputClass}
              placeholder="https://example.com/favicon.png"
            />
            <label
              className={`absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                uploadingFavicon
                  ? 'bg-gray-100 text-gray-400 pointer-events-none'
                  : 'bg-primary-50 text-primary-700 hover:bg-primary-100'
              }`}
            >
              {uploadingFavicon ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {t('admin.shopSettings.upload')}
              <input
                type="file"
                accept="image/*"
                onChange={handleFaviconUpload}
                disabled={uploadingFavicon}
                className="hidden"
              />
            </label>
          </div>
          {siteConfig.site_favicon_url && (
            <div className="mt-2 flex items-center gap-2" data-testid="favicon-preview">
              <img
                src={siteConfig.site_favicon_url}
                alt={t('admin.shopSettings.faviconPreview')}
                className="h-6 w-6 rounded object-contain ring-1 ring-gray-200"
              />
              <span className="text-xs text-gray-500">{t('admin.shopSettings.faviconPreview')}</span>
            </div>
          )}
          <p className="mt-1 text-xs text-gray-400">{t('admin.shopSettings.faviconHint')}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.shopSettings.supportChatUrl')}</label>
          <div className="relative">
            <MessageCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              name="support_chat_url"
              value={siteConfig.support_chat_url}
              onChange={handleChange}
              maxLength={2048}
              className={inputClass}
              placeholder="https://m.me/1251937284677510"
            />
          </div>
          <p className="mt-1 text-xs text-gray-400">{t('admin.shopSettings.supportChatHint')}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.shopSettings.supportEmail')}</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="email"
              name="support_email"
              value={config.support_email}
              onChange={handleChange}
              required
              maxLength={255}
              className={inputClass}
              placeholder="support@tcgstore.com"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.shopSettings.supportPhone')}</label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              name="support_phone"
              value={config.support_phone}
              onChange={handleChange}
              required
              maxLength={50}
              className={inputClass}
              placeholder="+84 123 456 789"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.shopSettings.supportAddress')}</label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              name="support_address"
              value={config.support_address}
              onChange={handleChange}
              required
              maxLength={500}
              className={inputClass}
              placeholder="123 Main St, Hanoi, Vietnam"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            data-testid="shop-settings-save"
            disabled={saving || uploadingLogo || uploadingFavicon}
            className="inline-flex items-center px-6 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                {t('admin.shopSettings.saving')}
              </>
            ) : (
              <>
                <Save className="h-5 w-5 mr-2" />
                {t('admin.shopSettings.save')}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ShopSettings;
