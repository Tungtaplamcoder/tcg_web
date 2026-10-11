import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Plus, Check } from 'lucide-react';

const normalizeValue = (val) => {
  if (!val) return null;
  if (typeof val === 'object' && val !== null && 'value' in val) {
    return { value: String(val.value), label: val.label || String(val.value) };
  }
  return { value: String(val), label: String(val) };
};

/**
 * Searchable combobox with "create on the fly" support.
 *
 * Props:
 * - name:        input name attribute (also used by E2E locators)
 * - value:       the selected option value, or free text typed by the user.
 *                Accepts either a string (e.g. "set 1") or an object
 *                { label: string, value: string }.
 * - options:     [{ value, label, hint? }] — `hint` renders under the label
 * - onChange(value, { isNew }): fired when an option is picked OR a new
 *   value is created (isNew = true when the text matches no option label)
 * - onNewOptionCreated(option): fired when a new option is created, passing
 *   the full { label, value } object. Use to persist the option in the
 *   parent's options list so it remains visible after re-render.
 * - placeholder, label, createLabel (fn: text => string), disabled
 *
 * The input always shows the human-readable label for the current value
 * (falling back to the raw value for freshly created entries).
 */
const CreatableSelect = ({
  name,
  value,
  options = [],
  onChange,
  onNewOptionCreated,
  placeholder = '',
  label,
  createLabel = (text) => `Tạo mới: "${text}"`,
  emptyMessage,
  disabled = false,
  required = false,
  testId
}) => {
  const normalizedValue = normalizeValue(value);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [localOptions, setLocalOptions] = useState(options);
  const wrapRef = useRef(null);

  useEffect(() => {
    setLocalOptions((prev) => {
      const existingKeys = new Set(prev.map((o) => o.value));
      const merged = [...prev];
      for (const opt of options) {
        if (!existingKeys.has(opt.value)) {
          merged.push(opt);
        }
      }
      return merged;
    });
  }, [options]);

  const selected = localOptions.find((o) => o.value === normalizedValue?.value);

  const displayText = open ? query : (selected ? selected.label : (normalizedValue ? normalizedValue.label : ''));

  useEffect(() => {
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const norm = (s) => String(s || '').trim().toLowerCase();
  const filtered = localOptions.filter((o) => norm(o.label).includes(norm(query)));
  const exactMatch = localOptions.some((o) => norm(o.label) === norm(query) || norm(o.value) === norm(query));
  const canCreate = query.trim().length > 0 && !exactMatch;

  const pick = (option) => {
    onChange(option.value, { isNew: false, option });
    setQuery('');
    setOpen(false);
  };

  const create = useCallback(() => {
    const text = query.trim();
    if (!text) return;
    const newOption = { label: text, value: text };
    setLocalOptions((prev) => {
      if (prev.some((o) => o.value === newOption.value)) return prev;
      return [...prev, newOption];
    });
    if (onNewOptionCreated) onNewOptionCreated(newOption);
    onChange(newOption.value, { isNew: true, option: newOption });
    setQuery('');
    setOpen(false);
  }, [query, onChange, onNewOptionCreated]);

  return (
    <div ref={wrapRef} className="relative" data-creatable-select={name} data-testid={testId || undefined}>
      {label && (
        <label className="block text-sm font-medium text-gray-700">{label}{required && ' *'}</label>
      )}
      <div className="mt-1 relative">
        <input
          type="text"
          name={name}
          role="combobox"
          aria-expanded={open}
          aria-label={label || name}
          autoComplete="off"
          disabled={disabled}
          value={displayText}
          placeholder={!normalizedValue && options.length === 0 && emptyMessage ? emptyMessage : placeholder}
          onFocus={() => { setOpen(true); setQuery(''); }}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (filtered.length > 0 && norm(filtered[0].label) === norm(query)) pick(filtered[0]);
              else if (canCreate) create();
              else if (filtered.length > 0) pick(filtered[0]);
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
          className="w-full px-3 py-2 pr-9 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100 dark:disabled:bg-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
        />
        <ChevronDown
          className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none"
        />
      </div>

{open && (
            <ul
              role="listbox"
              aria-label={label || name}
              className="absolute z-[9999] mt-1 w-full max-h-60 overflow-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl py-1"
              style={{ zIndex: 9999 }}
            >
{filtered.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={o.value === normalizedValue?.value}
                  onClick={() => pick(o)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-primary-50 dark:hover:bg-primary-900/20 flex items-center justify-between gap-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-gray-800 dark:text-gray-100">{o.label}</span>
                    {o.hint && <span className="block text-xs text-gray-400 dark:text-gray-500 truncate">{o.hint}</span>}
                  </span>
                  {o.value === normalizedValue?.value && <Check className="h-4 w-4 text-primary-600 dark:text-primary-400 shrink-0" />}
                </button>
              </li>
            ))}
            {filtered.length === 0 && !canCreate && (
              <li
                data-testid="creatable-empty"
                className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500"
              >
                {emptyMessage || '—'}
              </li>
            )}
            {canCreate && (
              <li>
                <button
                  type="button"
                  role="option"
                  aria-selected="false"
                  onClick={create}
                  className="w-full text-left px-3 py-2 text-sm text-pink-600 dark:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-900/20 flex items-center gap-2 font-medium"
                >
                  <Plus className="h-4 w-4 text-pink-500 shrink-0" />
                  <span className="truncate">{createLabel(query.trim())}</span>
                </button>
              </li>
            )}
        </ul>
      )}
    </div>
  );
};

export default CreatableSelect;
