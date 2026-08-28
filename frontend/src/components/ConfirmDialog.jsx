import React, { useEffect, useRef } from 'react';
import { AlertTriangle, X, Check, Loader2, Info, ShieldAlert } from 'lucide-react';

const ConfirmDialog = ({
  isOpen,
  title = 'Xác nhận',
  message = 'Bạn có chắc chắn muốn thực hiện hành động này?',
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy',
  variant = 'danger', // 'danger' | 'info' | 'warning'
  loading = false,
  onConfirm,
  onCancel,
}) => {
  const loadingRef = useRef(loading);
  const onCancelRef = useRef(onCancel);
  useEffect(() => {
    loadingRef.current = loading;
    onCancelRef.current = onCancel;
  }, [loading, onCancel]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    const handleKey = (e) => {
      if (e.key === 'Escape' && !loadingRef.current) onCancelRef.current?.();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      icon: <ShieldAlert className="h-6 w-6 text-rose-600" />,
      iconWrap: 'bg-gradient-to-br from-rose-50 to-red-100 ring-rose-200/60',
      button:
        'bg-gradient-to-r from-rose-600 to-red-600 shadow-[0_8px_20px_-6px_rgba(225,29,72,0.45)] hover:brightness-110',
    },
    warning: {
      icon: <AlertTriangle className="h-6 w-6 text-amber-600" />,
      iconWrap: 'bg-gradient-to-br from-amber-50 to-orange-100 ring-amber-200/60',
      button:
        'bg-gradient-to-r from-amber-500 to-orange-500 shadow-[0_8px_20px_-6px_rgba(217,119,6,0.45)] hover:brightness-110',
    },
    info: {
      icon: <Info className="h-6 w-6 text-primary-600" />,
      iconWrap: 'bg-gradient-to-br from-primary-50 to-fuchsia-100 ring-primary-200/60',
      button:
        'bg-gradient-to-r from-primary-600 to-fuchsia-600 shadow-[0_8px_20px_-6px_rgba(124,58,237,0.45)] hover:brightness-110',
    },
  };

  const selected = variantStyles[variant] || variantStyles.info;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/50 dark:bg-black/70 backdrop-blur-sm animate-tcg-fade-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !loading) onCancel();
      }}
    >
      <div className="relative w-full max-w-md rounded-3xl bg-white/95 dark:bg-[#14141e]/95 backdrop-blur-xl border border-ink-100 dark:border-white/10 shadow-2xl shadow-ink-900/20 p-6 sm:p-7 animate-tcg-scale-in">
        <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-primary-400/60 to-transparent" />

        <div className="flex items-start gap-4">
          <div className={`flex-shrink-0 h-12 w-12 rounded-2xl ring-1 flex items-center justify-center ${selected.iconWrap}`}>
            {selected.icon}
          </div>
          <div className="flex-1 pt-0.5">
            <h3 className="text-lg font-bold text-ink-900 dark:text-white font-display tracking-tight">{title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-500 dark:text-ink-300">{message}</p>
          </div>
          <button
            onClick={onCancel}
            disabled={loading}
            className="p-1.5 rounded-lg text-ink-400 dark:text-ink-300 hover:text-ink-700 dark:text-ink-100 hover:bg-ink-900/5 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-7 flex justify-end gap-3">
          <button onClick={onCancel} disabled={loading} className="btn-secondary !px-5 !py-2.5 text-sm">
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm text-white font-semibold rounded-xl transition-all duration-300 active:scale-[0.97] disabled:opacity-50 ${selected.button}`}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
