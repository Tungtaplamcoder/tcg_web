const express = require('express');
const router = express.Router();
const gachaController = require('../controllers/user/gacha.controller');
const validate = require('../middlewares/validate');
const { authenticate } = require('../middlewares/auth');
const { apiLimiter } = require('../middlewares/rateLimiters');
const { listVirtualBoxesQuerySchema } = require('../schemas/gacha.schema');

// Public: list active virtual boxes for the storefront
router.get('/virtual-boxes', apiLimiter, validate(listVirtualBoxesQuerySchema, 'query'), gachaController.listVirtualBoxes);

// Authenticated: open a virtual box (balance debit + weighted RNG + card grant, atomic)
router.post('/virtual-boxes/:id/open', apiLimiter, authenticate, gachaController.openVirtualBox);

module.exports = router;
