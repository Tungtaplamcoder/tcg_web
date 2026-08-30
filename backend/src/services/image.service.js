const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const env = require('../config/env');

// Fallback storage dir: backend/public/uploads (served at /uploads in app.js)
const LOCAL_UPLOAD_DIR = path.join(__dirname, '../../public/uploads');
fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });

const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg', 'bmp', 'ico'];

const sanitizeExtension = (originalname) => {
  const ext = path.extname(originalname || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return ALLOWED_EXTENSIONS.includes(ext) ? `.${ext}` : '.png';
};

/**
 * Lưu file vào public/uploads và trả về đường dẫn tương đối /uploads/<filename>
 * @param {Buffer} fileBuffer - Buffer của file
 * @param {string} originalname - Tên file gốc (chỉ dùng để lấy extension an toàn)
 * @returns {Promise<string>} - Relative path /uploads/filename
 */
const saveLocally = async (fileBuffer, originalname) => {
  const filename = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${sanitizeExtension(originalname)}`;
  await fsp.writeFile(path.join(LOCAL_UPLOAD_DIR, filename), fileBuffer);
  console.warn(`[Image] Saved file locally: /uploads/${filename}`);
  return `/uploads/${filename}`;
};

/**
 * Upload ảnh: thử ImgBB (Base64), tự động fallback về lưu local
 * khi IMGBB_API_KEY thiếu hoặc request ImgBB thất bại.
 * @param {Buffer} fileBuffer - Buffer của file
 * @param {string} originalname - Tên file gốc
 * @returns {Promise<string>} - URL ảnh trên Imgbb hoặc /uploads/filename
 */
const uploadImage = async (fileBuffer, originalname) => {
  if (!env.imgbbApiKey) {
    console.warn('[Image] IMGBB_API_KEY is not configured — falling back to local storage');
    return saveLocally(fileBuffer, originalname);
  }

  try {
    // ImgBB API expects the image as base64-encoded data in the "image" field
    const base64Image = fileBuffer.toString('base64');

    const form = new FormData();
    form.append('image', base64Image);

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${env.imgbbApiKey}`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(30000)
    });

    const rawBody = await response.text();
    let data = null;
    try {
      data = JSON.parse(rawBody);
    } catch {
      data = null;
    }

    if (!response.ok || !data?.success || !data?.data?.url) {
      console.error(`[ImgBB] Upload failed — HTTP ${response.status} ${response.statusText}`);
      console.error(`[ImgBB] API error response: ${rawBody}`);
      return saveLocally(fileBuffer, originalname);
    }

    return data.data.url;
  } catch (error) {
    console.error(`[ImgBB] Request error: ${error.message}`);
    return saveLocally(fileBuffer, originalname);
  }
};

module.exports = { uploadImage, saveLocally };
