import React, { useState, useRef } from 'react';
import { ImagePlus, X, Link2 } from 'lucide-react';

/**
 * AddEditProductModal
 * Standalone product add/edit modal component specification with Dynamic Multi-Image Gallery.
 * Supports file upload and pasting image URLs, with primary/cover thumbnail badging.
 */
const AddEditProductModal = ({
  isOpen,
  onClose,
  formData = {},
  onChange,
  onImagesChange,
  onSubmit,
  isEdit = false,
  saving = false
}) => {
  const [urlInput, setUrlInput] = useState('');
  const fileRef = useRef(null);

  if (!isOpen) return null;

  const images = Array.isArray(formData.images) ? formData.images : [];

  const handleAddUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    const updated = [...images, trimmed];
    if (onImagesChange) {
      onImagesChange(updated);
    } else if (onChange) {
      onChange({ target: { name: 'images', value: updated } });
    }
    setUrlInput('');
  };

  const handleRemove = (index) => {
    const updated = images.filter((_, idx) => idx !== index);
    if (onImagesChange) {
      onImagesChange(updated);
    } else if (onChange) {
      onChange({ target: { name: 'images', value: updated } });
    }
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    // In local demo or file input without API client, create object URL
    const newUrls = files.map((f) => URL.createObjectURL(f));
    const updated = [...images, ...newUrls];
    if (onImagesChange) {
      onImagesChange(updated);
    } else if (onChange) {
      onChange({ target: { name: 'images', value: updated } });
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" role="dialog">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl max-w-2xl w-full p-6 border border-neutral-200 dark:border-neutral-800 shadow-xl">
        <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-4">
          {isEdit ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm mới'}
        </h3>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Tên sản phẩm
            </label>
            <input
              type="text"
              name="name"
              value={formData.name || ''}
              onChange={onChange}
              className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Mô tả chi tiết
            </label>
            <textarea
              name="description"
              value={formData.description || ''}
              onChange={onChange}
              rows={4}
              className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              placeholder="Nhập mô tả sản phẩm (không giới hạn độ dài)..."
            />
          </div>

          {/* Dynamic Image Gallery Uploader */}
          <div className="space-y-3 p-4 bg-gray-50/80 dark:bg-neutral-800/50 rounded-xl border border-gray-200 dark:border-neutral-700">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                  Thư viện ảnh sản phẩm ({images.length})
                </label>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Ảnh đầu tiên là <span className="font-semibold text-pink-600">Ảnh bìa / Chính</span> (Cover).
                </p>
              </div>
              <div>
                <input
                  type="file"
                  ref={fileRef}
                  onChange={handleFileUpload}
                  accept="image/*"
                  multiple
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  data-testid="add-image-btn"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-semibold"
                >
                  <ImagePlus className="h-3.5 w-3.5" /> + Thêm ảnh
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Link2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddUrl();
                    }
                  }}
                  data-testid="image-url-input"
                  placeholder="Dán link ảnh (https://... hoặc /uploads/...) rồi bấm Thêm"
                  className="w-full pl-8 pr-3 py-1.5 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                />
              </div>
              <button
                type="button"
                onClick={handleAddUrl}
                data-testid="add-image-url-btn"
                className="px-3 py-1.5 bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 text-neutral-800 dark:text-neutral-200 rounded-lg text-xs font-semibold"
              >
                + Thêm URL
              </button>
            </div>

            {images.length > 0 ? (
              <div
                data-testid="product-gallery-uploader-list"
                className="grid grid-cols-3 sm:grid-cols-4 gap-3 pt-2"
              >
                {images.map((url, idx) => (
                  <div
                    key={idx}
                    data-testid={`gallery-upload-item-${idx}`}
                    className={`group relative aspect-[3/4] rounded-lg overflow-hidden border-2 bg-white dark:bg-neutral-800 ${
                      idx === 0 ? 'border-pink-500' : 'border-neutral-200 dark:border-neutral-700'
                    }`}
                  >
                    <img src={url} alt={`Ảnh ${idx + 1}`} className="w-full h-full object-contain p-1" />
                    {idx === 0 ? (
                      <span
                        data-testid="cover-image-badge"
                        className="absolute top-1 left-1 z-10 bg-pink-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow"
                      >
                        Ảnh bìa / Chính
                      </span>
                    ) : (
                      <span className="absolute top-1 left-1 z-10 bg-black/60 text-white text-[9px] font-semibold px-1 py-0.5 rounded shadow">
                        #{idx + 1}
                      </span>
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => handleRemove(idx)}
                        data-testid={`remove-image-btn-${idx}`}
                        className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold flex items-center gap-1 shadow"
                        title="Xóa ảnh"
                      >
                        <X className="h-3 w-3" /> Xóa
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-700 dark:text-neutral-300"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:opacity-50"
            >
              Lưu
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddEditProductModal;
