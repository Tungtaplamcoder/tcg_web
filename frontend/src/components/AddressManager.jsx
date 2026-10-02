import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X, MapPin, Plus, Pencil, Trash2, Check, Star, ChevronDown
} from 'lucide-react';
import { useAddressStore } from '../store/useAddressStore';
import { useLanguage } from '../i18n/LanguageContext';
import provincesData from '../province.json';
import wardsData from '../ward.json';

/* ── AddressManager ──────────────────────────────────────────────────────
   Saved shipping address book (Shopee-style), rendered as a floating
   pastel-pink card modal. Two modes:
     • manage  — full CRUD from the profile dropdown ("Địa chỉ nhận hàng")
     • picker  — checkout address picker; clicking a saved card fills the
                 checkout form in one click (onSelect).
   Controlled by props so the caller can own open state; the manage modal
   is additionally driven by the store flag mounted in the layout. */

const provinces = Object.values(provincesData).sort((a, b) => a.name.localeCompare(b.name));
const allWards = Object.values(wardsData);

const EMPTY_FORM = {
  fullName: '',
  phone: '',
  provinceCode: '',
  wardCode: '',
  addressLine1: '',
  isDefault: false
};

const AddressManager = ({ isOpen, onClose, pickerMode = false, onSelect }) => {
  const { t } = useLanguage();
  const { addresses, addAddress, updateAddress, deleteAddress, setDefault } = useAddressStore();

  const [view, setView] = useState('list'); // 'list' | 'form'
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [filteredWards, setFilteredWards] = useState([]);
  const [formError, setFormError] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);
  const pendingWardRef = useRef(null);

  // Reset to the list view every time the modal opens.
  useEffect(() => {
    if (isOpen) {
      setView('list');
      setEditingId(null);
      setForm(EMPTY_FORM);
      setFormError('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (filteredWards.length === 0) return;
    if (pendingWardRef.current && filteredWards.some((w) => w.code === pendingWardRef.current)) {
      setForm((prev) => ({ ...prev, wardCode: pendingWardRef.current }));
    }
    pendingWardRef.current = null;
  }, [filteredWards]);

  // Keep the ward list in sync with the chosen province.
  useEffect(() => {
    if (!form.provinceCode) {
      setFilteredWards([]);
      return;
    }
    const wards = allWards
      .filter((w) => String(w.parent_code) === String(form.provinceCode))
      .sort((a, b) => a.name.localeCompare(b.name));
    setFilteredWards(wards);
  }, [form.provinceCode]);

  const provinceName = useMemo(() => {
    const p = provinces.find((x) => x.code === form.provinceCode);
    return p ? (p.name_with_type || p.name) : '';
  }, [form.provinceCode]);

  const wardName = useMemo(() => {
    const w = filteredWards.find((x) => x.code === form.wardCode);
    return w ? (w.name_with_type || w.name) : '';
  }, [filteredWards, form.wardCode]);

  if (!isOpen) return null;

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFilteredWards([]);
    setFormError('');
    setView('form');
  };

  const openEdit = (addr) => {
    setEditingId(addr.id);
    setForm({
      fullName: addr.fullName,
      phone: addr.phone,
      provinceCode: addr.provinceCode,
      wardCode: addr.wardCode,
      addressLine1: addr.addressLine1,
      isDefault: addr.isDefault
    });
    setFormError('');
    setView('form');
  };

  const handleField = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleProvinceChange = (e) => {
    const code = e.target.value;
    pendingWardRef.current = null;
    setForm((prev) => ({ ...prev, provinceCode: code, wardCode: '' }));
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!form.fullName.trim()) { setFormError(t('addresses.errFullName')); return; }
    if (!form.phone.trim()) { setFormError(t('addresses.errPhone')); return; }
    if (!form.provinceCode) { setFormError(t('addresses.errProvince')); return; }
    if (!form.wardCode) { setFormError(t('addresses.errWard')); return; }
    if (!form.addressLine1.trim()) { setFormError(t('addresses.errStreet')); return; }

    const payload = {
      ...form,
      provinceName,
      wardName
    };
    if (editingId) {
      updateAddress(editingId, payload);
    } else {
      addAddress(payload);
    }
    setView('list');
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1800);
  };

  const handleSelect = (addr) => {
    if (pickerMode && onSelect) onSelect(addr);
    if (onClose) onClose();
  };

  const AddressCard = ({ addr }) => (
    <div
      data-testid="address-card"
      className="relative bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md border border-pink-100/70 dark:border-neutral-800 rounded-3xl p-5 shadow-sm transition-all duration-300 hover:shadow-soft hover:border-pink-200/80"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-ink-900 dark:text-white truncate">{addr.fullName}</p>
            <span className="text-ink-300">·</span>
            <p className="text-sm text-ink-500 dark:text-ink-300">{addr.phone}</p>
            {addr.isDefault && (
              <span
                data-testid="address-default-badge"
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300"
              >
                <Check className="h-3 w-3" />
                {t('addresses.defaultBadge')}
              </span>
            )}
          </div>
          <p className="mt-2 text-sm text-ink-600 dark:text-ink-200 leading-relaxed">
            {[addr.addressLine1, addr.wardName, addr.provinceName].filter(Boolean).join(', ')}
          </p>
        </div>
        <div className="h-9 w-9 shrink-0 rounded-full bg-blush-100 dark:bg-blush-500/15 ring-1 ring-pink-100/80 dark:ring-neutral-700 flex items-center justify-center">
          <MapPin className="h-4 w-4 text-primary-600 dark:text-primary-300" />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {pickerMode ? (
          <button
            type="button"
            onClick={() => handleSelect(addr)}
            data-testid="address-choose"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-primary-600 to-primary-400 hover:opacity-95 transition-opacity"
          >
            <Check className="h-4 w-4" />
            {t('addresses.choose')}
          </button>
        ) : (
          <>
            {!addr.isDefault && (
              <button
                type="button"
                onClick={() => setDefault(addr.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-pink-700 dark:text-pink-300 bg-pink-100 dark:bg-pink-950/60 hover:bg-pink-200/70 transition-colors"
              >
                <Star className="h-3.5 w-3.5" />
                {t('addresses.setDefault')}
              </button>
            )}
            <button
              type="button"
              onClick={() => openEdit(addr)}
              data-testid="address-edit"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-ink-600 dark:text-ink-200 bg-ink-50 dark:bg-white/5 hover:bg-ink-100 dark:hover:bg-white/10 transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
              {t('addresses.edit')}
            </button>
            <button
              type="button"
              onClick={() => deleteAddress(addr.id)}
              data-testid="address-delete"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t('addresses.delete')}
            </button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/50 dark:bg-black/70 backdrop-blur-sm animate-tcg-fade-in"
      onMouseDown={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}
    >
      <div
        data-testid="address-manager"
        className="relative w-full max-w-2xl max-h-[88vh] flex flex-col rounded-3xl bg-white/90 dark:bg-neutral-900/90 backdrop-blur-xl border border-pink-100/70 dark:border-neutral-800 shadow-2xl animate-tcg-scale-in"
      >
        <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-pink-300/70 to-transparent" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-pink-100/70 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blush-100 to-primary-100 dark:from-primary-400/30 dark:to-blush-500/20 ring-1 ring-pink-200/70 dark:ring-neutral-700 flex items-center justify-center">
              <MapPin className="h-5 w-5 text-primary-700 dark:text-primary-200" />
            </div>
            <div>
              <h3 className="font-display font-bold text-lg text-ink-900 dark:text-white">
                {pickerMode ? t('addresses.pickerTitle') : t('addresses.title')}
              </h3>
              <p className="text-xs text-ink-400 dark:text-ink-300">
                {pickerMode ? t('addresses.pickerSubtitle') : t('addresses.subtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            data-testid="address-manager-close"
            className="p-1.5 rounded-lg text-ink-400 dark:text-ink-300 hover:text-ink-700 dark:hover:text-ink-100 hover:bg-ink-900/5 dark:hover:bg-white/10 transition-colors"
            aria-label={t('common.close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {savedFlash && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 text-sm font-medium dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/30">
              {t('addresses.saved')}
            </div>
          )}

          {view === 'form' ? (
            <form onSubmit={handleSave} className="space-y-4" data-testid="address-form">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label-premium">{t('addresses.fullName')} *</label>
                  <input
                    type="text"
                    name="fullName"
                    data-testid="address-input-fullname"
                    value={form.fullName}
                    onChange={handleField}
                    placeholder={t('checkout.namePlaceholder')}
                    className="input-premium"
                  />
                </div>
                <div>
                  <label className="label-premium">{t('addresses.phone')} *</label>
                  <input
                    type="text"
                    name="phone"
                    data-testid="address-input-phone"
                    value={form.phone}
                    onChange={handleField}
                    placeholder={t('checkout.phonePlaceholder')}
                    className="input-premium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label-premium">{t('addresses.province')} *</label>
                  <div className="relative">
                    <select
                      name="provinceCode"
                      data-testid="address-input-province"
                      value={form.provinceCode}
                      onChange={handleProvinceChange}
                      className="input-premium appearance-none pr-10 cursor-pointer"
                    >
                      <option value="">{t('checkout.selectProvince')}</option>
                      {provinces.map((prov) => (
                        <option key={prov.code} value={prov.code}>{prov.name_with_type}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="label-premium">{t('addresses.ward')} *</label>
                  <div className="relative">
                    <select
                      name="wardCode"
                      data-testid="address-input-ward"
                      value={form.wardCode}
                      onChange={handleField}
                      disabled={!form.provinceCode}
                      className="input-premium appearance-none pr-10 cursor-pointer"
                    >
                      <option value="">{form.provinceCode ? t('checkout.selectWard') : t('checkout.selectProvinceFirst')}</option>
                      {filteredWards.map((ward) => (
                        <option key={ward.code} value={ward.code}>{ward.name_with_type}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div>
                <label className="label-premium">{t('addresses.street')} *</label>
                <input
                  type="text"
                  name="addressLine1"
                  data-testid="address-input-street"
                  value={form.addressLine1}
                  onChange={handleField}
                  placeholder={t('addresses.streetPlaceholder')}
                  className="input-premium"
                />
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  name="isDefault"
                  data-testid="address-input-default"
                  checked={form.isDefault}
                  onChange={handleField}
                  className="h-4 w-4 rounded border-pink-200 text-primary-600 focus:ring-primary-400/50"
                />
                <span className="text-sm font-medium text-ink-600 dark:text-ink-200">{t('addresses.setAsDefault')}</span>
              </label>

              {formError && (
                <div className="p-3.5 rounded-xl bg-rose-50 text-rose-600 ring-1 ring-rose-200 text-sm font-medium dark:bg-rose-400/10 dark:text-rose-300 dark:ring-rose-400/30">
                  {formError}
                </div>
              )}
            </form>
          ) : addresses.length === 0 ? (
            <div className="py-14 text-center">
              <div className="mx-auto h-14 w-14 rounded-2xl bg-blush-100 dark:bg-white/5 ring-1 ring-pink-100 dark:ring-neutral-800 flex items-center justify-center">
                <MapPin className="h-7 w-7 text-pink-300" />
              </div>
              <p className="mt-4 text-ink-600 dark:text-ink-200 font-medium">{t('addresses.empty')}</p>
              <p className="mt-1 text-sm text-ink-400 dark:text-ink-300">{t('addresses.emptyHint')}</p>
            </div>
          ) : (
            <div className="space-y-3" data-testid="address-list">
              {addresses.map((addr) => <AddressCard key={addr.id} addr={addr} />)}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-pink-100/70 dark:border-neutral-800 flex items-center justify-between gap-3">
          {view === 'form' ? (
            <>
              <button type="button" onClick={() => setView('list')} className="text-sm font-medium text-ink-500 hover:text-ink-700 dark:text-ink-300 transition-colors">
                {t('addresses.cancel')}
              </button>
              <button type="button" onClick={handleSave} data-testid="address-save" className="btn-primary !px-5 !py-2.5 text-sm">
                {editingId ? t('addresses.update') : t('addresses.save')}
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={openAdd} data-testid="address-add" className="btn-primary !px-5 !py-2.5 text-sm">
                <Plus className="h-4 w-4" />
                {t('addresses.addNew')}
              </button>
              <button type="button" onClick={onClose} className="btn-secondary !px-5 !py-2.5 text-sm">
                {t('common.close')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddressManager;
