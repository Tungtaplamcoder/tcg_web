import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Loader2, Pencil } from 'lucide-react';

/**
 * Unified floating Edit Modal for every Catalog Settings tab.
 *
 * One component drives the edit workflow for Series / Era, Expansion Sets,
 * Rarities (Độ hiếm) and Sealed Product categories. The parent supplies:
 *   • `title`         — e.g. "Chỉnh sửa Base Set"
 *   • `fields`        — field descriptors rendered as text inputs / selects
 *   • `initialValues` — pre-filled values for the active row
 *   • `onSubmit`      — async handler that performs the backend PUT
 *
 * It never mutates data on its own: cancel closes, submit delegates up, and
 * the parent owns toast + table refresh. Rendered only while open (returns
 * null otherwise) so it cannot leak state across rows.
 */
const CatalogEditModal = ({
  isOpen,
  title,
  fields = [],
  initialValues = {},
  saving = false,
  onSubmit,
  onClose,
  error = ''
}) => {
  const [values, setValues] = useState(initialValues);
  const savingRef = useRef(saving);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    savingRef.current = saving;
    onCloseRef.current = onClose;
  }, [saving, onClose]);

  // Re-prime the form every time the modal is opened (or the target row
  // changes) so a cancelled edit never leaves stale values behind.
  useEffect(() => {
    if (isOpen) setValues(initialValues || {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, title]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    const handleKey = (e) => {
      if (e.key === 'Escape' && !savingRef.current) onCloseRef.current?.();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const setField = (name, value) => setValues((prev) => ({ ...prev, [name]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (saving) return;
    onSubmit?.(values);
  };

  const inputCls =
    'w-full px-3 py-2.5 border border-ink-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100';

  return (
    <div
      data-testid="catalog-edit-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/50 dark:bg-black/70 backdrop-blur-sm animate-tcg-fade-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose?.();
      }}
    >
      <div className="relative w-full max-w-lg rounded-3xl bg-white/95 dark:bg-[#1e1318]/95 backdrop-blur-xl border border-ink-100 dark:border-white/10 shadow-2xl shadow-ink-900/20 p-6 sm:p-7 animate-tcg-scale-in">
        <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-primary-400/60 to-transparent" />

        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 h-12 w-12 rounded-2xl ring-1 bg-gradient-to-br from-primary-50 to-fuchsia-100 ring-primary-200/60 flex items-center justify-center">
            <Pencil className="h-6 w-6 text-primary-600" />
          </div>
          <div className="flex-1 pt-0.5">
            <h3
              data-testid="catalog-edit-title"
              className="text-lg font-bold text-ink-900 dark:text-white font-display tracking-tight"
            >
              {title}
            </h3>
            <p className="mt-1 text-sm text-ink-500 dark:text-ink-300">
              Cập nhật thông tin rồi bấm Lưu thay đổi.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="p-1.5 rounded-lg text-ink-400 dark:text-ink-300 hover:text-ink-700 dark:hover:text-ink-100 hover:bg-ink-900/5 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {fields.map((field) => (
            <div key={field.name}>
              <label className="block text-xs font-medium text-ink-500 dark:text-ink-300 mb-1">
                {field.label}
                {field.required ? ' *' : ''}
              </label>
              {field.type === 'select' ? (
                <select
                  data-testid={`catalog-edit-${field.name}`}
                  value={values[field.name] ?? ''}
                  onChange={(e) => setField(field.name, e.target.value)}
                  required={field.required}
                  className={inputCls}
                >
                  <option value="">{field.placeholder || '-- Chọn --'}</option>
                  {(field.options || []).map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  data-testid={`catalog-edit-${field.name}`}
                  value={values[field.name] ?? ''}
                  onChange={(e) => setField(field.name, e.target.value)}
                  placeholder={field.placeholder}
                  required={field.required}
                  className={inputCls}
                />
              )}
            </div>
          ))}

          {error && (
            <p className="text-sm text-rose-600 dark:text-rose-400" data-testid="catalog-edit-error">
              {error}
            </p>
          )}

          <div className="mt-7 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="btn-secondary !px-5 !py-2.5 text-sm"
            >
              Hủy
            </button>
            <button
              type="submit"
              data-testid="catalog-edit-save"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm text-white font-semibold rounded-xl bg-gradient-to-r from-primary-600 to-fuchsia-600 shadow-[0_8px_20px_-6px_rgba(124,58,237,0.45)] hover:brightness-110 transition-all duration-300 active:scale-[0.97] disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Cập nhật
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CatalogEditModal;
