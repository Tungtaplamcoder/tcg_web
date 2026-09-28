const express = require('express');
const router = express.Router();
const settingsService = require('../services/settings.service');
const { apiLimiter } = require('../middlewares/rateLimiters');

// Public site configuration (title, favicon, support chat URL) for the
// storefront — no authentication required, DB override > built-in defaults.
router.get('/settings/public', apiLimiter, async (req, res, next) => {
  try {
    const settings = await settingsService.getPublicSiteSettings();
    res.status(200).json({ success: true, data: settings, message: 'Site settings retrieved' });
  } catch (error) { next(error); }
});

module.exports = router;
