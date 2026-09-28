import React, { useEffect, useState } from 'react';
import {
  Settings,
  Loader2,
  AlertCircle,
  Save,
  Key,
  CreditCard,
  Building,
  Globe,
  Check,
  Eye,
  EyeOff
} from 'lucide-react';
import api from '../../services/api';
import { useLanguage } from '../../i18n/LanguageContext';

const SePayConfig = () => {
  const { t } = useLanguage();
  const [config, setConfig] = useState({
    apiUrl: '',
    webhookUrl: '',
    webhookSecret: '',
    accountNumber: '',
    accountName: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [configSource, setConfigSource] = useState('env-defaults');

  useEffect(() => {
    const fetchConfig = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.get('/admin/settings/sepay');
        const data = response.data.data || {};
        setConfigSource(data.source || 'env-defaults');
        setConfig({
          apiUrl: data.apiUrl || '',
          webhookUrl: data.webhookUrl || '',
          webhookSecret: data.webhookSecret || '',
          accountNumber: data.accountNumber || '',
          accountName: data.accountName || ''
        });
      } catch (err) {
        console.error('Failed to fetch SePay config:', err);
        setError(err.response?.data?.error?.message || t('admin.shopSettings.loadFailed'));
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const handleChange = (e) => {
    setConfig({ ...config, [e.target.name]: e.target.value });
    setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.put('/admin/settings/sepay', config);
      setSuccess(t('admin.shopSettings.saved'));
      setConfigSource('database');
    } catch (err) {
      console.error('Failed to save SePay config:', err);
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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 flex items-center">
          <Settings className="h-6 w-6 mr-2 text-primary-600" />
          {t('admin.sepay.title')}
        </h2>
        <p className="text-gray-500">{t('admin.sepay.subtitle')}</p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-600 rounded-lg flex items-center">
          <AlertCircle className="h-5 w-5 mr-2" />
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 text-green-700 rounded-lg flex items-center">
          <Check className="h-5 w-5 mr-2" />
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-card p-6 space-y-5">
        {configSource === 'env-defaults' && (
          <div className="p-3 bg-blue-50 text-blue-700 rounded-lg text-sm flex items-start">
            <Globe className="h-5 w-5 mr-2 mt-0.5 shrink-0" />
            <span>
              {t('admin.sepay.defaultFrom')}{' '}
              (SEPAY_API_URL, SEPAY_WEBHOOK_URL/APP_BASE_URL, SEPAY_WEBHOOK_SECRET, SEPAY_ACCOUNT_NUMBER, SEPAY_ACCOUNT_NAME).
            </span>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.sepay.apiUrl')}</label>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="url"
              name="apiUrl"
              value={config.apiUrl}
              onChange={handleChange}
              required
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="https://my.sepay.vn"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.sepay.webhookUrl')}</label>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              name="webhookUrl"
              value={config.webhookUrl}
              onChange={handleChange}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="https://your-domain.com/api/v1/webhooks/sepay"
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {t('admin.sepay.webhookHint')} / APP_BASE_URL — /api/v1/webhooks/sepay
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.sepay.webhookSecret')}</label>
          <div className="relative">
            <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type={showSecret ? 'text' : 'password'}
              name="webhookSecret"
              value={config.webhookSecret}
              onChange={handleChange}
              required
              className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder={t('admin.sepay.secretPlaceholder')}
            />
            <button
              type="button"
              onClick={() => setShowSecret(!showSecret)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
            >
              {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.sepay.accountNumber')}</label>
            <div className="relative">
              <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                name="accountNumber"
                value={config.accountNumber}
                onChange={handleChange}
                required
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder={t('admin.sepay.accountPlaceholder')}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.sepay.accountName')}</label>
            <div className="relative">
              <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                name="accountName"
                value={config.accountName}
                onChange={handleChange}
                required
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder={t('admin.sepay.namePlaceholder')}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center px-6 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                {t('admin.sepay.saving')}
              </>
            ) : (
              <>
                <Save className="h-5 w-5 mr-2" />
                {t('admin.sepay.save')}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SePayConfig;