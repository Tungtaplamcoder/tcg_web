const env = require('../config/env');
const { AppError } = require('../utils/errors');

/**
 * Upload ảnh lên Imgbb
 * @param {Buffer} fileBuffer - Buffer của file
 * @param {string} originalname - Tên file gốc
 * @returns {Promise<string>} - URL ảnh trên Imgbb
 */
const uploadToImgbb = async (fileBuffer, originalname) => {
  if (!env.imgbbApiKey) {
    throw new AppError('Imgbb API key is not configured', 500, 'IMAGE_UPLOAD_CONFIG_ERROR');
  }

  const form = new FormData();
  form.append('image', new Blob([fileBuffer], { type: 'application/octet-stream' }), originalname);

  const response = await fetch(`https://api.imgbb.com/1/upload?key=${env.imgbbApiKey}`, {
    method: 'POST',
    body: form,
  });

  const data = await response.json();

  if (!data.success) {
    throw new AppError('Failed to upload image to Imgbb', 400, 'IMAGE_UPLOAD_FAILED');
  }

  return data.data.url;
};

module.exports = { uploadToImgbb };