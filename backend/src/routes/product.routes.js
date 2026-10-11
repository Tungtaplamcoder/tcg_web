const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');
const settingsService = require('../services/settings.service');
const validate = require('../middlewares/validate');
const { catalogLimiter } = require('../middlewares/rateLimiters');
const { cacheMiddleware } = require('../utils/cache');
const {
  productQuerySchema,
  productFacetQuerySchema,
  categoryQuerySchema,
  cardQuerySchema
} = require('../schemas/product.schema');

// Public routes with in-memory caching (30-60s TTL) and relaxed rate limiting (1000 req/15min)
router.get('/products', catalogLimiter, cacheMiddleware(60), validate(productQuerySchema, 'query'), productController.listProducts);
// MUST stay above /products/:id — "facets" would otherwise be treated as an :id
router.get('/products/facets', catalogLimiter, cacheMiddleware(60), validate(productFacetQuerySchema, 'query'), productController.getProductFacets);
router.get('/products/:id', catalogLimiter, cacheMiddleware(30), productController.getProduct);
router.get('/products/:id/stock', catalogLimiter, cacheMiddleware(15), productController.getProductStock);

router.get('/categories', catalogLimiter, cacheMiddleware(60), validate(categoryQuerySchema, 'query'), productController.listCategories);
router.get('/sets', catalogLimiter, cacheMiddleware(60), productController.listSets);
// Dynamic rarity options ("Độ hiếm") — active only, feeds the admin product
// modal's creatable select.
router.get('/rarities', catalogLimiter, cacheMiddleware(60), productController.listRarities);
// Dynamic sealed-product categories ("Danh mục Sealed Product") — active only,
// feeds the admin product modal's "Loại sản phẩm niêm phong" dropdown.
router.get('/sealed-categories', catalogLimiter, cacheMiddleware(60), productController.listSealedCategories);
// Dynamic product languages ("Ngôn ngữ") — active only, feeds the admin
// product modal's "Ngôn ngữ (Language)" dropdown and the inventory filter.
router.get('/languages', catalogLimiter, cacheMiddleware(60), productController.listLanguages);

router.get('/cards', catalogLimiter, cacheMiddleware(60), validate(cardQuerySchema, 'query'), productController.listCards);
router.get('/cards/:id', catalogLimiter, cacheMiddleware(30), productController.getCard);

// Public shop info (name, logo, support contact) for the storefront footer
router.get('/shop-info', catalogLimiter, cacheMiddleware(60), async (req, res, next) => {
  try {
    const shop = await settingsService.getShopSettings();
    res.status(200).json({ success: true, data: shop, message: 'Shop info retrieved' });
  } catch (error) { next(error); }
});

// Public effective shipping fee (VND) for cart/checkout summary — same
// dynamic value the backend applies server-side when creating an order.
router.get('/shipping-fee', catalogLimiter, cacheMiddleware(60), async (req, res, next) => {
  try {
    const defaultShippingFee = await settingsService.getEffectiveShippingFee();
    res.status(200).json({ success: true, data: { defaultShippingFee }, message: 'Shipping fee retrieved' });
  } catch (error) { next(error); }
});

module.exports = router;