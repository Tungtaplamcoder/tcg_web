const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');
const validate = require('../middlewares/validate');
const { apiLimiter } = require('../middlewares/rateLimiters');
const {
  productQuerySchema,
  categoryQuerySchema,
  cardQuerySchema
} = require('../schemas/product.schema');

// Public routes
router.get('/products', apiLimiter, validate(productQuerySchema, 'query'), productController.listProducts);
router.get('/products/:id', apiLimiter, productController.getProduct);
router.get('/products/:id/stock', apiLimiter, productController.getProductStock);

router.get('/categories', apiLimiter, validate(categoryQuerySchema, 'query'), productController.listCategories);
router.get('/sets', apiLimiter, productController.listSets);

router.get('/cards', apiLimiter, validate(cardQuerySchema, 'query'), productController.listCards);
router.get('/cards/:id', apiLimiter, productController.getCard);

module.exports = router;