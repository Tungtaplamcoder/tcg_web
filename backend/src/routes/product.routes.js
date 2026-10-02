const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');
const settingsService = require('../services/settings.service');
const validate = require('../middlewares/validate');
const { apiLimiter } = require('../middlewares/rateLimiters');
const {
  productQuerySchema,
  productFacetQuerySchema,
  categoryQuerySchema,
  cardQuerySchema
} = require('../schemas/product.schema');

// Public routes
router.get('/products', apiLimiter, validate(productQuerySchema, 'query'), productController.listProducts);
// MUST stay above /products/:id — "facets" would otherwise be treated as an :id
router.get('/products/facets', apiLimiter, validate(productFacetQuerySchema, 'query'), productController.getProductFacets);
router.get('/products/:id', apiLimiter, productController.getProduct);
router.get('/products/:id/stock', apiLimiter, productController.getProductStock);

router.get('/categories', apiLimiter, validate(categoryQuerySchema, 'query'), productController.listCategories);
router.get('/sets', apiLimiter, productController.listSets);
// Dynamic rarity options ("Độ hiếm") — active only, feeds the admin product
// modal's creatable select.
router.get('/rarities', apiLimiter, productController.listRarities);

router.get('/cards', apiLimiter, validate(cardQuerySchema, 'query'), productController.listCards);
router.get('/cards/:id', apiLimiter, productController.getCard);

// Public shop info (name, logo, support contact) for the storefront footer
router.get('/shop-info', apiLimiter, async (req, res, next) => {
  try {
    const shop = await settingsService.getShopSettings();
    res.status(200).json({ success: true, data: shop, message: 'Shop info retrieved' });
  } catch (error) { next(error); }
});

// Public effective shipping fee (VND) for cart/checkout summary — same
// dynamic value the backend applies server-side when creating an order.
router.get('/shipping-fee', apiLimiter, async (req, res, next) => {
  try {
    const defaultShippingFee = await settingsService.getEffectiveShippingFee();
    res.status(200).json({ success: true, data: { defaultShippingFee }, message: 'Shipping fee retrieved' });
  } catch (error) { next(error); }
});

module.exports = router;